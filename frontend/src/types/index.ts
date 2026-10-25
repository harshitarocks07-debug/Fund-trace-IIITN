export type Role = "Donor" | "NGO admin" | "Auditor";
export type ExpenseStatus = "Pending review" | "Approved" | "Rejected" | "More evidence";
export type RiskLevel = "Low" | "Medium" | "High" | "Critical";

export interface AuthUser {
  id: number | string;
  email: string;
  full_name: string;
  role: Role;
  organization?: string;
  is_active: boolean;
  token?: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: AuthUser;
}

export interface RoleCapabilities {
  can_create_project: boolean;
  can_submit_expense: boolean;
  can_review_expense: boolean;
  can_donate: boolean;
  can_verify_receipts: boolean;
  can_view_audit_log: boolean;
}

export interface PermissionCheckResponse {
  role: Role;
  permissions: string[];
  capabilities: RoleCapabilities;
}

export interface ReceiptOCRResult {
  vendor?: string;
  invoiceNumber?: string;
  date?: string;
  amount?: number;
  confidence: number;
  ocrStatus: string;
  rawText?: string;
  warnings: string[];
}

export interface ReceiptMetadata {
  id: string;
  original_filename: string;
  file_size: number;
  mime_type: string;
  sha256_hash: string;
  expense_id?: string;
  uploaded_by_id?: number;
  created_at?: string;
  extracted_vendor?: string;
  extracted_invoice_number?: string;
  extracted_date?: string;
  extracted_amount?: number;
  ocr_confidence?: number;
  ocr_status?: string;
  raw_text?: string;
}

export interface ReceiptVerifyResponse {
  receiptHash: string;
  isDuplicate: boolean;
  matchingExpenses: string[];
  matchingReceipts: string[];
  message: string;
  ocrResult?: ReceiptOCRResult;
}

export interface Project {
  id: string;
  name: string;
  ngo: string;
  description: string;
  budget: number;
  raised: number;
  location: string;
  category: string;
}

export interface Donation {
  id: string;
  projectId: string;
  donor: string;
  amount: number;
  date: string;
  reference: string;
}

export interface Expense {
  id: string;
  projectId: string;
  vendor: string;
  category: string;
  invoiceNumber: string;
  claimedAmount: number;
  receiptName: string;
  receiptHash: string;
  receiptId?: string;
  extractedAmount?: number;
  extractedVendor?: string;
  extractedInvoiceNumber?: string;
  extractedDate?: string;
  status: ExpenseStatus;
  riskScore: number;
  riskReasons: string[];
  date: string;
  blockchainStatus: "Not submitted" | "Submitting" | "Confirmed" | "Failed";
  blockchainTxHash?: string;
  blockchainBlockNumber?: number;
  blockchainAnchoredAt?: string;
  blockchainCommitmentRoot?: string;
}

export interface AuditEntry {
  id: string;
  expenseId: string;
  action: string;
  actor: string;
  reason: string;
  date: string;
}

export interface FlowHop {
  id: string;
  flowId: string;
  hopNumber: number;
  hopType: "CRYPTO_DONATION" | "DEX_SWAP" | "CROSS_CHAIN_BRIDGE" | "FIAT_OFFRAMP" | "VENDOR_DISBURSEMENT" | string;
  title: string;
  fromEntity: string;
  toEntity: string;
  inputAsset: string;
  inputAmount: number;
  outputAsset: string;
  outputAmount: number;
  exchangeRate: number;
  feeAmount: number;
  txHash: string;
  chainNetwork: string;
  status: string;
  linkedExpenseId?: string;
  linkedReceiptHash?: string;
  evidenceSummary?: string;
  createdAt?: string;
}

export interface FinancialFlow {
  id: string;
  projectId: string;
  title: string;
  earmarkTag: string;
  sourceChain: string;
  initialAsset: string;
  initialAmount: number;
  initialFiatEstimate: number;
  finalFiatAvailable: number;
  disbursedFiatAmount: number;
  remainingFiatAmount: number;
  status: string;
  hops: FlowHop[];
  createdAt?: string;
}

export interface FlowAnomaly {
  severity: "HIGH" | "MEDIUM" | "LOW" | string;
  anomalyType: "EARMARK_MISMATCH" | "UNEXPECTED_SLIPPAGE" | "OVERDRAW" | "MISSING_EVIDENCE" | string;
  description: string;
  affectedHop?: number;
  recommendation: string;
}

export interface FlowReconciliationResult {
  flowId: string;
  earmarkTag: string;
  status: string;
  initialAmountCrypto: string;
  finalFiatAvailable: number;
  totalDisbursedToVendors: number;
  remainingBalance: number;
  hopCount: number;
  anomaliesFound: FlowAnomaly[];
  isReconciled: boolean;
  verdict: string;
}

export interface TimelineMilestone {
  hopNumber: number;
  stage: string;
  title: string;
  amountSummary: string;
  route: string;
  network: string;
  txRef: string;
  evidence: string;
  status: string;
  timestamp?: string;
}

export interface TimelineImpactView {
  flow: FinancialFlow;
  reconciliation: FlowReconciliationResult;
  milestones: TimelineMilestone[];
}

export interface ZKAttestationProof {
  flowId: string;
  hopNumber: number;
  proofType: string;
  notaryPublicKey: string;
  merkleCommitment: string;
  redactedFields: string[];
  verifiedAttributes: Record<string, unknown>;
  timestamp: string;
  isValid: boolean;
  privacyGuarantee: string;
}

export interface MerkleProofStep {
  hopNumber: number;
  stage: string;
  hopHash: string;
  siblingHash?: string;
  direction: string;
}

export interface ImpactCertificateOut {
  certificateId: string;
  flowId: string;
  title: string;
  earmarkTag: string;
  donorOrigin: string;
  initialCryptoAmount: string;
  finalFiatRealized: number;
  totalDisbursedToVendors: number;
  remainingBalance: number;
  hopCount: number;
  merkleRoot: string;
  proofSteps: MerkleProofStep[];
  auditedReceiptFingerprints: string[];
  blockchainContractAddress: string;
  status: string;
  isReconciled: boolean;
  privacyCompliance: string;
  issuedAt: string;
}

export interface FundTraceData {
  projects: Project[];
  donations: Donation[];
  expenses: Expense[];
  auditLog: AuditEntry[];
}
