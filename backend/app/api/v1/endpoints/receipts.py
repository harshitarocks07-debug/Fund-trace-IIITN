import os
import re
from typing import List, Optional

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    status,
    UploadFile,
    File,
    Form,
)
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.permissions import (
    require_ngo_admin_or_auditor,
)
from app.db.session import get_db
from app.models.user import User, UserRole
from app.models.receipt import Receipt
from app.models.expense import Expense
from app.schemas.receipt import (
    ReceiptOut,
    ReceiptVerifyRequest,
    ReceiptVerifyResponse,
    ReceiptOCRResult,
)
from app.services.receipt_service import (
    save_uploaded_receipt,
    get_receipt_by_id,
    validate_file,
    list_receipts_for_user,
    authorize_receipt_access,
    require_expense_access,
    resolve_user_ngo_id,
    get_expense_ngo_id,
)
from app.services.ocr_service import (
    check_duplicate_file,
    check_duplicate_invoice,
    extract_receipt_data,
    process_receipt_ocr,
)

router = APIRouter()


def _role_value(user: User) -> str:
    """Return a normalized user role."""
    role = getattr(user, "role", None)
    return str(getattr(role, "value", role))


def _read_limited_file(file: UploadFile) -> tuple[bytes, str]:
    """
    Read and validate an uploaded receipt without loading
    an arbitrarily large file into memory.
    """
    if not file.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file must have a filename.",
        )

    max_size = settings.MAX_RECEIPT_SIZE_BYTES

    header_bytes = file.file.read(4096)

    if not header_bytes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file is empty.",
        )

    if len(header_bytes) > max_size:
        raise HTTPException(
            status_code=status.HTTP_413_CONTENT_TOO_LARGE,
            detail="The uploaded file exceeds the maximum permitted size.",
        )

    canonical_mime = validate_file(
        filename=file.filename,
        header_bytes=header_bytes,
        declared_content_type=file.content_type,
    )

    # Read at most one byte beyond the limit to detect oversized files.
    remaining_bytes = file.file.read(
        max_size - len(header_bytes) + 1
    )

    full_bytes = header_bytes + remaining_bytes

    if len(full_bytes) > max_size:
        raise HTTPException(
            status_code=status.HTTP_413_CONTENT_TOO_LARGE,
            detail="The uploaded file exceeds the maximum permitted size.",
        )

    return full_bytes, canonical_mime


# -------------------------------------------------------------------
# RECEIPT UPLOAD
# -------------------------------------------------------------------

@router.post(
    "/upload",
    response_model=ReceiptOut,
    status_code=status.HTTP_201_CREATED,
)
def upload_receipt(
    file: UploadFile = File(
        ...,
        description="Receipt document or image (PDF, PNG, JPG, WEBP)",
    ),
    expense_id: Optional[str] = Form(
        None,
        description="Optional associated expense claim ID",
    ),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_ngo_admin_or_auditor),
):
    """
    Validate and store a receipt.

    If linked to an expense, verify ownership before accepting the
    document. Receipt files must remain in private storage.
    """
    if expense_id:
        require_expense_access(
            db=db,
            expense_id=expense_id,
            current_user=current_user,
        )

    return save_uploaded_receipt(
        file=file,
        db=db,
        uploaded_by=current_user,
        expense_id=expense_id,
    )


# -------------------------------------------------------------------
# OCR PREVIEW
# -------------------------------------------------------------------

@router.post("/ocr-extract", response_model=ReceiptOCRResult)
def ocr_extract_file(
    file: UploadFile = File(
        ...,
        description="Receipt document or image to analyze",
    ),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_ngo_admin_or_auditor),
):
    """
    Extract candidate invoice fields without storing the uploaded file.
    Only authorized NGO administrators and auditors can use this route.
    """
    full_bytes, canonical_mime = _read_limited_file(file)

    ocr_result = extract_receipt_data(
        file_bytes=full_bytes,
        filename=os.path.basename(file.filename or "receipt"),
        mime_type=canonical_mime,
    )
    ocr_result.duplicateInvoice = check_duplicate_invoice(db, ocr_result)
    ocr_result.duplicateFile = check_duplicate_file(db, ocr_result)
    if ocr_result.duplicateInvoice:
        ocr_result.warnings.append(
            "Invoice number and vendor match a previously submitted invoice; review for a duplicate claim."
        )
    if ocr_result.duplicateFile:
        ocr_result.warnings.append(
            "The uploaded file fingerprint matches an existing receipt or expense claim."
        )
    return ocr_result


# -------------------------------------------------------------------
# LIST RECEIPTS
# -------------------------------------------------------------------

@router.get("", response_model=List[ReceiptOut])
def list_receipts(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_ngo_admin_or_auditor),
):
    """
    Return only receipts the current user is authorized to access.

    NGO administrators see their organization's receipts.
    Auditors retain authorized cross-organization access.
    """
    return list_receipts_for_user(db, current_user)


# -------------------------------------------------------------------
# RECEIPT METADATA
# -------------------------------------------------------------------

@router.get("/{receipt_id}", response_model=ReceiptOut)
def get_receipt_metadata(
    receipt_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_ngo_admin_or_auditor),
):
    """Return receipt metadata only after checking ownership and access."""
    return get_receipt_by_id(db, receipt_id, current_user)


# -------------------------------------------------------------------
# SECURE RECEIPT DOWNLOAD
# -------------------------------------------------------------------

