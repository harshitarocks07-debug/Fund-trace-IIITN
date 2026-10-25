import os
import re
import uuid
import hashlib
from typing import Optional

from fastapi import UploadFile, HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.receipt import Receipt
from app.models.expense import Expense
from app.models.project import Project
from app.models.ngo import NGO
from app.models.user import User, UserRole


# -------------------------------------------------------------------
# PRIVACY / OWNERSHIP HELPERS
# -------------------------------------------------------------------

def _role_value(user: User) -> str:
    """Return a normalized role value."""
    role = getattr(user, "role", None)
    return str(getattr(role, "value", role))


def _same_id(first, second) -> bool:
    """Compare database IDs without assuming whether they are strings or integers."""
    return first is not None and second is not None and str(first) == str(second)


def _normalize_text(value) -> str:
    """Normalize organization names for an exact, case-insensitive comparison."""
    if value is None:
        return ""
    return " ".join(str(value).strip().casefold().split())


def resolve_user_ngo_id(db: Session, current_user: User):
    """
    Determine the NGO associated with an NGO administrator.

    Prefer an explicit user.ngo_id relationship. If one is unavailable,
    resolve the user's organization name against known NGO name fields.

    Fail closed if the association cannot be established.
    """
    direct_ngo_id = getattr(current_user, "ngo_id", None)

    if direct_ngo_id is not None:
        ngo_exists = (
            db.query(NGO)
            .filter(NGO.id == direct_ngo_id)
            .first()
        )
        if ngo_exists:
            return direct_ngo_id

    organization = _normalize_text(
        getattr(current_user, "organization", None)
    )

    if not organization:
        return None

    name_fields = (
        "name",
        "ngo_name",
        "organization_name",
        "legal_name",
    )

    for ngo in db.query(NGO).all():
        for field in name_fields:
            ngo_name = _normalize_text(getattr(ngo, field, None))

            if ngo_name and ngo_name == organization:
                return ngo.id

    return None


def get_expense_ngo_id(db: Session, expense: Expense):
    """
    Resolve the owning NGO for an expense.

    Prefer Expense.ngo_id. If it is not populated, try the associated
    project's ngo_id. Return None if ownership cannot be established.
    """
    expense_ngo_id = getattr(expense, "ngo_id", None)

    if expense_ngo_id is not None:
        return expense_ngo_id

    project_id = getattr(expense, "project_id", None)

    if project_id is not None:
        project = (
            db.query(Project)
            .filter(Project.id == project_id)
            .first()
        )

        if project:
            return getattr(project, "ngo_id", None)

    return None


def require_expense_access(
    db: Session,
    expense_id: str,
    current_user: User,
) -> Expense:
    """
    Verify that the current user may submit evidence for this expense.

    Auditors retain cross-NGO access. NGO administrators must own the
    expense's NGO. Use a 404 for an inaccessible expense to avoid
    revealing whether another organization's record exists.
    """
    if not isinstance(current_user, User):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication is required.",
        )

    role = _role_value(current_user)

    if role == UserRole.AUDITOR.value:
        expense = (
            db.query(Expense)
            .filter(Expense.id == expense_id)
            .first()
        )

        if not expense:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Expense not found.",
            )

        return expense

    if role != UserRole.NGO_ADMIN.value:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized to access this expense.",
        )

    expense = (
        db.query(Expense)
        .filter(Expense.id == expense_id)
        .first()
    )

    if not expense:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Expense not found.",
        )

    user_ngo_id = resolve_user_ngo_id(db, current_user)
    expense_ngo_id = get_expense_ngo_id(db, expense)

    if user_ngo_id is None or expense_ngo_id is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="The NGO ownership of this expense could not be verified.",
        )

    if not _same_id(user_ngo_id, expense_ngo_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Expense not found.",
        )

    return expense


