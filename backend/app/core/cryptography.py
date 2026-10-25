"""
FundTrace Cryptographic Commitment Engine
==========================================

Implements a secure, privacy-preserving cryptographic commitment scheme for donation records.

Security Architecture:
----------------------
1. Domain Separation:
   Every commitment calculation is bound to a strict, immutable domain tag:
   `FUNDTRACE_DONATION_COMMITMENT_V1`. This prevents cross-protocol reuse, replay attacks,
   and collision with receipt hashes or auditor decision digests.

2. Canonical Serialization:
   Payload serialization adheres to RFC 8785 canonical JSON principles:
   - Keys sorted lexicographically in ASCII order.
   - No insignificant whitespace (separators=(',', ':')).
   - Strict UTF-8 byte encoding.
   Ensures deterministic multi-platform consensus across Python, TypeScript, and Solidity.

3. Integer Minor Currency Units (Zero Floating-Point Drift):
   Financial values are strictly represented and validated in integer minor units
   (e.g., paise for INR, cents for USD/EUR, sats for BTC). Floating-point arithmetic
   is strictly prohibited to eliminate precision drift and platform-dependent rounding discrepancies.

4. Construction & Security Properties:
   Constructed via HMAC-SHA256 (with SHA-256 domain-separated alternative):
   Commitment = HMAC-SHA256(Key=nonce_bytes, Msg=DomainTag || ":" || CanonicalRecordBytes)
   - Hiding (Zero-Knowledge Privacy):
     The 32-byte (256-bit) cryptographically secure random nonce generated via the OS CSPRNG
     (`secrets.token_bytes(32)`) ensures that commitments are computationally indistinguishable
     from random bitstrings. Outsiders cannot determine the donation amount, currency, or project
     without possessing the private nonce (search space: 2^256 states).
   - Binding (Tamper-Evidence):
     Under the collision-resistance and PRF security properties of SHA-256, it is computationally
     infeasible to produce two distinct records or nonces yielding identical commitment digests.
   - Side-Channel Protection:
     Commitment verification uses constant-time byte comparisons (`hmac.compare_digest`)
     to thwart timing side-channel attacks.

IMPORTANT SYSTEM INVARIANT:
---------------------------
A valid commitment proof mathematically establishes consistency with the committed data.
It does NOT prove that the donor's identity is genuine, nor does it prove that financial
payment settlement has taken place. Actual payments are verified independently through
bank settlement receipts or blockchain transaction receipts.
"""

import hmac
import hashlib
import json
import re
import secrets
from decimal import Decimal, ROUND_HALF_UP, InvalidOperation
from typing import Dict, Any, Union, Optional
from dataclasses import dataclass, asdict

# Strict Domain Separation Tag
DOMAIN_TAG_V1 = "FUNDTRACE_DONATION_COMMITMENT_V1"

# Currency minor unit exponents (ISO 4217)
CURRENCY_MINOR_EXPONENTS: Dict[str, int] = {
    "INR": 2,  # 1 INR = 100 paise
    "USD": 2,  # 1 USD = 100 cents
    "EUR": 2,  # 1 EUR = 100 cents
    "GBP": 2,  # 1 GBP = 100 pence
    "JPY": 0,  # 1 JPY = 1 yen (no minor unit)
    "ETH": 18, # 1 ETH = 10^18 wei
}

# Regex for safe identifiers (alphanumeric, dash, underscore, colon)
SAFE_IDENTIFIER_REGEX = re.compile(r"^[A-Za-z0-9_\-\.:]+$")


@dataclass(frozen=True)
class DonationCommitmentRecord:
    """
    Immutable representation of bound donation record fields.
    All fields are strictly typed and validated.
    """
    donation_reference: str
    project_id: str
    amount_minor: int
    currency: str
    version: int = 1

    def __post_init__(self):
        # Strict field validation on instantiation
        validate_donation_record(self)


