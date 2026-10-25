import os
import re
import uuid
import hashlib
from typing import Optional, Tuple
from fastapi import UploadFile, HTTPException, status
from sqlalchemy.orm import Session
from app.core.config import settings
from app.models.receipt import Receipt
from app.models.expense import Expense
from app.models.user import User, UserRole

def sanitize_filename(filename: str) -> str:
    """Sanitize the uploaded file's original name to avoid traversal and control characters."""
    clean = filename.replace("\\", "_").replace("/", "_")
    clean = os.path.basename(clean)
    clean = re.sub(r'[\\/*?:"<>|\x00]', "", clean)
    clean = clean.strip(" ._")
    if not clean:
        clean = "receipt_document"
    return clean

def validate_magic_bytes(header: bytes) -> Optional[str]:
    """Validate true file type based on file signature / magic bytes."""
    if header.startswith(b"%PDF"):
        return "application/pdf"
    if header.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if header.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if len(header) >= 12 and header[:4] == b"RIFF" and header[8:12] == b"WEBP":
        return "image/webp"
    return None

def validate_file(filename: str, header_bytes: bytes, declared_content_type: Optional[str] = None) -> str:
    """
    Validate file extension, declared MIME type, and magic bytes.
    Returns the validated canonical MIME type.
    """
    ext = os.path.splitext(filename)[1].lower()
    if ext not in settings.ALLOWED_RECEIPT_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"File extension '{ext}' is not allowed for receipts. "
                f"Allowed extensions: {', '.join(settings.ALLOWED_RECEIPT_EXTENSIONS)}"
            )
        )
    
    detected_mime = validate_magic_bytes(header_bytes)
    if not detected_mime:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "File signature does not match any allowed format (PDF, PNG, JPEG, WEBP). "
                "The file may be corrupt or masquerading as another format."
            )
        )
        
    # Check that extension matches detected magic MIME type
    if detected_mime == "application/pdf" and ext != ".pdf":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File content is PDF but extension is not .pdf."
        )
    if detected_mime in ("image/jpeg", "image/png", "image/webp"):
        img_exts = {
            "image/jpeg": [".jpg", ".jpeg"],
            "image/png": [".png"],
            "image/webp": [".webp"],
        }
        if ext not in img_exts.get(detected_mime, []):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"File content is {detected_mime} but extension '{ext}' is incompatible."
            )

    return detected_mime

