import os
import re
import zlib
import shutil
import subprocess
from datetime import datetime
from typing import Optional, Dict, Any, List, Tuple
from sqlalchemy.orm import Session
from app.models.receipt import Receipt
from app.schemas.receipt import ReceiptOCRResult

# Common date formats in Indian and international invoices
DATE_FORMATS = (
    "%Y-%m-%d",
    "%d/%m/%Y",
    "%d-%m-%Y",
    "%d.%m.%Y",
    "%m/%d/%Y",
    "%d %b %Y",
    "%d %B %Y",
    "%b %d, %Y",
    "%B %d, %Y",
    "%d-%b-%Y",
    "%d-%B-%Y",
)

def clean_text_line(line: str) -> str:
    """Strip whitespace and weird characters from extracted text line."""
    return re.sub(r"[^\x20-\x7E\u0900-\u097F]", " ", line).strip()

def parse_date_to_iso(raw_date_str: str) -> Optional[str]:
    """Parse various invoice date formats and normalize to ISO YYYY-MM-DD."""
    if not raw_date_str:
        return None
    cleaned = raw_date_str.strip(" .,;:-")
    for fmt in DATE_FORMATS:
        try:
            dt = datetime.strptime(cleaned, fmt)
            # Sanity check: year between 2000 and 2050
            if 2000 <= dt.year <= 2050:
                return dt.strftime("%Y-%m-%d")
        except ValueError:
            continue
    # Try regex match for YYYY-MM-DD
    iso_match = re.search(r"\b(20[2-3][0-9])[-/](0[1-9]|1[0-2])[-/](0[1-9]|[12][0-9]|3[01])\b", cleaned)
    if iso_match:
        return f"{iso_match.group(1)}-{iso_match.group(2)}-{iso_match.group(3)}"
    return None

def parse_currency_amount(val_str: str) -> Optional[float]:
    """Parse string representation of currency amount (supports Indian lakh/crore commas)."""
    if not val_str:
        return None
    cleaned = val_str.replace(",", "").replace(" ", "").strip()
    try:
        amt = float(cleaned)
        return amt if amt > 0 else None
    except ValueError:
        return None

def extract_pdf_streams_text(pdf_bytes: bytes) -> str:
    """
    Extract readable text streams from a PDF file using zlib FlateDecode and BT..ET operator parsing.
    Requires no external binaries or 3rd-party PDF packages.
    """
    extracted_lines: List[str] = []

    # 1. Look for compressed streams
    stream_blocks = re.findall(rb"stream[\r\n]+(.*?)[\r\n]+endstream", pdf_bytes, re.DOTALL)
    for raw_stream in stream_blocks:
        decompressed_data = None
        try:
            decompressed_data = zlib.decompress(raw_stream)
        except Exception:
            # Maybe not compressed or partial
            decompressed_data = raw_stream

        if not decompressed_data:
            continue

        try:
            stream_text = decompressed_data.decode("latin1", errors="ignore")
        except Exception:
            continue

        # Extract text within BT (Begin Text) ... ET (End Text) blocks
        bt_blocks = re.findall(r"BT\s*(.*?)\s*ET", stream_text, re.DOTALL)
        if not bt_blocks and ("Tj" in stream_text or "TJ" in stream_text):
            bt_blocks = [stream_text]

        for block in bt_blocks:
            # Handle Tj operators: (string) Tj
            tj_matches = re.finditer(r"\((.*?)\)\s*(?:Tj|\'|\")", block)
            for m in tj_matches:
                t = m.group(1)
                t = t.replace(r"\(", "(").replace(r"\)", ")").replace(r"\\", "\\")
                extracted_lines.append(clean_text_line(t))

            # Handle TJ operators: [(str1) num (str2)] TJ
            tj_array_matches = re.finditer(r"\[(.*?)\]\s*TJ", block)
            for m in tj_array_matches:
                inner = m.group(1)
                parts = re.findall(r"\((.*?)\)", inner)
                combined = "".join(parts).replace(r"\(", "(").replace(r"\)", ")").replace(r"\\", "\\")
                extracted_lines.append(clean_text_line(combined))

    # 2. Also search for plain literal strings outside streams if very little text found
    if len(extracted_lines) < 2:
        literal_matches = re.findall(rb"\(([\x20-\x7E]{4,100})\)", pdf_bytes)
        for lit in literal_matches:
            try:
                dec = lit.decode("latin1")
                if not dec.startswith(("/", "PDF", "Font", "Length", "Filter")):
                    extracted_lines.append(clean_text_line(dec))
            except Exception:
                pass

    return "\n".join([line for line in extracted_lines if line])

