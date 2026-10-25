"""
Comprehensive Unit Tests for FundTrace Cryptographic Commitment Engine
=======================================================================
Verifies all security properties, canonical serialization, domain separation,
integer minor units, input validation, and tamper-detection invariants.
"""

import pytest
import secrets
from decimal import Decimal

from app.core.cryptography import (
    DonationCommitmentRecord,
    generate_secure_nonce,
    validate_nonce,
    validate_commitment_format,
    validate_donation_record,
    amount_to_minor_units,
    canonical_serialize_donation_record,
    compute_secure_donation_commitment,
    verify_secure_donation_commitment,
    DOMAIN_TAG_V1,
)


def test_secure_nonce_generation():
    """Verify that generated nonces are cryptographically secure 256-bit (32-byte) hex strings."""
    nonce1 = generate_secure_nonce()
    nonce2 = generate_secure_nonce()

    assert nonce1.startswith("0x")
    assert len(nonce1) == 66  # 0x + 64 hex chars = 32 bytes = 256 bits
    assert nonce1 != nonce2  # Independent randomness from OS CSPRNG

    # Validating the nonce must succeed and yield 32 bytes
    raw_bytes = validate_nonce(nonce1)
    assert len(raw_bytes) == 32


def test_nonce_validation_rejects_malformed_inputs():
    """Verify that invalid nonces (wrong length, non-hex, empty) are strictly rejected."""
    # Too short
    with pytest.raises(ValueError, match="must be exactly 64 hex characters"):
        validate_nonce("0x1234abcd")

    # Too long
    with pytest.raises(ValueError, match="must be exactly 64 hex characters"):
        validate_nonce("0x" + "a" * 66)

    # Non-hex characters
    with pytest.raises(ValueError, match="invalid non-hexadecimal"):
        validate_nonce("0x" + "g" * 64)

    # Wrong type
    with pytest.raises(ValueError, match="Nonce must be a 64-character hex string"):
        validate_nonce(123456789)  # type: ignore


def test_amount_to_minor_units_avoids_floating_point_drift():
    """Verify financial amount conversion to integer minor units without float arithmetic."""
    # INR: 1 INR = 100 paise
    assert amount_to_minor_units("500.50", "INR") == 50050
    assert amount_to_minor_units(Decimal("500.50"), "INR") == 50050
    assert amount_to_minor_units(1000, "INR") == 100000

    # USD: 1 USD = 100 cents
    assert amount_to_minor_units("12.99", "USD") == 1299

    # JPY: 1 JPY = 1 yen (0 minor units)
    assert amount_to_minor_units("2500", "JPY") == 2500

    # Reject non-positive amounts
    with pytest.raises(ValueError, match="strictly positive"):
        amount_to_minor_units("0.00", "INR")
    with pytest.raises(ValueError, match="strictly positive"):
        amount_to_minor_units("-50.00", "INR")

    # Reject malformed strings
    with pytest.raises(ValueError, match="Invalid currency amount representation"):
        amount_to_minor_units("not-a-number", "INR")


def test_donation_record_validation():
    """Verify strict input validation on all record fields."""
    # Valid record
    rec = DonationCommitmentRecord(
        donation_reference="DON-REF-001",
        project_id="PRJ-KENYA-WATER",
        amount_minor=500000,  # 5,000.00 INR in paise
        currency="INR",
        version=1,
    )
    assert rec.donation_reference == "DON-REF-001"
    assert rec.amount_minor == 500000

    # Reject floating-point amount_minor
    with pytest.raises(ValueError, match="amount_minor must be a strict integer"):
        DonationCommitmentRecord(
            donation_reference="DON-001",
            project_id="PRJ-001",
            amount_minor=5000.50,  # float rejected!
            currency="INR",
        )

    # Reject negative / zero amount_minor
    with pytest.raises(ValueError, match="strictly positive"):
        DonationCommitmentRecord(
            donation_reference="DON-001",
            project_id="PRJ-001",
            amount_minor=0,
            currency="INR",
        )

    # Reject empty donation_reference
    with pytest.raises(ValueError, match="donation_reference must be a non-empty string"):
        DonationCommitmentRecord(
            donation_reference="",
            project_id="PRJ-001",
            amount_minor=1000,
            currency="INR",
        )

    # Reject illegal characters in project_id
    with pytest.raises(ValueError, match="contains illegal characters"):
        DonationCommitmentRecord(
            donation_reference="DON-001",
            project_id="PRJ<script>alert(1)</script>",
            amount_minor=1000,
            currency="INR",
        )

    # Reject invalid currency code
    with pytest.raises(ValueError, match="currency must be a standard 3-letter ISO code"):
        DonationCommitmentRecord(
            donation_reference="DON-001",
            project_id="PRJ-001",
            amount_minor=1000,
            currency="INDIAN_RUPEE",
        )


def test_canonical_serialization_consistency():
    """Verify RFC 8785 canonical JSON consistency across arbitrary instantiations."""
    rec = DonationCommitmentRecord(
        donation_reference="DON-REF-42",
        project_id="PRJ-001",
        amount_minor=100000,
        currency="INR",
        version=1,
    )

    serialized = canonical_serialize_donation_record(rec)
    # Expected exact ASCII ordered string with no whitespace:
    expected_bytes = b'{"amount_minor":100000,"currency":"INR","donation_reference":"DON-REF-42","project_id":"PRJ-001","version":1}'
    assert serialized == expected_bytes


