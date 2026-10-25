import os
import sys
import io
import shutil
import tempfile
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import pytest
import asyncio
from fastapi import HTTPException, UploadFile
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.config import settings
from app.db.base import Base
from app.models.user import User, UserRole
from app.models.project import Project
from app.models.receipt import Receipt
from app.models.expense import Expense
from app.services.receipt_service import (
    save_uploaded_receipt,
    get_receipt_by_id,
    validate_file,
    sanitize_filename
)
from app.schemas.receipt import ReceiptVerifyRequest
from app.api.v1.endpoints.receipts import verify_receipt_hash

# Ultra-fast hashing for test
settings.HASH_ITERATIONS = 1000

@pytest.fixture(scope="module")
def test_env():
    # Use isolated temp dir for receipt storage in tests
    temp_storage = tempfile.mkdtemp(prefix="fundtrace_test_receipts_")
    settings.STORAGE_DIR = temp_storage
    settings.RECEIPTS_DIR = os.path.join(temp_storage, "receipts")
    os.makedirs(settings.RECEIPTS_DIR, exist_ok=True)

    test_engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=test_engine)
    TestingSession = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)
    session = TestingSession()

    ngo_user = User(
        id=1,
        email="ngo@test.org",
        hashed_password="dummy",
        full_name="NGO Lead",
        role=UserRole.NGO_ADMIN.value,
        organization="Test NGO",
        is_active=True,
    )
    auditor_user = User(
        id=2,
        email="auditor@test.org",
        hashed_password="dummy",
        full_name="Auditor Lead",
        role=UserRole.AUDITOR.value,
        is_active=True,
    )
    donor_user = User(
        id=3,
        email="donor@test.org",
        hashed_password="dummy",
        full_name="Donor Lead",
        role=UserRole.DONOR.value,
        is_active=True,
    )
    session.add_all([ngo_user, auditor_user, donor_user])
    session.commit()

    yield {
        "session": session,
        "ngo_user": ngo_user,
        "auditor_user": auditor_user,
        "donor_user": donor_user,
        "storage_dir": temp_storage,
    }

    session.close()
    if os.path.exists(temp_storage):
        shutil.rmtree(temp_storage)

def test_sanitize_filename():
    assert "malicious_file.pdf" in sanitize_filename("../../../malicious_file.pdf")
    assert sanitize_filename("in*voice?01.jpg") == "invoice01.jpg"
    assert sanitize_filename("...") == "receipt_document"

def test_validate_file_valid_types():
    # PDF
    assert validate_file("invoice.pdf", b"%PDF-1.5 fake content") == "application/pdf"
    # PNG
    assert validate_file("receipt.png", b"\x89PNG\r\n\x1a\nfake content") == "image/png"
    # JPEG
    assert validate_file("bill.jpeg", b"\xff\xd8\xff\xe0fake content") == "image/jpeg"
    # WEBP
    assert validate_file("scan.webp", b"RIFF\x00\x00\x00\x00WEBPfake content") == "image/webp"

def test_validate_file_disallowed_extension():
    with pytest.raises(HTTPException) as exc:
        validate_file("malicious.exe", b"%PDF-1.4 fake content")
    assert exc.value.status_code == 400
    assert "not allowed" in exc.value.detail

def test_validate_file_spoofed_magic_bytes():
    # File named .pdf but containing HTML or plaintext
    with pytest.raises(HTTPException) as exc:
        validate_file("invoice.pdf", b"<html>Hello world</html>")
    assert exc.value.status_code == 400
    assert "File signature does not match" in exc.value.detail

