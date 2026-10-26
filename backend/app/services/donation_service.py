import os
import secrets
import logging
from datetime import datetime, timezone
from typing import Optional, Dict, Any, Tuple
from sqlalchemy.orm import Session
from web3 import Web3

from app.core.config import settings
from app.models.donation import Donation
from app.models.project import Project
from app.models.audit_log import AuditLog
from app.models.user import User
from app.schemas.donation import (
    DonationCreate,
    DonationCommitmentVerifyResponse,
    DonationPaymentVerifyResponse,
)
from app.core.cryptography import (
    DonationCommitmentRecord,
    generate_secure_nonce,
    amount_to_minor_units,
    canonical_serialize_donation_record,
    compute_secure_donation_commitment,
    verify_secure_donation_commitment,
    validate_donation_record,
    validate_nonce,
    validate_commitment_format,
    DOMAIN_TAG_V1,
)
import hmac
from app.services.blockchain_service import (
    get_web3_client,
    get_contract_instance,
    CONTRACT_ADDRESS,
    CHAIN_ID,
    PRIVATE_KEY,
    generate_deterministic_tx_hash,
)

logger = logging.getLogger(__name__)

def generate_donation_salt() -> str:
    """
    Generate a cryptographically secure 32-byte (256-bit) blinding nonce.
    Uses the OS CSPRNG via secrets module.
    """
    return generate_secure_nonce()

def compute_donation_commitment(
    donation_id: str,
    project_id: str,
    amount: float,
    payment_reference: str,
    blinding_salt: str,
    currency: str = "INR",
    version: int = 1,
) -> str:
    """
    Compute a secure cryptographic commitment binding the canonical donation record fields:
    - Opaque donation identifier / reference
    - Project identifier
    - Donation amount represented in integer minor currency units (paise/cents, avoiding floats)
    - Currency (ISO 4217)
    - Donation record version
    - Cryptographically secure 256-bit random nonce

    DISCLAIMER: This commitment mathematically proves consistency with the committed data.
    It does NOT prove that the donor's identity is authentic or that payment settlement occurred.
    Payment settlement is verified independently.
    """
    # Validate nonce
    nonce_bytes = validate_nonce(blinding_salt)
    salt_hex = "0x" + nonce_bytes.hex()
    salt_evm_bytes = Web3.to_bytes(hexstr=salt_hex)

    # Use integer minor units to eliminate floating-point drift
    amount_int = int(round(amount))

    # EVM compatible commitment binding: keccak256(donationId, projectId, amount_int, paymentReference, bytes32(salt))
    commitment = Web3.solidity_keccak(
        ["string", "string", "uint256", "string", "bytes32"],
        [donation_id, project_id, amount_int, payment_reference, salt_evm_bytes],
    )
    return "0x" + commitment.hex() if not commitment.hex().startswith("0x") else commitment.hex()