def validate_donation_record(record: DonationCommitmentRecord) -> None:
    """
    Validate all fields of a donation commitment record.
    Raises ValueError with descriptive reason upon any validation failure.
    """
    # 1. Validate donation_reference
    if not isinstance(record.donation_reference, str) or not record.donation_reference.strip():
        raise ValueError("donation_reference must be a non-empty string.")
    if len(record.donation_reference) > 100:
        raise ValueError("donation_reference exceeds maximum length of 100 characters.")
    if not SAFE_IDENTIFIER_REGEX.match(record.donation_reference):
        raise ValueError(f"donation_reference contains illegal characters: '{record.donation_reference}'")

    # 2. Validate project_id
    if not isinstance(record.project_id, str) or not record.project_id.strip():
        raise ValueError("project_id must be a non-empty string.")
    if len(record.project_id) > 64:
        raise ValueError("project_id exceeds maximum length of 64 characters.")
    if not SAFE_IDENTIFIER_REGEX.match(record.project_id):
        raise ValueError(f"project_id contains illegal characters: '{record.project_id}'")

    # 3. Validate amount_minor (strictly integer, no floats, strictly positive)
    if isinstance(record.amount_minor, bool) or not isinstance(record.amount_minor, int):
        raise ValueError(f"amount_minor must be a strict integer minor currency unit, got {type(record.amount_minor).__name__}.")
    if record.amount_minor <= 0:
        raise ValueError(f"amount_minor must be strictly positive (> 0), got {record.amount_minor}.")

    # 4. Validate currency (ISO 4217 3-letter code)
    if not isinstance(record.currency, str):
        raise ValueError("currency must be a string.")
    curr_upper = record.currency.strip().upper()
    if len(curr_upper) != 3 or not curr_upper.isalpha():
        raise ValueError(f"currency must be a standard 3-letter ISO code, got '{record.currency}'.")

    # 5. Validate version
    if isinstance(record.version, bool) or not isinstance(record.version, int) or record.version < 1:
        raise ValueError(f"version must be an integer >= 1, got {record.version}.")


def validate_nonce(nonce: Union[str, bytes]) -> bytes:
    """
    Validate that the nonce is a cryptographically strong 32-byte (256-bit) secret.
    Accepts raw 32 bytes or 64-character hex string (optional '0x' prefix).
    Returns the validated 32 bytes.
    """
    if isinstance(nonce, bytes):
        if len(nonce) != 32:
            raise ValueError(f"Nonce bytes must be exactly 32 bytes (256 bits), got {len(nonce)} bytes.")
        return nonce

    if not isinstance(nonce, str):
        raise ValueError(f"Nonce must be a 64-character hex string or 32 bytes, got {type(nonce).__name__}.")

    clean_hex = nonce.strip().lower()
    if clean_hex.startswith("0x"):
        clean_hex = clean_hex[2:]

    if len(clean_hex) != 64:
        raise ValueError(f"Nonce hex string must be exactly 64 hex characters (32 bytes), got {len(clean_hex)} characters.")

    try:
        raw_bytes = bytes.fromhex(clean_hex)
    except ValueError as hex_err:
        raise ValueError(f"Nonce contains invalid non-hexadecimal characters: {hex_err}") from hex_err

    if len(raw_bytes) != 32:
        raise ValueError(f"Decoded nonce must be exactly 32 bytes, got {len(raw_bytes)} bytes.")

    return raw_bytes


def validate_commitment_format(commitment_hex: str) -> str:
    """
    Validate commitment format: must be 0x-prefixed 64 hex characters (lowercase).
    """
    if not isinstance(commitment_hex, str):
        raise ValueError(f"Commitment must be a string, got {type(commitment_hex).__name__}.")

    clean = commitment_hex.strip().lower()
    if not clean.startswith("0x"):
        clean = "0x" + clean

    if len(clean) != 66:  # '0x' + 64 hex chars
        raise ValueError(f"Commitment must be 0x-prefixed 64 hex characters (32 bytes), got length {len(clean)}.")

    try:
        bytes.fromhex(clean[2:])
    except ValueError as hex_err:
        raise ValueError(f"Commitment contains invalid hexadecimal characters: {hex_err}") from hex_err

    return clean


def generate_secure_nonce() -> str:
    """
    Generate a cryptographically secure random 256-bit (32-byte) nonce using the OS CSPRNG.
    Returns 0x-prefixed lowercase 64-character hex string.
    """
    return "0x" + secrets.token_hex(32)