def test_save_valid_pdf_receipt(test_env):
    db = test_env["session"]
    ngo = test_env["ngo_user"]

    pdf_content = b"%PDF-1.4\n1 0 obj\n<< /Title (Invoice 2026-001) >>\nendobj\ntrailer\n<<>>\n%%EOF"
    upload = UploadFile(
        file=io.BytesIO(pdf_content),
        filename="cement_invoice_2026.pdf",
        headers={"content-type": "application/pdf"}
    )

    receipt = save_uploaded_receipt(upload, db, ngo)
    assert receipt.id.startswith("RCP-")
    assert receipt.original_filename == "cement_invoice_2026.pdf"
    assert receipt.mime_type == "application/pdf"
    assert receipt.file_size == len(pdf_content)
    assert len(receipt.sha256_hash) == 64
    assert os.path.exists(receipt.storage_path)

    # Verify content on disk
    with open(receipt.storage_path, "rb") as f:
        assert f.read() == pdf_content

def test_save_valid_png_receipt(test_env):
    db = test_env["session"]
    ngo = test_env["ngo_user"]

    png_content = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00"
    upload = UploadFile(
        file=io.BytesIO(png_content),
        filename="store_receipt.png",
        headers={"content-type": "image/png"}
    )

    receipt = save_uploaded_receipt(upload, db, ngo)
    assert receipt.id.startswith("RCP-")
    assert receipt.original_filename == "store_receipt.png"
    assert receipt.mime_type == "image/png"
    assert os.path.exists(receipt.storage_path)

def test_empty_file_rejected(test_env):
    db = test_env["session"]
    ngo = test_env["ngo_user"]

    upload = UploadFile(
        file=io.BytesIO(b""),
        filename="empty.pdf",
        headers={"content-type": "application/pdf"}
    )

    with pytest.raises(HTTPException) as exc:
        save_uploaded_receipt(upload, db, ngo)
    assert exc.value.status_code == 400
    assert "empty" in exc.value.detail

def test_oversized_file_rejected(test_env):
    db = test_env["session"]
    ngo = test_env["ngo_user"]

    old_limit = settings.MAX_RECEIPT_SIZE_BYTES
    try:
        # Set limit to 500 bytes for test
        settings.MAX_RECEIPT_SIZE_BYTES = 500
        large_content = b"%PDF-1.4 " + (b"A" * 1000)
        upload = UploadFile(
            file=io.BytesIO(large_content),
            filename="large_invoice.pdf",
            headers={"content-type": "application/pdf"}
        )

        with pytest.raises(HTTPException) as exc:
            save_uploaded_receipt(upload, db, ngo)
        assert exc.value.status_code == 413
        assert "exceeds maximum allowed size" in exc.value.detail
    finally:
        settings.MAX_RECEIPT_SIZE_BYTES = old_limit

def test_receipt_access_permissions(test_env):
    db = test_env["session"]
    ngo = test_env["ngo_user"]
    auditor = test_env["auditor_user"]
    donor = test_env["donor_user"]

    # 1. First receipt stored
    receipt = db.query(Receipt).first()
    assert receipt is not None

    # 2. NGO Admin can retrieve
    res_ngo = get_receipt_by_id(db, receipt.id, ngo)
    assert res_ngo.id == receipt.id

    # 3. Auditor can retrieve
    res_auditor = get_receipt_by_id(db, receipt.id, auditor)
    assert res_auditor.id == receipt.id

    # 4. Donor is forbidden from inspecting raw receipt
    with pytest.raises(HTTPException) as exc_donor:
        get_receipt_by_id(db, receipt.id, donor)
    assert exc_donor.value.status_code == 403
    assert "Access forbidden" in exc_donor.value.detail

def test_receipt_fingerprint_verification_endpoint(test_env):
    db = test_env["session"]
    auditor = test_env["auditor_user"]

    receipt = db.query(Receipt).first()
    assert receipt is not None

    # Verification of existing hash
    req_match = ReceiptVerifyRequest(receiptHash=receipt.sha256_hash)
    res_match = verify_receipt_hash(req_match, db, auditor)
    assert res_match.isDuplicate is True
    assert receipt.id in res_match.matchingReceipts

    # Verification of non-existent hash
    fake_hash = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
    req_fake = ReceiptVerifyRequest(receiptHash=fake_hash)
    res_fake = verify_receipt_hash(req_fake, db, auditor)
    assert res_fake.isDuplicate is False
    assert len(res_fake.matchingReceipts) == 0