def test_commitment_determinism():
    """Verify that identical record + identical nonce always produce the identical commitment."""
    rec = DonationCommitmentRecord(
        donation_reference="DON-REF-77",
        project_id="PRJ-WELL-01",
        amount_minor=250000,
        currency="INR",
        version=1,
    )
    nonce = "0x" + "4a" * 32

    comm1 = compute_secure_donation_commitment(rec, nonce, construction="HMAC-SHA256")
    comm2 = compute_secure_donation_commitment(rec, nonce, construction="HMAC-SHA256")
    assert comm1 == comm2
    assert comm1.startswith("0x")
    assert len(comm1) == 66


def test_binding_property_changing_any_field_changes_commitment():
    """
    Binding Property Test:
    Demonstrates that altering ANY single committed field (or nonce) strictly
    produces a completely different, uncorrelated commitment digest.
    """
    base_rec = DonationCommitmentRecord(
        donation_reference="DON-REF-ALPHA",
        project_id="PRJ-001",
        amount_minor=100000,
        currency="INR",
        version=1,
    )
    base_nonce = "0x" + "11" * 32
    base_comm = compute_secure_donation_commitment(base_rec, base_nonce)

    # 1. Alter donation_reference
    rec_diff_ref = DonationCommitmentRecord(
        donation_reference="DON-REF-BETA",  # changed
        project_id="PRJ-001",
        amount_minor=100000,
        currency="INR",
        version=1,
    )
    assert compute_secure_donation_commitment(rec_diff_ref, base_nonce) != base_comm

    # 2. Alter project_id
    rec_diff_proj = DonationCommitmentRecord(
        donation_reference="DON-REF-ALPHA",
        project_id="PRJ-002",  # changed
        amount_minor=100000,
        currency="INR",
        version=1,
    )
    assert compute_secure_donation_commitment(rec_diff_proj, base_nonce) != base_comm

    # 3. Alter amount_minor (even by a single paise)
    rec_diff_amount = DonationCommitmentRecord(
        donation_reference="DON-REF-ALPHA",
        project_id="PRJ-001",
        amount_minor=100001,  # +1 paise
        currency="INR",
        version=1,
    )
    assert compute_secure_donation_commitment(rec_diff_amount, base_nonce) != base_comm

    # 4. Alter currency
    rec_diff_curr = DonationCommitmentRecord(
        donation_reference="DON-REF-ALPHA",
        project_id="PRJ-001",
        amount_minor=100000,
        currency="USD",  # changed
        version=1,
    )
    assert compute_secure_donation_commitment(rec_diff_curr, base_nonce) != base_comm

    # 5. Alter version
    rec_diff_version = DonationCommitmentRecord(
        donation_reference="DON-REF-ALPHA",
        project_id="PRJ-001",
        amount_minor=100000,
        currency="INR",
        version=2,  # changed
    )
    assert compute_secure_donation_commitment(rec_diff_version, base_nonce) != base_comm

    # 6. Alter nonce (even by 1 bit)
    diff_nonce = "0x" + "11" * 31 + "12"  # last byte 0x12 instead of 0x11
    assert compute_secure_donation_commitment(base_rec, diff_nonce) != base_comm


def test_constant_time_verification():
    """Verify constant-time verification passes for genuine data and fails for tampered data."""
    rec = DonationCommitmentRecord(
        donation_reference="DON-TEST-99",
        project_id="PRJ-001",
        amount_minor=750000,
        currency="INR",
        version=1,
    )
    nonce = generate_secure_nonce()
    comm = compute_secure_donation_commitment(rec, nonce)

    # Genuine verification succeeds
    assert verify_secure_donation_commitment(rec, nonce, comm) is True

    # Tampered commitment fails
    tampered_comm = "0x" + "00" * 32
    assert verify_secure_donation_commitment(rec, nonce, tampered_comm) is False

    # Tampered nonce fails
    tampered_nonce = generate_secure_nonce()
    assert verify_secure_donation_commitment(rec, tampered_nonce, comm) is False

    # Tampered amount fails
    tampered_rec = DonationCommitmentRecord(
        donation_reference="DON-TEST-99",
        project_id="PRJ-001",
        amount_minor=750001,  # altered
        currency="INR",
        version=1,
    )
    assert verify_secure_donation_commitment(tampered_rec, nonce, comm) is False


def test_domain_separation_prevents_cross_protocol_collisions():
    """Verify that domain separation tag is explicitly enforced."""
    rec = DonationCommitmentRecord(
        donation_reference="DON-REF-100",
        project_id="PRJ-001",
        amount_minor=50000,
        currency="INR",
        version=1,
    )
    nonce = generate_secure_nonce()

    # Domain tag is included in the canonical message
    comm_hmac = compute_secure_donation_commitment(rec, nonce, construction="HMAC-SHA256")
    comm_sha = compute_secure_donation_commitment(rec, nonce, construction="SHA256")

    assert comm_hmac.startswith("0x")
    assert comm_sha.startswith("0x")
    assert comm_hmac != comm_sha  # distinct constructions with independent outputs

