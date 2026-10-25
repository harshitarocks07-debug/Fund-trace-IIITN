import os
import sys
import io
import zlib
import shutil
import tempfile
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import pytest
from fastapi import HTTPException, UploadFile
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
try:
    from PIL import Image, PngImagePlugin
except ImportError:
    Image = None
    PngImagePlugin = None

from app.core.config import settings
from app.db.base import Base
from app.models.user import User, UserRole
from app.models.project import Project
from app.models.expense import Expense
from app.models.receipt import Receipt
from app.schemas.expense import ExpenseCreate
from app.services.ocr_service import (
    extract_pdf_streams_text,
    extract_vendor,
    extract_invoice_number,
    extract_date,
    extract_amount,
    extract_receipt_data,
    parse_date_to_iso,
    parse_currency_amount,
)
from app.api.v1.endpoints.receipts import ocr_extract_file, upload_receipt, trigger_receipt_ocr
from app.api.v1.endpoints.expenses import submit_expense

# Set fast hash iterations for tests
settings.HASH_ITERATIONS = 1000

@pytest.fixture(scope="module")
def temp_storage():
    test_storage = tempfile.mkdtemp(prefix="fundtrace_test_ocr_")
    test_receipts = os.path.join(test_storage, "receipts")
    os.makedirs(test_receipts, exist_ok=True)
    orig_storage = settings.STORAGE_DIR
    orig_receipts = settings.RECEIPTS_DIR
    settings.STORAGE_DIR = test_storage
    settings.RECEIPTS_DIR = test_receipts
    yield test_receipts
    settings.STORAGE_DIR = orig_storage
    settings.RECEIPTS_DIR = orig_receipts
    shutil.rmtree(test_storage, ignore_errors=True)

@pytest.fixture
def db_session(temp_storage):
    test_engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=test_engine)
    TestingSession = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)
    session = TestingSession()

    # Preload sample project
    sample_proj = Project(
        id="PRJ-001",
        name="School Construction",
        ngo="Helping Hands Foundation",
        description="Classroom construction",
        budget=1000000.0,
        raised=1000000.0,
        location="Madhya Pradesh",
        category="Education",
    )
    session.add(sample_proj)
    session.commit()

    yield session
    session.close()
    Base.metadata.drop_all(bind=test_engine)

@pytest.fixture
def admin_user():
    return User(
        id=1,
        email="admin@helpinghands.org",
        full_name="Helping Hands Admin",
        role=UserRole.NGO_ADMIN.value,
        organization="Helping Hands Foundation",
        is_active=True,
    )

@pytest.fixture
def auditor_user():
    return User(
        id=2,
        email="auditor@trustcheck.org",
        full_name="Priya Nair",
        role=UserRole.AUDITOR.value,
        organization="TrustCheck",
        is_active=True,
    )

def create_sample_pdf_receipt(
    vendor: str = "ABC Building Supplies",
    invoice_no: str = "INV-2026-101",
    date_str: str = "18/10/2026",
    amount_str: str = "2,00,000.00"
) -> bytes:
    """Helper to generate a valid PDF containing text streams in FlateDecode format."""
    text_content = f"""
BT
/F1 12 Tf
72 712 Td
(TAX INVOICE) Tj
0 -20 Td
(Vendor: {vendor}) Tj
0 -20 Td
(Invoice Number: {invoice_no}) Tj
0 -20 Td
(Date: {date_str}) Tj
0 -20 Td
(Item: Cement Bags and Structural Steel) Tj
0 -20 Td
(Subtotal: INR {amount_str}) Tj
0 -20 Td
(GRAND TOTAL: INR {amount_str}) Tj
ET
""".strip().encode("latin1")

    compressed = zlib.compress(text_content)
    length = len(compressed)

    stream_header = f"<< /Length {length} /Filter /FlateDecode >>\nstream\n".encode("latin1")
    pdf = (
        b"%PDF-1.4\n"
        b"1 0 obj\n"
        b"<< /Type /Catalog /Pages 2 0 R >>\n"
        b"endobj\n"
        b"2 0 obj\n"
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>\n"
        b"endobj\n"
        b"3 0 obj\n"
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R >>\n"
        b"endobj\n"
        b"4 0 obj\n"
        + stream_header
        + compressed
        + b"\nendstream\n"
        b"endobj\n"
        b"xref\n0 5\n"
        b"0000000000 65535 f \n"
        b"trailer\n<< /Root 1 0 R /Size 5 >>\n"
        b"startxref\n500\n%%EOF"
    )
    return pdf