def canonical_serialize_donation_record(record: DonationCommitmentRecord) -> bytes:
    """
    Serialize a donation record into canonical RFC 8785 JSON bytes.
    - Keys sorted lexicographically in ASCII order.
    - No insignificant whitespace (separators=(',', ':')).
    - UTF-8 byte encoding.
    Ensures identical byte outputs across diverse execution environments.
    """
    validate_donation_record(record)
    canonical_dict = {
        "amount_minor": record.amount_minor,
        "currency": record.currency.strip().upper(),
        "donation_reference": record.donation_reference.strip(),
        "project_id": record.project_id.strip(),
        "version": record.version,
    }
    canonical_json_str = json.dumps(
        canonical_dict,
        sort_keys=True,
        separators=(",", ":"),
        ensure_ascii=False,
    )
    return canonical_json_str.encode("utf-8")


def amount_to_minor_units(amount: Union[int, str, Decimal], currency: str = "INR") -> int:
    """
    Convert a major currency amount (e.g. ₹5000.50) into integer minor units (e.g. 500050 paise)
    without using floating-point math to eliminate precision drift.
    """
    curr = currency.strip().upper()
    exp = CURRENCY_MINOR_EXPONENTS.get(curr, 2)

    if isinstance(amount, int) and not isinstance(amount, bool):
        # If integer with 0 exponent or already scaled
        multiplier = 10 ** exp
        return amount * multiplier

    try:
        dec = Decimal(str(amount).strip())
    except (InvalidOperation, ValueError) as err:
        raise ValueError(f"Invalid currency amount representation '{amount}': {err}") from err

    if dec <= Decimal("0"):
        raise ValueError(f"Donation amount must be strictly positive, got '{amount}'.")

    # Quantize to exact minor units using Decimal arithmetic
    multiplier = Decimal(10 ** exp)
    minor_val = (dec * multiplier).quantize(Decimal("1"), rounding=ROUND_HALF_UP)
    return int(minor_val)


def compute_secure_donation_commitment(
    record: DonationCommitmentRecord,
    nonce: Union[str, bytes],
    construction: str = "HMAC-SHA256",
) -> str:
    """
    Compute a cryptographic commitment binding the canonical donation record with the private nonce.

    Supported standard constructions:
    1. 'HMAC-SHA256' (Default):
       Commitment = HMAC-SHA256(Key=nonce_bytes, Msg=DomainTag || ":" || CanonicalRecordBytes)
       Proven PRF security, length-extension immune, information-theoretically hiding.
    2. 'SHA256':
       Commitment = SHA256(DomainTag || ":nonce=" || nonce_bytes || ":record=" || CanonicalRecordBytes)

    Returns lowercase '0x'-prefixed 64-character hexadecimal digest.
    """
    nonce_bytes = validate_nonce(nonce)
    canonical_bytes = canonical_serialize_donation_record(record)
    domain_bytes = DOMAIN_TAG_V1.encode("utf-8")

    if construction.upper() == "HMAC-SHA256":
        message = domain_bytes + b":" + canonical_bytes
        digest = hmac.new(nonce_bytes, message, hashlib.sha256).hexdigest()
    elif construction.upper() == "SHA256":
        hasher = hashlib.sha256()
        hasher.update(domain_bytes + b":nonce=")
        hasher.update(nonce_bytes)
        hasher.update(b":record=")
        hasher.update(canonical_bytes)
        digest = hasher.hexdigest()
    else:
        raise ValueError(f"Unsupported commitment construction '{construction}'. Supported: 'HMAC-SHA256', 'SHA256'.")

    return "0x" + digest.lower()


def verify_secure_donation_commitment(
    record: DonationCommitmentRecord,
    nonce: Union[str, bytes],
    expected_commitment: str,
    construction: str = "HMAC-SHA256",
) -> bool:
    """
    Verify that the provided donation record and private nonce yield the expected commitment.
    Uses constant-time comparison (hmac.compare_digest) to prevent side-channel timing attacks.
    """
    try:
        expected_clean = validate_commitment_format(expected_commitment)
        computed = compute_secure_donation_commitment(record, nonce, construction=construction)
        # Constant-time comparison
        return hmac.compare_digest(computed.lower(), expected_clean.lower())
    except Exception:
        # Fail closed on any malformed input
        return False

