import { useEffect, useState } from "react";
import { 
  Activity, 
  AlertCircle, 
  AlertTriangle, 
  ArrowRight, 
  ArrowRightLeft, 
  BadgeCheck, 
  CheckCircle2, 
  Coins, 
  ExternalLink, 
  FileCheck2, 
  GitFork, 
  Layers, 
  Link2, 
  Lock, 
  RefreshCw, 
  ShieldAlert, 
  ShieldCheck, 
  SlidersHorizontal, 
  Sparkles, 
  Wallet,
  X 
} from "lucide-react";
import type { 
  FinancialFlow, 
  FlowAnomaly, 
  FlowHop, 
  FlowReconciliationResult, 
  Role, 
  TimelineImpactView,
  ZKAttestationProof,
  ImpactCertificateOut 
} from "../types";
import { flowService } from "../services/flowService";
import { formatINR } from "../utils/demoData";
import { PipelineFlowVisualizer } from "./PipelineFlowVisualizer";

interface MultiHopFlowViewProps {
  role: Role;
  onLinkExpense?: (flowId: string) => void;
}

export function MultiHopFlowView({ role }: MultiHopFlowViewProps) {
  const [flows, setFlows] = useState<FinancialFlow[]>([]);
  const [selectedFlowId, setSelectedFlowId] = useState<string>("FLOW-001");
  const [timelineView, setTimelineView] = useState<TimelineImpactView | null>(null);
  const [reconciliation, setReconciliation] = useState<FlowReconciliationResult | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [reconciling, setReconciling] = useState<boolean>(false);
  const [simulatedAnomaly, setSimulatedAnomaly] = useState<boolean>(false);
  const [selectedHop, setSelectedHop] = useState<FlowHop | null>(null);
  const [zkModalProof, setZkModalProof] = useState<ZKAttestationProof | null>(null);
  const [zkLoading, setZkLoading] = useState<boolean>(false);
  const [certModal, setCertModal] = useState<ImpactCertificateOut | null>(null);
  const [certLoading, setCertLoading] = useState<boolean>(false);
  const [activePillarStage, setActivePillarStage] = useState<number>(1);

  function handlePillarStageSelect(stageId: number) {
    setActivePillarStage(stageId);
    if (!timelineView?.flow?.hops) return;
    const currentHops = timelineView.flow.hops;
    if (stageId === 1 && currentHops.length > 0) {
      setSelectedHop(currentHops[0]);
    } else if (stageId === 2 && currentHops.length > 1) {
      setSelectedHop(currentHops[1]);
    } else if (stageId === 3 && currentHops.length > 4) {
      setSelectedHop(currentHops[4]);
    } else if (stageId === 4) {
      void handleOpenCertificate();
    }
  }

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const flowList = await flowService.listFlows();
        setFlows(flowList);
        if (flowList.length > 0) {
          const activeId = flowList[0].id;
          setSelectedFlowId(activeId);
          const tl = await flowService.getFlowTimeline(activeId);
          setTimelineView(tl);
          setReconciliation(tl.reconciliation);
          if (tl.flow.hops.length > 0) {
            setSelectedHop(tl.flow.hops[0]);
          }
        }
      } catch (e) {
        console.error("Failed to load flow timeline:", e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  async function handleSelectFlow(flowId: string) {
    setSelectedFlowId(flowId);
    setLoading(true);
    setSimulatedAnomaly(false);
    try {
      const tl = await flowService.getFlowTimeline(flowId);
      setTimelineView(tl);
      setReconciliation(tl.reconciliation);
      if (tl.flow.hops.length > 0) {
        setSelectedHop(tl.flow.hops[0]);
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleRunReconciliation() {
    if (!selectedFlowId) return;
    setReconciling(true);
    try {
      const result = await flowService.reconcileFlow(selectedFlowId);
      setReconciliation(result);
      setSimulatedAnomaly(false);
    } finally {
      setReconciling(false);
    }
  }

  function handleSimulateEarmarkAnomaly() {
    if (!reconciliation) return;
    setSimulatedAnomaly(true);
    const mockAnomaly: FlowAnomaly = {
      severity: "HIGH",
      anomalyType: "EARMARK_MISMATCH",
      affectedHop: 5,
      description: "Hop #5: Expense EXP-OFFICE-99 category 'Office supplies' directly conflicts with earmarked purpose 'Clean water infrastructure'.",
      recommendation: "Auditor action required: Flagged transaction violates donor earmark covenant. Disbursement blocked from on-chain attestation.",
    };
    setReconciliation({
      ...reconciliation,
      isReconciled: false,
      anomaliesFound: [mockAnomaly],
      verdict: "Reconciliation flagged 1 high-severity earmark anomaly requiring auditor attention.",
    });
  }

  async function handleOpenCertificate() {
    if (!selectedFlowId) return;
    setCertLoading(true);
    try {
      const cert = await flowService.getImpactCertificate(selectedFlowId);
      setCertModal(cert);
    } finally {
      setCertLoading(false);
    }
  }

  function handleDownloadCertJson() {
    if (!certModal) return;
    const blob = new Blob([JSON.stringify(certModal, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${certModal.certificateId}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const currentFlow = timelineView?.flow;
  const hops = currentFlow?.hops || [];

  if (loading && !currentFlow) {
    return (
      <div className="flow-loading-container">
        <RefreshCw className="spin-icon" size={28} />
        <p>Loading multi-hop financial pipeline & cryptographic ledger...</p>
      </div>
    );
  }

  if (!currentFlow) {
    return (
      <div className="empty-flow-state">
        <p>No multi-hop financial flows found.</p>
      </div>
    );
  }

  const percentDisbursed = Math.min(
    100,
    Math.round((currentFlow.disbursedFiatAmount / currentFlow.finalFiatAvailable) * 100 * 10) / 10
  );

  return (
    <div className="multihop-flow-container">
      {/* Page Header */}
      <div className="flow-header">
        <div>
          <div className="flow-badge-row">
            <span className="flow-pill-id">{currentFlow.id}</span>
            <span className="flow-pill-earmark">
              <Lock size={12} /> Earmark: {currentFlow.earmarkTag}
            </span>
            <span className="flow-pill-source">
              <Coins size={12} /> {currentFlow.sourceChain}
            </span>
            <span className="zero-pii-badge">
              <ShieldCheck size={13} /> Zero Beneficiary PII On-Chain
            </span>
          </div>
          <h2 className="flow-title">{currentFlow.title}</h2>
          <p className="flow-subtitle">
            Autonomous multi-hop pipeline tracing crypto donations across DEX swaps, cross-chain bridges, and regulated fiat off-ramps to verified vendor receipt fingerprints.
          </p>
        </div>

        <div className="flow-header-actions">
          <button 
            className="action-btn"
            disabled={reconciling}
            onClick={handleRunReconciliation}
          >
            <RefreshCw size={14} className={reconciling ? "spin-icon" : ""} />
            {reconciling ? "Reconciling..." : "Run Autonomous Reconciliation"}
          </button>

          <button 
            className="action-btn"
            style={{ background: "#065f46" }}
            disabled={certLoading}
            onClick={handleOpenCertificate}
          >
            <BadgeCheck size={14} />
            {certLoading ? "Generating Proof..." : "Impact Merkle Certificate"}
          </button>
          
          {role === "Auditor" && (
            <button 
              className={`action-btn-secondary ${simulatedAnomaly ? "active" : ""}`}
              onClick={simulatedAnomaly ? handleRunReconciliation : handleSimulateEarmarkAnomaly}
              title="Test autonomous earmark diversion detection"
            >
              <SlidersHorizontal size={14} />
              {simulatedAnomaly ? "Reset Clean State" : "Simulate Earmark Divergence"}
            </button>
          )}
        </div>
      </div>

      {/* Financial Health Summary Cards */}
      <div className="flow-kpi-grid">
        <div className="flow-kpi-card">
          <span className="kpi-label">INITIAL CRYPTO INFLOW</span>
          <div className="kpi-value-row">
            <b>{currentFlow.initialAmount} {currentFlow.initialAsset}</b>
            <span className="kpi-badge-crypto">L1 Inflow</span>
          </div>
          <small>Est. initial value ₹{currentFlow.initialFiatEstimate.toLocaleString("en-IN")}</small>
        </div>

        <div className="flow-kpi-card">
          <span className="kpi-label">FIAT REALIZED AFTER OFF-RAMP</span>
          <div className="kpi-value-row">
            <b>{formatINR(currentFlow.finalFiatAvailable)}</b>
            <span className="kpi-badge-fiat">Off-Ramped</span>
          </div>
          <small>Net realized in NGO treasury (0.4% total bridge/swap fee)</small>
        </div>

        <div className="flow-kpi-card">
          <span className="kpi-label">TOTAL DISBURSED TO VENDORS</span>
          <div className="kpi-value-row">
            <b>{formatINR(currentFlow.disbursedFiatAmount)}</b>
            <span className="kpi-badge-disbursed">{percentDisbursed}% deployed</span>
          </div>
          <div className="kpi-progress-bar">
            <div className="kpi-progress-fill" style={{ width: `${percentDisbursed}%` }} />
          </div>
        </div>

        <div className="flow-kpi-card">
          <span className="kpi-label">REMAINING EARMARKED BALANCE</span>
          <div className="kpi-value-row">
            <b>{formatINR(currentFlow.remainingFiatAmount)}</b>
            <span className="kpi-badge-active">{currentFlow.status}</span>
          </div>
          <small>Strictly bound to: &quot;{currentFlow.earmarkTag}&quot;</small>
        </div>
      </div>

      {/* Reconciliation Engine Status Card */}
      {reconciliation && (
        <div className={`reconciliation-status-card ${reconciliation.isReconciled ? "reconciled" : "flagged"}`}>
          <div className="reconciliation-header">
            <div className="reconciliation-title-group">
              {reconciliation.isReconciled ? (
                <div className="icon-badge success">
                  <CheckCircle2 size={20} />
                </div>
              ) : (
                <div className="icon-badge danger">
                  <ShieldAlert size={20} />
                </div>
              )}
              <div>
                <div className="reconciliation-status-text">
                  <b>{reconciliation.isReconciled ? "Autonomous Flow Reconciliation: VERIFIED" : "Autonomous Flow Reconciliation: ANOMALY DETECTED"}</b>
                  <span className="hop-count-pill">{reconciliation.hopCount} Hops Traced</span>
                </div>
                <p className="reconciliation-verdict">{reconciliation.verdict}</p>
              </div>
            </div>
            
            <div className="reconciliation-meta">
              <span className="audit-rule-pill">
                <BadgeCheck size={13} /> Strict Earmark Bounds
              </span>
              <span className="audit-rule-pill">
                <Lock size={13} /> Anti-Double-Claim Shield
              </span>
            </div>
          </div>

          {/* Anomaly Alerts List if any */}
          {reconciliation.anomaliesFound.length > 0 && (
            <div className="anomalies-list">
              {reconciliation.anomaliesFound.map((a, idx) => (
                <div key={idx} className={`anomaly-card ${a.severity.toLowerCase()}`}>
                  <div className="anomaly-header">
                    <AlertTriangle size={16} />
                    <b>{a.anomalyType.replace("_", " ")} (Severity: {a.severity})</b>
                    {a.affectedHop && <span className="affected-hop-tag">Hop #{a.affectedHop}</span>}
                  </div>
                  <p className="anomaly-description">{a.description}</p>
                  <p className="anomaly-recommendation">
                    <strong>Autonomous Guard:</strong> {a.recommendation}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 4-Stage Architectural Pipeline Visualizer */}
      <PipelineFlowVisualizer 
        activeStage={activePillarStage} 
        onSelectStage={handlePillarStageSelect} 
      />

      {/* Multi-Hop Interactive Timeline */}
      <div className="timeline-section">
        <div className="timeline-section-header">
          <div>
            <h3>Multi-Hop Execution Pipeline (5 Stages)</h3>
            <p>Cryptographically verifiable transformation from donor crypto through decentralized protocols to local fiat impact.</p>
          </div>
          <span className="privacy-preserving-banner">
            <ShieldCheck size={14} /> Zero Beneficiary Exposure: Raw vendor bank accounts and individual identities remain off-chain
          </span>
        </div>

        <div className="timeline-pipeline">
          {hops.map((hop, index) => {
            const isSelected = selectedHop?.id === hop.id;
            const isDisbursement = hop.hopType === "VENDOR_DISBURSEMENT";
            const isBridge = hop.hopType === "CROSS_CHAIN_BRIDGE";
            const isSwap = hop.hopType === "DEX_SWAP";
            const isDonation = hop.hopType === "CRYPTO_DONATION";
            const isOfframp = hop.hopType === "FIAT_OFFRAMP";

            return (
              <div 
                key={hop.id} 
                className={`timeline-stage-card ${isSelected ? "selected" : ""}`}
                onClick={() => setSelectedHop(hop)}
              >
                <div className="stage-marker-col">
                  <div className={`stage-number-badge ${isDisbursement ? "disbursement" : ""}`}>
                    {hop.hopNumber}
                  </div>
                  {index < hops.length - 1 && <div className="stage-connector-line" />}
                </div>

                <div className="stage-content">
                  <div className="stage-top-row">
                    <div className="stage-title-wrap">
                      <span className={`hop-type-badge ${hop.hopType.toLowerCase()}`}>
                        {isDonation && <Wallet size={12} />}
                        {isSwap && <ArrowRightLeft size={12} />}
                        {isBridge && <GitFork size={12} />}
                        {isOfframp && <Activity size={12} />}
                        {isDisbursement && <FileCheck2 size={12} />}
                        {hop.hopType.replace("_", " ")}
                      </span>
                      <h4 className="stage-title">{hop.title}</h4>
                    </div>
                    <span className="stage-status-badge">
                      <CheckCircle2 size={13} /> {hop.status}
                    </span>
                  </div>

                  <div className="stage-transfer-box">
                    <div className="transfer-entity from">
                      <span className="entity-role">SOURCE</span>
                      <b>{hop.fromEntity}</b>
                      <span className="asset-tag">{hop.inputAmount.toLocaleString()} {hop.inputAsset}</span>
                    </div>

                    <div className="transfer-arrow-icon">
                      <ArrowRight size={18} />
                      {hop.exchangeRate !== 1.0 && (
                        <small className="rate-caption">1 : {hop.exchangeRate}</small>
                      )}
                    </div>

                    <div className="transfer-entity to">
                      <span className="entity-role">DESTINATION</span>
                      <b>{hop.toEntity}</b>
                      <span className="asset-tag highlighted">{hop.outputAmount.toLocaleString()} {hop.outputAsset}</span>
                    </div>
                  </div>

                  <div className="stage-meta-row">
                    <div className="stage-meta-item">
                      <span className="meta-label">NETWORK / SETTLEMENT</span>
                      <span className="meta-val">{hop.chainNetwork}</span>
                    </div>

                    <div className="stage-meta-item">
                      <span className="meta-label">TX IDENTIFIER / REF</span>
                      <code className="meta-code" title={hop.txHash}>
                        {hop.txHash.length > 24 ? `${hop.txHash.slice(0, 10)}...${hop.txHash.slice(-8)}` : hop.txHash}
                      </code>
                    </div>

                    {hop.linkedReceiptHash && (
                      <div className="stage-meta-item">
                        <span className="meta-label">AUDITED RECEIPT HASH (SHA-256)</span>
                        <code className="meta-code receipt-code" title={hop.linkedReceiptHash}>
                          {hop.linkedReceiptHash.slice(0, 12)}...
                        </code>
                      </div>
                    )}
                  </div>

                  <p className="stage-evidence-text">
                    <Sparkles size={12} /> {hop.evidenceSummary}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Selected Hop Deep-Dive Panel */}
      {selectedHop && (
        <div className="hop-details-drawer">
          <div className="drawer-header">
            <div className="drawer-title-group">
              <span className="drawer-badge">Hop #{selectedHop.hopNumber} Protocol Verification</span>
              <h3>{selectedHop.title}</h3>
            </div>
            <span className="network-pill">{selectedHop.chainNetwork}</span>
          </div>

          <div className="drawer-details-grid">
            <div className="drawer-col">
              <span className="drawer-col-title">Cryptographic Execution</span>
              <div className="detail-item">
                <label>Transaction / Settlement Hash:</label>
                <code>{selectedHop.txHash}</code>
              </div>
              <div className="detail-item">
                <label>Input Volume:</label>
                <b>{selectedHop.inputAmount.toLocaleString()} {selectedHop.inputAsset}</b>
              </div>
              <div className="detail-item">
                <label>Output Volume:</label>
                <b>{selectedHop.outputAmount.toLocaleString()} {selectedHop.outputAsset}</b>
              </div>
              <div className="detail-item">
                <label>Protocol Fee / Gas:</label>
                <span>{selectedHop.feeAmount} {selectedHop.inputAsset}</span>
              </div>
            </div>

            <div className="drawer-col">
              <span className="drawer-col-title">Off-Chain Evidence & Privacy Boundary</span>
              <div className="detail-item">
                <label>Earmark Protection Guard:</label>
                <span className="text-emerald">Strictly Enforced &quot;{currentFlow.earmarkTag}&quot;</span>
              </div>
              <div className="detail-item">
                <label>Beneficiary Privacy Status:</label>
                <span className="text-emerald">100% Protected (No beneficiary names/PII in on-chain calldata)</span>
              </div>
              {selectedHop.linkedReceiptHash ? (
                <div className="detail-item">
                  <label>Audited Invoice Receipt Hash:</label>
                  <code className="text-highlight">{selectedHop.linkedReceiptHash}</code>
                </div>
              ) : (
                <div className="detail-item">
                  <label>Settlement Proof:</label>
                  <span>Decentralized Liquidity Pool State Transition verified</span>
                </div>
              )}

              {(selectedHop.hopType === "FIAT_OFFRAMP" || selectedHop.hopType === "VENDOR_DISBURSEMENT") && (
                <button
                  className="action-btn-secondary"
                  style={{ marginTop: 8, display: "inline-flex", alignItems: "center", gap: 6, fontSize: "11px", padding: "6px 10px" }}
                  disabled={zkLoading}
                  onClick={async () => {
                    setZkLoading(true);
                    try {
                      const proof = await flowService.getZKProof(currentFlow.id, selectedHop.hopNumber);
                      setZkModalProof(proof);
                    } finally {
                      setZkLoading(false);
                    }
                  }}
                >
                  <ShieldCheck size={14} style={{ color: "#16a34a" }} />
                  {zkLoading ? "Verifying zkTLS Proof..." : "Inspect zkTLS Privacy Proof"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* zkTLS Cryptographic Privacy Proof Modal */}
      {zkModalProof && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setZkModalProof(null)}>
          <div className="modal" role="dialog" aria-modal="true" style={{ maxWidth: 580 }} onMouseDown={e => e.stopPropagation()}>
            <div className="modal-heading">
              <div>
                <h2>zkTLS Zero-Knowledge Privacy Proof</h2>
                <p>Off-chain banking wire attested via TLS session commitments with zero beneficiary PII exposure</p>
              </div>
              <button className="icon-button" onClick={() => setZkModalProof(null)}><X size={19} /></button>
            </div>

            <div className="detail-item" style={{ marginBottom: 10 }}>
              <label>Proof Type & Protocol:</label>
              <b>{zkModalProof.proofType} (TLSNotary / Reclaim MPC Attestation)</b>
            </div>

            <div className="detail-item" style={{ marginBottom: 10 }}>
              <label>Notary Public Key:</label>
              <code style={{ fontSize: "10.5px" }}>{zkModalProof.notaryPublicKey}</code>
            </div>

            <div className="detail-item" style={{ marginBottom: 10 }}>
              <label>Merkle Session Commitment:</label>
              <code className="text-highlight" style={{ fontSize: "10.5px" }}>{zkModalProof.merkleCommitment}</code>
            </div>

            <div className="detail-item" style={{ marginBottom: 10 }}>
              <label>Redacted Fields (100% Protected from Public/Donors):</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 4 }}>
                {zkModalProof.redactedFields.map((f, i) => (
                  <span key={i} style={{ fontSize: "10px", background: "#fef2f2", color: "#991b1b", border: "1px solid #fecaca", padding: "2px 6px", borderRadius: 4 }}>
                    [REDACTED] {f.replace(/_/g, " ")}
                  </span>
                ))}
              </div>
            </div>

            <div className="detail-item" style={{ marginBottom: 10 }}>
              <label>Cryptographically Verified Settlement Attributes:</label>
              <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", padding: "8px 12px", borderRadius: 6, fontSize: "11px", color: "#166534" }}>
                {Object.entries(zkModalProof.verifiedAttributes).map(([k, v]) => (
                  <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "2px 0" }}>
                    <span style={{ fontWeight: 600 }}>{k}:</span>
                    <span>{String(v)}</span>
                  </div>
                ))}
              </div>
            </div>

            <p style={{ fontSize: "11px", color: "#047857", margin: "8px 0 0", lineHeight: 1.4 }}>
              ✓ {zkModalProof.privacyGuarantee}
            </p>
          </div>
        </div>
      )}

      {/* Cryptographic Impact Merkle Certificate Modal */}
      {certModal && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setCertModal(null)}>
          <div className="modal" role="dialog" aria-modal="true" style={{ maxWidth: 640 }} onMouseDown={e => e.stopPropagation()}>
            <div className="modal-heading">
              <div>
                <h2>Cryptographic Impact Certificate</h2>
                <p>Auditable Merkle proof linking {certModal.initialCryptoAmount} directly to local vendor receipts</p>
              </div>
              <button className="icon-button" onClick={() => setCertModal(null)}><X size={19} /></button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10, marginBottom: 12 }}>
              <div className="detail-item">
                <label>Certificate ID:</label>
                <b>{certModal.certificateId}</b>
              </div>
              <div className="detail-item">
                <label>Earmark Covenant:</label>
                <b className="text-emerald">{certModal.earmarkTag}</b>
              </div>
              <div className="detail-item">
                <label>Donor L1 Origin:</label>
                <code style={{ fontSize: "10.5px" }}>{certModal.donorOrigin}</code>
              </div>
              <div className="detail-item">
                <label>Realized Fiat Inflow:</label>
                <b>{formatINR(certModal.finalFiatRealized)}</b>
              </div>
            </div>

            <div className="detail-item" style={{ marginBottom: 12 }}>
              <label>Merkle Commitment Root (EVM State Anchor):</label>
              <code className="text-highlight" style={{ fontSize: "11px" }}>{certModal.merkleRoot}</code>
            </div>

            <div className="detail-item" style={{ marginBottom: 12 }}>
              <label>Audited Vendor Receipt Fingerprints (SHA-256):</label>
              {certModal.auditedReceiptFingerprints.map((h, i) => (
                <code key={i} style={{ fontSize: "10.5px", display: "block", marginTop: 2, background: "#ecfdf5", color: "#065f46" }}>
                  [RECEIPT #{i+1}] {h}
                </code>
              ))}
            </div>

            <div className="detail-item" style={{ marginBottom: 12 }}>
              <label>Step-by-Step Merkle Proof Chain ({certModal.proofSteps.length} Stages):</label>
              <div style={{ maxHeight: 130, overflowY: "auto", background: "#f8faf9", border: "1px solid #e1ece5", borderRadius: 6, padding: "6px 10px", fontSize: "10.5px" }}>
                {certModal.proofSteps.map((s, idx) => (
                  <div key={idx} style={{ display: "flex", justifyContent: "space-between", padding: "2px 0", borderBottom: idx < certModal.proofSteps.length - 1 ? "1px solid #edf2ef" : "none" }}>
                    <span><b>Hop #{s.hopNumber}</b> ({s.stage}):</span>
                    <code style={{ fontSize: "10px" }}>{s.hopHash.slice(0, 16)}...</code>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", padding: "8px 12px", borderRadius: 6, fontSize: "11px", color: "#166534", marginBottom: 12 }}>
              <b>Privacy Guarantee:</b> {certModal.privacyCompliance}
            </div>

            <div className="modal-actions" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <button className="button button-outline" onClick={() => setCertModal(null)}>Close</button>
              <button className="button button-primary" onClick={handleDownloadCertJson}>
                <ExternalLink size={14} /> Download Certificate (JSON)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

