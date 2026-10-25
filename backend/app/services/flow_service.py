from datetime import datetime
from typing import List, Optional, Tuple
from sqlalchemy.orm import Session
from app.models.flow import FinancialFlow, FlowHop
from app.models.expense import Expense
from app.models.receipt import Receipt
from app.models.project import Project
from app.schemas.flow import (
    FinancialFlowCreate,
    FinancialFlowOut,
    FlowHopCreate,
    FlowHopOut,
    FlowAnomaly,
    FlowReconciliationResult,
    TimelineImpactView,
)

def serialize_hop(hop: FlowHop) -> FlowHopOut:
    return FlowHopOut(
        id=hop.id,
        flowId=hop.flow_id,
        hopNumber=hop.hop_number,
        hopType=hop.hop_type,
        title=hop.title,
        fromEntity=hop.from_entity,
        toEntity=hop.to_entity,
        inputAsset=hop.input_asset,
        inputAmount=hop.input_amount,
        outputAsset=hop.output_asset,
        outputAmount=hop.output_amount,
        exchangeRate=hop.exchange_rate,
        feeAmount=hop.fee_amount,
        txHash=hop.tx_hash,
        chainNetwork=hop.chain_network,
        status=hop.status,
        linkedExpenseId=hop.linked_expense_id,
        linkedReceiptHash=hop.linked_receipt_hash,
        evidenceSummary=hop.evidence_summary,
        createdAt=hop.created_at,
    )

def serialize_flow(flow: FinancialFlow) -> FinancialFlowOut:
    return FinancialFlowOut(
        id=flow.id,
        projectId=flow.project_id,
        title=flow.title,
        earmarkTag=flow.earmark_tag,
        sourceChain=flow.source_chain,
        initialAsset=flow.initial_asset,
        initialAmount=flow.initial_amount,
        initialFiatEstimate=flow.initial_fiat_estimate,
        finalFiatAvailable=flow.final_fiat_available,
        disbursedFiatAmount=flow.disbursed_fiat_amount,
        remainingFiatAmount=flow.remaining_fiat_amount,
        status=flow.status,
        hops=[serialize_hop(h) for h in flow.hops],
        createdAt=flow.created_at,
    )

def create_financial_flow(db: Session, flow_in: FinancialFlowCreate) -> FinancialFlow:
    """Create a new tracked multi-hop financial pipeline for an earmarked donation."""
    project = db.query(Project).filter(Project.id == flow_in.projectId).first()
    if not project:
        raise ValueError(f"Project with ID '{flow_in.projectId}' does not exist.")

    count = db.query(FinancialFlow).count()
    flow_id = f"FLOW-{str(count + 1).zfill(3)}"

    flow = FinancialFlow(
        id=flow_id,
        project_id=flow_in.projectId,
        title=flow_in.title,
        earmark_tag=flow_in.earmarkTag,
        source_chain=flow_in.sourceChain,
        initial_asset=flow_in.initialAsset,
        initial_amount=flow_in.initialAmount,
        initial_fiat_estimate=flow_in.initialFiatEstimate,
        final_fiat_available=flow_in.finalFiatAvailable,
        disbursed_fiat_amount=0.0,
        remaining_fiat_amount=flow_in.finalFiatAvailable,
        status="Active",
    )
    db.add(flow)
    db.commit()
    db.refresh(flow)
    return flow

def ingest_flow_hop(db: Session, flow_id: str, hop_in: FlowHopCreate) -> FlowHop:
    """Passively ingest a transaction hop into an existing multi-hop financial flow."""
    flow = db.query(FinancialFlow).filter(FinancialFlow.id == flow_id).first()
    if not flow:
        raise ValueError(f"Financial flow '{flow_id}' does not exist.")

    hop_id = f"HOP-{flow_id}-{str(hop_in.hopNumber).zfill(2)}"
    
    # If this hop is linked to an expense, verify receipt fingerprint
    receipt_hash = hop_in.linkedReceiptHash
    if hop_in.linkedExpenseId:
        expense = db.query(Expense).filter(Expense.id == hop_in.linkedExpenseId).first()
        if expense and expense.receipt_hash:
            receipt_hash = expense.receipt_hash

    hop = FlowHop(
        id=hop_id,
        flow_id=flow.id,
        hop_number=hop_in.hopNumber,
        hop_type=hop_in.hopType,
        title=hop_in.title,
        from_entity=hop_in.fromEntity,
        to_entity=hop_in.toEntity,
        input_asset=hop_in.inputAsset,
        input_amount=hop_in.inputAmount,
        output_asset=hop_in.outputAsset,
        output_amount=hop_in.outputAmount,
        exchange_rate=hop_in.exchangeRate,
        fee_amount=hop_in.feeAmount,
        tx_hash=hop_in.txHash,
        chain_network=hop_in.chainNetwork,
        status=hop_in.status,
        linked_expense_id=hop_in.linkedExpenseId,
        linked_receipt_hash=receipt_hash,
        evidence_summary=hop_in.evidenceSummary,
    )
    db.add(hop)

    # If this is a vendor disbursement hop, update flow balance
    if hop_in.hopType == "VENDOR_DISBURSEMENT":
        flow.disbursed_fiat_amount += hop_in.outputAmount
        flow.remaining_fiat_amount = max(0.0, flow.final_fiat_available - flow.disbursed_fiat_amount)
        if flow.remaining_fiat_amount == 0:
            flow.status = "Fully Disbursed"

    db.commit()
    db.refresh(hop)
    return hop

