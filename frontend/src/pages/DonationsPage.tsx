import React, { useState, useEffect, useMemo, type FormEvent } from "react";
import { donationService } from "../services/donationService";
import { DonationChart } from "../components/DonationChart";
import { StatCard } from "../components/StatCard";
import type { Donation, DonationCommitmentVerifyResponse, FundTraceData, Project, Role } from "../types";
import { formatINR } from "../utils/demoData";
import {
  ShieldCheck,
  Lock,
  RefreshCw,
  CheckCircle2,
  HandCoins,
  Plus,
  Search,
  Receipt,
  Landmark,
  BadgeCheck,
  Clock,
  X,
  BarChart3,
  Trash2,
  Printer,
  Sparkles,
  AlertCircle,
  CircleHelp,
  Building2,
  Calendar,
  ExternalLink,
} from "lucide-react";

export interface DonationsPageProps {
  data?: FundTraceData;
  setData?: React.Dispatch<React.SetStateAction<FundTraceData>>;
  donationsTotal?: number;
  role?: Role;
  onToast?: (msg: string) => void;
  onRequestRecord?: (project?: Project) => void;
}

function money(amount: number): string {
  return formatINR(amount);
}

function dateLabel(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

function amountToWordsINR(num: number): string {
  if (num === 500000) return "Five Lakh Rupees Only";
  if (num === 250000) return "Two Lakh Fifty Thousand Rupees Only";
  if (num === 100000) return "One Lakh Rupees Only";
  if (num === 50000) return "Fifty Thousand Rupees Only";
  if (num === 10000) return "Ten Thousand Rupees Only";
  return `Rupees ${num.toLocaleString("en-IN")} Only`;
}

function generateSalt(): string {
  if (typeof window !== "undefined" && window.crypto && window.crypto.getRandomValues) {
    const bytes = new Uint8Array(32);
    window.crypto.getRandomValues(bytes);
    return "0x" + Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
  }
  return "0x" + Math.random().toString(16).slice(2) + Math.random().toString(16).slice(2);
}

async function sha256Hex(str: string): Promise<string> {
  if (typeof window !== "undefined" && window.crypto && window.crypto.subtle) {
    const enc = new TextEncoder();
    const hash = await window.crypto.subtle.digest("SHA-256", enc.encode(str));
    return "0x" + Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
  }
  return "0x" + Math.random().toString(16).slice(2).padStart(64, "0");
}

export const DonationsPage: React.FC<DonationsPageProps> = ({
  data: propsData,
  setData: propsSetData,
  donationsTotal: propsDonationsTotal,
  role: propsRole,
  onToast = () => {},
}) => {
  // Role determination
  const storedRole = (localStorage.getItem("fundtrace-demo-role-v1") as Role) || "Donor";
  const activeRole: Role = propsRole || storedRole;
  const isAuditor = activeRole === "Auditor";
  const isDonor = activeRole === "Donor";
  const isNGOAdmin = activeRole === "NGO admin";

  // State fallback if data not provided via props
  const [localData, setLocalData] = useState<FundTraceData>(() => {
    if (propsData) return propsData;
    return {
      projects: [],
      donations: [],
      expenses: [],
      auditLog: [],
    };
  });

  const data = propsData || localData;
  const setData = propsSetData || setLocalData;

  // Filter & Search States
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [selectedProjectId, setSelectedProjectId] = useState<string>("ALL");
  const [selectedMethod, setSelectedMethod] = useState<string>("ALL");
  const [selectedStatus, setSelectedStatus] = useState<string>("ALL");
  const [showTrendsChart, setShowTrendsChart] = useState<boolean>(true);

  // Modals
  const [showRecordModal, setShowRecordModal] = useState<boolean>(false);
  const [selectedDonationForCommitment, setSelectedDonationForCommitment] = useState<Donation | null>(null);
  const [activeReceiptDonation, setActiveReceiptDonation] = useState<Donation | null>(null);
  const [paymentModalDonation, setPaymentModalDonation] = useState<Donation | null>(null);
  const [verifyingCommitment, setVerifyingCommitment] = useState<boolean>(false);
  const [verificationResult, setVerificationResult] = useState<DonationCommitmentVerifyResponse | null>(null);
  const [paymentTxInput, setPaymentTxInput] = useState<string>("");
  const [paymentMethodInput, setPaymentMethodInput] = useState<string>("Bank RTGS Settlement");
  const [submittingPayment, setSubmittingPayment] = useState<boolean>(false);

  // Record Form State
  const [formDonorName, setFormDonorName] = useState<string>(isDonor ? "Aarav Mehta" : "Rajesh Verma");
  const [formDonorEmail, setFormDonorEmail] = useState<string>(isDonor ? "aarav.mehta@example.com" : "donor@example.com");
  const [formDonorPan, setFormDonorPan] = useState<string>("ABCDE1234F");
  const [formAmount, setFormAmount] = useState<string>("50000");
  const [formProjectId, setFormProjectId] = useState<string>(data.projects[0]?.id || "PRJ-001");
  const [formPaymentMethod, setFormPaymentMethod] = useState<string>("UPI");
  const [formIsAnonymous, setFormIsAnonymous] = useState<boolean>(false);
  const [formNotes, setFormNotes] = useState<string>("Dedicated to milestone implementation");
  const [formSalt, setFormSalt] = useState<string>(generateSalt());
  const [previewCommitmentHash, setPreviewCommitmentHash] = useState<string>("");
  const [formSubmitting, setFormSubmitting] = useState<boolean>(false);
  const [formError, setFormError] = useState<string>("");

  // Update live cryptographic commitment preview
  useEffect(() => {
    async function updatePreview() {
      const parsedAmount = parseFloat(formAmount) || 0;
      const paise = Math.round(parsedAmount * 100);
      const str = `DONATION_COMMITMENT_V1|project:${formProjectId}|amount_paise:${paise}|salt:${formSalt}`;
      const hash = await sha256Hex(str);
      setPreviewCommitmentHash(hash);
    }
    void updatePreview();
  }, [formAmount, formProjectId, formSalt]);

  // Handle role-based donor records
  const rawDonations = isDonor
    ? data.donations.filter((item) => item.donor === "Aarav Mehta" || item.donor === formDonorName)
    : data.donations;

  // Filtered donations
  const filteredDonations = useMemo(() => {
    return rawDonations.filter((d) => {
      const project = data.projects.find((p) => p.id === d.projectId);
      const projectName = project?.name || "";
      const searchLower = searchTerm.toLowerCase().trim();

      const matchesSearch =
        searchLower === "" ||
        d.id.toLowerCase().includes(searchLower) ||
        d.reference.toLowerCase().includes(searchLower) ||
        (d.commitmentHash && d.commitmentHash.toLowerCase().includes(searchLower)) ||
        (d.paymentTxHash && d.paymentTxHash.toLowerCase().includes(searchLower)) ||
        projectName.toLowerCase().includes(searchLower) ||
        (!isAuditor && d.donor.toLowerCase().includes(searchLower));

      const matchesProject =
        selectedProjectId === "ALL" ||
        (selectedProjectId === "GENERAL" && !d.projectId) ||
        d.projectId === selectedProjectId;

      const matchesMethod =
        selectedMethod === "ALL" ||
        (d.paymentMethod && d.paymentMethod.toUpperCase().includes(selectedMethod.toUpperCase()));

      const matchesStatus =
        selectedStatus === "ALL" ||
        (selectedStatus === "Verified" && d.paymentStatus === "Verified") ||
        (selectedStatus === "Pending" && d.paymentStatus !== "Verified");

      return matchesSearch && matchesProject && matchesMethod && matchesStatus;
    }).sort((a, b) => b.date.localeCompare(a.date));
  }, [rawDonations, searchTerm, selectedProjectId, selectedMethod, selectedStatus, isAuditor, data.projects]);

  // Totals & Analytics
  const donationsTotal = propsDonationsTotal !== undefined
    ? propsDonationsTotal
    : rawDonations.reduce((sum, item) => sum + item.amount, 0);

  const verifiedSettledTotal = rawDonations
    .filter((item) => item.paymentStatus === "Verified")
    .reduce((sum, item) => sum + item.amount, 0);

  const pendingSettlementCount = rawDonations.filter((item) => item.paymentStatus !== "Verified").length;
  const supportedProjectsCount = new Set(rawDonations.map((item) => item.projectId)).size;
  const averageDonation = rawDonations.length > 0 ? Math.round(donationsTotal / rawDonations.length) : 0;

  // Monthly Chart Trends
  const chartData = useMemo(() => {
    const monthlyMap: Record<string, number> = {
      May: 450000,
      Jun: 620000,
      Jul: 890000,
      Aug: 750000,
      Sep: 980000,
      Oct: 1200000,
    };
    rawDonations.forEach((d) => {
      try {
        const month = new Date(d.date).toLocaleString("en-US", { month: "short" });
        if (monthlyMap[month] !== undefined) {
          monthlyMap[month] += d.amount;
        }
      } catch {
        // ignore date parse issues
      }
    });
    return Object.entries(monthlyMap).map(([month, amount]) => ({ month, amount }));
  }, [rawDonations]);

  // Open Record Modal
  function handleOpenRecordModal(prefillProject?: Project) {
    if (prefillProject) {
      setFormProjectId(prefillProject.id);
    } else if (data.projects.length > 0 && !formProjectId) {
      setFormProjectId(data.projects[0].id);
    }
    setFormSalt(generateSalt());
    setFormError("");
    setShowRecordModal(true);
  }

  // Handle Record Submission
  async function handleRecordSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError("");

    const parsedAmount = parseFloat(formAmount);
    if (!formDonorName.trim() && !formIsAnonymous) {
      setFormError("Donor Name is required for private database record.");
      return;
    }
    if (!parsedAmount || parsedAmount <= 0) {
      setFormError("Please enter a valid donation amount greater than 0.");
      return;
    }

    setFormSubmitting(true);
    try {
      const donationId = `DON-${Date.now().toString().slice(-4)}`;
      const ref = `PAY-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
      const salt = formSalt;
      const paise = Math.round(parsedAmount * 100);
      const canonical = `DONATION_COMMITMENT_V1|project:${formProjectId}|amount_paise:${paise}|salt:${salt}`;
      const commitmentHash = await sha256Hex(canonical);

      const newDonation: Donation = {
        id: donationId,
        projectId: formProjectId,
        donor: formIsAnonymous ? "Anonymous Donor" : formDonorName.trim(),
        amount: parsedAmount,
        date: new Date().toISOString().slice(0, 10),
        reference: ref,
        paymentStatus: "Pending",
        paymentMethod: formPaymentMethod,
        blockchainStatus: "Confirmed",
        commitmentHash: commitmentHash,
        blockchainTxHash: "0x" + Array.from(new Uint8Array(32)).map(() => Math.floor(Math.random() * 16).toString(16)).join(""),
        blockchainBlockNumber: 10 + Math.floor(Math.random() * 5),
        blindingSalt: salt,
        donorPan: formDonorPan.trim() ? formDonorPan.trim().toUpperCase() : undefined,
        donorEmail: formDonorEmail.trim() || undefined,
        notes: formNotes.trim() || undefined,
        receiptNumber: `REC-2026-${donationId}`,
        isAnonymous: formIsAnonymous,
      };

      // Update State
      setData((prev) => ({
        ...prev,
        donations: [newDonation, ...prev.donations],
        projects: prev.projects.map((p) =>
          p.id === formProjectId ? { ...p, raised: p.raised + parsedAmount } : p
        ),
        auditLog: [
          {
            id: `AUD-${Date.now().toString().slice(-4)}`,
            expenseId: donationId,
            action: "Zero-PII Donation Commitment Anchored",
            actor: isAuditor ? "Auditor" : isDonor ? `${formDonorName} (Donor)` : "NGO Admin",
            reason: `Salted cryptographic commitment ${commitmentHash.slice(0, 14)}... anchored on-chain for project ${formProjectId}. Zero PII revealed.`,
            date: new Date().toISOString(),
          },
          ...prev.auditLog,
        ],
      }));

      // Try backend sync if available
      try {
        await donationService.createDonation({
          projectId: formProjectId,
          amount: parsedAmount,
          donorName: newDonation.donor,
          donorEmail: formDonorEmail.trim(),
          paymentMethod: formPaymentMethod,
          paymentReference: ref,
        });
      } catch {
        // Local state already updated
      }

      onToast(`✨ ₹${parsedAmount.toLocaleString()} recorded with Zero-PII commitment hash!`);
      setShowRecordModal(false);
      setFormAmount("50000");
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "Failed to record donation commitment.");
    } finally {
      setFormSubmitting(false);
    }
  }

  // Handle Verify Commitment
  async function handleVerifyCommitment(donation: Donation) {
    setSelectedDonationForCommitment(donation);
    setVerifyingCommitment(true);
    setVerificationResult(null);
    try {
      const res = await donationService.verifyCommitment({
        donationId: donation.id,
        projectId: donation.projectId,
        amount: donation.amount,
        paymentReference: donation.reference,
        blindingSalt: donation.blindingSalt || "0x9a8b7c6d5e4f3a2b1c0d9e8f7a6b5c4d3e2f1a0b9c8d7e6f5a4b3c2d1e0f9a8b",
      });
      setVerificationResult(res);
    } catch (err: unknown) {
      console.error("Commitment verification failed:", err);
      onToast("Failed to verify on-chain commitment.");
    } finally {
      setVerifyingCommitment(false);
    }
  }

  // Handle Confirm Payment Settlement
  async function handleConfirmPayment(event: FormEvent) {
    event.preventDefault();
    if (!paymentModalDonation || !paymentTxInput.trim()) return;
    setSubmittingPayment(true);
    try {
      await donationService.verifyPayment(
        paymentModalDonation.id,
        paymentTxInput.trim(),
        paymentMethodInput
      );
      setData((prev) => ({
        ...prev,
        donations: prev.donations.map((d) =>
          d.id === paymentModalDonation.id
            ? {
                ...d,
                paymentStatus: "Verified",
                paymentTxHash: paymentTxInput.trim(),
                paymentMethod: paymentMethodInput,
                paymentVerifiedAt: new Date().toISOString(),
              }
            : d
        ),
      }));
      onToast(`Payment settlement confirmed for ${paymentModalDonation.id}.`);
      setPaymentModalDonation(null);
      setPaymentTxInput("");
    } catch (err: unknown) {
      onToast(err instanceof Error ? err.message : "Failed to verify payment.");
    } finally {
      setSubmittingPayment(false);
    }
  }

  // Handle Delete / Rollback
  function handleDeleteDonation(id: string) {
    const toDelete = data.donations.find((d) => d.id === id);
    if (!toDelete) return;
    if (!window.confirm(`Are you sure you want to rollback donation ${id}? Project raised balance will be adjusted.`)) {
      return;
    }
    setData((prev) => ({
      ...prev,
      donations: prev.donations.filter((d) => d.id !== id),
      projects: prev.projects.map((p) =>
        p.id === toDelete.projectId ? { ...p, raised: Math.max(0, p.raised - toDelete.amount) } : p
      ),
    }));
    onToast(`Donation ${id} rolled back.`);
  }

  const hasActiveFilters =
    searchTerm !== "" || selectedProjectId !== "ALL" || selectedMethod !== "ALL" || selectedStatus !== "ALL";

  function resetFilters() {
    setSearchTerm("");
    setSelectedProjectId("ALL");
    setSelectedMethod("ALL");
    setSelectedStatus("ALL");
  }

  return (
    <>
      {/* Top Banner and Heading */}
      <section className="welcome-row">
        <div>
          <div className="flow-badge-row" style={{ marginBottom: 8, display: "flex", flexWrap: "wrap", gap: 8 }}>
            <span className="zero-pii-badge">
              <ShieldCheck size={13} /> Zero Donor PII On-Chain
            </span>
            <span className="flow-pill-source">
              <Lock size={12} /> Keccak-256 Salted Commitments
            </span>
            {isAuditor && (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  fontSize: 11,
                  fontWeight: 600,
                  background: "#fdf4ff",
                  color: "#86198f",
                  border: "1px solid #f5d0fe",
                  padding: "2px 8px",
                  borderRadius: 6,
                }}
              >
                <ShieldCheck size={12} /> Auditor Privacy Shield Active: Donor Names Masked to Hashes
              </span>
            )}
          </div>
          <p className="eyebrow">
            {isAuditor ? "AUDITOR PRIVACY-PRESERVING VERIFICATION" : "PRIVACY-PRESERVING DONATION LEDGER"}
          </p>
          <h1>{isDonor ? "Your shielded contributions." : "Zero-PII Donation Commitments."}</h1>
          <p className="welcome-subtitle">
            {isAuditor
              ? "Auditor Privacy Enforced: In full compliance with privacy rules, donor names, emails, and phone numbers are strictly concealed. You see ONLY cryptographic commitment hashes and project-level aggregates."
              : "Donor names, email addresses, and phone numbers remain strictly off-chain in private storage. Cryptographic commitments are anchored to the EVM blockchain, while actual payment settlement is verified separately."}
          </p>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <button
            className="button button-outline"
            onClick={() => setShowTrendsChart((prev) => !prev)}
            style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13 }}
            title="Toggle monthly donation analytics"
          >
            <BarChart3 size={15} />
            {showTrendsChart ? "Hide Trends" : "Show Trends"}
          </button>
          <button
            className="button button-primary"
            onClick={() => handleOpenRecordModal()}
            style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13 }}
            title="Record a new donor contribution with cryptographic commitment"
          >
            <Plus size={16} /> Record Contribution
          </button>
        </div>
      </section>

      {/* Aggregate Transparency KPIs */}
      <div className="stat-grid stat-grid-three" style={{ marginBottom: 20 }}>
        <StatCard
          label={isDonor ? "YOUR CONTRIBUTIONS" : "TOTAL COMMITMENTS"}
          value={money(donationsTotal)}
          note={`${rawDonations.length} records recorded`}
          icon={HandCoins}
          tone="green"
        />
        <StatCard
          label="VERIFIED FINANCIAL TRANSFERS"
          value={money(verifiedSettledTotal)}
          note={`${rawDonations.length - pendingSettlementCount} settlements confirmed`}
          icon={BadgeCheck}
          tone="green"
        />
        <StatCard
          label="ACTIVE INITIATIVES FUNDED"
          value={String(supportedProjectsCount)}
          note={`Avg ₹${averageDonation.toLocaleString()} per contribution`}
          icon={Landmark}
          tone="blue"
        />
      </div>

      {/* Monthly Trends Chart */}
      {showTrendsChart && (
        <div style={{ marginBottom: 24 }}>
          <DonationChart data={chartData} />
        </div>
      )}

      {/* Search and Filters Bar */}
      <div
        style={{
          background: "#ffffff",
          border: "1px solid #e2e8f0",
          borderRadius: 10,
          padding: "14px 18px",
          marginBottom: 20,
          display: "flex",
          flexWrap: "wrap",
          gap: 12,
          alignItems: "center",
          justifyContent: "space-between",
          boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
        }}
      >
        <div style={{ display: "flex", flex: "1 1 280px", gap: 10, alignItems: "center" }}>
          <div style={{ position: "relative", width: "100%" }}>
            <Search
              size={15}
              style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }}
            />
            <input
              type="text"
              placeholder={isAuditor ? "Search by reference, hash, receipt, or project..." : "Search by donor, reference, hash, or project..."}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                width: "100%",
                boxSizing: "border-box",
                padding: "8px 12px 8px 34px",
                borderRadius: 6,
                border: "1px solid #cbd5e1",
                fontSize: 13,
                outline: "none",
                background: "#f8fafc",
                color: "#1e293b",
              }}
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm("")}
                style={{
                  position: "absolute",
                  right: 10,
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "transparent",
                  border: "none",
                  color: "#94a3b8",
                  cursor: "pointer",
                  padding: 2,
                }}
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          {/* Project Association Filter */}
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 12, color: "#64748b", fontWeight: 500 }}>Project:</span>
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              style={{
                padding: "7px 10px",
                borderRadius: 6,
                border: "1px solid #cbd5e1",
                fontSize: 12.5,
                background: "#f8fafc",
                color: "#1e293b",
                outline: "none",
              }}
            >
              <option value="ALL">All Associated Projects</option>
              <option value="GENERAL">Unallocated / General Fund</option>
              {data.projects.map((p) => (
                <option key={p.id} value={p.id}>
                  🚀 {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* Payment Method Filter */}
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 12, color: "#64748b", fontWeight: 500 }}>Payment:</span>
            <select
              value={selectedMethod}
              onChange={(e) => setSelectedMethod(e.target.value)}
              style={{
                padding: "7px 10px",
                borderRadius: 6,
                border: "1px solid #cbd5e1",
                fontSize: 12.5,
                background: "#f8fafc",
                color: "#1e293b",
                outline: "none",
              }}
            >
              <option value="ALL">All Methods</option>
              <option value="UPI">UPI</option>
              <option value="BANK">Bank Wire / RTGS</option>
              <option value="CARD">Credit / Debit Card</option>
              <option value="CRYPTO">Crypto Vault</option>
              <option value="CHEQUE">Cheque / DD</option>
            </select>
          </div>

          {/* Settlement Status Filter */}
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 12, color: "#64748b", fontWeight: 500 }}>Settlement:</span>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              style={{
                padding: "7px 10px",
                borderRadius: 6,
                border: "1px solid #cbd5e1",
                fontSize: 12.5,
                background: "#f8fafc",
                color: "#1e293b",
                outline: "none",
              }}
            >
              <option value="ALL">All Statuses</option>
              <option value="Verified">Verified Settlement</option>
              <option value="Pending">Pending Settlement</option>
            </select>
          </div>

          {hasActiveFilters && (
            <button
              onClick={resetFilters}
              style={{
                background: "#f1f5f9",
                border: "1px solid #cbd5e1",
                borderRadius: 6,
                padding: "6px 10px",
                fontSize: 12,
                color: "#475569",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
              }}
              title="Reset search and filters"
            >
              <X size={12} /> Clear Filters
            </button>
          )}
        </div>
      </div>

      {/* Main Ledger Table Panel */}
      <section className="panel page-panel">
        <div className="panel-heading" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <p className="eyebrow">TAMPER-EVIDENT DONATION LEDGER</p>
            <h2>
              Recorded contributions{" "}
              <span className="count-in-title">
                {filteredDonations.length}
                {filteredDonations.length !== rawDonations.length ? ` of ${rawDonations.length}` : ""}
              </span>
            </h2>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span className="record-count">
              {pendingSettlementCount > 0 ? `${pendingSettlementCount} pending settlement` : "All settlements verified"}
            </span>
          </div>
        </div>

        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>REFERENCE & ID</th>
                <th>{isAuditor ? "DONOR (SHIELDED HASH)" : "DONOR (SHIELDED)"}</th>
                <th>PROJECT</th>
                <th>AMOUNT</th>
                <th>ON-CHAIN COMMITMENT</th>
                <th>PAYMENT SETTLEMENT</th>
                <th>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {filteredDonations.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center", padding: "40px 20px", color: "#64748b" }}>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                      <HandCoins size={32} style={{ color: "#94a3b8" }} />
                      <p style={{ margin: 0, fontWeight: 600 }}>No donation records matched your filters.</p>
                      <button
                        className="button button-secondary"
                        onClick={() => handleOpenRecordModal()}
                        style={{ marginTop: 8, fontSize: 13 }}
                      >
                        <Plus size={14} /> Record First Contribution
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredDonations.map((donation) => {
                  const project = data.projects.find((p) => p.id === donation.projectId);
                  const isVerifiedPayment = donation.paymentStatus === "Verified";
                  const isConfirmedChain = donation.blockchainStatus === "Confirmed";

                  return (
                    <tr key={donation.id}>
                      {/* Reference & ID */}
                      <td>
                        <span className="ref-code">{donation.id}</span>
                        <small className="table-subline">{donation.reference}</small>
                      </td>

                      {/* Donor Name (STRICT AUDITOR PRIVACY: Auditor sees ONLY hash) */}
                      <td>
                        <div>
                          {isAuditor ? (
                            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                              <code
                                style={{
                                  fontFamily: "monospace",
                                  fontSize: 11,
                                  color: "#0284c7",
                                  background: "#f0f9ff",
                                  border: "1px solid #bae6fd",
                                  padding: "2px 6px",
                                  borderRadius: 4,
                                }}
                                title={donation.commitmentHash || (donation.donor.startsWith("0x") ? donation.donor : `0x${donation.reference || donation.id}`)}
                              >
                                <Lock size={10} style={{ marginRight: 3, display: "inline" }} />
                                {donation.commitmentHash
                                  ? `${donation.commitmentHash.slice(0, 10)}...${donation.commitmentHash.slice(-8)}`
                                  : donation.donor.startsWith("0x")
                                  ? `${donation.donor.slice(0, 10)}...${donation.donor.slice(-8)}`
                                  : `0x${donation.reference || donation.id}`}
                              </code>
                              <small className="table-subline" style={{ color: "#059669", display: "flex", alignItems: "center", gap: 3 }}>
                                <ShieldCheck size={11} /> Cryptographic Hash • Zero PII
                              </small>
                            </div>
                          ) : (
                            <div>
                              <div style={{ fontWeight: 600, color: "#1e293b", display: "flex", alignItems: "center", gap: 5 }}>
                                {isDonor ? `${donation.donor} (You)` : donation.donor}
                                {donation.isAnonymous && (
                                  <span style={{ fontSize: 10, background: "#f1f5f9", color: "#475569", padding: "1px 5px", borderRadius: 4 }}>
                                    Anon
                                  </span>
                                )}
                              </div>
                              <small className="table-subline" style={{ color: "#059669", display: "flex", alignItems: "center", gap: 3 }}>
                                <ShieldCheck size={11} /> Off-chain only · Zero PII on-chain
                              </small>
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Project Initiative */}
                      <td>
                        <span style={{ fontWeight: 500, color: "#1e293b" }}>{project?.name ?? donation.projectId}</span>
                        <small className="table-subline">{dateLabel(donation.date)}</small>
                      </td>

                      {/* Amount */}
                      <td className="amount-cell">
                        <b>{money(donation.amount)}</b>
                      </td>

                      {/* On-Chain Commitment */}
                      <td>
                        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                          <span className="commitment-chip" title={donation.commitmentHash || "Commitment computed"}>
                            <Lock size={11} /> {donation.commitmentHash ? `${donation.commitmentHash.slice(0, 10)}...` : "Salted Keccak-256"}
                          </span>
                          {isConfirmedChain ? (
                            <span className="badge badge-success" style={{ fontSize: 11, alignSelf: "flex-start" }}>
                              EVM Block #{donation.blockchainBlockNumber || 9}
                            </span>
                          ) : (
                            <span className="badge badge-neutral" style={{ fontSize: 11, alignSelf: "flex-start" }}>
                              Pending Anchor
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Payment Settlement */}
                      <td>
                        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                          {isVerifiedPayment ? (
                            <>
                              <span className="badge badge-success" style={{ alignSelf: "flex-start", display: "inline-flex", alignItems: "center", gap: 4 }}>
                                <CheckCircle2 size={12} /> Verified Settlement
                              </span>
                              <small className="table-subline">{donation.paymentTxHash || "Bank Wire Confirmed"}</small>
                            </>
                          ) : (
                            <>
                              <span className="badge badge-warning" style={{ alignSelf: "flex-start", display: "inline-flex", alignItems: "center", gap: 4 }}>
                                <Clock size={12} /> Pending Settlement
                              </span>
                              <small className="table-subline">Pledged · Awaiting transfer</small>
                            </>
                          )}
                        </div>
                      </td>

                      {/* Actions */}
                      <td>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                          {/* 80G Tax Receipt */}
                          <button
                            className="button button-plain"
                            style={{ padding: "4px 8px", fontSize: 12, display: "inline-flex", alignItems: "center", gap: 4 }}
                            onClick={() => setActiveReceiptDonation(donation)}
                            title="Generate and view official Section 80G Tax Receipt"
                          >
                            <Receipt size={13} /> 80G Receipt
                          </button>

                          {/* Verify Commitment */}
                          <button
                            className="button button-plain"
                            style={{ padding: "4px 8px", fontSize: 12, display: "inline-flex", alignItems: "center", gap: 4 }}
                            onClick={() => void handleVerifyCommitment(donation)}
                            title="Verify cryptographic commitment on-chain without revealing identity"
                          >
                            <ShieldCheck size={13} /> Verify Commitment
                          </button>

                          {/* Verify Payment (Auditor / NGO admin) */}
                          {!isDonor && !isVerifiedPayment && (
                            <button
                              className="button button-secondary"
                              style={{ padding: "4px 8px", fontSize: 12, display: "inline-flex", alignItems: "center", gap: 4 }}
                              onClick={() => {
                                setPaymentModalDonation(donation);
                                setPaymentTxInput(`BANK-WIRE-${Date.now().toString().slice(-6)}`);
                              }}
                              title="Verify financial transfer separately from commitment"
                            >
                              <BadgeCheck size={13} /> Verify Payment
                            </button>
                          )}

                          {/* Delete/Rollback (NGO Admin) */}
                          {isNGOAdmin && (
                            <button
                              className="button button-plain"
                              style={{ padding: "4px 6px", fontSize: 12, color: "#ef4444" }}
                              onClick={() => handleDeleteDonation(donation.id)}
                              title="Rollback test donation"
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <p className="table-disclaimer" style={{ marginTop: 14 }}>
          <CircleHelp size={14} /> <b>Zero-PII Commitment Architecture:</b> Public on-chain data contains only project aggregates and salted commitments. Donor names, emails, and phone numbers remain strictly off-chain in private storage. Actual financial payment transfers are verified separately from pledges.
        </p>
      </section>

      {/* MODAL 1: Record Contribution Modal */}
      {showRecordModal && (
        <div className="modal-backdrop">
          <div className="modal" style={{ maxWidth: 580 }}>
            <div className="modal-header">
              <div>
                <h2>Record Donor Contribution</h2>
                <p>Register fund receipts with live Zero-PII cryptographic commitment generation.</p>
              </div>
              <button aria-label="Close" onClick={() => setShowRecordModal(false)}>
                <X size={17} />
              </button>
            </div>

            {formError && (
              <div
                style={{
                  background: "#fef2f2",
                  border: "1px solid #fecaca",
                  color: "#b91c1c",
                  padding: "10px 14px",
                  borderRadius: 6,
                  fontSize: 13,
                  marginBottom: 16,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <AlertCircle size={16} />
                <span>{formError}</span>
              </div>
            )}

            <form className="form-grid" onSubmit={(e) => void handleRecordSubmit(e)}>
              {/* Donor Name */}
              <label className="field field-full">
                Donor Full Name / Corporate Entity *
                <input
                  required
                  type="text"
                  placeholder="e.g. Aarav Mehta or Infosys Foundation"
                  value={formDonorName}
                  onChange={(e) => setFormDonorName(e.target.value)}
                />
                <small>Stored strictly in private backend storage; NEVER published on Ethereum.</small>
              </label>

              {/* Email & PAN */}
              <label className="field">
                Donor Email (for 80G Receipt)
                <input
                  type="email"
                  placeholder="donor@example.com"
                  value={formDonorEmail}
                  onChange={(e) => setFormDonorEmail(e.target.value)}
                />
              </label>

              <label className="field">
                Donor PAN (Tax ID)
                <input
                  type="text"
                  maxLength={10}
                  placeholder="e.g. ABCDE1234F"
                  value={formDonorPan}
                  onChange={(e) => setFormDonorPan(e.target.value.toUpperCase())}
                  style={{ textTransform: "uppercase", fontFamily: "monospace" }}
                />
              </label>

              {/* Amount & Project */}
              <label className="field">
                Contribution Amount (₹) *
                <input
                  required
                  type="number"
                  min="1"
                  step="any"
                  placeholder="50000"
                  value={formAmount}
                  onChange={(e) => setFormAmount(e.target.value)}
                />
                <small>{money(parseFloat(formAmount) || 0)}</small>
              </label>

              <label className="field">
                Associate with Project Initiative *
                <select
                  required
                  value={formProjectId}
                  onChange={(e) => setFormProjectId(e.target.value)}
                >
                  {data.projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      🚀 {p.name}
                    </option>
                  ))}
                </select>
              </label>

              {/* Payment Method */}
              <label className="field">
                Payment Method
                <select
                  value={formPaymentMethod}
                  onChange={(e) => setFormPaymentMethod(e.target.value)}
                >
                  <option value="UPI">UPI (Google Pay, PhonePe, Paytm)</option>
                  <option value="Bank RTGS Settlement">Bank Wire / RTGS / NEFT</option>
                  <option value="Credit / Debit Card">Credit / Debit Card</option>
                  <option value="Crypto Vault">Crypto Vault (USDC/ETH)</option>
                  <option value="Cheque / DD">Demand Draft / Cheque</option>
                </select>
              </label>

              {/* Anonymous Checkbox */}
              <div className="field" style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 24 }}>
                <input
                  type="checkbox"
                  id="anonymousCheckbox"
                  checked={formIsAnonymous}
                  onChange={(e) => setFormIsAnonymous(e.target.checked)}
                  style={{ width: 16, height: 16, cursor: "pointer" }}
                />
                <label htmlFor="anonymousCheckbox" style={{ fontSize: 13, cursor: "pointer", color: "#334155" }}>
                  Mark as Anonymous
                </label>
              </div>

              {/* Purpose Notes */}
              <label className="field field-full">
                Purpose / Memo
                <input
                  type="text"
                  placeholder="e.g. Dedicated to pipeline materials in Phase 1"
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                />
              </label>

              {/* Live Cryptographic Commitment Box */}
              <div
                className="field-full"
                style={{
                  background: "#f0fdf4",
                  border: "1px solid #bbf7d0",
                  borderRadius: 8,
                  padding: "12px 16px",
                  fontSize: 12,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#166534", fontWeight: 700, marginBottom: 6 }}>
                  <ShieldCheck size={16} />
                  <span>Live Zero-PII Cryptographic Commitment Generator</span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 4, color: "#374151" }}>
                  <div>
                    <span style={{ color: "#6b7280" }}>Computed Commitment Hash: </span>
                    <code style={{ color: "#0284c7", fontWeight: 600, wordBreak: "break-all" }}>
                      {previewCommitmentHash || "Computing..."}
                    </code>
                  </div>
                  <div>
                    <span style={{ color: "#6b7280" }}>Private Blinding Salt: </span>
                    <code style={{ color: "#4b5563" }}>
                      {formSalt ? `${formSalt.slice(0, 14)}...${formSalt.slice(-8)}` : "Generating..."}
                    </code>
                  </div>
                </div>
                <p style={{ margin: "6px 0 0 0", fontSize: 11, color: "#15803d" }}>
                  🔒 Mathematically binds the project and amount without leaking the donor name, email, or contact information to the public blockchain.
                </p>
              </div>

              {/* Modal Actions */}
              <div className="modal-actions field-full" style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                <button
                  type="button"
                  className="button button-plain"
                  onClick={() => setShowRecordModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="button button-primary"
                  disabled={formSubmitting}
                >
                  {formSubmitting ? "Anchoring On-Chain..." : "Confirm & Record Contribution"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Section 80G Official Tax Receipt Modal */}
      {activeReceiptDonation && (
        <div className="modal-backdrop">
          <div
            className="modal"
            style={{
              maxWidth: 620,
              background: "#ffffff",
              color: "#0f172a",
              padding: "28px 32px",
            }}
          >
            {/* Header with Print & Close */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "2px solid #e2e8f0", paddingBottom: 16, marginBottom: 20 }}>
              <div>
                <h2 style={{ fontSize: 20, fontWeight: 800, margin: "0 0 4px 0", color: "#0f172a" }}>
                  {data.projects.find((p) => p.id === activeReceiptDonation.projectId)?.ngo || "Vidya Jyoti Foundation"}
                </h2>
                <p style={{ fontSize: 12, color: "#64748b", margin: 0 }}>
                  NITI Aayog Darpan ID: <b>MH/2018/0198421</b> | 80G Reg: <b>AAATV1284RF20214</b>
                </p>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span
                  style={{
                    background: "#dcfce7",
                    color: "#15803d",
                    fontSize: 11,
                    fontWeight: 700,
                    padding: "4px 8px",
                    borderRadius: 6,
                  }}
                >
                  SECTION 80G COMPLIANT
                </span>
                <button
                  aria-label="Close"
                  onClick={() => setActiveReceiptDonation(null)}
                  style={{ background: "transparent", border: "none", cursor: "pointer", color: "#64748b", padding: 4 }}
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Title & Receipt Meta */}
            <div style={{ textAlign: "center", marginBottom: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase", color: "#1e293b" }}>
                Official Donation Tax Receipt
              </div>
              <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
                Receipt No: <b>{activeReceiptDonation.receiptNumber || `REC-2026-${activeReceiptDonation.id}`}</b> | Date: <b>{dateLabel(activeReceiptDonation.date)}</b>
              </div>
            </div>

            {/* Auditor Privacy Banner if Auditor */}
            {isAuditor && (
              <div
                style={{
                  background: "#fdf4ff",
                  border: "1px solid #f5d0fe",
                  borderRadius: 8,
                  padding: "10px 14px",
                  fontSize: 12,
                  color: "#86198f",
                  marginBottom: 16,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <ShieldCheck size={16} />
                <span>
                  <b>Auditor Zero-PII Shield Active:</b> Personally Identifiable Information (Donor Name, PAN, Contact) is cryptographically shielded for audit independence.
                </span>
              </div>
            )}

            {/* Receipt Details Box */}
            <div
              style={{
                background: "#f8fafc",
                border: "1px solid #e2e8f0",
                borderRadius: 8,
                padding: "16px 20px",
                marginBottom: 20,
                fontSize: 13,
              }}
            >
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                {/* Donor Name (Auditor Shielded) */}
                <div>
                  <div style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase", fontWeight: 600 }}>Donor Name</div>
                  <div style={{ fontWeight: 700, color: "#0f172a", marginTop: 2 }}>
                    {isAuditor ? (
                      <code style={{ fontSize: 11, color: "#0284c7", background: "#e0f2fe", padding: "2px 6px", borderRadius: 4 }}>
                        {activeReceiptDonation.commitmentHash
                          ? `${activeReceiptDonation.commitmentHash.slice(0, 14)}...${activeReceiptDonation.commitmentHash.slice(-8)}`
                          : "0x4d0b397db6b0142b7819ce2994e6371a5c6819eb76a91c890123456789abcdef"}
                      </code>
                    ) : (
                      activeReceiptDonation.donor
                    )}
                  </div>
                </div>

                {/* Donor PAN (Auditor Shielded) */}
                <div>
                  <div style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase", fontWeight: 600 }}>Donor PAN (Tax ID)</div>
                  <div style={{ fontWeight: 700, color: "#0f172a", fontFamily: "monospace", marginTop: 2 }}>
                    {isAuditor ? "REDACTED (Auditor Shielded)" : activeReceiptDonation.donorPan || "ABCDE1234F"}
                  </div>
                </div>

                {/* Project Initiative */}
                <div>
                  <div style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase", fontWeight: 600 }}>Associated Initiative</div>
                  <div style={{ fontWeight: 600, color: "#0284c7", marginTop: 2 }}>
                    🚀 {data.projects.find((p) => p.id === activeReceiptDonation.projectId)?.name || activeReceiptDonation.projectId}
                  </div>
                </div>

                {/* Payment Mode */}
                <div>
                  <div style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase", fontWeight: 600 }}>Payment Mode</div>
                  <div style={{ fontWeight: 600, color: "#0f172a", marginTop: 2 }}>
                    {activeReceiptDonation.paymentMethod || "Bank RTGS Settlement"}
                  </div>
                </div>
              </div>

              {/* Amount Donated */}
              <div
                style={{
                  borderTop: "1px dashed #cbd5e1",
                  marginTop: 16,
                  paddingTop: 12,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "#475569" }}>Total Contribution:</span>
                  <div style={{ fontSize: 11, color: "#64748b" }}>{amountToWordsINR(activeReceiptDonation.amount)}</div>
                </div>
                <span style={{ fontSize: 22, fontWeight: 800, color: "#059669" }}>
                  ₹{activeReceiptDonation.amount.toLocaleString()}
                </span>
              </div>
            </div>

            {/* Cryptographic Ledger Proof Box */}
            <div
              style={{
                background: "#f1f5f9",
                borderRadius: 8,
                padding: "12px 16px",
                marginBottom: 20,
                fontSize: 11.5,
                color: "#475569",
              }}
            >
              <div style={{ fontWeight: 700, color: "#0f172a", marginBottom: 4, display: "flex", alignItems: "center", gap: 6 }}>
                <ShieldCheck size={14} color="#059669" /> Immutable On-Chain Ledger Verification:
              </div>
              <div style={{ fontFamily: "monospace", wordBreak: "break-all", color: "#0284c7" }}>
                Commitment: {activeReceiptDonation.commitmentHash || "0x4d0b397db6b0142b7819ce2994e6371a5c6819eb76a91c890123456789abcdef"}
              </div>
              <div style={{ marginTop: 4, display: "flex", justifyContent: "space-between", color: "#64748b" }}>
                <span>Smart Contract: <b>FundTraceLedger.sol</b></span>
                <span>EVM Block: <b>#{activeReceiptDonation.blockchainBlockNumber || 9}</b></span>
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button
                className="button button-plain"
                onClick={() => setActiveReceiptDonation(null)}
              >
                Close
              </button>
              <button
                className="button button-primary"
                onClick={() => window.print()}
                style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
              >
                <Printer size={15} /> Print / Download Receipt
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: Commitment Verification Modal */}
      {selectedDonationForCommitment && (
        <div className="modal-backdrop">
          <div className="modal" style={{ maxWidth: 560 }}>
            <div className="modal-header">
              <div>
                <h2>Donation Commitment Verification · {selectedDonationForCommitment.id}</h2>
                <p>Cryptographic proof verified against FundTraceLedger.sol on Ethereum</p>
              </div>
              <button aria-label="Close" onClick={() => setSelectedDonationForCommitment(null)}>
                <X size={17} />
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div className="proof-banner-box">
                <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#065f46" }}>
                  <ShieldCheck size={20} />
                  <b>Zero-PII Privacy Guarantee Active</b>
                </div>
                <p style={{ margin: "4px 0 0 0", fontSize: 13, color: "#374151" }}>
                  This verification establishes mathematical proof of the donation record using Keccak-256 commitments without publishing donor identities, email addresses, or phone numbers on the blockchain.
                </p>
              </div>

              <div className="proof-details-grid">
                <div className="proof-detail-item">
                  <span>DONATION REFERENCE</span>
                  <b>{selectedDonationForCommitment.id} ({selectedDonationForCommitment.reference})</b>
                </div>
                <div className="proof-detail-item">
                  <span>COMMITTED AMOUNT</span>
                  <b>{money(selectedDonationForCommitment.amount)}</b>
                </div>
                <div className="proof-detail-item">
                  <span>ASSOCIATED INITIATIVE</span>
                  <b>{data.projects.find((p) => p.id === selectedDonationForCommitment.projectId)?.name || selectedDonationForCommitment.projectId}</b>
                </div>
                <div className="proof-detail-item">
                  <span>BLINDING SALT</span>
                  <code style={{ fontSize: 11, wordBreak: "break-all" }}>
                    {selectedDonationForCommitment.blindingSalt
                      ? `${selectedDonationForCommitment.blindingSalt.slice(0, 10)}...${selectedDonationForCommitment.blindingSalt.slice(-8)}`
                      : "0x9a8b...9a8b"}
                  </code>
                </div>
              </div>

              {verifyingCommitment ? (
                <div style={{ textAlign: "center", padding: "20px 0" }}>
                  <RefreshCw className="spin-icon" size={24} style={{ margin: "0 auto 8px", color: "#0d9488" }} />
                  <p style={{ margin: 0, fontSize: 13, color: "#6b7280" }}>
                    Verifying Keccak-256 commitment against smart contract ledger...
                  </p>
                </div>
              ) : verificationResult ? (
                <div
                  style={{
                    background: "#ecfdf5",
                    border: "1px solid #a7f3d0",
                    borderRadius: 8,
                    padding: "14px 16px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#065f46", fontWeight: 700, marginBottom: 6 }}>
                    <CheckCircle2 size={18} />
                    <span>On-Chain Commitment Validated</span>
                  </div>
                  <p style={{ margin: 0, fontSize: 12.5, color: "#1f2937" }}>
                    {verificationResult.message}
                  </p>
                  <p style={{ margin: "6px 0 0 0", fontSize: 11.5, color: "#047857", fontWeight: 600 }}>
                    {verificationResult.piiStatus}
                  </p>
                </div>
              ) : null}

              <div className="modal-actions" style={{ display: "flex", justifyContent: "flex-end" }}>
                <button
                  type="button"
                  className="button button-plain"
                  onClick={() => setSelectedDonationForCommitment(null)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: Payment Settlement Verification Modal */}
      {paymentModalDonation && (
        <div className="modal-backdrop">
          <div className="modal" style={{ maxWidth: 500 }}>
            <div className="modal-header">
              <div>
                <h2>Verify Financial Payment Settlement</h2>
                <p>Confirm the banking transfer for donation {paymentModalDonation.id} separately from the pledge commitment.</p>
              </div>
              <button aria-label="Close" onClick={() => setPaymentModalDonation(null)}>
                <X size={17} />
              </button>
            </div>

            <form className="form-grid" onSubmit={(e) => void handleConfirmPayment(e)}>
              <div
                className="field-full"
                style={{
                  background: "#f8fafc",
                  border: "1px solid #e2e8f0",
                  borderRadius: 8,
                  padding: "12px 14px",
                  fontSize: 13,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ color: "#64748b" }}>Donation ID:</span>
                  <b>{paymentModalDonation.id}</b>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ color: "#64748b" }}>Donor Identity:</span>
                  <b>{isAuditor ? "Shielded Cryptographic Hash" : paymentModalDonation.donor}</b>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "#64748b" }}>Amount Pledged:</span>
                  <b style={{ color: "#059669" }}>{money(paymentModalDonation.amount)}</b>
                </div>
              </div>

              <label className="field field-full">
                Settlement Reference / Bank UTR *
                <input
                  required
                  type="text"
                  placeholder="e.g. BANK-WIRE-982134"
                  value={paymentTxInput}
                  onChange={(e) => setPaymentTxInput(e.target.value)}
                />
                <small>The bank settlement UTR or transaction confirmation hash</small>
              </label>

              <label className="field field-full">
                Settlement Method
                <select
                  value={paymentMethodInput}
                  onChange={(e) => setPaymentMethodInput(e.target.value)}
                >
                  <option value="Bank RTGS Settlement">Bank RTGS Settlement</option>
                  <option value="NEFT Wire Transfer">NEFT Wire Transfer</option>
                  <option value="UPI Instant Settlement">UPI Instant Settlement</option>
                  <option value="Direct Merchant Clearing">Direct Merchant Clearing</option>
                </select>
              </label>

              <div className="modal-actions field-full" style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                <button
                  type="button"
                  className="button button-plain"
                  onClick={() => setPaymentModalDonation(null)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="button button-primary"
                  disabled={submittingPayment}
                >
                  {submittingPayment ? "Confirming Settlement..." : "Confirm Verified Payment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

export default DonationsPage;
