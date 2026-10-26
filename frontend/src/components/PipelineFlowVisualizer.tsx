import React, { useState } from "react";
import { 
  ArrowRight, 
  ArrowDown,
  ShieldCheck, 
  Lock, 
  FileCheck2, 
  Sparkles, 
  BadgeCheck, 
  CheckCircle2, 
  ExternalLink,
  ChevronRight,
  Info,
  RefreshCw,
  Coins,
  Scale
} from "lucide-react";

export interface PipelineStageInfo {
  id: number;
  label: string;
  tagline: string;
  badge: string;
  cryptographicPrimitive: string;
  privacyGuarantee: string;
  practicalFlow: string;
  onChainState: string;
}

export const PIPELINE_STAGES: PipelineStageInfo[] = [
  {
    id: 1,
    label: "Inbound Donation",
    tagline: "Cryptographic Zero-PII Earmark Commitment",
    badge: "STAGE 1 • DONOR INFLOW",
    cryptographicPrimitive: "HMAC-SHA256 & Keccak-256 with 256-bit Random Blinding Nonce",
    privacyGuarantee: "Donor name, email, phone, and internal database ID are kept strictly off-chain in encrypted storage. Zero PII touches Solidity storage, calldata, or events.",
    practicalFlow: "Donor pledges 50 ETH for 'water infrastructure'. System generates random 256-bit blinding nonce, binds amount in integer minor units, and anchors commitment on-chain.",
    onChainState: "anchorDonationCommitmentBlinded(donationId, projectId, commitmentHash) anchored to EVM smart contract.",
  },
  {
    id: 2,
    label: "Escrow Condition",
    tagline: "Purpose-Bound Multi-Validator Smart Escrow",
    badge: "STAGE 2 • ESCROW ENFORCEMENT",
    cryptographicPrimitive: "Programmable EVM Escrow with 3-of-5 Validator Consensus & Earmark Hash H(Cat || Prj || Cor)",
    privacyGuarantee: "Capital is locked in a purpose-bound smart contract. Funds cannot be diverted to unapproved categories. Multi-sig validators verify tranche rules without learning vendor identities.",
    practicalFlow: "Escrow holds assets across DEX swap (Uniswap: 50 ETH -> 150k USDC) and cross-chain bridge (Stargate/CCTP) under strict performance-based tranches.",
    onChainState: "Smart contract validates earmark envelope and locks next disbursement until prior milestone impact proof is submitted.",
  },
  {
    id: 3,
    label: "Off-Chain Invoice Proof",
    tagline: "Salted Merkle Redacted Line-Item Commitment",
    badge: "STAGE 3 • RECEIPT AUDITING",
    cryptographicPrimitive: "Salted Merkle Tree Root + SHA-256 OCR Invoice Fingerprint",
    privacyGuarantee: "Local vendor bank wires, contractor identities, and beneficiary names are completely redacted off-chain. Only the cryptographic Merkle root is anchored on-chain.",
    practicalFlow: "Fiat wire settled to local borehole contractor in Kenya for casing pipes. Receipt OCR validates items against budget, and salted hash is submitted to ledger.",
    onChainState: "anchorExpenseAudit(expenseId, projectId, receiptCommitmentHash) verified via verifyReceiptCommitment().",
  },
  {
    id: 4,
    label: "Cryptographic Impact Verification",
    tagline: "Autonomous Lineage DAG & Attestation Certificate",
    badge: "STAGE 4 • PROOF OF IMPACT",
    cryptographicPrimitive: "Autonomous Multi-Hop Reconciliation + Merkle Inclusion Proofs + IoT Sensor Telemetry",
    privacyGuarantee: "Mathematical proof that donor funds flowed through each hop to real-world impact, verified without exposing any vulnerable community identities.",
    practicalFlow: "Reconciliation engine validates cross-chain hops, flags any diversion anomalies, and issues a tamper-proof Impact Certificate with IoT flow-meter attestations.",
    onChainState: "Impact certificate finalized and sealed on-chain, unlocking subsequent project tranches automatically.",
  },
];

export interface PipelineFlowVisualizerProps {
  activeStage?: number;
  onSelectStage?: (stageId: number) => void;
  showInspector?: boolean;
  className?: string;
  onNavigateToFlows?: () => void;
}