@router.get("/{receipt_id}/download")
def download_receipt_file(
    receipt_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_ngo_admin_or_auditor),
):
    """
    Download or preview a private receipt after authorization.
    Prevent browser caching of confidential receipt files.
    """
    receipt = get_receipt_by_id(db, receipt_id, current_user)

    # The filename is for the response header only, never a filesystem path.
    safe_name = os.path.basename(
        receipt.original_filename or "receipt"
    )
    safe_name = re.sub(r'[\r\n"\\]', "_", safe_name)

    return FileResponse(
        path=receipt.storage_path,
        media_type=receipt.mime_type,
        headers={
            "Content-Disposition": f'inline; filename="{safe_name}"',
            "Cache-Control": "private, no-store",
            "Pragma": "no-cache",
            "X-Content-Type-Options": "nosniff",
            "Cross-Origin-Resource-Policy": "same-origin",
        },
    )


# -------------------------------------------------------------------
# RE-RUN OCR ON A STORED RECEIPT
# -------------------------------------------------------------------

@router.post("/{receipt_id}/ocr", response_model=ReceiptOCRResult)
def trigger_receipt_ocr(
    receipt_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_ngo_admin_or_auditor),
):
    """Re-run OCR only after verifying access to the stored receipt."""
    receipt = get_receipt_by_id(db, receipt_id, current_user)

    return process_receipt_ocr(db, receipt)


# -------------------------------------------------------------------
# PRIVACY-AWARE HASH VERIFICATION
# -------------------------------------------------------------------

@router.post("/verify", response_model=ReceiptVerifyResponse)
def verify_receipt_hash(
    req: ReceiptVerifyRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_ngo_admin_or_auditor),
):
    """
    Check a SHA-256 fingerprint globally for duplicate evidence.

    NGO administrators receive only information about matching records
    they are authorized to access. Cross-organization matches may still
    trigger a generic duplicate warning, without exposing private IDs,
    filenames, or OCR data.
    """
    clean_hash = req.receiptHash.strip().lower()

    # A SHA-256 hexadecimal digest must contain 64 hexadecimal characters.
    if not re.fullmatch(r"[0-9a-f]{64}", clean_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A valid 64-character SHA-256 hash is required.",
        )

    # Search all records to detect cross-project duplicate evidence.
    all_matching_receipts = (
        db.query(Receipt)
        .filter(Receipt.sha256_hash == clean_hash)
        .all()
    )

    all_matching_expenses = (
        db.query(Expense)
        .filter(Expense.receipt_hash == clean_hash)
        .all()
    )

    is_duplicate = bool(
        all_matching_receipts or all_matching_expenses
    )

    auditor = (
        _role_value(current_user) == UserRole.AUDITOR.value
    )

    # Filter receipt matches to those the requester may inspect.
    visible_receipts = []

    for receipt in all_matching_receipts:
        if auditor:
            visible_receipts.append(receipt)
            continue

        try:
            authorize_receipt_access(
                db=db,
                receipt=receipt,
                current_user=current_user,
            )
            visible_receipts.append(receipt)

        except HTTPException as exc:
            if exc.status_code in (
                status.HTTP_403_FORBIDDEN,
                status.HTTP_404_NOT_FOUND,
            ):
                continue
            raise

    # Filter expense matches to the current NGO for non-auditors.
    visible_expense_ids = []

    if auditor:
        visible_expense_ids = [
            str(expense.id)
            for expense in all_matching_expenses
        ]
    else:
        user_ngo_id = resolve_user_ngo_id(
            db=db,
            current_user=current_user,
        )

        if user_ngo_id is not None:
            for expense in all_matching_expenses:
                expense_ngo_id = get_expense_ngo_id(
                    db=db,
                    expense=expense,
                )

                if (
                    expense_ngo_id is not None
                    and str(expense_ngo_id) == str(user_ngo_id)
                ):
                    visible_expense_ids.append(str(expense.id))

    visible_receipt_ids = [
        receipt.id for receipt in visible_receipts
    ]

    # Include OCR data only from a receipt the requester may view.
    ocr_result = None

    for receipt in visible_receipts:
        if (
            receipt.extracted_amount is not None
            or receipt.extracted_vendor
        ):
            ocr_result = ReceiptOCRResult(
                vendor=receipt.extracted_vendor,
                vendorAddress=receipt.extracted_vendor_address,
                gstin=receipt.extracted_gstin,
                invoiceNumber=receipt.extracted_invoice_number,
                date=receipt.extracted_date,
                description=receipt.extracted_description,
                quantity=receipt.extracted_quantity,
                quantityUnit=receipt.extracted_quantity_unit,
                unitPrice=receipt.extracted_unit_price,
                subtotal=receipt.extracted_subtotal,
                taxAmount=receipt.extracted_tax_amount,
                amount=receipt.extracted_amount,
                currency=receipt.extracted_currency,
                paymentStatus=receipt.extracted_payment_status,
                paymentReference=receipt.extracted_payment_reference,
                dueDate=receipt.extracted_due_date,
                arithmeticConsistent=receipt.arithmetic_consistent,
                duplicateInvoice=receipt.duplicate_invoice,
                duplicateFile=receipt.duplicate_file,
                originalFilename=receipt.original_filename,
                fileHash=receipt.sha256_hash,
                confidence=receipt.ocr_confidence or 0.0,
                ocrStatus=receipt.ocr_status or "COMPLETED",
                rawText=receipt.raw_text,
            )
            break

    if not is_duplicate:
        message = (
            "No matching receipt fingerprint was found."
        )
    elif visible_receipt_ids or visible_expense_ids:
        message = (
            "Duplicate fingerprint detected in records "
            "accessible to your account."
        )
    else:
        message = (
            "A matching fingerprint exists in the system. "
            "Details are restricted for privacy."
        )

    return ReceiptVerifyResponse(
        receiptHash=clean_hash,
        isDuplicate=is_duplicate,
        matchingReceipts=visible_receipt_ids,
        matchingExpenses=visible_expense_ids,
        message=message,
        ocrResult=ocr_result,
    )