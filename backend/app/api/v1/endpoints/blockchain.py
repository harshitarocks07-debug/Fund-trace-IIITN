import logging

from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.models.user import User
from app.models.expense import Expense
from app.core.permissions import require_ngo_admin_or_auditor, get_current_user
from app.core.config import settings
from app.services.blockchain_service import (
    anchor_expense_on_chain,
    verify_on_chain_seal,
    get_ledger_status,
)
from web3 import Web3

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("/networks")
def get_supported_networks(
    _current_user: User = Depends(get_current_user),
):
    """Return live connectivity and escrow-deployment status for supported EVM testnets."""
    networks = [
        {
            "network": "Ethereum Sepolia",
            "chainId": 11155111,
            "rpcUrl": settings.SEPOLIA_RPC_URL,
            "escrowAddress": settings.SEPOLIA_ESCROW_ADDRESS,
        },
        {
            "network": "Polygon Amoy",
            "chainId": 80002,
            "rpcUrl": settings.POLYGON_AMOY_RPC_URL,
            "escrowAddress": settings.POLYGON_AMOY_ESCROW_ADDRESS,
        },
    ]
    for item in networks:
        rpc_url = item.pop("rpcUrl")
        item["configured"] = bool(rpc_url and Web3.is_address(item["escrowAddress"]))
        item["escrowDeployed"] = False
        item["rpcConnected"] = False
        item["latestBlock"] = None
        item["observedChainId"] = None
        if not rpc_url:
            item["status"] = "RPC not configured"
            continue
        try:
            web3 = Web3(Web3.HTTPProvider(rpc_url, request_kwargs={"timeout": 3}))
            if web3.is_connected():
                observed_chain_id = web3.eth.chain_id
                item["observedChainId"] = observed_chain_id
                item["rpcConnected"] = observed_chain_id == item["chainId"]
                if item["rpcConnected"]:
                    item["latestBlock"] = web3.eth.block_number
                    if item["configured"]:
                        item["escrowDeployed"] = bool(
                            web3.eth.get_code(item["escrowAddress"])
                        )
                    item["status"] = "Connected" if item["escrowDeployed"] else (
                        "Connected; escrow contract not found"
                    )
                else:
                    item["status"] = "Connected to unexpected chain ID"
            else:
                item["status"] = "RPC unreachable"
        except Exception as error:
            logger.warning(
                "RPC status check failed for %s (%s)",
                item["network"],
                type(error).__name__,
            )
            item["status"] = "RPC check failed"
    return {"networks": networks, "validatorQuorum": "3 of 5"}

@router.post("/anchor-expense/{expense_id}", status_code=status.HTTP_200_OK)
def anchor_expense(
    expense_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_ngo_admin_or_auditor),
):
    """
    Anchor an approved expense claim and its off-chain SHA-256 receipt fingerprint
    to the decentralized EVM smart contract ledger.
    Authorized for Independent Auditors and NGO Admins.
    """
    expense = db.query(Expense).filter(Expense.id == expense_id).first()
    if not expense:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Expense with ID '{expense_id}' not found.",
        )

    try:
        result = anchor_expense_on_chain(db, expense, current_user)
        return result
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )

@router.get("/verify/{expense_id}")
def verify_expense_seal(
    expense_id: str,
    receipt_hash: str = Query(..., min_length=64, max_length=64, description="SHA-256 fingerprint to verify"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Cryptographically verify whether a presented receipt file's fingerprint
    matches the on-chain seal recorded by an auditor.
    Accessible to all authenticated users (Donors, NGO Admins, Auditors).
    """
    return verify_on_chain_seal(db, expense_id, receipt_hash)

@router.get("/status")
def get_status(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get the current blockchain ledger network and smart contract status."""
    return get_ledger_status(db)
