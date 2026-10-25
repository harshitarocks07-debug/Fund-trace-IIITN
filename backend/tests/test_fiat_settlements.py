import asyncio
import hashlib
import hmac
import json
import pytest
from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.config import settings
from app.db.base import Base
from app.models.expense import Expense
from app.models.fiat_settlement import FiatSettlement
from app.models.project import Project
from app.schemas.fiat_settlement import FiatSettlementWebhook
from app.api.v1.endpoints.fiat_settlements import (
    record_fiat_settlement,
    verify_webhook_signature,
)
from app.api.v1.endpoints.blockchain import get_supported_networks
from app.api.v1.endpoints.fiat_settlements import accept_fiat_settlement_webhook
from starlette.requests import Request


@pytest.fixture
def db_session():
    test_engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=test_engine)
    session = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)()
    session.add(
        Project(
            id="PRJ-001",
            name="School Construction",
            ngo="Helping Hands Foundation",
            description="Build classrooms",
            budget=100000.0,
            raised=50000.0,
            location="Madhya Pradesh",
            category="Education",
        )
    )
    session.add(
        Expense(
            id="EXP-001",
            project_id="PRJ-001",
            vendor="ABC Supplies",
            category="Construction",
            invoice_number="INV-001",
            claimed_amount=500.0,
            receipt_name="invoice.pdf",
            receipt_hash="a" * 64,
            status="Pending review",
            date="2026-10-20",
        )
    )
    session.commit()
    yield session
    session.close()
    Base.metadata.drop_all(bind=test_engine)


def make_payload(**overrides):
    data = {
        "eventId": "evt-001",
        "settlementReference": "BANK-001",
        "expenseId": "EXP-001",
        "projectId": "PRJ-001",
        "evidenceHash": "a" * 64,
        "amount": 500.0,
        "currency": "INR",
        "chainId": 11155111,
        "status": "settled",
    }
    data.update(overrides)
    return FiatSettlementWebhook.model_validate(data)


def test_webhook_signature_uses_raw_body_and_constant_expected_format(monkeypatch):
    body = b'{"eventId":"evt-001"}'
    secret = "test-webhook-secret"
    monkeypatch.setattr(settings, "FIAT_WEBHOOK_PROVIDER", "sandbox")
    monkeypatch.setattr(settings, "FIAT_WEBHOOK_SECRET", secret)
    signature = "sha256=" + hmac.new(
        secret.encode(), body, hashlib.sha256
    ).hexdigest()

    verify_webhook_signature(body, signature)

    with pytest.raises(HTTPException) as error:
        verify_webhook_signature(body + b" ", signature)
    assert error.value.status_code == 401


def test_webhook_fails_closed_when_secret_is_not_configured(monkeypatch):
    monkeypatch.setattr(settings, "FIAT_WEBHOOK_PROVIDER", "sandbox")
    monkeypatch.setattr(settings, "FIAT_WEBHOOK_SECRET", "")

    with pytest.raises(HTTPException) as error:
        verify_webhook_signature(b"{}", "sha256=" + "0" * 64)
    assert error.value.status_code == 503


def test_settlement_event_is_idempotent(db_session, monkeypatch):
    monkeypatch.setattr(settings, "FIAT_WEBHOOK_PROVIDER", "sandbox")
    monkeypatch.setattr(settings, "FIAT_WEBHOOK_SECRET", "secret")
    payload = make_payload()

    first = record_fiat_settlement("sandbox", payload, db_session, "b" * 64)
    duplicate_delivery = record_fiat_settlement("sandbox", payload, db_session, "b" * 64)

    assert first.id == duplicate_delivery.id
    assert db_session.query(FiatSettlement).count() == 1
    assert first.provider_status == "SETTLED"
    assert first.review_status == "CLEAR"