def save_uploaded_receipt(
    file: UploadFile,
    db: Session,
    uploaded_by: User,
    expense_id: Optional[str] = None
) -> Receipt:
    """
    Securely stream, validate, hash, and persist an uploaded receipt file.
    Enforces maximum size limit and stores in private storage directory.
    Uses underlying file stream for maximum performance and compatibility.
    """
    if not file.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file must have a valid filename."
        )

    # 1. Read first chunk for magic bytes validation
    header_chunk = file.file.read(4096)
    if not header_chunk:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file is empty (0 bytes). Valid receipt evidence is required."
        )

    canonical_mime = validate_file(
        filename=file.filename,
        header_bytes=header_chunk,
        declared_content_type=file.content_type
    )

    # 2. Prepare destination path
    os.makedirs(settings.RECEIPTS_DIR, exist_ok=True)
    clean_original = sanitize_filename(file.filename)
    file_ext = os.path.splitext(clean_original)[1].lower()

    hasher = hashlib.sha256()
    hasher.update(header_chunk)
    total_size = len(header_chunk)
    if total_size > settings.MAX_RECEIPT_SIZE_BYTES:
        max_mb = settings.MAX_RECEIPT_SIZE_BYTES / (1024 * 1024)
        raise HTTPException(
            status_code=status.HTTP_413_CONTENT_TOO_LARGE,
            detail=f"File exceeds maximum allowed size of {max_mb:.1f} MB."
        )

    # Temporary file path during stream
    temp_filename = f"tmp_{uuid.uuid4().hex}{file_ext}"
    temp_path = os.path.join(settings.RECEIPTS_DIR, temp_filename)

    try:
        with open(temp_path, "wb") as f_out:
            f_out.write(header_chunk)
            
            while True:
                chunk = file.file.read(64 * 1024)
                if not chunk:
                    break
                total_size += len(chunk)
                if total_size > settings.MAX_RECEIPT_SIZE_BYTES:
                    max_mb = settings.MAX_RECEIPT_SIZE_BYTES / (1024 * 1024)
                    raise HTTPException(
                        status_code=status.HTTP_413_CONTENT_TOO_LARGE,
                        detail=f"File exceeds maximum allowed size of {max_mb:.1f} MB."
                    )
                hasher.update(chunk)
                f_out.write(chunk)
    except Exception:
        if os.path.exists(temp_path):
            os.remove(temp_path)
        raise

    sha256_hash = hasher.hexdigest().lower()

    # Rename temp file to permanent content-addressed secure name
    final_filename = f"rcp_{sha256_hash[:16]}_{uuid.uuid4().hex[:8]}{file_ext}"
    final_path = os.path.join(settings.RECEIPTS_DIR, final_filename)

    # Traversal safety check
    common = os.path.commonpath([settings.RECEIPTS_DIR, os.path.abspath(final_path)])
    if common != os.path.abspath(settings.RECEIPTS_DIR):
        if os.path.exists(temp_path):
            os.remove(temp_path)
        raise HTTPException(status_code=500, detail="Storage path traversal violation.")

    if os.path.exists(final_path):
        os.remove(final_path)
    os.rename(temp_path, final_path)

    # Generate sequential receipt ID
    existing_count = db.query(Receipt).count()
    receipt_id = f"RCP-{str(existing_count + 1).zfill(3)}"

    # 4. Extract candidate OCR fields (vendor, invoice number, date, amount)
    ocr_result = None
    try:
        from app.services.ocr_service import extract_receipt_data
        with open(final_path, "rb") as f_read:
            file_bytes = f_read.read()
        ocr_result = extract_receipt_data(
            file_bytes=file_bytes,
            filename=clean_original,
            mime_type=canonical_mime,
        )
    except Exception:
        pass

    receipt = Receipt(
        id=receipt_id,
        original_filename=clean_original,
        sanitized_filename=final_filename,
        storage_path=final_path,
        file_size=total_size,
        mime_type=canonical_mime,
        sha256_hash=sha256_hash,
        expense_id=expense_id,
        uploaded_by_id=uploaded_by.id,
        extracted_vendor=ocr_result.vendor if ocr_result else None,
        extracted_invoice_number=ocr_result.invoiceNumber if ocr_result else None,
        extracted_date=ocr_result.date if ocr_result else None,
        extracted_amount=ocr_result.amount if ocr_result else None,
        ocr_confidence=ocr_result.confidence if ocr_result else 0.0,
        ocr_status=ocr_result.ocrStatus if ocr_result else "NOT_PROCESSED",
        raw_text=ocr_result.rawText if ocr_result else None,
    )
    db.add(receipt)

    # If expense_id was provided and expense exists, update expense receiptHash & receiptName
    if expense_id:
        expense = db.query(Expense).filter(Expense.id == expense_id).first()
        if expense:
            expense.receipt_hash = sha256_hash
            expense.receipt_name = clean_original
            if ocr_result and ocr_result.amount is not None:
                expense.extracted_amount = ocr_result.amount
            if ocr_result and ocr_result.vendor:
                expense.extracted_vendor = ocr_result.vendor
            if ocr_result and ocr_result.invoiceNumber:
                expense.extracted_invoice_number = ocr_result.invoiceNumber
            if ocr_result and ocr_result.date:
                expense.extracted_date = ocr_result.date

    db.commit()
    db.refresh(receipt)
    return receipt

def get_receipt_by_id(db: Session, receipt_id: str, current_user: User) -> Receipt:
    """Retrieve receipt record with access control (Donors forbidden)."""
    receipt = db.query(Receipt).filter(Receipt.id == receipt_id).first()
    if not receipt:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Receipt with ID '{receipt_id}' not found."
        )

    # Permission check: Auditor and NGO Admin can view receipts
    if current_user.role not in (UserRole.NGO_ADMIN.value, UserRole.AUDITOR.value):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access forbidden: Donors cannot inspect raw vendor receipt evidence for beneficiary privacy."
        )

    if not os.path.exists(receipt.storage_path):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Receipt file is missing from secure storage repository."
        )

    return receipt