def extract_image_text_and_metadata(image_bytes: bytes, filename: str) -> str:
    """
    Extract text from image files (PNG, JPEG, WEBP) using Pillow metadata, comments,
    or Tesseract CLI if installed.
    """
    extracted_lines: List[str] = []

    # 1. Pillow inspection for embedded text metadata (PNG tEXt/iTXt, JPEG comment/EXIF)
    try:
        from PIL import Image
        import io
        img = Image.open(io.BytesIO(image_bytes))
        info = getattr(img, "info", {})

        # PNG text chunks
        for k, v in info.items():
            if isinstance(v, str) and len(v) > 3:
                extracted_lines.append(v)
            elif isinstance(v, bytes):
                try:
                    dec = v.decode("utf-8", errors="ignore").strip()
                    if len(dec) > 3:
                        extracted_lines.append(dec)
                except Exception:
                    pass

        # EXIF tags if present
        if hasattr(img, "_getexif") and callable(img._getexif):
            exif = img._getexif()
            if exif:
                for tag_id, val in exif.items():
                    if isinstance(val, str) and len(val) > 3:
                        extracted_lines.append(val)
                    elif isinstance(val, bytes):
                        try:
                            extracted_lines.append(val.decode("utf-8", errors="ignore"))
                        except Exception:
                            pass
    except Exception:
        pass

    # 1b. Pure-Python PNG text chunk scanner fallback if Pillow is absent
    if not extracted_lines and (image_bytes.startswith(b"\x89PNG") or filename.lower().endswith(".png")):
        try:
            import struct
            offset = 8
            while offset < len(image_bytes) - 8:
                chunk_len = struct.unpack(">I", image_bytes[offset:offset+4])[0]
                chunk_type = image_bytes[offset+4:offset+8]
                if chunk_type in (b"tEXt", b"iTXt", b"zTXt"):
                    chunk_data = image_bytes[offset+8:offset+8+chunk_len]
                    parts = chunk_data.split(b"\x00", 1)
                    if len(parts) > 1:
                        extracted_lines.append(parts[1].decode("utf-8", errors="ignore"))
                offset += 12 + chunk_len
        except Exception:
            pass

    # 2. If Tesseract executable is present on host system, run native OCR
    tesseract_cmd = shutil.which("tesseract")
    if not tesseract_cmd:
        # Check standard Windows paths
        win_paths = [
            r"C:\Program Files\Tesseract-OCR\tesseract.exe",
            r"C:\Program Files (x86)\Tesseract-OCR\tesseract.exe",
        ]
        for wp in win_paths:
            if os.path.exists(wp):
                tesseract_cmd = wp
                break

    if tesseract_cmd:
        try:
            import tempfile
            ext = os.path.splitext(filename)[1] or ".png"
            with tempfile.NamedTemporaryFile(suffix=ext, delete=False) as tf:
                tf.write(image_bytes)
                temp_img_path = tf.name
            try:
                proc = subprocess.run(
                    [tesseract_cmd, temp_img_path, "stdout", "--oem", "1", "-l", "eng"],
                    capture_output=True,
                    text=True,
                    timeout=10,
                )
                if proc.returncode == 0 and proc.stdout:
                    extracted_lines.append(proc.stdout)
            finally:
                if os.path.exists(temp_img_path):
                    os.remove(temp_img_path)
        except Exception:
            pass

    # 3. Search for raw printable ASCII strings embedded in the file
    printable_strings = re.findall(rb"[\x20-\x7E]{5,80}", image_bytes)
    candidate_text = []
    for s in printable_strings:
        try:
            dec = s.decode("latin1").strip()
            # Look for invoice/vendor keywords
            if any(kw in dec.lower() for kw in ("invoice", "vendor", "bill", "date", "total", "amount", "rs", "inr", "ltd")):
                candidate_text.append(dec)
        except Exception:
            pass
    if candidate_text:
        extracted_lines.extend(candidate_text)

    return "\n".join([line for line in extracted_lines if line])