def create_sample_png_receipt(
    vendor: str = "Shree Cement Depot",
    invoice_no: str = "INV-2026-118",
    date_str: str = "2026-10-21",
    amount_str: str = "1,60,000.00"
) -> bytes:
    """Helper to generate a valid PNG image containing embedded receipt metadata."""
    if Image is not None and PngImagePlugin is not None:
        img = Image.new("RGB", (200, 100), color=(255, 255, 255))
        info = PngImagePlugin.PngInfo()
        info.add_text("ReceiptData", f"TAX INVOICE\nVendor: {vendor}\nInvoice No: {invoice_no}\nDate: {date_str}\nTotal Amount: INR {amount_str}")
        buf = io.BytesIO()
        img.save(buf, format="PNG", pnginfo=info)
        return buf.getvalue()
    else:
        import struct
        text_data = f"TAX INVOICE\nVendor: {vendor}\nInvoice No: {invoice_no}\nDate: {date_str}\nTotal Amount: INR {amount_str}".encode("latin1")
        chunk_data = b"ReceiptData\0" + text_data
        t_chunk = struct.pack(">I", len(chunk_data)) + b"tEXt" + chunk_data + struct.pack(">I", zlib.crc32(b"tEXt" + chunk_data) & 0xffffffff)
        ihdr = struct.pack(">IIBBBBB", 1, 1, 8, 0, 0, 0, 0)
        ihdr_chunk = struct.pack(">I", len(ihdr)) + b"IHDR" + ihdr + struct.pack(">I", zlib.crc32(b"IHDR" + ihdr) & 0xffffffff)
        comp = zlib.compress(b"\x00\xff")
        idat = struct.pack(">I", len(comp)) + b"IDAT" + comp + struct.pack(">I", zlib.crc32(b"IDAT" + comp) & 0xffffffff)
        iend = struct.pack(">I", 0) + b"IEND" + struct.pack(">I", zlib.crc32(b"IEND") & 0xffffffff)
        return b"\x89PNG\r\n\x1a\n" + ihdr_chunk + t_chunk + idat + iend

# ================= Unit Tests for OCR Engine =================

def test_extract_pdf_streams_text():
    pdf_bytes = create_sample_pdf_receipt(
        vendor="ABC Building Supplies",
        invoice_no="INV-2026-101",
        date_str="18/10/2026",
        amount_str="2,00,000.00"
    )
    text = extract_pdf_streams_text(pdf_bytes)
    assert "ABC Building Supplies" in text
    assert "INV-2026-101" in text
    assert "18/10/2026" in text
    assert "2,00,000.00" in text

def test_extract_vendor_heuristics():
    text = (
        "TAX INVOICE\n"
        "Shree Cement Depot\n"
        "Railway Road, Katni\n"
        "GSTIN: 23AAAAA1234A1Z5\n"
        "Invoice No: INV-118\n"
    )
    vendor = extract_vendor(text)
    assert vendor == "Shree Cement Depot"

def test_extract_invoice_number_variants():
    assert extract_invoice_number("Invoice No: INV-2026-101\nDate: 2026-10-18") == "INV-2026-101"
    assert extract_invoice_number("Bill Number: #9901") == "9901"
    assert extract_invoice_number("Receipt No. RCP-4412") == "RCP-4412"
    assert extract_invoice_number("INV-2026-880") == "INV-2026-880"
    assert extract_invoice_number("TAX INVOICE / CASH MEMO\nCustomer: Helping Hands") is None

def test_extract_date_normalization():
    assert parse_date_to_iso("18/10/2026") == "2026-10-18"
    assert parse_date_to_iso("18-10-2026") == "2026-10-18"
    assert parse_date_to_iso("2026-10-18") == "2026-10-18"
    assert parse_date_to_iso("18 Oct 2026") == "2026-10-18"
    assert extract_date("TAX INVOICE\nDate: 18/10/2026\nTotal: 1000") == "2026-10-18"

def test_extract_amount_comma_handling():
    assert parse_currency_amount("2,00,000.00") == 200000.0
    assert parse_currency_amount("1,60,000") == 160000.0
    assert parse_currency_amount("45000.50") == 45000.50

    text = """
    Subtotal: Rs. 1,50,000.00
    CGST: Rs. 25,000.00
    SGST: Rs. 25,000.00
    GRAND TOTAL: Rs. 2,00,000.00
    """
    assert extract_amount(text) == 200000.0

def test_extract_receipt_data_complete():
    pdf_bytes = create_sample_pdf_receipt(
        vendor="ABC Building Supplies",
        invoice_no="INV-2026-101",
        date_str="18/10/2026",
        amount_str="2,00,000.00"
    )
    result = extract_receipt_data(pdf_bytes, "invoice.pdf", "application/pdf")
    assert result.vendor == "ABC Building Supplies"
    assert result.invoiceNumber == "INV-2026-101"
    assert result.date == "2026-10-18"
    assert result.amount == 200000.0
    assert result.confidence == 1.0
    assert result.ocrStatus == "COMPLETED"