def link_expense_to_flow(db: Session, flow_id: str, expense_id: str) -> FlowHop:
    """Link an off-chain authorized vendor expense claim directly to an earmarked multi-hop flow."""
    flow = db.query(FinancialFlow).filter(FinancialFlow.id == flow_id).first()
    if not flow:
        raise ValueError(f"Flow '{flow_id}' does not exist.")

    expense = db.query(Expense).filter(Expense.id == expense_id).first()
    if not expense:
        raise ValueError(f"Expense '{expense_id}' does not exist.")

    # Determine next hop number
    max_hop = db.query(FlowHop).filter(FlowHop.flow_id == flow_id).count()
    next_hop_num = max_hop + 1

    hop_create = FlowHopCreate(
        hopNumber=next_hop_num,
        hopType="VENDOR_DISBURSEMENT",
        title=f"Vendor Payment: {expense.vendor} ({expense.category})",
        fromEntity="NGO Project Treasury (INR Account)",
        toEntity=f"Vendor: {expense.vendor}",
        inputAsset="INR",
        inputAmount=expense.claimed_amount,
        outputAsset="INR",
        outputAmount=expense.claimed_amount,
        exchangeRate=1.0,
        feeAmount=0.0,
        txHash=f"BANK-WIRE-{expense.id}",
        chainNetwork="Off-Chain Banking Wire / Local Settlement",
        status="CONFIRMED",
        linkedExpenseId=expense.id,
        linkedReceiptHash=expense.receipt_hash,
        evidenceSummary=f"Invoice #{expense.invoice_number} approved by Auditor. SHA-256 seal: {expense.receipt_hash[:12]}...",
    )
    return ingest_flow_hop(db, flow_id, hop_create)

