import hashlib
import hmac
import json
import re
import uuid
from typing import List, Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Path, Request, status
from pydantic import ValidationError
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.permissions import get_current_user
from app.db.session import get_db
from app.models.expense import Expense
from app.models.fiat_settlement import FiatSettlement
from app.models.user import User
from app.schemas.fiat_settlement import FiatSettlementOut, FiatSettlementWebhook

router = APIRouter()


def verify_webhook_signature(raw_body: bytes, signature: Optional[str]) -> None:
    if not settings.FIAT_WEBHOOK_PROVIDER or not settings.FIAT_WEBHOOK_SECRET:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Fiat webhook integration is not configured.",
        )
    if not signature or not signature.startswith("sha256="):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid webhook signature.",
        )

    expected = "sha256=" + hmac.new(
        settings.FIAT_WEBHOOK_SECRET.encode("utf-8"),
        raw_body,
        hashlib.sha256,
    ).hexdigest()
    if not hmac.compare_digest(expected, signature):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Webhook signature verification failed.",
        )


def _normalized_reference(value: str) -> str:
    return re.sub(r"[^a-z0-9]", "", value.casefold())


def _matches_payload(
    existing: FiatSettlement,
    provider: str,
    payload: FiatSettlementWebhook,
    evidence_hash: str,
) -> bool:
    return (
        existing.provider == provider
        and existing.event_id == payload.eventId
        and existing.settlement_reference == payload.settlementReference
        and existing.expense_id == payload.expenseId
        and existing.project_id == payload.projectId
        and existing.evidence_hash == evidence_hash
        and existing.amount == payload.amount
        and existing.currency == payload.currency.upper()
        and existing.chain_id == payload.chainId
        and existing.provider_status == payload.status.upper()
    )


def record_fiat_settlement(
    provider: str,
    payload: FiatSettlementWebhook,
    db: Session,
    raw_event_hash: str,
) -> FiatSettlement:
    configured_provider = settings.FIAT_WEBHOOK_PROVIDER
    if not configured_provider or not settings.FIAT_WEBHOOK_SECRET:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Fiat webhook integration is not configured.",
        )
    if provider != configured_provider:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Unknown fiat settlement provider.",
        )

    evidence_hash = payload.evidenceHash.removeprefix("0x").lower()
    existing_event = (
        db.query(FiatSettlement)
        .filter(
            FiatSettlement.provider == provider,
            FiatSettlement.event_id == payload.eventId,
        )
        .first()
    )
    if existing_event:
        if _matches_payload(existing_event, provider, payload, evidence_hash):
            return existing_event
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Provider event ID was already used for different settlement data.",
        )

    if payload.expenseId:
        expense = db.query(Expense).filter(Expense.id == payload.expenseId).first()
        if not expense:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Referenced expense was not found.",
            )
        if payload.projectId and payload.projectId != expense.project_id:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Settlement project does not match the referenced expense.",
            )

    matching_expenses = db.query(Expense).all()
    duplicate_evidence = any(
        (expense.receipt_hash or "").removeprefix("0x").lower() == evidence_hash
        and expense.id != payload.expenseId
        for expense in matching_expenses
    )
    same_reference = _normalized_reference(payload.settlementReference)
    existing_settlements = db.query(FiatSettlement).filter(
        FiatSettlement.provider == provider
    ).all()
    duplicate_evidence = duplicate_evidence or any(
        settlement.expense_id != payload.expenseId
        and (
            settlement.evidence_hash == evidence_hash
            or _normalized_reference(settlement.settlement_reference) == same_reference
        )
        for settlement in existing_settlements
    )

    settlement = FiatSettlement(
        id=str(uuid.uuid4()),
        provider=provider,
        event_id=payload.eventId,
        settlement_reference=payload.settlementReference,
        expense_id=payload.expenseId,
        project_id=payload.projectId,
        evidence_hash=evidence_hash,
        amount=payload.amount,
        currency=payload.currency.upper(),
        chain_id=payload.chainId,
        provider_status=payload.status.upper(),
        duplicate_evidence=duplicate_evidence,
        review_status="QUORUM_REQUIRED" if duplicate_evidence else "CLEAR",
        raw_event_hash=raw_event_hash,
    )
    db.add(settlement)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        concurrent_event = (
            db.query(FiatSettlement)
            .filter(
                FiatSettlement.provider == provider,
                FiatSettlement.event_id == payload.eventId,
            )
            .first()
        )
        if concurrent_event and _matches_payload(
            concurrent_event, provider, payload, evidence_hash
        ):
            return concurrent_event
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Settlement conflicts with an already recorded provider event.",
        )
    db.refresh(settlement)
    return settlement


@router.post(
    "/webhooks/{provider}",
    response_model=FiatSettlementOut,
    status_code=status.HTTP_202_ACCEPTED,
)
async def accept_fiat_settlement_webhook(
    request: Request,
    provider: str = Path(..., pattern=r"^[a-z0-9-]{1,64}$"),
    signature: Optional[str] = Header(default=None, alias="X-FundTrace-Signature"),
    db: Session = Depends(get_db),
):
    raw_body = await request.body()
    if len(raw_body) > 64 * 1024:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="Webhook payload exceeds the 64 KiB limit.",
        )
    verify_webhook_signature(raw_body, signature)

    try:
        payload = FiatSettlementWebhook.model_validate_json(raw_body)
    except ValidationError as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=json.loads(error.json()),
        ) from error

    return record_fiat_settlement(
        provider,
        payload,
        db,
        hashlib.sha256(raw_body).hexdigest(),
    )


@router.get("", response_model=List[FiatSettlementOut])
def list_fiat_settlements(
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_user),
):
    return (
        db.query(FiatSettlement)
        .order_by(FiatSettlement.created_at.desc())
        .limit(200)
        .all()
    )