def test_extract_png_metadata_receipt():
    png_bytes = create_sample_png_receipt(
        vendor="Shree Cement Depot",
        invoice_no="INV-2026-118",
        date_str="2026-10-21",
        amount_str="1,60,000.00"
    )
    result = extract_receipt_data(png_bytes, "receipt.png", "image/png")
    assert result.vendor == "Shree Cement Depot"
    assert result.invoiceNumber == "INV-2026-118"
    assert result.date == "2026-10-21"
    assert result.amount == 160000.0
    assert result.confidence == 1.0

# ================= Integration Tests for Endpoints =================

def test_direct_ocr_extract_endpoint(admin_user):
    pdf_bytes = create_sample_pdf_receipt(
        vendor="Apex Medical Corp",
        invoice_no="INV-2026-550",
        date_str="15/10/2026",
        amount_str="82,500.00"
    )
    upload_file = UploadFile(
        file=io.BytesIO(pdf_bytes),
        filename="medical_invoice.pdf",
        headers={"content-type": "application/pdf"}
    )

    result = ocr_extract_file(file=upload_file, current_user=admin_user)
    assert result.vendor == "Apex Medical Corp"
    assert result.invoiceNumber == "INV-2026-550"
    assert result.date == "2026-10-15"
    assert result.amount == 82500.0
    assert result.confidence == 1.0

def test_upload_receipt_auto_runs_ocr(db_session, admin_user):
    pdf_bytes = create_sample_pdf_receipt(
        vendor="ABC Building Supplies",
        invoice_no="INV-2026-101",
        date_str="18/10/2026",
        amount_str="2,00,000.00"
    )
    upload_file = UploadFile(
        file=io.BytesIO(pdf_bytes),
        filename="invoice_abc.pdf",
        headers={"content-type": "application/pdf"}
    )

    receipt_out = upload_receipt(
        file=upload_file,
        expense_id=None,
        db=db_session,
        current_user=admin_user,
    )

    assert receipt_out.extracted_vendor == "ABC Building Supplies"
    assert receipt_out.extracted_invoice_number == "INV-2026-101"
    assert receipt_out.extracted_date == "2026-10-18"
    assert receipt_out.extracted_amount == 200000.0
    assert receipt_out.ocr_confidence == 1.0
    assert receipt_out.ocr_status == "COMPLETED"

def test_trigger_ocr_on_stored_receipt(db_session, admin_user, auditor_user):
    pdf_bytes = create_sample_pdf_receipt(
        vendor="Metro Logistics Services",
        invoice_no="INV-2026-777",
        date_str="22/10/2026",
        amount_str="45,000.00"
    )
    upload_file = UploadFile(
        file=io.BytesIO(pdf_bytes),
        filename="logistics.pdf",
        headers={"content-type": "application/pdf"}
    )
    receipt_out = upload_receipt(
        file=upload_file,
        expense_id=None,
        db=db_session,
        current_user=admin_user,
    )

    ocr_result = trigger_receipt_ocr(
        receipt_id=receipt_out.id,
        db=db_session,
        current_user=auditor_user,
    )
    assert ocr_result.vendor == "Metro Logistics Services"
    assert ocr_result.invoiceNumber == "INV-2026-777"
    assert ocr_result.amount == 45000.0

def test_expense_submission_with_ocr_crosscheck_risk_scoring(db_session, admin_user):
    # Case 1: All OCR fields match perfectly -> low risk score
    payload_matching = ExpenseCreate(
        projectId="PRJ-001",
        vendor="ABC Building Supplies",
        category="Construction",
        invoiceNumber="INV-2026-101",
        claimedAmount=200000.0,
        receiptName="invoice.pdf",
        receiptHash="abc123hash" * 5 + "1234",
        extractedAmount=200000.0,
        extractedVendor="ABC Building Supplies",
        extractedInvoiceNumber="INV-2026-101",
        extractedDate="2026-10-18",
    )
    exp1 = submit_expense(
        expense_in=payload_matching,
        db=db_session,
        current_user=admin_user,
    )
    assert exp1.riskScore == 0

    # Case 2: Vendor mismatch, invoice mismatch, amount mismatch -> raises review signals
    payload_mismatch = ExpenseCreate(
        projectId="PRJ-001",
        vendor="XYZ Hardware Store",
        category="Construction",
        invoiceNumber="INV-9999",
        claimedAmount=250000.0,
        receiptName="invoice.pdf",
        receiptHash="def456hash" * 5 + "5678",
        extractedAmount=200000.0,  # ₹50,000 difference
        extractedVendor="ABC Building Supplies",  # Vendor mismatch
        extractedInvoiceNumber="INV-2026-101",  # Invoice mismatch
        extractedDate="2026-10-18",
    )
    exp2 = submit_expense(
        expense_in=payload_mismatch,
        db=db_session,
        current_user=admin_user,
    )
    assert exp2.riskScore >= 65
    assert any("Claimed amount differs" in r for r in exp2.riskReasons)
    assert any("Claimed vendor" in r for r in exp2.riskReasons)
    assert any("Claimed invoice number" in r for r in exp2.riskReasons)