def authorize_receipt_access(
    db: Session,
    receipt: Receipt,
    current_user: User,
) -> None:
    """
    Enforce receipt privacy.

    Auditors can review receipts across organizations.
    NGO administrators can access receipts belonging to their NGO.
    Unlinked receipts are accessible only to their original uploader.
    Donors and unauthenticated users cannot access raw receipts.
    """
    if not isinstance(current_user, User):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication is required.",
        )

    role = _role_value(current_user)

    if role == UserRole.AUDITOR.value:
        return

    if role != UserRole.NGO_ADMIN.value:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access forbidden: Access to private receipt evidence is forbidden.",
        )

    # Standalone receipts: only the uploader or an auditor may access them.
    if not receipt.expense_id:
        if _same_id(receipt.uploaded_by_id, current_user.id):
            return

        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Receipt not found.",
        )

    expense = (
        db.query(Expense)
        .filter(Expense.id == receipt.expense_id)
        .first()
    )

    if not expense:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Receipt not found.",
        )

    user_ngo_id = resolve_user_ngo_id(db, current_user)
    expense_ngo_id = get_expense_ngo_id(db, expense)

    if user_ngo_id is None or expense_ngo_id is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="The NGO ownership of this receipt could not be verified.",
        )

    if not _same_id(user_ngo_id, expense_ngo_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Receipt not found.",
        )


def _validate_stored_receipt_path(receipt: Receipt) -> str:
    """
    Ensure the stored path stays inside the configured private receipt directory.
    """
    storage_root = os.path.realpath(
        os.path.abspath(settings.RECEIPTS_DIR)
    )
    storage_path = os.path.realpath(receipt.storage_path)

    try:
        common_path = os.path.commonpath(
            [storage_root, storage_path]
        )
    except ValueError:
        common_path = ""

    if common_path != storage_root:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="The receipt storage path is invalid.",
        )

    if not os.path.isfile(storage_path):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Receipt file is unavailable.",
        )

    return storage_path


# -------------------------------------------------------------------
# FILE HANDLING
# -------------------------------------------------------------------

def sanitize_filename(filename: str) -> str:
    """Remove path components and unsafe characters from a filename."""
    clean = filename.replace("\\", "_").replace("/", "_")
    clean = os.path.basename(clean)
    clean = re.sub(r'[<>:"/\\|?*\x00-\x1f]', "", clean)
    clean = clean.strip(" ._")

    return clean or "receipt_document"


def validate_magic_bytes(header: bytes) -> Optional[str]:
    """Identify allowed file formats from their signatures."""
    if header.startswith(b"%PDF"):
        return "application/pdf"

    if header.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"

    if header.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"

    if len(header) >= 12 and header[:4] == b"RIFF" and header[8:12] == b"WEBP":
        return "image/webp"

    return None


def validate_file(
    filename: str,
    header_bytes: bytes,
    declared_content_type: Optional[str] = None,
) -> str:
    """
    Validate file extension and signature.
    Return the detected MIME type rather than trusting the browser-provided type.
    """
    ext = os.path.splitext(filename)[1].lower()
    allowed_extensions = {
        extension.lower()
        for extension in settings.ALLOWED_RECEIPT_EXTENSIONS
    }

    if ext not in allowed_extensions:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"File extension '{ext}' is not allowed. "
                f"Allowed extensions: {', '.join(sorted(allowed_extensions))}"
            ),
        )

    detected_mime = validate_magic_bytes(header_bytes)

    if not detected_mime:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The uploaded file signature is not an allowed receipt format. File signature does not match expected extension.",
        )

    compatible_extensions = {
        "application/pdf": {".pdf"},
        "image/jpeg": {".jpg", ".jpeg"},
        "image/png": {".png"},
        "image/webp": {".webp"},
    }

    if ext not in compatible_extensions.get(detected_mime, set()):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The file extension does not match the file contents.",
        )

    return detected_mime