def extract_vendor(text: str) -> Optional[str]:
    """Extract business / vendor / merchant name from receipt text."""
    # 1. Explicit vendor prefix
    labeled = re.search(
        r"\b(?:Vendor|Merchant|Seller|Supplier|Billed\s*By|Sold\s*By|Store|Company|From)\b[\s.:\-]+([^\n\r,]+)",
        text,
        re.IGNORECASE,
    )
    if labeled:
        cand = clean_text_line(labeled.group(1))
        if len(cand) >= 2 and not cand.lower().startswith(("tax", "invoice", "receipt", "cash")):
            return cand

    # 2. Look for top header lines
    skip_keywords = (
        "TAX INVOICE", "CASH MEMO", "RETAIL INVOICE", "INVOICE", "RECEIPT", "BILL OF SUPPLY",
        "ORIGINAL FOR RECIPIENT", "DUPLICATE FOR TRANSPORTER", "GSTIN", "PAN", "PHONE",
        "TEL", "EMAIL", "WEBSITE", "WWW.", "HTTP", "CIN:", "DATE", "INVOICE NO", "BILL NO",
        "CUSTOMER", "BILL TO", "SHIP TO", "BUYER", "TOTAL", "SUBTOTAL", "AMOUNT"
    )

    lines = [clean_text_line(line) for line in text.split("\n") if clean_text_line(line)]
    for line in lines:
        upper = line.upper()
        if any(skip in upper for skip in skip_keywords):
            continue
        if re.match(r"^[\-_=*\s#]+$", line):
            continue
        # Skip pure addresses or phone numbers
        if re.match(r"^(?:Plot|Sector|Road|Street|Near|Opp|P\.?O\.?|Pin|Zip|Ph|Mob)\b", line, re.IGNORECASE):
            continue
        if re.match(r"^[0-9\W]+$", line):
            continue
        # Clean up line
        clean = re.sub(r"[^\w\s\.\&\-\']", "", line).strip()
        if 3 <= len(clean) <= 60 and len(clean.split()) <= 8:
            return clean

    return None

def extract_invoice_number(text: str) -> Optional[str]:
    """Extract invoice / bill / receipt reference number."""
    # 1. Direct recognizable patterns like INV-2026-101, RCP-104, BILL-9021
    m_direct = re.search(r"\b((?:INV|RCP|BILL|REF)[-_/][A-Za-z0-9\-_/]+)\b", text, re.IGNORECASE)
    if m_direct:
        cand = m_direct.group(1).upper()
        # Avoid false positives like INV-TAX or BILL-TO
        if not cand.endswith(("-TAX", "-TO", "-DATE", "-AMOUNT")):
            return cand

    # 2. Labeled invoice pattern
    pattern = re.compile(
        r"\b(?:Invoice|Inv|Bill|Receipt|Reference|Ref)\b[\s.:]*(?:(?:Number|No|Num|#)[\s.:\-]*)?(?:[:#\-])?\s*([A-Za-z0-9][A-Za-z0-9\-_/]*[A-Za-z0-9]|[A-Za-z0-9]+)",
        re.IGNORECASE,
    )
    m = pattern.search(text)
    if m:
        val = m.group(1).strip(" #").upper()
        invalid_words = ("CASH", "MEMO", "TAX", "ORIGINAL", "DUPLICATE", "FOR", "DATE", "AMOUNT", "DETAILS", "OF")
        if len(val) >= 2 and val not in invalid_words:
            return val

    return None

