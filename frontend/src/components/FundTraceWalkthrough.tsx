import { useState } from "react";
import { 
  ArrowRight, 
  BadgeCheck, 
  CheckCircle2, 
  ChevronDown, 
  ChevronUp, 
  FileCheck2, 
  FileText, 
  Fingerprint, 
  GitFork, 
  HandCoins, 
  HelpCircle, 
  Info, 
  KeyRound, 
  Layers, 
  Lightbulb, 
  Link2, 
  Lock, 
  ShieldAlert, 
  ShieldCheck, 
  Sparkles, 
  Upload, 
  X 
} from "lucide-react";
import type { Role } from "../types";
import type { PageKey } from "./Sidebar";

interface WalkthroughProps {
  currentRole: Role;
  onSelectRole: (role: Role) => void;
  onNavigate: (page: PageKey) => void;
  onNewExpense: () => void;
}

export function FundTraceWalkthrough({
  currentRole,
  onSelectRole,
  onNavigate,
  onNewExpense,
}: WalkthroughProps) {
  const [expanded, setExpanded] = useState(true);
  const [activeStep, setActiveStep] = useState<number | null>(null);
  const [glossaryOpen, setGlossaryOpen] = useState(false);

  const steps = [
    {
      num: 1,
      title: "Donate & Earmark",
      short: "Funds pledged with clear tags",
      icon: HandCoins,
      color: "#059669",
      bg: "#ecfdf5",
      role: "Donor",
      desc: "Donors contribute fiat or cryptocurrency earmarked for specific purposes (e.g., 'Clean water infrastructure'). Smart contracts enforce these disbursement conditions.",
      actionLabel: "View Donations",
      action: () => onNavigate("Donations"),
    },
    {
      num: 2,
      title: "Spend & Upload",
      short: "NGO submits invoice evidence",
      icon: Upload,
      color: "#2563eb",
      bg: "#eff6ff",
      role: "NGO admin",
      desc: "When money is spent, the NGO submits the expense claim and uploads the vendor's receipt or invoice (PDF/image) into secure, anti-traversal file storage.",
      actionLabel: "Submit Test Expense",
      action: () => onNewExpense(),
    },
    {
      num: 3,
      title: "OCR & Risk Check",
      short: "AI extracts data & catches fraud",
      icon: Sparkles,
      color: "#d97706",
      bg: "#fffbeb",
      role: "Auditor",
      desc: "Automated OCR engine extracts the vendor, invoice #, date, and amount. The system calculates a SHA-256 fingerprint, flags duplicate receipts, and computes a risk score (0–100).",
      actionLabel: "Try Receipt Inspector",
      action: () => onNavigate("Receipt verification"),
    },
    {
      num: 4,
      title: "Auditor Decision",
      short: "Independent human review",
      icon: ShieldCheck,
      color: "#7c3aed",
      bg: "#f5f3ff",
      role: "Auditor",
      desc: "An independent auditor reviews discrepancies between claimed amounts and invoice bytes, verifies vendor records, and chooses: Approve, Reject, or Request More Evidence.",
      actionLabel: "Open Review Queue",
      action: () => onNavigate("Expenses"),
    },
    {
      num: 5,
      title: "Blockchain Anchor",
      short: "Zero-PII permanent seal",
      icon: Link2,
      color: "#0891b2",
      bg: "#ecfeff",
      role: "Auditor / Donor",
      desc: "The auditor's approval and receipt SHA-256 fingerprint are anchored to the Ethereum smart contract. Donors can independently verify proofs without exposing beneficiary personal data.",
      actionLabel: "Explore Multi-Hop Flows",
      action: () => onNavigate("Multi-hop flows"),
    },
  ];

  return (
    <section className="workflow-tour-card" aria-label="Interactive guide">
      <div className="tour-header">
        <div className="tour-title-group">
          <span className="tour-badge">
            <Lightbulb size={14} />
            <span>Interactive Workflow Guide</span>
          </span>
          <h3>How FundTrace Works in 5 Clear Steps</h3>
          <p>
            Understand the complete journey from donor contribution to tamper-evident blockchain verification.
          </p>
        </div>

        <div className="tour-actions">
          <button 
            type="button" 
            className="tour-glossary-btn" 
            onClick={() => setGlossaryOpen(true)}
            title="Learn blockchain & privacy concepts in plain English"
          >
            <HelpCircle size={15} />
            <span>Plain-English Glossary</span>
          </button>

          <button 
            type="button" 
            className="tour-toggle-btn" 
            onClick={() => setExpanded(!expanded)}
            aria-expanded={expanded}
          >
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            <span>{expanded ? "Collapse" : "Expand Guide"}</span>
          </button>
        </div>
      </div>

      {expanded && (
        <>
          {/* 5-Step Visual Pipeline */}
          <div className="stepper-grid">
            {steps.map((step, idx) => {
              const Icon = step.icon;
              const isSelected = activeStep === step.num;
              return (
                <div 
                  key={step.num} 
                  className={`step-card ${isSelected ? "selected" : ""}`}
                  onClick={() => setActiveStep(isSelected ? null : step.num)}
                >
                  <div className="step-card-top">
                    <span 
                      className="step-icon-wrap" 
                      style={{ background: step.bg, color: step.color }}
                    >
                      <Icon size={18} />
                    </span>
                    <span className="step-number">Step {step.num}</span>
                  </div>

                  <h4 className="step-title">{step.title}</h4>
                  <p className="step-short">{step.short}</p>

                  <div className="step-role-tag">
                    <span>Role: <b>{step.role}</b></span>
                  </div>

                  {idx < steps.length - 1 && (
                    <span className="step-connector" aria-hidden="true">
                      <ArrowRight size={14} />
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Active Step Deep-Dive Banner */}
          {activeStep !== null && (
            <div className="step-detail-banner animate-fade-in">
              <div className="step-detail-left">
                <span className="step-pill">Step {steps[activeStep - 1].num} Detail</span>
                <h4>{steps[activeStep - 1].title}</h4>
                <p>{steps[activeStep - 1].desc}</p>
              </div>
              <div className="step-detail-actions">
                <button 
                  type="button" 
                  className="button button-primary"
                  onClick={steps[activeStep - 1].action}
                >
                  {steps[activeStep - 1].actionLabel} <ArrowRight size={14} />
                </button>
                <button 
                  type="button" 
                  className="button button-plain" 
                  onClick={() => setActiveStep(null)}
                >
                  Close
                </button>
              </div>
            </div>
          )}

          {/* Persona Quick-Switch Guide */}
          <div className="role-guide-strip">
            <span className="role-guide-label">
              <KeyRound size={13} />
              <span>TEST THE 3 PERSPECTIVES:</span>
            </span>

            <div className="role-guide-pills">
              <button 
                type="button" 
                className={`role-choice-pill ${currentRole === "NGO admin" ? "active" : ""}`}
                onClick={() => onSelectRole("NGO admin")}
              >
                <b>🏢 NGO Admin:</b> Submit expenses & test AI OCR auto-fill
              </button>

              <button 
                type="button" 
                className={`role-choice-pill ${currentRole === "Auditor" ? "active" : ""}`}
                onClick={() => onSelectRole("Auditor")}
              >
                <b>🔍 Auditor:</b> Review risk signals & anchor to EVM smart contract
              </button>

              <button 
                type="button" 
                className={`role-choice-pill ${currentRole === "Donor" ? "active" : ""}`}
                onClick={() => onSelectRole("Donor")}
              >
                <b>🎁 Donor:</b> Verify impact proofs with zero-PII privacy
              </button>
            </div>
          </div>
        </>
      )}

      {/* Plain-English Concepts Modal */}
      {glossaryOpen && (
        <div className="modal-backdrop" onClick={() => setGlossaryOpen(false)}>
          <div className="modal glossary-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-heading">
              <div>
                <h2>Plain-English Guide: How FundTrace Works</h2>
                <p>Demystifying blockchain, cryptographic receipts, and privacy protection.</p>
              </div>
              <button className="icon-button" onClick={() => setGlossaryOpen(false)}>
                <X size={18} />
              </button>
            </div>

            <div className="glossary-grid">
              <div className="glossary-item">
                <div className="glossary-icon" style={{ background: "#ecfdf5", color: "#059669" }}>
                  <Fingerprint size={20} />
                </div>
                <div>
                  <h4>1. Receipt Fingerprint (SHA-256)</h4>
                  <p>
                    A digital fingerprint generated from the exact bytes of the receipt file. 
                    If anyone changes a single character, amount, or pixel, the fingerprint completely changes, immediately exposing tampering.
                  </p>
                </div>
              </div>

              <div className="glossary-item">
                <div className="glossary-icon" style={{ background: "#eff6ff", color: "#2563eb" }}>
                  <Lock size={20} />
                </div>
                <div>
                  <h4>2. Zero-PII Beneficiary Privacy</h4>
                  <p>
                    Original invoices and vulnerable beneficiary identities stay <b>100% private off-chain</b>. 
                    Only cryptographic hashes touch the public blockchain. Donors get mathematical certainty without violating anyone's dignity or privacy.
                  </p>
                </div>
              </div>

              <div className="glossary-item">
                <div className="glossary-icon" style={{ background: "#f5f3ff", color: "#7c3aed" }}>
                  <Link2 size={20} />
                </div>
                <div>
                  <h4>3. Smart Contract EVM Ledger</h4>
                  <p>
                    A computer program running on Ethereum / Polygon that locks in verified expense approvals forever. 
                    Once an auditor seals a receipt hash on-chain, nobody—not even the NGO or platform creators—can alter or backdate it.
                  </p>
                </div>
              </div>

              <div className="glossary-item">
                <div className="glossary-icon" style={{ background: "#fffbeb", color: "#d97706" }}>
                  <ShieldAlert size={20} />
                </div>
                <div>
                  <h4>4. Risk Score (0–100)</h4>
                  <p>
                    An automated warning signal. If an invoice amount doesn't match the claimed amount (+20 pts) or if a receipt was uploaded twice (+25 pts), the score rises. 
                    It alerts the human auditor to investigate—it never makes accusations automatically.
                  </p>
                </div>
              </div>

              <div className="glossary-item">
                <div className="glossary-icon" style={{ background: "#ecfeff", color: "#0891b2" }}>
                  <GitFork size={20} />
                </div>
                <div>
                  <h4>5. Multi-Hop Financial Flow</h4>
                  <p>
                    Donated crypto (e.g. 50 ETH) often travels across decentralized exchanges (DEXs) and cross-chain bridges before being converted to fiat rupees for local vendors. 
                    FundTrace traces every hop in a single auditable timeline.
                  </p>
                </div>
              </div>

              <div className="glossary-item">
                <div className="glossary-icon" style={{ background: "#fdf2f8", color: "#db2777" }}>
                  <BadgeCheck size={20} />
                </div>
                <div>
                  <h4>6. Merkle Impact Certificate</h4>
                  <p>
                    A tamper-evident certificate that bundles all approved project expenses into a single mathematical Merkle tree root. 
                    Donors can download their certificate to prove real-world impact.
                  </p>
                </div>
              </div>
            </div>

            <div className="modal-actions">
              <button 
                type="button" 
                className="button button-primary" 
                onClick={() => setGlossaryOpen(false)}
              >
                Got It, Let's Explore
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