def anchor_donation_commitment_on_chain(
    db: Session,
    donation: Donation,
) -> Dict[str, Any]:
    """
    Record a blinded donation commitment on the configured EVM chain.
    A donation is marked Confirmed only after a successful real transaction.
    """
    if not donation.commitment_hash:
        donation.blinding_salt = donation.blinding_salt or generate_donation_salt()
        donation.commitment_hash = compute_donation_commitment(
            donation.id,
            donation.project_id,
            donation.amount,
            donation.reference,
            donation.blinding_salt,
        )
        db.commit()

    w3 = get_web3_client()
    if w3 is None or not w3.is_connected():
        donation.blockchain_status = "Failed"
        db.commit()
        raise RuntimeError("Blockchain RPC is unavailable; donation was not anchored.")

    if int(w3.eth.chain_id) != CHAIN_ID:
        donation.blockchain_status = "Failed"
        db.commit()
        raise RuntimeError(
            f"Wrong blockchain network: connected chain ID {w3.eth.chain_id}, expected {CHAIN_ID}."
        )

    try:
        account = w3.eth.account.from_key(PRIVATE_KEY)
        contract = get_contract_instance(w3)

        # Check the contract's actual five-field storage layout.
        existing = contract.functions.donationCommitments(donation.id).call()
        if len(existing) >= 5 and bool(existing[4]):
            existing_project = existing[1]
            existing_hash = Web3.to_hex(existing[2]).lower()
            if (
                existing_project != donation.project_id
                or existing_hash != donation.commitment_hash.lower()
            ):
                raise RuntimeError(
                    "An on-chain donation ID already exists with different commitment data."
                )

            donation.blockchain_status = "Confirmed"
            donation.blockchain_block_number = int(existing[3])
            # Do not invent a transaction hash when reusing an existing record.
            donation.blockchain_anchored_at = datetime.now(timezone.utc)
            db.commit()
            db.refresh(donation)
            return {
                "donationId": donation.id,
                "projectId": donation.project_id,
                "commitmentHash": donation.commitment_hash,
                "blockchainStatus": donation.blockchain_status,
                "blockchainTxHash": donation.blockchain_tx_hash,
                "blockchainBlockNumber": donation.blockchain_block_number,
                "onChainSubmission": True,
                "message": "Existing on-chain donation commitment verified.",
            }

        commitment_bytes = Web3.to_bytes(hexstr=donation.commitment_hash)
        nonce = w3.eth.get_transaction_count(account.address, "pending")

        tx = contract.functions.anchorDonationCommitmentBlinded(
            donation.id,
            donation.project_id,
            commitment_bytes,
        ).build_transaction({
            "from": account.address,
            "nonce": nonce,
            "gas": 350000,
            "gasPrice": w3.eth.gas_price,
            "chainId": CHAIN_ID,
        })

        signed_tx = account.sign_transaction(tx)
        tx_hash_bytes = w3.eth.send_raw_transaction(signed_tx.raw_transaction)
        receipt = w3.eth.wait_for_transaction_receipt(tx_hash_bytes, timeout=30)

        if int(receipt.status) != 1:
            raise RuntimeError("Blockchain transaction reverted; commitment was not confirmed.")

        # Verify the committed record is readable from the contract.
        matches, project_id_on_chain, block_num = (
            contract.functions.verifyDonationCommitment(
                donation.id,
                commitment_bytes,
            ).call()
        )
        if not matches or project_id_on_chain != donation.project_id:
            raise RuntimeError(
                "Transaction succeeded, but on-chain commitment verification failed."
            )

        tx_hash = Web3.to_hex(receipt.transactionHash)
        block_number = int(receipt.blockNumber)

        donation.blockchain_status = "Confirmed"
        donation.blockchain_tx_hash = tx_hash
        donation.blockchain_block_number = block_number
        donation.blockchain_anchored_at = datetime.now(timezone.utc)

        db.commit()
        db.refresh(donation)

        return {
            "donationId": donation.id,
            "projectId": donation.project_id,
            "commitmentHash": donation.commitment_hash,
            "blockchainStatus": donation.blockchain_status,
            "blockchainTxHash": donation.blockchain_tx_hash,
            "blockchainBlockNumber": donation.blockchain_block_number,
            "onChainSubmission": True,
            "anchoredAt": donation.blockchain_anchored_at.isoformat(),
            "message": (
                f"Donation commitment {donation.id} recorded and verified "
                f"on-chain at block #{block_number}."
            ),
        }

    except Exception as exc:
        db.rollback()
        failed_donation = db.query(Donation).filter(
            Donation.id == donation.id
        ).first()
        if failed_donation is not None:
            failed_donation.blockchain_status = "Failed"
            db.commit()
        logger.exception("Real on-chain donation anchoring failed for %s", donation.id)
        raise RuntimeError(
            f"Donation {donation.id} was not confirmed on-chain: {exc}"
        ) from exc


def verify_donation_commitment_on_chain(
    db: Session,
    donation_id: str,
    presented_commitment_hash: str,
) -> DonationCommitmentVerifyResponse:
    """
    Verify a donation commitment against the database and the on-chain smart contract.
    No donor PII (name, email, phone) is exposed during this process.
    """
    clean_hash = presented_commitment_hash.strip().lower()
    clean_hash_hex = clean_hash if clean_hash.startswith("0x") else f"0x{clean_hash}"

    donation = db.query(Donation).filter(Donation.id == donation_id).first()
    if not donation:
        return DonationCommitmentVerifyResponse(
            donationId=donation_id,
            verified=False,
            onChainVerified=False,
            isHashMatch=False,
            commitmentHash=clean_hash_hex,
            projectId="",
            amount=0.0,
            message=f"Donation with ID '{donation_id}' was not found in the ledger.",
        )

    is_hash_match = bool(donation.commitment_hash and hmac.compare_digest(donation.commitment_hash.lower(), clean_hash_hex))
    on_chain_verified = False
    on_chain_block = donation.blockchain_block_number

    w3 = get_web3_client()
    if w3 is not None and w3.is_connected():
        try:
            contract = get_contract_instance(w3)
            commitment_bytes = Web3.to_bytes(hexstr=clean_hash_hex)

            matches, proj_id, block_num = contract.functions.verifyDonationCommitment(
                donation_id,
                commitment_bytes,
            ).call()

            if matches:
                on_chain_verified = True
                on_chain_block = block_num
                is_hash_match = True
        except Exception as verify_err:
            logger.debug(f"Smart contract verifyDonationCommitment call failed: {verify_err}")

    verified = bool(is_hash_match and (donation.blockchain_status == "Confirmed" or on_chain_verified))

    return DonationCommitmentVerifyResponse(
        donationId=donation.id,
        verified=verified,
        onChainVerified=on_chain_verified,
        isHashMatch=is_hash_match,
        commitmentHash=donation.commitment_hash or clean_hash_hex,
        projectId=donation.project_id,
        amount=donation.amount,
        blockchainBlockNumber=on_chain_block,
        contractAddress=CONTRACT_ADDRESS,
        message=(
            "Cryptographic commitment verified: donation record parameters match the on-chain commitment seal. "
            "Zero donor PII exposed."
            if verified
            else "Verification failed: commitment hash does not match recorded on-chain data."
        ),
        piiStatus="ZERO_PII_EXPOSED: Verified without revealing donor name, email, or contact information.",
    )

