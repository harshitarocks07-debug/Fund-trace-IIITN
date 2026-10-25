from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field, ConfigDict

class FlowHopBase(BaseModel):
    hopNumber: int = Field(..., ge=1)
    hopType: str = Field(..., description="CRYPTO_DONATION, DEX_SWAP, CROSS_CHAIN_BRIDGE, FIAT_OFFRAMP, VENDOR_DISBURSEMENT")
    title: str = Field(..., min_length=2)
    fromEntity: str
    toEntity: str
    inputAsset: str
    inputAmount: float = Field(..., gt=0)
    outputAsset: str
    outputAmount: float = Field(..., gt=0)
    exchangeRate: float = 1.0
    feeAmount: float = 0.0
    txHash: str
    chainNetwork: str
    status: str = "CONFIRMED"
    linkedExpenseId: Optional[str] = None
    linkedReceiptHash: Optional[str] = None
    evidenceSummary: str = ""

class FlowHopCreate(FlowHopBase):
    pass

class FlowHopOut(FlowHopBase):
    id: str
    flowId: str
    createdAt: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)

class FinancialFlowCreate(BaseModel):
    projectId: str
    title: str = Field(..., min_length=3)
    earmarkTag: str = Field(..., min_length=2)
    sourceChain: str = "Ethereum Mainnet (L1)"
    initialAsset: str = "ETH"
    initialAmount: float = Field(..., gt=0)
    initialFiatEstimate: float = Field(..., gt=0)
    finalFiatAvailable: float = Field(..., gt=0)

class FinancialFlowOut(BaseModel):
    id: str
    projectId: str
    title: str
    earmarkTag: str
    sourceChain: str
    initialAsset: str
    initialAmount: float
    initialFiatEstimate: float
    finalFiatAvailable: float
    disbursedFiatAmount: float
    remainingFiatAmount: float
    status: str
    hops: List[FlowHopOut] = []
    createdAt: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)

class FlowAnomaly(BaseModel):
    severity: str  # "HIGH", "MEDIUM", "LOW"
    anomalyType: str  # "EARMARK_MISMATCH", "UNEXPECTED_SLIPPAGE", "OVERDRAW", "MISSING_EVIDENCE"
    description: str
    affectedHop: Optional[int] = None
    recommendation: str

class FlowReconciliationResult(BaseModel):
    flowId: str
    earmarkTag: str
    status: str
    initialAmountCrypto: str
    finalFiatAvailable: float
    totalDisbursedToVendors: float
    remainingBalance: float
    hopCount: int
    anomaliesFound: List[FlowAnomaly] = []
    isReconciled: bool
    verdict: str

class TimelineImpactView(BaseModel):
    flow: FinancialFlowOut
    reconciliation: FlowReconciliationResult
    milestones: List[dict] = []

class ZKAttestationProof(BaseModel):
    flowId: str
    hopNumber: int
    proofType: str = "ZKTLS_MPC_NOTARY_PROOF"
    notaryPublicKey: str
    merkleCommitment: str
    redactedFields: List[str] = [
        "beneficiary_personal_identities",
        "beneficiary_aadhaar_tax_ids",
        "vendor_bank_account_numbers",
        "bank_branch_internal_routing",
    ]
    verifiedAttributes: dict
    timestamp: str
    isValid: bool = True
    privacyGuarantee: str = "Zero PII leaked: Attests bank settlement via TLS session commitments while preserving recipient confidentiality."

class PassiveWebhookEvent(BaseModel):
    eventType: str = Field(..., description="ONCHAIN_TRANSFER, DEX_SWAP, BRIDGE_TRANSFER, FIAT_OFFRAMP, VENDOR_PAYMENT")
    network: str = Field(..., description="Ethereum L1, Polygon, LayerZero, Banking API")
    txHash: str = Field(..., min_length=4)
    fromEntity: str
    toEntity: str
    inputAsset: str
    inputAmount: float = Field(..., gt=0)
    outputAsset: str
    outputAmount: float = Field(..., gt=0)
    exchangeRate: float = 1.0
    feeAmount: float = 0.0
    evidenceSummary: str = ""
    linkedExpenseId: Optional[str] = None
    linkedReceiptHash: Optional[str] = None

class MerkleProofStep(BaseModel):
    hopNumber: int
    stage: str
    hopHash: str
    siblingHash: Optional[str] = None
    direction: str = "leaf"

class ImpactCertificateOut(BaseModel):
    certificateId: str
    flowId: str
    title: str
    earmarkTag: str
    donorOrigin: str
    initialCryptoAmount: str
    finalFiatRealized: float
    totalDisbursedToVendors: float
    remainingBalance: float
    hopCount: int
    merkleRoot: str
    proofSteps: List[MerkleProofStep] = []
    auditedReceiptFingerprints: List[str] = []
    blockchainContractAddress: str
    status: str
    isReconciled: bool
    privacyCompliance: str
    issuedAt: str