def test_reused_evidence_hash_requires_quorum_review(db_session, monkeypatch):
    monkeypatch.setattr(settings, "FIAT_WEBHOOK_PROVIDER", "sandbox")
    monkeypatch.setattr(settings, "FIAT_WEBHOOK_SECRET", "secret")

    first = record_fiat_settlement(
        "sandbox",
        make_payload(),
        db_session,
        hashlib.sha256(b"event one").hexdigest(),
    )
    second = record_fiat_settlement(
        "sandbox",
        make_payload(
            eventId="evt-002",
            settlementReference="BANK-002",
            expenseId=None,
        ),
        db_session,
        hashlib.sha256(b"event two").hexdigest(),
    )

    assert first.duplicate_evidence is False
    assert second.duplicate_evidence is True
    assert second.review_status == "QUORUM_REQUIRED"
    assert second.provider_status == "SETTLED"


def test_conflicting_reuse_of_event_id_is_rejected(db_session, monkeypatch):
    monkeypatch.setattr(settings, "FIAT_WEBHOOK_PROVIDER", "sandbox")
    monkeypatch.setattr(settings, "FIAT_WEBHOOK_SECRET", "secret")
    record_fiat_settlement("sandbox", make_payload(), db_session, "b" * 64)

    with pytest.raises(HTTPException) as error:
        record_fiat_settlement(
            "sandbox",
            make_payload(amount=501.0),
            db_session,
            "c" * 64,
        )
    assert error.value.status_code == 409


def test_unconfigured_provider_is_not_accepted(db_session, monkeypatch):
    monkeypatch.setattr(settings, "FIAT_WEBHOOK_PROVIDER", "sandbox")
    monkeypatch.setattr(settings, "FIAT_WEBHOOK_SECRET", "secret")

    with pytest.raises(HTTPException) as error:
        record_fiat_settlement(
            "other-provider",
            make_payload(),
            db_session,
            "d" * 64,
        )
    assert error.value.status_code == 404


def test_supported_network_status_is_explicit_when_rpc_is_unconfigured(monkeypatch):
    monkeypatch.setattr(settings, "SEPOLIA_RPC_URL", "")
    monkeypatch.setattr(settings, "SEPOLIA_ESCROW_ADDRESS", "")
    monkeypatch.setattr(settings, "POLYGON_AMOY_RPC_URL", "")
    monkeypatch.setattr(settings, "POLYGON_AMOY_ESCROW_ADDRESS", "")

    result = get_supported_networks(_current_user=None)

    assert [item["chainId"] for item in result["networks"]] == [11155111, 80002]
    assert all(item["rpcConnected"] is False for item in result["networks"])
    assert all(item["configured"] is False for item in result["networks"])


def test_signed_webhook_route_records_only_verified_event(db_session, monkeypatch):
    monkeypatch.setattr(settings, "FIAT_WEBHOOK_PROVIDER", "sandbox")
    monkeypatch.setattr(settings, "FIAT_WEBHOOK_SECRET", "secret")
    payload = {
        "eventId": "evt-route",
        "settlementReference": "BANK-ROUTE",
        "expenseId": "EXP-001",
        "projectId": "PRJ-001",
        "evidenceHash": "a" * 64,
        "amount": 500.0,
        "currency": "INR",
        "chainId": 80002,
        "status": "settled",
    }
    body = json.dumps(payload, separators=(",", ":")).encode()
    signature = "sha256=" + hmac.new(
        b"secret", body, hashlib.sha256
    ).hexdigest()
    scope = {
        "type": "http",
        "asgi": {"version": "3.0"},
        "http_version": "1.1",
        "method": "POST",
        "scheme": "http",
        "path": "/api/v1/fiat-settlements/webhooks/sandbox",
        "raw_path": b"/api/v1/fiat-settlements/webhooks/sandbox",
        "query_string": b"",
        "headers": [],
        "server": ("testserver", 80),
        "client": ("testclient", 123),
    }
    async def receive_body():
        return {"type": "http.request", "body": body, "more_body": False}

    request = Request(scope, receive=receive_body)
    settlement = asyncio.run(
        accept_fiat_settlement_webhook(
            request=request,
            provider="sandbox",
            signature=signature,
            db=db_session,
        )
    )

    assert settlement.event_id == "evt-route"
    assert settlement.chain_id == 80002
    assert settlement.raw_event_hash == hashlib.sha256(body).hexdigest()