def save_uploaded_receipt(
    file: UploadFile,
    db: Session,
    uploaded_by: User,
    expense_id: Optional[str] = None,
) -> Receipt:
    """
    Validate, hash and privately store a receipt.

    If expense_id is provided, verify that the caller is permitted to
    attach evidence to that expense before saving the file.
    """
    if not isinstance(uploaded_by, User):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication is required.",
        )

    # Check expense ownership before accepting or storing its receipt.
    if expense_id:
        require_expense_access(db, expense_id, uploaded_by)

    if not file.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file must have a filename.",
        )

    header_chunk = file.file.read(4096)

    if not header_chunk:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The uploaded receipt is empty.",
        )

    clean_original = sanitize_filename(file.filename)

    canonical_mime = validate_file(
        filename=clean_original,
        header_bytes=header_chunk,
        declared_content_type=file.content_type,
    )

    receipt_dir = os.path.realpath(
        os.path.abspath(settings.RECEIPTS_DIR)
    )
    os.makedirs(receipt_dir, exist_ok=True)

    file_ext = os.path.splitext(clean_original)[1].lower()
    hasher = hashlib.sha256()
    hasher.update(header_chunk)
    total_size = len(header_chunk)

    max_size = settings.MAX_RECEIPT_SIZE_BYTES

    if total_size > max_size:
        raise HTTPException(
            status_code=status.HTTP_413_CONTENT_TOO_LARGE,
            detail="The uploaded receipt exceeds maximum allowed size (permitted file size limit).",
        )

    temp_filename = f"tmp_{uuid.uuid4().hex}{file_ext}"
    temp_path = os.path.join(receipt_dir, temp_filename)

    final_path = None

    try:
        with open(temp_path, "wb") as output_file:
            output_file.write(header_chunk)

            while True:
                chunk = file.file.read(64 * 1024)

                if not chunk:
                    break

                total_size += len(chunk)

                if total_size > max_size:
                    raise HTTPException(
                        status_code=status.HTTP_413_CONTENT_TOO_LARGE,
                        detail="The uploaded receipt exceeds maximum allowed size (permitted file size limit).",
                    )

                hasher.update(chunk)
                output_file.write(chunk)

        sha256_hash = hasher.hexdigest().lower()

        final_filename = (
            f"rcp_{sha256_hash[:16]}_{uuid.uuid4().hex[:8]}{file_ext}"
        )
        final_path = os.path.realpath(
            os.path.join(receipt_dir, final_filename)
        )

        if os.path.commonpath([receipt_dir, final_path]) != receipt_dir:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid receipt storage path.",
            )

        os.replace(temp_path, final_path)

        # Generate an ID using the current application convention.
        existing_count = db.query(Receipt).count()
        receipt_id = f"RCP-{str(existing_count + 1).zfill(3)}"

        # OCR is best-effort. An OCR failure must not expose or discard the file.
        ocr_result = None

        try:
            from app.services.ocr_service import (
                check_duplicate_file,
                check_duplicate_invoice,
                extract_receipt_data,
            )

            with open(final_path, "rb") as input_file:
                file_bytes = input_file.read()

            ocr_result = extract_receipt_data(
                file_bytes=file_bytes,
                filename=clean_original,
                mime_type=canonical_mime,
            )
            ocr_result.duplicateInvoice = check_duplicate_invoice(db, ocr_result)
            ocr_result.duplicateFile = check_duplicate_file(db, ocr_result)
        except Exception:
            ocr_result = None

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
            extracted_vendor=(
                ocr_result.vendor if ocr_result else None
            ),
            extracted_invoice_number=(
                ocr_result.invoiceNumber if ocr_result else None
            ),
            extracted_date=(
                ocr_result.date if ocr_result else None
            ),
            extracted_amount=(
                ocr_result.amount if ocr_result else None
            ),
            ocr_confidence=(
                ocr_result.confidence if ocr_result else 0.0
            ),
            ocr_status=(
                ocr_result.ocrStatus if ocr_result else "NOT_PROCESSED"
            ),
            raw_text=(
                ocr_result.rawText if ocr_result else None
            ),
            extracted_vendor_address=(
                ocr_result.vendorAddress if ocr_result else None
            ),
            extracted_gstin=ocr_result.gstin if ocr_result else None,
            extracted_description=(
                ocr_result.description if ocr_result else None
            ),
            extracted_quantity=ocr_result.quantity if ocr_result else None,
            extracted_quantity_unit=(
                ocr_result.quantityUnit if ocr_result else None
            ),
            extracted_unit_price=ocr_result.unitPrice if ocr_result else None,
            extracted_subtotal=ocr_result.subtotal if ocr_result else None,
            extracted_tax_amount=ocr_result.taxAmount if ocr_result else None,
            extracted_currency=ocr_result.currency if ocr_result else None,
            extracted_payment_status=(
                ocr_result.paymentStatus if ocr_result else None
            ),
            extracted_payment_reference=(
                ocr_result.paymentReference if ocr_result else None
            ),
            extracted_due_date=ocr_result.dueDate if ocr_result else None,
            arithmetic_consistent=(
                ocr_result.arithmeticConsistent if ocr_result else None
            ),
            duplicate_invoice=(
                ocr_result.duplicateInvoice if ocr_result else False
            ),
            duplicate_file=(
                ocr_result.duplicateFile if ocr_result else False
            ),
        )

        db.add(receipt)

        # Update linked expense fields when the expense exists.
        if expense_id:
            expense = (
                db.query(Expense)
                .filter(Expense.id == expense_id)
                .first()
            )

            if expense:
                expense.receipt_hash = sha256_hash
                expense.receipt_name = clean_original

                if ocr_result:
                    if ocr_result.amount is not None:
                        expense.extracted_amount = ocr_result.amount

                    if ocr_result.vendor:
                        expense.extracted_vendor = ocr_result.vendor

                    if ocr_result.invoiceNumber:
                        expense.extracted_invoice_number = (
                            ocr_result.invoiceNumber
                        )

                    if ocr_result.date:
                        expense.extracted_date = ocr_result.date

        db.commit()
        db.refresh(receipt)
        return receipt

    except Exception:
        db.rollback()

        if os.path.exists(temp_path):
            os.remove(temp_path)

        # Avoid leaving an orphaned file if database persistence failed.
        if final_path and os.path.exists(final_path):
            os.remove(final_path)

        raise