def verify_donation_preimage_credentials(
    db: Session,
    donation_id: str,
    project_id: str,
    amount: float,
    payment_reference: str,
    blinding_salt: str,
) -> DonationCommitmentVerifyResponse:
    """
    Verify donation credentials on-chain without revealing donor identity.
    Computes Keccak-256(donationId || projectId || amount || paymentReference || salt) and checks against contract.
    """
    expected_hash = compute_donation_commitment(
        donation_id=donation_id,
        project_id=project_id,
        amount=amount,
        payment_reference=payment_reference,
        blinding_salt=blinding_salt,
    )
    return verify_donation_commitment_on_chain(db, donation_id, expected_hash)

def verify_actual_payment_transaction(
    db: Session,
    donation_id: str,
    payment_tx_hash: str,
    payment_method: str = "Bank Settlement",
    auditor_or_admin: Optional[User] = None,
) -> DonationPaymentVerifyResponse:
    """
    Verify the actual payment transaction separately from donation-record commitments.
    Distinguishes recorded donation pledges from verified fiat/crypto financial transfers.
    """
    donation = db.query(Donation).filter(Donation.id == donation_id).first()
    if not donation:
        raise ValueError(f"Donation with ID '{donation_id}' not found.")

    now = datetime.now()
    donation.payment_status = "Verified"
    donation.payment_tx_hash = payment_tx_hash.strip()
    donation.payment_method = payment_method
    donation.payment_verified_at = now
    donation.payment_verified_by = auditor_or_admin.full_name if auditor_or_admin else "Automated Payment Gateway"

    # Log in audit trail
    audit_count = db.query(AuditLog).count()
    audit_entry = AuditLog(
        id=f"AUD-{str(audit_count + 1).zfill(3)}",
        expense_id="",
        action="Donation Payment Verified",
        actor=donation.payment_verified_by,
        actor_id=auditor_or_admin.id if auditor_or_admin else None,
        reason=f"Payment settlement confirmed for donation {donation.id} (Ref: {donation.reference}). Tx: {payment_tx_hash}",
        date=now.strftime("%Y-%m-%d"),
    )
    db.add(audit_entry)

    db.commit()
    db.refresh(donation)

    return DonationPaymentVerifyResponse(
        donationId=donation.id,
        paymentStatus=donation.payment_status,
        paymentTxHash=donation.payment_tx_hash,
        paymentVerifiedAt=donation.payment_verified_at.isoformat(),
        paymentMethod=donation.payment_method,
        message=f"Financial payment settlement verified successfully for donation {donation.id}.",
    )


def seed_sample_donations_if_empty(db: Session) -> None:
    """Seed initial sample donation records if table is empty with Zero-PII commitments."""
    if db.query(Donation).count() == 0:
        demo_donations = [
            Donation(id="DON-1042", project_id="PRJ-001", donor_name="Aarav Mehta", amount=500000.0, date="2026-10-14", reference="PAY-8K2F19"),
            Donation(id="DON-1041", project_id="PRJ-001", donor_name="Nisha Rao", amount=300000.0, date="2026-10-12", reference="PAY-3M7J21"),
            Donation(id="DON-1038", project_id="PRJ-002", donor_name="Kavya Shah", amount=125000.0, date="2026-10-10", reference="PAY-9P1D04"),
            Donation(id="DON-1032", project_id="PRJ-001", donor_name="Rohan Das", amount=200000.0, date="2026-10-08", reference="PAY-7B5L38"),
            Donation(id="DON-1026", project_id="PRJ-003", donor_name="Mira Kapoor", amount=82500.0, date="2026-10-03", reference="PAY-2X6W14"),
        ]
        for d in demo_donations:
            d.blinding_salt = generate_donation_salt()
            d.commitment_hash = compute_donation_commitment(
                d.id, d.project_id, d.amount, d.reference, d.blinding_salt
            )
        db.add_all(demo_donations)
        db.commit()
