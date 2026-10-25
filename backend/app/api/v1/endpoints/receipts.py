import os
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.models.user import User, UserRole
from app.models.receipt import Receipt
from app.models.expense import Expense
from app.schemas.receipt import ReceiptOut, ReceiptVerifyRequest, ReceiptVerifyResponse, ReceiptOCRResult
from app.core.permissions import require_ngo_admin_or_auditor, require_ngo_admin
from app.services.receipt_service import save_uploaded_receipt, get_receipt_by_id, validate_file
from app.services.ocr_service import extract_receipt_data, process_receipt_ocr

router = APIRouter()

@router.post("/upload", response_model=ReceiptOut, status_code=status.HTTP_201_CREATED)
def upload_receipt(
    file: UploadFile = File(..., description="Receipt document or image (PDF, PNG, JPG, WEBP; max 10MB)"),
    expense_id: Optional[str] = Form(None, description="Optional ID of associated expense claim"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_ngo_admin_or_auditor),
):
    """
    Accept, validate, compute SHA-256 fingerprint, run OCR extraction, and securely store receipt files.
    Enforces format, signature magic bytes, and size restrictions.
    """
    receipt = save_uploaded_receipt(
        file=file,
        db=db,
        uploaded_by=current_user,
        expense_id=expense_id,
    )
    return receipt

@router.post("/ocr-extract", response_model=ReceiptOCRResult)
def ocr_extract_file(
    file: UploadFile = File(..., description="Receipt document or image (PDF, PNG, JPG, WEBP) to analyze"),
    current_user: User = Depends(require_ngo_admin_or_auditor),
):
    """
    Directly run OCR receipt extraction on an uploaded file without requiring prior storage.
    Extracts candidate vendor, invoice number, date, and amount for live form pre-fill and preview.
    """
    if not file.filename:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Uploaded file must have a filename.")

    header_bytes = file.file.read(4096)
    if not header_bytes:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Uploaded file is empty.")

    canonical_mime = validate_file(
        filename=file.filename,
        header_bytes=header_bytes,
        declared_content_type=file.content_type,
    )

    remaining_bytes = file.file.read()
    full_bytes = header_bytes + remaining_bytes

    ocr_result = extract_receipt_data(
        file_bytes=full_bytes,
        filename=file.filename,
        mime_type=canonical_mime,
    )
    return ocr_result

@router.post("/{receipt_id}/ocr", response_model=ReceiptOCRResult)
def trigger_receipt_ocr(
    receipt_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_ngo_admin_or_auditor),
):
    """
    Run or re-run OCR extraction on an already stored receipt in the private repository.
    Updates the database record and returns the extracted fields.
    """
    receipt = get_receipt_by_id(db, receipt_id, current_user)
    ocr_result = process_receipt_ocr(db, receipt)
    return ocr_result

@router.get("", response_model=List[ReceiptOut])
def list_receipts(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_ngo_admin_or_auditor),
):
    """List all stored receipts. Accessible to NGO Admins and Independent Auditors."""
    receipts = db.query(Receipt).order_by(Receipt.created_at.desc()).all()
    return receipts

@router.get("/{receipt_id}", response_model=ReceiptOut)
def get_receipt_metadata(
    receipt_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_ngo_admin_or_auditor),
):
    """Get metadata and OCR results for a specific receipt file."""
    receipt = get_receipt_by_id(db, receipt_id, current_user)
    return receipt

@router.get("/{receipt_id}/download")
def download_receipt_file(
    receipt_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_ngo_admin_or_auditor),
):
    """
    Securely download or preview an original stored receipt file.
    Only authorized NGO Admins and Auditors have access.
    """
    receipt = get_receipt_by_id(db, receipt_id, current_user)
    
    return FileResponse(
        path=receipt.storage_path,
        media_type=receipt.mime_type,
        filename=receipt.original_filename,
        headers={
            "Content-Disposition": f'inline; filename="{receipt.original_filename}"',
            "X-Content-Type-Options": "nosniff",
        }
    )

@router.post("/verify", response_model=ReceiptVerifyResponse)
def verify_receipt_hash(
    req: ReceiptVerifyRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_ngo_admin_or_auditor),
):
    """
    Verify a receipt SHA-256 fingerprint against all stored receipts and expense claims.
    Flags exact duplicate matches to assist auditors and prevent double-claim fraud.
    """
    clean_hash = req.receiptHash.strip().lower()
    matching_receipts = [
        r for r in db.query(Receipt).filter(Receipt.sha256_hash == clean_hash).all()
    ]
    matching_expenses = [
        e.id for e in db.query(Expense).filter(Expense.receipt_hash == clean_hash).all()
    ]

    is_duplicate = bool(matching_receipts or matching_expenses)
    ocr_result = None

    if is_duplicate:
        matches = []
        if matching_receipts:
            matches.append(f"receipt(s): {', '.join(r.id for r in matching_receipts)}")
            # If the matching receipt has OCR info, include it
            r_first = matching_receipts[0]
            if r_first.extracted_amount or r_first.extracted_vendor:
                ocr_result = ReceiptOCRResult(
                    vendor=r_first.extracted_vendor,
                    invoiceNumber=r_first.extracted_invoice_number,
                    date=r_first.extracted_date,
                    amount=r_first.extracted_amount,
                    confidence=r_first.ocr_confidence or 0.0,
                    ocrStatus=r_first.ocr_status or "COMPLETED",
                    rawText=r_first.raw_text,
                )
        if matching_expenses:
            matches.append(f"expense(s): {', '.join(matching_expenses)}")
        message = f"Duplicate fingerprint detected! Matches {'; '.join(matches)}."
    else:
        message = "Unique fingerprint: no matching receipt found in the system."

    return ReceiptVerifyResponse(
        receiptHash=clean_hash,
        isDuplicate=is_duplicate,
        matchingReceipts=[r.id for r in matching_receipts],
        matchingExpenses=matching_expenses,
        message=message,
        ocrResult=ocr_result,
    )