def reconcile_flow(db: Session, flow_id: str) -> FlowReconciliationResult:
    """
    Autonomously reconcile the multi-hop flow from original crypto donation
    through DEX swap, cross-chain bridge, and fiat off-ramp to vendor disbursements.
    Flags earmark diversions, overdraws, and missing evidence.
    """
    flow = db.query(FinancialFlow).filter(FinancialFlow.id == flow_id).first()
    if not flow:
        raise ValueError(f"Flow '{flow_id}' does not exist.")

    hops = db.query(FlowHop).filter(FlowHop.flow_id == flow_id).order_by(FlowHop.hop_number).all()
    anomalies: List[FlowAnomaly] = []

    # 1. Check Overdraw
    if flow.disbursed_fiat_amount > flow.final_fiat_available:
        over_diff = flow.disbursed_fiat_amount - flow.final_fiat_available
        anomalies.append(
            FlowAnomaly(
                severity="HIGH",
                anomalyType="OVERDRAW",
                description=f"Disbursed vendor payments (₹{flow.disbursed_fiat_amount:,.2f}) exceed off-ramped fiat balance (₹{flow.final_fiat_available:,.2f}) by ₹{over_diff:,.2f}.",
                recommendation="Audit project treasury account and freeze unbacked claims.",
            )
        )

    # 2. Check Earmark Tag Compatibility on all Vendor Disbursements
    earmark_lower = flow.earmark_tag.lower()
    for h in hops:
        if h.hop_type == "VENDOR_DISBURSEMENT" and h.linked_expense_id:
            exp = db.query(Expense).filter(Expense.id == h.linked_expense_id).first()
            if exp:
                cat_lower = exp.category.lower()
                # Check if expense category is compatible with earmark tag
                keywords = [k.strip() for k in earmark_lower.split() if len(k) > 3]
                matches_earmark = any(kw in cat_lower for kw in keywords) or (earmark_lower in cat_lower) or (cat_lower in earmark_lower)
                
                # Check for incompatible categories
                incompatible_categories = ["travel", "entertainment", "office supplies", "marketing", "miscellaneous"]
                if not matches_earmark and cat_lower in incompatible_categories:
                    anomalies.append(
                        FlowAnomaly(
                            severity="HIGH",
                            anomalyType="EARMARK_MISMATCH",
                            affectedHop=h.hop_number,
                            description=f"Hop #{h.hop_number}: Expense {exp.id} category '{exp.category}' conflicts with earmark '{flow.earmark_tag}'.",
                            recommendation="Auditor review required: Ensure funds are not diverted away from stipulated cause.",
                        )
                    )

        # 3. Check Receipt Evidence Fingerprint on Disbursements
        if h.hop_type == "VENDOR_DISBURSEMENT":
            if not h.linked_receipt_hash or len(h.linked_receipt_hash) != 64:
                anomalies.append(
                    FlowAnomaly(
                        severity="MEDIUM",
                        anomalyType="MISSING_EVIDENCE",
                        affectedHop=h.hop_number,
                        description=f"Hop #{h.hop_number}: Vendor payment lacks cryptographic SHA-256 receipt fingerprint.",
                        recommendation="Require NGO Admin to attach and verify original vendor invoice evidence.",
                    )
                )

        # 4. Check DEX Swap Slippage
        if h.hop_type == "DEX_SWAP":
            expected_output = h.input_amount * h.exchange_rate
            if h.output_amount < expected_output * 0.94:  # > 6% loss
                anomalies.append(
                    FlowAnomaly(
                        severity="LOW",
                        anomalyType="UNEXPECTED_SLIPPAGE",
                        affectedHop=h.hop_number,
                        description=f"Hop #{h.hop_number}: High DEX swap slippage detected. Expected {expected_output:.2f} {h.output_asset}, received {h.output_amount:.2f}.",
                        recommendation="Verify MEV protection or pool fee tier on decentralized exchange.",
                    )
                )

        # 5. Check Unexplained Transfers (Lacking verifiable settlement hash or counterparty)
        if not h.tx_hash or len(h.tx_hash.strip()) < 4 or "UNKNOWN" in h.to_entity.upper():
            anomalies.append(
                FlowAnomaly(
                    severity="HIGH",
                    anomalyType="UNEXPLAINED_TRANSFER",
                    affectedHop=h.hop_number,
                    description=f"Hop #{h.hop_number}: Unexplained transfer detected lacking verifiable transaction identifier or destination counterparty.",
                    recommendation="Freeze unverified destination and perform forensic auditor review.",
                )
            )

        # 6. Check Inconsistencies Between Published Reports and Recorded Evidence
        if h.hop_type == "VENDOR_DISBURSEMENT" and h.linked_expense_id:
            exp = db.query(Expense).filter(Expense.id == h.linked_expense_id).first()
            if exp and exp.extracted_amount is not None and exp.extracted_amount != exp.claimed_amount:
                diff = abs(exp.claimed_amount - exp.extracted_amount)
                anomalies.append(
                    FlowAnomaly(
                        severity="MEDIUM",
                        anomalyType="REPORT_INCONSISTENCY",
                        affectedHop=h.hop_number,
                        description=f"Hop #{h.hop_number}: Inconsistency detected. Claimed expense amount (₹{exp.claimed_amount:,.2f}) differs from OCR-extracted receipt total (₹{exp.extracted_amount:,.2f}) by ₹{diff:,.2f}.",
                        recommendation="Auditor must reconcile invoice line items before approving on-chain settlement.",
                    )
                )

    is_reconciled = (len(anomalies) == 0)
    verdict = (
        "Reconciled & Verified: End-to-end timeline intact. All vendor spending matches earmark and authorized off-ramp balance."
        if is_reconciled
        else f"Reconciliation flagged {len(anomalies)} anomaly/anomalies requiring auditor attention."
    )

    return FlowReconciliationResult(
        flowId=flow.id,
        earmarkTag=flow.earmark_tag,
        status=flow.status,
        initialAmountCrypto=f"{flow.initial_amount} {flow.initial_asset}",
        finalFiatAvailable=flow.final_fiat_available,
        totalDisbursedToVendors=flow.disbursed_fiat_amount,
        remainingBalance=flow.remaining_fiat_amount,
        hopCount=len(hops),
        anomaliesFound=anomalies,
        isReconciled=is_reconciled,
        verdict=verdict,
    )

def reconstruct_timeline_impact_view(db: Session, flow_id: str) -> TimelineImpactView:
    """Build a complete, transparent impact timeline from crypto donation to ground spending."""
    flow = db.query(FinancialFlow).filter(FinancialFlow.id == flow_id).first()
    if not flow:
        raise ValueError(f"Flow '{flow_id}' does not exist.")

    reconciliation = reconcile_flow(db, flow_id)
    flow_out = serialize_flow(flow)

    milestones = []
    for h in flow.hops:
        milestones.append({
            "hopNumber": h.hop_number,
            "stage": h.hop_type,
            "title": h.title,
            "amountSummary": f"{h.input_amount:,.2f} {h.input_asset} ➔ {h.output_amount:,.2f} {h.output_asset}",
            "route": f"{h.from_entity} ➔ {h.to_entity}",
            "network": h.chain_network,
            "txRef": h.tx_hash,
            "evidence": h.evidence_summary,
            "status": h.status,
            "timestamp": h.created_at.isoformat() if h.created_at else None,
        })

    return TimelineImpactView(
        flow=flow_out,
        reconciliation=reconciliation,
        milestones=milestones,
    )