# -------------------------------------------------------------------
# RECEIPT ACCESS
# -------------------------------------------------------------------

def get_receipt_by_id(
    db: Session,
    receipt_id: str,
    current_user: User,
) -> Receipt:
    """
    Retrieve receipt metadata only after confirming the caller's access.
    """
    if not isinstance(current_user, User):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication is required.",
        )

    receipt = (
        db.query(Receipt)
        .filter(Receipt.id == receipt_id)
        .first()
    )

    if not receipt:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Receipt not found.",
        )

    authorize_receipt_access(db, receipt, current_user)

    # Confirm that the saved file resolves to a valid private-storage path.
    _validate_stored_receipt_path(receipt)

    return receipt


def list_receipts_for_user(
    db: Session,
    current_user: User,
) -> list[Receipt]:
    """
    Return only receipts the current user is authorized to access.

    Auditors can inspect all receipts. NGO administrators receive their
    organization's expense-linked receipts and their own unlinked uploads.
    """
    if not isinstance(current_user, User):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication is required.",
        )

    role = _role_value(current_user)

    query = db.query(Receipt).order_by(Receipt.created_at.desc())

    if role == UserRole.AUDITOR.value:
        return query.all()

    if role != UserRole.NGO_ADMIN.value:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized to list private receipts.",
        )

    user_ngo_id = resolve_user_ngo_id(db, current_user)

    if user_ngo_id is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your NGO association could not be verified.",
        )

    accessible_receipts = []

    for receipt in query.all():
        # A receipt not attached to an expense is visible only to its uploader.
        if not receipt.expense_id:
            if _same_id(receipt.uploaded_by_id, current_user.id):
                accessible_receipts.append(receipt)
            continue

        expense = (
            db.query(Expense)
            .filter(Expense.id == receipt.expense_id)
            .first()
        )

        if not expense:
            continue

        expense_ngo_id = get_expense_ngo_id(db, expense)

        if _same_id(user_ngo_id, expense_ngo_id):
            accessible_receipts.append(receipt)

    return accessible_receipts