def extract_date(text: str) -> Optional[str]:
    """Extract receipt / invoice date and convert to ISO YYYY-MM-DD."""
    # 1. Search for labeled date lines
    labeled_matches = re.findall(
        r"\b(?:Date|Dated|Invoice\s*Date|Bill\s*Date)\b[\s.:\-]*([0-9A-Za-z\s,\.\/\-]+)",
        text,
        re.IGNORECASE,
    )
    for m in labeled_matches:
        # Take the first token group representing date
        cand_str = m.strip().split("\n")[0]
        # Match date substring
        dt_sub = re.search(
            r"([0-9]{1,2}[/-][0-9]{1,2}[/-][0-9]{2,4}|[0-9]{4}[/-][0-9]{1,2}[/-][0-9]{1,2}|[0-9]{1,2}\s+[A-Za-z]{3,9}\s+[0-9]{4}|[A-Za-z]{3,9}\s+[0-9]{1,2},?\s+[0-9]{4})",
            cand_str,
        )
        if dt_sub:
            parsed = parse_date_to_iso(dt_sub.group(1))
            if parsed:
                return parsed

    # 2. General date scan across entire text
    general_matches = re.findall(
        r"\b([0-9]{1,2}[/-][0-9]{1,2}[/-][0-9]{2,4}|[0-9]{4}[/-][0-9]{1,2}[/-][0-9]{1,2}|[0-9]{1,2}\s+[A-Za-z]{3,9}\s+[0-9]{4})\b",
        text,
    )
    for gm in general_matches:
        parsed = parse_date_to_iso(gm)
        if parsed:
            return parsed

    return None

def extract_amount(text: str) -> Optional[float]:
    """Extract total receipt amount, prioritizing Grand Total and final labeled figures."""
    # Priority 1: High-confidence Grand/Total Amount labels
    p1 = re.compile(
        r"(?:Grand\s*Total|Total\s*Amount|Total\s*Payable|Net\s*Amount|Balance\s*Due)[\s.:]*(?:INR|Rs\.?|₹)?[\s]*([0-9]{1,3}(?:,[0-9]{2,3})*(?:\.[0-9]{1,2})?|[0-9]+(?:\.[0-9]{1,2})?)",
        re.IGNORECASE,
    )
    m1 = p1.findall(text)
    if m1:
        amt = parse_currency_amount(m1[-1])
        if amt:
            return amt

    # Priority 2: Simple Total
    p2 = re.compile(
        r"\bTotal\b[\s.:]*(?:INR|Rs\.?|₹)?[\s]*([0-9]{1,3}(?:,[0-9]{2,3})*(?:\.[0-9]{1,2})?|[0-9]+(?:\.[0-9]{1,2})?)",
        re.IGNORECASE,
    )
    m2 = p2.findall(text)
    if m2:
        amt = parse_currency_amount(m2[-1])
        if amt:
            return amt

    # Priority 3: Explicit Invoice Amount or Claimed Amount
    p3 = re.compile(
        r"\b(?:Invoice\s*Amount|Amount\s*Due|Amount|Claimed)[\s.:]*(?:INR|Rs\.?|₹)?[\s]*([0-9]{1,3}(?:,[0-9]{2,3})*(?:\.[0-9]{1,2})?|[0-9]+(?:\.[0-9]{1,2})?)",
        re.IGNORECASE,
    )
    m3 = p3.findall(text)
    if m3:
        amt = parse_currency_amount(m3[-1])
        if amt:
            return amt

    # Priority 4: Currency-prefixed figures
    p4 = re.compile(
        r"(?:INR|Rs\.?|₹)[\s]*([0-9]{1,3}(?:,[0-9]{2,3})*(?:\.[0-9]{1,2})?|[0-9]+(?:\.[0-9]{1,2})?)",
        re.IGNORECASE,
    )
    m4 = p4.findall(text)
    if m4:
        amounts = [parse_currency_amount(x) for x in m4]
        valid_amounts = [a for a in amounts if a is not None]
        if valid_amounts:
            # Usually the highest currency figure on an invoice is the final total
            return max(valid_amounts)

    return None