export const PipelineFlowVisualizer: React.FC<PipelineFlowVisualizerProps> = ({
  activeStage: controlledActiveStage,
  onSelectStage,
  showInspector = true,
  className = "",
  onNavigateToFlows,
}) => {
  const [internalStage, setInternalStage] = useState<number>(1);
  const [isSimulating, setIsSimulating] = useState<boolean>(false);

  const currentStageId = controlledActiveStage !== undefined ? controlledActiveStage : internalStage;
  const currentStage = PIPELINE_STAGES.find((s) => s.id === currentStageId) || PIPELINE_STAGES[0];

  const handleStageClick = (stageId: number) => {
    setInternalStage(stageId);
    if (onSelectStage) {
      onSelectStage(stageId);
    }
  };

  const handleSimulateJourney = () => {
    if (isSimulating) return;
    setIsSimulating(true);
    let step = 1;
    handleStageClick(1);

    const interval = setInterval(() => {
      step += 1;
      if (step <= 4) {
        handleStageClick(step);
      } else {
        clearInterval(interval);
        setIsSimulating(false);
      }
    }, 1800);
  };

  return (
    <div className={`pipeline-visualizer-container ${className}`}>
      {/* Visual Header */}
      <div className="pipeline-header-row">
        <div className="pipeline-title-group">
          <span className="pipeline-super-badge">
            <ShieldCheck size={13} />
            DECENTRALIZED MULTI-HOP DONATION TRACKING
          </span>
          <h2 className="pipeline-main-title">Auditable Impact Architecture</h2>
          <p className="pipeline-sub-title">
            Passively tracing crypto donations across DEX swaps, bridges, and local fiat vendors to verified physical impact—with zero beneficiary PII exposure.
          </p>
        </div>

        <div className="pipeline-header-controls">
          <button 
            type="button"
            className={`simulate-flow-btn ${isSimulating ? "simulating" : ""}`}
            onClick={handleSimulateJourney}
            disabled={isSimulating}
          >
            <RefreshCw size={14} className={isSimulating ? "spin-icon" : ""} />
            {isSimulating ? `Tracing Stage ${currentStageId}/4...` : "Simulate 50 ETH Flow"}
          </button>
          {onNavigateToFlows && (
            <button
              type="button"
              className="view-flows-btn"
              onClick={onNavigateToFlows}
            >
              Explore Multi-Hop Flows <ChevronRight size={14} />
            </button>
          )}
        </div>
      </div>

      {/* The 4-Stage Visual Diagram Matching User Specification */}
      <div className="pipeline-diagram-canvas" role="region" aria-label="4-stage donation tracking pipeline">
        <div className="pipeline-diagram-content">
          {/* Row 1: Inbound Donation -> Escrow Condition -> Off-Chain Invoice Proof */}
          <div className="pipeline-diagram-row row-1">
            {/* Stage 1: Inbound Donation */}
            <button
              type="button"
              className={`pipeline-pill ${currentStageId === 1 ? "active" : ""}`}
              onClick={() => handleStageClick(1)}
              aria-label="Stage 1: Inbound Donation"
            >
              <span className="pill-text">Inbound Donation</span>
              {currentStageId === 1 && <span className="active-glow-dot" />}
            </button>

            {/* Arrow 1 */}
            <div className="pipeline-arrow-separator">
              <span className="pipeline-arrow-glyph">➔</span>
            </div>

            {/* Stage 2: Escrow Condition */}
            <button
              type="button"
              className={`pipeline-pill ${currentStageId === 2 ? "active" : ""}`}
              onClick={() => handleStageClick(2)}
              aria-label="Stage 2: Escrow Condition"
            >
              <span className="pill-text">Escrow Condition</span>
              {currentStageId === 2 && <span className="active-glow-dot" />}
            </button>

            {/* Arrow 2 */}
            <div className="pipeline-arrow-separator">
              <span className="pipeline-arrow-glyph">➔</span>
            </div>

            {/* Stage 3: Off-Chain Invoice Proof */}
            <button
              type="button"
              className={`pipeline-pill ${currentStageId === 3 ? "active" : ""}`}
              onClick={() => handleStageClick(3)}
              aria-label="Stage 3: Off-Chain Invoice Proof"
            >
              <span className="pill-text">Off-Chain Invoice Proof</span>
              {currentStageId === 3 && <span className="active-glow-dot" />}
            </button>
          </div>

          {/* Row 2: Cryptographic Impact Verification */}
          <div className="pipeline-diagram-row row-2">
            <div className="pipeline-return-arrow" aria-hidden="true">
              <div className="corner-turn-line" />
              <span className="pipeline-arrow-glyph">➔</span>
            </div>

            {/* Stage 4: Cryptographic Impact Verification */}
            <button
              type="button"
              className={`pipeline-pill ${currentStageId === 4 ? "active" : ""}`}
              onClick={() => handleStageClick(4)}
              aria-label="Stage 4: Cryptographic Impact Verification"
            >
              <span className="pill-text">Cryptographic Impact Verification</span>
              {currentStageId === 4 && <span className="active-glow-dot" />}
            </button>
          </div>
        </div>
      </div>

      {/* Interactive Inspector Drawer for Selected Stage */}
      {showInspector && currentStage && (
        <div className="pipeline-inspector-card">
          <div className="inspector-top-bar">
            <div className="inspector-badge-group">
              <span className="stage-id-chip">{currentStage.badge}</span>
              <span className="stage-tagline">{currentStage.tagline}</span>
            </div>
            <div className="inspector-actions">
              <span className="active-indicator">
                <CheckCircle2 size={14} /> Active Inspection
              </span>
            </div>
          </div>

          <div className="inspector-grid">
            {/* Column 1: Privacy Guarantee */}
            <div className="inspector-col">
              <div className="col-header">
                <ShieldCheck size={16} className="text-emerald" />
                <h4>Privacy & Shielding Guarantee</h4>
              </div>
              <p className="col-body">{currentStage.privacyGuarantee}</p>
              <div className="col-meta-box">
                <span className="meta-label">Off-Chain Isolation:</span>
                <span className="meta-value">Zero Donor/Beneficiary PII on Ledger</span>
              </div>
            </div>

            {/* Column 2: Cryptographic Primitive */}
            <div className="inspector-col">
              <div className="col-header">
                <Lock size={16} className="text-amber" />
                <h4>Cryptographic Verification Scheme</h4>
              </div>
              <p className="col-body">{currentStage.cryptographicPrimitive}</p>
              <div className="col-meta-box">
                <span className="meta-label">On-Chain State:</span>
                <code className="meta-code">{currentStage.onChainState}</code>
              </div>
            </div>

            {/* Column 3: Real-World Multi-Hop Execution */}
            <div className="inspector-col">
              <div className="col-header">
                <Sparkles size={16} className="text-cyan" />
                <h4>Practical Multi-Hop Execution</h4>
              </div>
              <p className="col-body">{currentStage.practicalFlow}</p>
              <div className="col-meta-box">
                <span className="meta-label">Earmark Target:</span>
                <span className="meta-value">PRJ-KENYA-WATER (Clean Borehole Pipes)</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
