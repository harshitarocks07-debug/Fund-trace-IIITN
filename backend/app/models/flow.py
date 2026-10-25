from sqlalchemy import Column, Integer, String, Float, Text, ForeignKey, DateTime
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.db.base import Base

class FinancialFlow(Base):
    __tablename__ = "financial_flows"

    id = Column(String(50), primary_key=True, index=True)
    project_id = Column(String(50), ForeignKey("projects.id"), nullable=False)
    title = Column(String(255), nullable=False)
    earmark_tag = Column(String(100), nullable=False)
    source_chain = Column(String(50), default="Ethereum Mainnet (L1)", nullable=False)
    initial_asset = Column(String(20), default="ETH", nullable=False)
    initial_amount = Column(Float, nullable=False)
    initial_fiat_estimate = Column(Float, nullable=False)
    final_fiat_available = Column(Float, nullable=False)
    disbursed_fiat_amount = Column(Float, default=0.0, nullable=False)
    remaining_fiat_amount = Column(Float, nullable=False)
    status = Column(String(50), default="Active", nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    hops = relationship("FlowHop", back_populates="flow", cascade="all, delete-orphan", order_by="FlowHop.hop_number")

    def __repr__(self):
        return f"<FinancialFlow {self.id} earmark='{self.earmark_tag}' status='{self.status}'>"

class FlowHop(Base):
    __tablename__ = "flow_hops"

    id = Column(String(50), primary_key=True, index=True)
    flow_id = Column(String(50), ForeignKey("financial_flows.id"), nullable=False, index=True)
    hop_number = Column(Integer, nullable=False)
    hop_type = Column(String(50), nullable=False)  # CRYPTO_DONATION, DEX_SWAP, CROSS_CHAIN_BRIDGE, FIAT_OFFRAMP, VENDOR_DISBURSEMENT
    title = Column(String(255), nullable=False)
    from_entity = Column(String(255), nullable=False)
    to_entity = Column(String(255), nullable=False)
    input_asset = Column(String(20), nullable=False)
    input_amount = Column(Float, nullable=False)
    output_asset = Column(String(20), nullable=False)
    output_amount = Column(Float, nullable=False)
    exchange_rate = Column(Float, default=1.0, nullable=False)
    fee_amount = Column(Float, default=0.0, nullable=False)
    tx_hash = Column(String(100), nullable=False)
    chain_network = Column(String(100), nullable=False)
    status = Column(String(50), default="CONFIRMED", nullable=False)
    linked_expense_id = Column(String(50), ForeignKey("expenses.id"), nullable=True)
    linked_receipt_hash = Column(String(64), nullable=True)
    evidence_summary = Column(Text, default="", nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    flow = relationship("FinancialFlow", back_populates="hops")

    def __repr__(self):
        return f"<FlowHop #{self.hop_number} type='{self.hop_type}' tx='{self.tx_hash[:12]}...'>"

# Backward compatibility aliases
FlowNode = FinancialFlow
FlowAllocation = FlowHop
FlowDisbursement = FlowHop
FlowRefund = FlowHop