def extract_receipt_data(file_bytes: bytes, filename: str, mime_type: str) -> ReceiptOCRResult:
    """
    Main OCR extraction entry point.
    Dispatches to appropriate document/image text readers and extracts vendor, invoice number, date, and amount.
    """
    raw_text = ""
    warnings: List[str] = []

    # 1. Extract raw text based on MIME type / format
    if mime_type == "application/pdf" or filename.lower().endswith(".pdf"):
        raw_text = extract_pdf_streams_text(file_bytes)
    else:
        raw_text = extract_image_text_and_metadata(file_bytes, filename)

    # 2. Extract structured fields
    vendor = extract_vendor(raw_text) if raw_text else None
    invoice_number = extract_invoice_number(raw_text) if raw_text else None
    date_val = extract_date(raw_text) if raw_text else None
    amount = extract_amount(raw_text) if raw_text else None

    # Fallback heuristic: If filename contains hints (e.g. invoice_101.pdf)
    if not invoice_number:
        fn_match = re.search(r"(?:inv|bill|rcp)[_-]?([0-9A-Za-z]+)", filename, re.IGNORECASE)
        if fn_match:
            invoice_number = f"INV-{fn_match.group(1).upper()}"

    # Calculate confidence score
    fields_found = 0
    if vendor:
        fields_found += 1
    else:
        warnings.append("Vendor name could not be automatically recognized.")

    if invoice_number:
        fields_found += 1
    else:
        warnings.append("Invoice / receipt number not found.")

    if date_val:
        fields_found += 1
    else:
        warnings.append("Invoice date could not be parsed.")

    if amount is not None:
        fields_found += 1
    else:
        warnings.append("Total monetary amount could not be parsed from receipt.")

    confidence = round(fields_found / 4.0, 2)
    ocr_status = "COMPLETED" if fields_found > 0 else "NO_TEXT_FOUND"

    return ReceiptOCRResult(
        vendor=vendor,
        invoiceNumber=invoice_number,
        date=date_val,
        amount=amount,
        confidence=confidence,
        ocrStatus=ocr_status,
        rawText=raw_text.strip() if raw_text else None,
        warnings=warnings,
    )

def process_receipt_ocr(db: Session, receipt: Receipt) -> ReceiptOCRResult:
    """Run OCR extraction for an existing stored receipt record and persist extracted metadata."""
    if not os.path.exists(receipt.storage_path):
        return ReceiptOCRResult(
            confidence=0.0,
            ocrStatus="FAILED",
            warnings=["Receipt file is missing from storage."],
        )

    with open(receipt.storage_path, "rb") as f:
        file_bytes = f.read()

    ocr_result = extract_receipt_data(
        file_bytes=file_bytes,
        filename=receipt.original_filename,
        mime_type=receipt.mime_type,
    )

    # Update database record
    receipt.extracted_vendor = ocr_result.vendor
    receipt.extracted_invoice_number = ocr_result.invoiceNumber
    receipt.extracted_date = ocr_result.date
    receipt.extracted_amount = ocr_result.amount
    receipt.ocr_confidence = ocr_result.confidence
    receipt.ocr_status = ocr_result.ocrStatus
    receipt.raw_text = ocr_result.rawText

    db.commit()
    db.refresh(receipt)
    return ocr_result

