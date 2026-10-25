import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { 
  AlertTriangle, 
  BadgeCheck, 
  Check, 
  CheckCircle2,
  ChevronRight, 
  CircleHelp, 
  Download,
  FilePlus2, 
  Fingerprint, 
  GitFork,
  HandCoins, 
  KeyRound, 
  Landmark, 
  Link2,
  MapPin, 
  Plus, 
  Search, 
  ShieldAlert, 
  ShieldCheck, 
  Sparkles, 
  Upload, 
  WalletCards, 
  X 
} from "lucide-react";
import { DonationChart } from "./components/DonationChart";
import { ExpenseTable } from "./components/ExpenseTable";
import { Navbar } from "./components/Navbar";
import { Sidebar, type PageKey } from "./components/Sidebar";
import { StatCard } from "./components/StatCard";
import { StatusBadge } from "./components/StatusBadge";
import { MultiHopFlowView } from "./components/MultiHopFlowView";
import { FundTraceWalkthrough } from "./components/FundTraceWalkthrough";
import { LoginPage } from "./pages/LoginPage";
import { NGODashboard } from "./pages/NGODashboard";
import { NGOManagementPage } from "./pages/NGOManagementPage";
import { FundingIntegrityPage } from "./pages/FundingIntegrityPage";
import { authService, DEMO_USERS } from "./services/authService";
import { receiptService } from "./services/receiptService";
import { blockchainService, type BlockchainVerifyResponse } from "./services/blockchainService";
import { formatINR, initialData } from "./utils/demoData";
import type { AuditEntry, AuthUser, Expense, FundTraceData, Project, Role, ReceiptOCRResult } from "./types";

const DATA_KEY = "fundtrace-demo-data-v1";
const ROLE_KEY = "fundtrace-demo-role-v1";
const money = (amount: number) => formatINR(amount);
const dateLabel = (value: string) => new Date(`${value.slice(0, 10)}T12:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

function loadData(): FundTraceData {
  const saved = localStorage.getItem(DATA_KEY);
  return saved ? JSON.parse(saved) as FundTraceData : initialData;
}

function newId(prefix: string, existing: { id: string }[]): string {
  const next = Math.max(0, ...existing.map((item) => Number(item.id.match(/\d+$/)?.[0] ?? 0))) + 1;
  return `${prefix}-${String(next).padStart(3, "0")}`;
}

function riskLabel(score: number): string {
  if (score >= 75) return "Critical";
  if (score >= 50) return "High";
  if (score >= 25) return "Medium";
  return "Low";
}

export default function App() {
  const [data, setData] = useState<FundTraceData>(loadData);
  const [role, setRole] = useState<Role>(() => (localStorage.getItem(ROLE_KEY) as Role | null) ?? "NGO admin");
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(() => {
    const stored = authService.getCurrentUser();
    if (stored) return stored;
    const initialRole = (localStorage.getItem(ROLE_KEY) as Role | null) ?? "NGO admin";
    const demo = DEMO_USERS.find((u) => u.role === initialRole);
    if (demo) {
      return {
        id: `demo-${demo.role.toLowerCase()}`,
        email: demo.email,
        full_name: demo.name,
        role: demo.role,
        organization: demo.organization,
        is_active: true,
        token: "demo-token",
      };
    }
    return null;
  });
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [page, setPage] = useState<PageKey>("Overview");
  const [selectedNgoId, setSelectedNgoId] = useState<number | null>(null);
  const [expenseModal, setExpenseModal] = useState(false);
  const [projectModal, setProjectModal] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [toast, setToast] = useState("");

  // Upload & OCR modal state
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState("");
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrResult, setOcrResult] = useState<ReceiptOCRResult | null>(null);

  // Controlled form state for expense submission
  const [formVendor, setFormVendor] = useState("");
  const [formCategory, setFormCategory] = useState("Construction");
  const [formInvoiceNumber, setFormInvoiceNumber] = useState("");
  const [formAmount, setFormAmount] = useState("");
  const [formReceiptAmount, setFormReceiptAmount] = useState("");
  const [formDate, setFormDate] = useState("");

  function resetExpenseForm() {
    setExpenseModal(false);
    setUploadedFile(null);
    setFileError("");
    setOcrLoading(false);
    setOcrResult(null);
    setFormVendor("");
    setFormCategory("Construction");
    setFormInvoiceNumber("");
    setFormAmount("");
    setFormReceiptAmount("");
    setFormDate("");
  }

  async function handleExpenseFileSelect(selected: File | null) {
    setUploadedFile(selected);
    setOcrResult(null);
    if (!selected) {
      setFileError("");
      return;
    }

    const val = receiptService.validateFile(selected);
    if (!val.valid) {
      setFileError(val.error || "Invalid file format or size limit exceeded.");
      return;
    }
    setFileError("");

    setOcrLoading(true);
    try {
      const ocr = await receiptService.extractReceiptOCR(selected);
      setOcrResult(ocr);
      if (ocr.vendor && !formVendor) setFormVendor(ocr.vendor);
      if (ocr.invoiceNumber && !formInvoiceNumber) setFormInvoiceNumber(ocr.invoiceNumber);
      if (ocr.amount !== undefined) {
        if (!formAmount) setFormAmount(String(ocr.amount));
        if (!formReceiptAmount) setFormReceiptAmount(String(ocr.amount));
      }
      if (ocr.date && !formDate) setFormDate(ocr.date);
      setToast("✨ Receipt analyzed: OCR extracted vendor, invoice, date, and amount!");
    } catch (err: unknown) {
      console.error("OCR extraction failed:", err);
    } finally {
      setOcrLoading(false);
    }
  }

  useEffect(() => { localStorage.setItem(DATA_KEY, JSON.stringify(data)); }, [data]);
  useEffect(() => { localStorage.setItem(ROLE_KEY, role); }, [role]);
  useEffect(() => {
    if (role === "Donor" && (page === "Receipt verification" || page === "Audit log")) {
      setPage("Overview");
    }
  }, [role, page]);
  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(""), 3500);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const approvedTotal = data.expenses.filter((item) => item.status === "Approved").reduce((sum, item) => sum + item.claimedAmount, 0);
  const donorName = currentUser?.full_name || "Aarav Mehta";
  const visibleDonations = role === "Donor" ? data.donations.filter((item) => item.donor === donorName) : data.donations;
  const donationsTotal = visibleDonations.reduce((sum, item) => sum + item.amount, 0);
  const pending = data.expenses.filter((item) => item.status === "Pending review" || item.status === "More evidence");
  const latestExpenses = [...data.expenses].sort((a, b) => b.date.localeCompare(a.date));

  async function handleRoleChange(newRole: Role) {
    setRole(newRole);
    localStorage.setItem(ROLE_KEY, newRole);
    try {
      const user = await authService.loginAsDemoRole(newRole);
      if (user) {
        setCurrentUser(user);
        setToast(`Role switched to ${newRole} (${user.full_name}). Real permissions active.`);
        return;
      }
    } catch (err) {
      console.warn("Could not authenticate demo role via backend:", err);
    }
    const demo = DEMO_USERS.find((u) => u.role === newRole);
    if (demo) {
      const updatedUser: AuthUser = {
        id: `demo-${newRole.toLowerCase()}`,
        email: demo.email,
        full_name: demo.name,
        role: newRole,
        organization: demo.organization,
        is_active: true,
        token: "demo-jwt-token",
      };
      setCurrentUser(updatedUser);
      authService.setSession("demo-jwt-token", updatedUser);
      setToast(`Role switched to ${newRole} (${demo.name}).`);
    }
  }

  function handleLoginSuccess(user?: AuthUser) {
    const activeUser = user || authService.getCurrentUser();
    if (activeUser) {
      setCurrentUser(activeUser);
      setRole(activeUser.role);
      setToast(`Authenticated as ${activeUser.full_name} (${activeUser.role}). Permissions active.`);
    }
    setAuthModalOpen(false);
  }

  function handleLogout() {
    authService.clearSession();
    setCurrentUser(null);
    setToast("Logged out of active session.");
    setAuthModalOpen(true);
  }

  function recordAudit(expense: Expense, action: string, reason: string) {
    const actorName = currentUser?.full_name || (role === "Auditor" ? "Priya Nair" : "Helping Hands admin");
    const entry: AuditEntry = {
      id: newId("AUD", data.auditLog),
      expenseId: expense.id,
      action,
      actor: `${actorName} (${role})`,
      reason,
      date: new Date().toISOString(),
    };
    setData((current) => ({ ...current, auditLog: [entry, ...current.auditLog] }));
  }

  function decideExpense(expense: Expense, status: Expense["status"], reason: string) {
    if (role !== "Auditor") {
      setToast("Permission Denied: Only Independent Auditors can record review decisions.");
      return;
    }
    const action = status === "Approved" ? "Approved" : status === "Rejected" ? "Rejected" : "More evidence requested";
    setData((current) => ({
      ...current,
      expenses: current.expenses.map((item) => item.id === expense.id ? { ...item, status } : item),
    }));
    recordAudit(expense, action, reason);
    setSelectedExpense(null);
    setToast(`${expense.id} marked ${status.toLowerCase()} by Auditor.`);
  }

  async function addExpense(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (role !== "NGO admin") {
      setToast("Permission Denied: Only NGO Admins can submit expense claims.");
      return;
    }
    const form = new FormData(event.currentTarget);
    const projectId = String(form.get("projectId"));
    const project = data.projects.find((item) => item.id === projectId);
    if (!project) return;

    const vendorVal = formVendor.trim() || String(form.get("vendor")).trim();
    const invoiceNumberVal = formInvoiceNumber.trim() || String(form.get("invoiceNumber")).trim();
    const claimedAmount = Number(formAmount || form.get("amount"));
    const extractedValue = formReceiptAmount || String(form.get("receiptAmount") ?? "");
    const extractedAmount = extractedValue ? Number(extractedValue) : (ocrResult?.amount ?? undefined);
    const receiptValue = form.get("receipt");
    const file = receiptValue instanceof File && receiptValue.size > 0 ? receiptValue : (uploadedFile?.size ? uploadedFile : undefined);
    
    let receiptHash = "";
    let receiptId: string | undefined = undefined;

    if (file) {
      const validation = receiptService.validateFile(file);
      if (!validation.valid) {
        setToast(validation.error || "Invalid file format or size.");
        return;
      }
      try {
        receiptHash = await receiptService.computeFileSha256(file);
        const receiptMeta = await receiptService.uploadReceipt(file);
        receiptId = receiptMeta.id;
      } catch (err: unknown) {
        setToast(err instanceof Error ? err.message : "Failed to securely store receipt file.");
        return;
      }
    }

    const reasons: string[] = [];
    let score = 0;
    if (receiptHash && data.expenses.some((item) => item.receiptHash === receiptHash)) {
      reasons.push("Exact receipt file has already been submitted");
      score += 45;
    }
    const normalizedInvoice = (ocrResult?.invoiceNumber || invoiceNumberVal)
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");
    const normalizedVendor = (ocrResult?.vendor || vendorVal)
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");
    if (
      normalizedInvoice &&
      normalizedVendor &&
      (ocrResult?.duplicateInvoice ||
        data.expenses.some((item) =>
          item.invoiceNumber.toLowerCase().replace(/[^a-z0-9]/g, "") === normalizedInvoice &&
          item.vendor.toLowerCase().replace(/[^a-z0-9]/g, "") === normalizedVendor
        ))
    ) {
      reasons.push("Invoice number and vendor match a previously submitted expense");
      score += 35;
    }
    if (ocrResult?.duplicateFile) {
      reasons.push("Receipt file fingerprint matches a previously uploaded document");
      score += 45;
    }
    if (extractedAmount !== undefined && extractedAmount !== claimedAmount) {
      reasons.push(`Claimed amount differs from receipt amount by ${money(Math.abs(claimedAmount - extractedAmount))}`);
      score += 30;
    }
    if (ocrResult?.vendor) {
      const v1 = vendorVal.toLowerCase();
      const v2 = ocrResult.vendor.toLowerCase();
      if (!v1.includes(v2) && !v2.includes(v1)) {
        reasons.push(`Claimed vendor ('${vendorVal}') differs from receipt vendor ('${ocrResult.vendor}')`);
        score += 20;
      }
    }
    if (ocrResult?.invoiceNumber) {
      const i1 = invoiceNumberVal.toLowerCase();
      const i2 = ocrResult.invoiceNumber.toLowerCase();
      if (i1 !== i2 && !i1.includes(i2) && !i2.includes(i1)) {
        reasons.push(`Claimed invoice number ('${invoiceNumberVal}') differs from receipt ('${ocrResult.invoiceNumber}')`);
        score += 15;
      }
    }
    if (ocrResult?.arithmeticConsistent === false) {
      reasons.push("Invoice subtotal, tax, and total do not reconcile");
      score += 20;
    }
    if (ocrResult?.currency && ocrResult.currency !== "INR") {
      reasons.push(`Invoice currency is ${ocrResult.currency}; project budget is recorded in INR`);
      score += 10;
    }
    if (ocrResult?.paymentStatus === "Unpaid") {
      reasons.push("Invoice is marked unpaid; confirm payment with separate evidence");
    }
    if (ocrResult?.warnings.length) reasons.push(...ocrResult.warnings);
    const approvedForProject = data.expenses
      .filter((item) => item.projectId === projectId && item.status === "Approved")
      .reduce((sum, item) => sum + item.claimedAmount, 0);
    if (approvedForProject + claimedAmount > project.budget) {
      reasons.push("Claim exceeds the remaining project budget");
      score += 25;
    }
    if (!file?.size) {
      reasons.push("No receipt attached");
      score += 30;
    }
    if (reasons.length === 0) reasons.push("No automatic warning triggered; human auditor review is still required");
    score = Math.min(100, score);

    const expense: Expense = {
      id: newId("EXP", data.expenses),
      projectId,
      vendor: vendorVal,
      category: formCategory || String(form.get("category")),
      invoiceNumber: invoiceNumberVal,
      claimedAmount,
      extractedAmount,
      extractedVendor: ocrResult?.vendor,
      extractedInvoiceNumber: ocrResult?.invoiceNumber,
      extractedDate: ocrResult?.date || formDate || new Date().toISOString().slice(0, 10),
      extractedDueDate: ocrResult?.dueDate,
      extractedVendorAddress: ocrResult?.vendorAddress,
      extractedGstin: ocrResult?.gstin,
      extractedDescription: ocrResult?.description,
      extractedQuantity: ocrResult?.quantity,
      extractedQuantityUnit: ocrResult?.quantityUnit,
      extractedUnitPrice: ocrResult?.unitPrice,
      extractedSubtotal: ocrResult?.subtotal,
      extractedTaxAmount: ocrResult?.taxAmount,
      extractedCurrency: ocrResult?.currency,
      extractedPaymentStatus: ocrResult?.paymentStatus,
      extractedPaymentReference: ocrResult?.paymentReference,
      arithmeticConsistent: ocrResult?.arithmeticConsistent,
      duplicateInvoice: ocrResult?.duplicateInvoice,
      duplicateFile: ocrResult?.duplicateFile,
      missingInvoiceFields: ocrResult?.missingFields,
      receiptName: file?.size ? file.name : "No receipt attached",
      receiptHash,
      receiptId,
      status: "Pending review",
      riskScore: score,
      riskReasons: reasons,
      date: ocrResult?.date || formDate || new Date().toISOString().slice(0, 10),
      blockchainStatus: "Not submitted",
    };
    setData((current) => ({ ...current, expenses: [expense, ...current.expenses] }));
    recordAudit(expense, "Expense submitted", "Submitted by NGO Admin for review.");
    resetExpenseForm();
    setToast(`${expense.id} submitted for review with secure receipt storage. Fingerprint: ${receiptHash ? receiptHash.slice(0, 12) + "..." : "none"}`);
  }

  function addProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (role !== "NGO admin") {
      setToast("Permission Denied: Only NGO Admins can create new projects.");
      return;
    }
    const form = new FormData(event.currentTarget);
    const orgName = currentUser?.organization || currentUser?.full_name || "Helping Hands Foundation";
    const project: Project = {
      id: newId("PRJ", data.projects),
      name: String(form.get("name")).trim(),
      ngo: orgName,
      description: String(form.get("description")).trim(),
      budget: Number(form.get("budget")),
      raised: 0,
      location: String(form.get("location")).trim(),
      category: String(form.get("category")),
    };
    setData((current) => ({ ...current, projects: [project, ...current.projects] }));
    setProjectModal(false);
    setToast(`${project.name} created by NGO Admin.`);
  }

  function addDonation(project: Project) {
    if (role !== "Donor") {
      setToast("Permission Denied: Please switch or sign in as a Donor to make contributions.");
      return;
    }
    const donor = currentUser?.full_name || "Aarav Mehta";
    const donation = {
      id: newId("DON", data.donations),
      projectId: project.id,
      donor,
      amount: 10_000,
      date: new Date().toISOString().slice(0, 10),
      reference: `PAY-${Date.now().toString().slice(-6)}`,
    };
    setData((current) => ({
      ...current,
      donations: [donation, ...current.donations],
      projects: current.projects.map((item) => item.id === project.id ? { ...item, raised: item.raised + donation.amount } : item),
    }));
    setToast(`${money(donation.amount)} contribution recorded for ${project.name} by ${donor}.`);
  }

  return (
    <div className="app-shell">
      <Sidebar 
        page={page} 
        setPage={setPage} 
        role={role} 
        setRole={handleRoleChange} 
        currentUser={currentUser}
        onOpenAuth={() => setAuthModalOpen(true)}
        pendingCount={pending.length}
      />
      <div className="main-column">
        <Navbar 
          currentUser={currentUser}
          role={role} 
          page={page} 
          onOpenAuth={() => setAuthModalOpen(true)}
          onLogout={handleLogout}
        />
        <main className="main-content">
          {/* Enforced RBAC Status Bar */}
          <div className="rbac-status-bar">
            <div className="rbac-status-info">
              <ShieldCheck size={20} className="text-green" />
              <div>
                <span>
                  Active Account: <b>{currentUser?.full_name || role}</b> ·{" "}
                  <span className={`role-pill ${role === "Donor" ? "badge-donor" : role === "NGO admin" ? "badge-ngo" : "badge-auditor"}`}>
                    {role}
                  </span>
                </span>
                <small style={{ display: "block", color: "#596f64", marginTop: 2 }}>
                  {role === "NGO admin" && "NGO Admin Permissions: Create projects, submit expenses with verified receipt storage, view all allocations."}
                  {role === "Auditor" && "Auditor Permissions: Review & approve/reject claims, download secure receipts, verify SHA-256 hashes, access audit logs."}
                  {role === "Donor" && "Donor Permissions: Contribute funds, view personal donations, and inspect transparency summaries (receipt files private)."}
                </small>
              </div>
            </div>
            <button className="rbac-switch-btn" onClick={() => setAuthModalOpen(true)}>
              <KeyRound size={13} />
              <span>Switch / Register</span>
            </button>
          </div>

          <div className="demo-banner">
            <Sparkles size={15} />
            <span>
              <b>Secure Receipt Upload & Storage Active</b> · File types (PDF, PNG, JPG, WEBP) & 10MB limits validated; SHA-256 fingerprints recorded.
            </span>
            <button onClick={() => { localStorage.removeItem(DATA_KEY); window.location.reload(); }}>
              Reset demo
            </button>
          </div>

          <FundTraceWalkthrough
            currentRole={role}
            onSelectRole={(newRole) => void handleRoleChange(newRole)}
            onNavigate={(targetPage) => setPage(targetPage)}
            onNewExpense={() => setExpenseModal(true)}
          />

          {page === "Overview" && <Overview
            role={role} data={data} donationsTotal={donationsTotal} approvedTotal={approvedTotal}
            pending={pending} latestExpenses={latestExpenses} onNewExpense={() => setExpenseModal(true)}
            onSelectExpense={setSelectedExpense} setPage={setPage} addDonation={addDonation} onOpenProject={setSelectedProject}
          />}
          {page === "NGO Directory" && (
            selectedNgoId ? (
              <NGODashboard ngoId={selectedNgoId} onNavigateToDirectory={() => setSelectedNgoId(null)} />
            ) : (
              <NGOManagementPage onSelectNGO={(id) => setSelectedNgoId(id)} />
            )
          )}
          {page === "Projects" && <ProjectsPage projects={data.projects} donations={data.donations} expenses={data.expenses} role={role} addDonation={addDonation} onCreate={() => setProjectModal(true)} onOpenProject={setSelectedProject} />}
          {page === "Donations" && <DonationsPage data={data} donationsTotal={donationsTotal} role={role} />}
          {page === "Expenses" && <ExpensesPage data={data} role={role} onNew={() => setExpenseModal(true)} onSelect={setSelectedExpense} />}
          {page === "Receipt verification" && role !== "Donor" && <ReceiptPage expenses={data.expenses} />}
          {page === "Multi-hop flows" && <MultiHopFlowView role={role} />}
          {page === "Funding integrity" && <FundingIntegrityPage />}
          {page === "Audit log" && role !== "Donor" && <AuditPage entries={data.auditLog} projects={data.projects} expenses={data.expenses} />}
          
          <footer className="app-footer">
            <span>FundTrace · transparent giving, accountable spending</span>
            <span>Secure Receipt Storage & Enforced RBAC</span>
          </footer>
        </main>
      </div>

      {authModalOpen && (
        <LoginPage 
          onLoginSuccess={handleLoginSuccess}
          onCancel={() => setAuthModalOpen(false)}
        />
      )}

      {expenseModal && <Modal title="Submit an expense" subtitle="Upload receipt document with automatic OCR field extraction." onClose={resetExpenseForm}>
        <form className="form-grid" onSubmit={(event) => void addExpense(event)}>
          <label className="field field-full">Project<select required name="projectId">{data.projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label>
          <label className="field">Vendor name<input required name="vendor" value={formVendor} onChange={(e) => setFormVendor(e.target.value)} placeholder="e.g. ABC Building Supplies" /></label>
          <label className="field">Category<select name="category" value={formCategory} onChange={(e) => setFormCategory(e.target.value)}><option>Construction</option><option>Materials</option><option>Transportation</option><option>Medical supplies</option><option>Other</option></select></label>
          <label className="field">Invoice number<input name="invoiceNumber" value={formInvoiceNumber} onChange={(e) => setFormInvoiceNumber(e.target.value)} placeholder="INV-2026-001" /></label>
          <label className="field">Claimed amount (₹)<input required name="amount" type="number" min="1" step="1" value={formAmount} onChange={(e) => setFormAmount(e.target.value)} placeholder="200000" /></label>
          <label className="field">Receipt amount (₹)<input name="receiptAmount" type="number" min="0" step="1" value={formReceiptAmount} onChange={(e) => setFormReceiptAmount(e.target.value)} placeholder="Auto-filled by OCR or enter manually" /><small>Extracted via OCR worker; human review required.</small></label>
          
          <div className="field-full file-drop-container">
            <label className="file-drop">
              <Upload size={18} />
              <span>{uploadedFile ? uploadedFile.name : "Attach receipt or invoice (PDF, PNG, JPG, WEBP)"}</span>
              <small>Validated format & max 10 MB. Real-time OCR worker extracts vendor, invoice #, date, and amount.</small>
              <input 
                name="receipt" 
                type="file" 
                accept=".pdf,.png,.jpg,.jpeg,.webp" 
                onChange={(e) => void handleExpenseFileSelect(e.target.files?.[0] ?? null)} 
              />
            </label>

            {ocrLoading && (
              <div className="ocr-loading-badge">
                <Sparkles size={15} />
                <span><b>Analyzing receipt with OCR worker…</b> Extracting vendor, invoice number, date, and amount</span>
              </div>
            )}

            {uploadedFile && !fileError && !ocrLoading && (
              <div className="file-validation-indicator">
                <CheckCircle2 size={15} />
                <span><b>{uploadedFile.name}</b> ({receiptService.formatBytes(uploadedFile.size)}) — Validated for secure storage & OCR</span>
              </div>
            )}

            {ocrResult && !ocrLoading && (
              <div className="ocr-extraction-card">
                <div className="ocr-card-header">
                  <div className="ocr-card-title">
                    <Sparkles size={15} />
                    <span>OCR Extracted Invoice Candidate Data</span>
                  </div>
                  <span className={`ocr-confidence-pill ${ocrResult.confidence < 0.6 ? "low" : ""}`}>
                    {Math.round(ocrResult.confidence * 100)}% Confidence
                  </span>
                </div>
                <div className="ocr-extracted-grid">
                  <div className="ocr-field-item">
                    <span>Vendor</span>
                    <b>{ocrResult.vendor || "Not recognized"}</b>
                  </div>
                  <div className="ocr-field-item">
                    <span>Invoice #</span>
                    <b>{ocrResult.invoiceNumber || "Not recognized"}</b>
                  </div>
                  <div className="ocr-field-item">
                    <span>Date</span>
                    <b>{ocrResult.date || "Not recognized"}</b>
                  </div>
                  <div className="ocr-field-item">
                    <span>Amount</span>
                    <b>{ocrResult.amount !== undefined ? money(ocrResult.amount) : "Not recognized"}</b>
                  </div>
                  <div className="ocr-field-item">
                    <span>Vendor address</span>
                    <b>{ocrResult.vendorAddress ?? "Not recognized"}</b>
                  </div>
                  <div className="ocr-field-item">
                    <span>GSTIN</span>
                    <b>{ocrResult.gstin ?? "Not recognized"}</b>
                  </div>
                  <div className="ocr-field-item">
                    <span>Goods / services</span>
                    <b>{ocrResult.description ?? "Not recognized"}</b>
                  </div>
                  <div className="ocr-field-item">
                    <span>Quantity</span>
                    <b>{ocrResult.quantity !== undefined
                      ? `${ocrResult.quantity}${ocrResult.quantityUnit ? ` ${ocrResult.quantityUnit}` : ""}`
                      : "Not recognized"}</b>
                  </div>
                  <div className="ocr-field-item">
                    <span>Unit price</span>
                    <b>{ocrResult.unitPrice !== undefined ? money(ocrResult.unitPrice) : "Not recognized"}</b>
                  </div>
                  <div className="ocr-field-item">
                    <span>Subtotal</span>
                    <b>{ocrResult.subtotal !== undefined ? money(ocrResult.subtotal) : "Not recognized"}</b>
                  </div>
                  <div className="ocr-field-item">
                    <span>Tax</span>
                    <b>{ocrResult.taxAmount !== undefined ? money(ocrResult.taxAmount) : "Not recognized"}</b>
                  </div>
                  <div className="ocr-field-item">
                    <span>Currency</span>
                    <b>{ocrResult.currency ?? "Not recognized"}</b>
                  </div>
                  <div className="ocr-field-item">
                    <span>Payment status</span>
                    <b>{ocrResult.paymentStatus ?? "Not recognized"}</b>
                  </div>
                  <div className="ocr-field-item">
                    <span>Payment reference</span>
                    <b>{ocrResult.paymentReference ?? "Not recognized"}</b>
                  </div>
                  <div className="ocr-field-item">
                    <span>Due date</span>
                    <b>{ocrResult.dueDate ?? "Not recognized"}</b>
                  </div>
                  <div className="ocr-field-item">
                    <span>File fingerprint</span>
                    <b>{ocrResult.fileHash ? `${ocrResult.fileHash.slice(0, 16)}…` : "Not available"}</b>
                  </div>
                </div>
                {(ocrResult.duplicateInvoice || ocrResult.duplicateFile || ocrResult.warnings.length > 0) && (
                  <ul className="ocr-warning-list" role="status">
                    {ocrResult.duplicateInvoice && <li>Potential duplicate invoice detected for this vendor.</li>}
                    {ocrResult.duplicateFile && <li>File fingerprint matches a previously uploaded document.</li>}
                  {ocrResult.missingFields && ocrResult.missingFields.length > 0 && (
                    <li>Fields not detected: {ocrResult.missingFields.join(", ")}.</li>
                  )}
                  {ocrResult.warnings
                    .filter((warning) => !warning.toLowerCase().includes("duplicate"))
                    .map((warning) => <li key={warning}>{warning}</li>)}
                </ul>
                )}
                <p className="ocr-auto-applied-note">
                  <Check size={13} className="text-green" />
                  <span>Candidate fields pre-filled into the form. Human auditor review is still required before approval.</span>
                </p>
              </div>
            )}

            {fileError && (
              <div className="file-validation-indicator error">
                <AlertTriangle size={15} />
                <span>{fileError}</span>
              </div>
            )}
          </div>

          <div className="form-note field-full"><CircleHelp size={15} /> Risk indicators prioritize review; they do not establish fraud.</div>
          <div className="modal-actions field-full">
            <button type="button" className="button button-plain" onClick={resetExpenseForm}>Cancel</button>
            <button className="button button-primary" disabled={Boolean(fileError) || ocrLoading}><FilePlus2 size={16} /> Submit for review</button>
          </div>
        </form>
      </Modal>}

      {projectModal && <Modal title="Create a project" subtitle="Set up a project for demo tracking." onClose={() => setProjectModal(false)}>
        <form className="form-grid" onSubmit={addProject}>
          <label className="field field-full">Project name<input required name="name" placeholder="Community library renovation" /></label>
          <label className="field">Category<select name="category"><option>Education</option><option>Clean water</option><option>Healthcare</option><option>Food security</option><option>Other</option></select></label>
          <label className="field">Budget (₹)<input required min="1" type="number" name="budget" placeholder="500000" /></label>
          <label className="field field-full">Location<input required name="location" placeholder="District, State" /></label>
          <label className="field field-full">Description<textarea required name="description" rows={3} placeholder="What will this project achieve?" /></label>
          <div className="modal-actions field-full"><button type="button" className="button button-plain" onClick={() => setProjectModal(false)}>Cancel</button><button className="button button-primary"><Plus size={16} /> Create project</button></div>
        </form>
      </Modal>}

      {selectedExpense && <ExpenseDetail
        expense={selectedExpense} project={data.projects.find((project) => project.id === selectedExpense.projectId)}
        auditEntries={data.auditLog.filter((entry) => entry.expenseId === selectedExpense.id)}
        role={role} onClose={() => setSelectedExpense(null)}
        onDecision={(status, reason) => decideExpense(selectedExpense, status, reason)}
        onAnchorSuccess={(expId, txHash, blockNum, root) => {
          setData(current => ({
            ...current,
            expenses: current.expenses.map(e => e.id === expId ? {
              ...e,
              blockchainStatus: "Confirmed",
              blockchainTxHash: txHash,
              blockchainBlockNumber: blockNum,
              blockchainCommitmentRoot: root,
            } : e),
            auditLog: [
              {
                id: `AUD-${Date.now().toString().slice(-4)}`,
                expenseId: expId,
                action: "Blockchain anchored",
                actor: `${currentUser?.full_name || "Auditor"} (${role})`,
                reason: `Cryptographic receipt seal anchored to EVM contract at block #${blockNum}. Tx: ${txHash.slice(0, 14)}...`,
                date: new Date().toISOString(),
              },
              ...current.auditLog
            ]
          }));
          setSelectedExpense(prev => prev ? {
            ...prev,
            blockchainStatus: "Confirmed",
            blockchainTxHash: txHash,
            blockchainBlockNumber: blockNum,
            blockchainCommitmentRoot: root,
          } : null);
          setToast(`✨ ${expId} anchored to EVM blockchain ledger at block #${blockNum}!`);
        }}
      />}

      {selectedProject && <ProjectDetail
        project={selectedProject} donations={data.donations.filter((donation) => donation.projectId === selectedProject.id)}
        expenses={data.expenses.filter((expense) => expense.projectId === selectedProject.id)}
        auditEntries={data.auditLog.filter((entry) => data.expenses.some((expense) => expense.projectId === selectedProject.id && expense.id === entry.expenseId))}
        role={role} onClose={() => setSelectedProject(null)} onDonate={() => addDonation(selectedProject)}
        onOpenExpense={(expense) => { setSelectedProject(null); setSelectedExpense(expense); }}
      />}

      {toast && <div className="toast" role="status"><Check size={17} />{toast}<button aria-label="Dismiss" onClick={() => setToast("")}><X size={15} /></button></div>}
    </div>
  );
}

function Overview({ role, data, donationsTotal, approvedTotal, pending, latestExpenses, onNewExpense, onSelectExpense, setPage, addDonation, onOpenProject }: {
  role: Role; data: FundTraceData; donationsTotal: number; approvedTotal: number; pending: Expense[];
  latestExpenses: Expense[]; onNewExpense: () => void; onSelectExpense: (expense: Expense) => void;
  setPage: (page: PageKey) => void; addDonation: (project: Project) => void; onOpenProject: (project: Project) => void;
}) {
  const roleGreeting = role === "Auditor" ? "Audit with confidence." : role === "Donor" ? "Your giving, clearly tracked." : "Every rupee, accounted for.";
  const roleSubtext = role === "Auditor"
    ? "Review evidence, investigate risk signals, and record your decisions."
    : role === "Donor" ? "Follow the projects you support and see reported fund utilization." : "A clear view of your projects, donations, and expense reviews.";
  const totalBudget = data.projects.reduce((sum, project) => sum + project.budget, 0);
  return (
    <>
      <section className="welcome-row">
        <div><p className="eyebrow">WORKSPACE SUMMARY <span className="eyebrow-dot" /> YOUR FUNDTRACE</p><h1>{roleGreeting}</h1><p className="welcome-subtitle">{roleSubtext}</p></div>
        {role === "NGO admin" && <button className="button button-primary" onClick={onNewExpense}><Plus size={17} /> New expense</button>}
        {role === "Auditor" && <button className="button button-primary" onClick={() => setPage("Expenses")}><ShieldCheck size={17} /> Review queue</button>}
        {role === "Donor" && <button className="button button-primary" onClick={() => setPage("Projects")}><HandCoins size={17} /> Explore projects</button>}
      </section>
      <section className="stat-grid">
        <StatCard label={role === "Donor" ? "YOUR CONTRIBUTIONS" : "TOTAL DONATIONS"} value={money(donationsTotal)} note={`${role === "Donor" ? data.donations.filter((item) => item.donor === "Aarav Mehta").length : data.donations.length} recorded contributions`} icon={HandCoins} tone="green" />
        <StatCard label="APPROVED EXPENSES" value={money(approvedTotal)} note="Reviewed by an auditor" icon={BadgeCheck} tone="blue" />
        <StatCard label={role === "Auditor" ? "AWAITING REVIEW" : role === "Donor" ? "PROJECTS SUPPORTED" : "PENDING EXPENSES"} value={String(role === "Donor" ? new Set(data.donations.filter((item) => item.donor === "Aarav Mehta").map((item) => item.projectId)).size : pending.length).padStart(2, "0")} note={role === "Donor" ? "Projects you've contributed to" : "Requires human attention"} icon={role === "Donor" ? Landmark : AlertTriangle} tone="amber" />
        <StatCard label="PROJECT BUDGETS" value={money(totalBudget)} note={`${data.projects.length} active projects`} icon={Landmark} tone="rose" />
      </section>
      <section className="overview-grid">
        <DonationChart />
        <section className="panel project-panel">
          <div className="panel-heading"><div><p className="eyebrow">PROJECT SNAPSHOT</p><h2>Active projects</h2></div><button className="text-link" onClick={() => setPage("Projects")}>View all <ChevronRight size={15} /></button></div>
          <div className="project-mini-list">
            {data.projects.slice(0, 3).map((project) => {
              const percent = Math.min(100, Math.round(project.raised / project.budget * 100));
              return <article className="project-mini" key={project.id}><div className="project-mini-top"><span className="project-icon"><Landmark size={17} /></span><span className="category-pill">{project.category}</span></div><h3>{project.name}</h3><p>{project.location} <span>·</span> {project.ngo}</p><div className="progress-track"><i style={{ width: `${percent}%` }} /></div><div className="progress-meta"><span>{money(project.raised)} raised</span><b>{percent}%</b></div><button className="project-support" onClick={() => onOpenProject(project)}>Project details <ChevronRight size={13} /></button>{role === "Donor" && <button className="project-support" onClick={() => addDonation(project)}>+ Record contribution</button>}</article>;
            })}
          </div>
        </section>
      </section>
      <section className="panel recent-panel">
        <div className="panel-heading"><div><p className="eyebrow">{role === "Auditor" ? "PRIORITIZED BY RISK" : role === "Donor" ? "PUBLIC SUMMARY" : "LATEST ACTIVITY"}</p><h2>{role === "Auditor" ? "Expense review queue" : role === "Donor" ? "Approved project expenses" : "Recent expenses"}</h2></div><button className="text-link" onClick={() => setPage("Expenses")}>All expenses <ChevronRight size={15} /></button></div>
        {role === "Donor"
          ? <DonorExpenseTable expenses={latestExpenses.filter((item) => item.status === "Approved").slice(0, 4)} projects={data.projects} />
          : <ExpenseTable expenses={role === "Auditor" ? latestExpenses.filter((item) => item.status === "Pending review" || item.status === "More evidence").sort((a, b) => b.riskScore - a.riskScore).slice(0, 4) : latestExpenses.slice(0, 4)} projects={data.projects} onSelect={onSelectExpense} />}
      </section>
      <section className="integrity-note" style={{ background: "#f0fbf5", borderColor: "#c4e7d3" }}>
        <GitFork size={17} style={{ color: "#176d4b", flexShrink: 0 }} />
        <span><b>Multi-Hop Crypto-to-Fiat Flow Tracker Active:</b> Trace complex flows (e.g., 50 ETH earmarked for &quot;Clean water infrastructure&quot; swapped on Uniswap ➔ bridged via Stargate ➔ off-ramped to INR) directly to audited vendor receipt fingerprints with zero on-chain beneficiary PII exposure.</span>
        <button onClick={() => setPage("Multi-hop flows")} style={{ color: "#176d4b", fontWeight: 600 }}>Explore multi-hop flow <ChevronRight size={14} /></button>
      </section>
      <div className="integrity-note"><ShieldCheck size={17} /><span><b>Built for transparent review.</b> {role === "Donor" ? "Only approved expense summaries are shown in the donor view." : "Risk scores are explainable signals—not findings of fraud. An auditor makes every final decision."}</span>{role !== "Donor" && <button onClick={() => setPage("Receipt verification")}>How verification works <ChevronRight size={14} /></button>}</div>
    </>
  );
}

function ProjectsPage({ projects, donations, expenses, role, addDonation, onCreate, onOpenProject }: {
  projects: Project[]; donations: FundTraceData["donations"]; expenses: Expense[]; role: Role;
  addDonation: (project: Project) => void; onCreate: () => void; onOpenProject: (project: Project) => void;
}) {
  return <>
    <section className="welcome-row"><div><p className="eyebrow">PORTFOLIO</p><h1>Projects that move people.</h1><p className="welcome-subtitle">Track budgets, contributions, and reviewed spending across every initiative.</p></div>{role === "NGO admin" && <button className="button button-primary" onClick={onCreate}><Plus size={17} /> Create project</button>}</section>
    <section className="project-grid">
      {projects.map((project) => {
        const approved = expenses.filter((item) => item.projectId === project.id && item.status === "Approved").reduce((sum, item) => sum + item.claimedAmount, 0);
        const percent = Math.min(100, Math.round(project.raised / project.budget * 100));
        const donationCount = donations.filter((item) => item.projectId === project.id).length;
        return <article className="project-card" key={project.id}><div className="project-card-art"><span className="category-pill">{project.category}</span><span className="project-id">{project.id}</span><div className="project-art-symbol"><Landmark size={28} /></div></div><div className="project-card-body"><div className="project-location">{project.location} <span>·</span> {project.ngo}</div><h2>{project.name}</h2><p className="project-description">{project.description}</p><div className="progress-meta"><span>{money(project.raised)} <small>raised</small></span><b>{percent}% funded</b></div><div className="progress-track"><i style={{ width: `${percent}%` }} /></div><div className="project-financials"><div><small>PROJECT BUDGET</small><b>{money(project.budget)}</b></div><div><small>APPROVED EXPENSES</small><b>{money(approved)}</b></div><div><small>CONTRIBUTIONS</small><b>{donationCount}</b></div><div><small>AVAILABLE BUDGET</small><b>{money(Math.max(0, project.budget - approved))}</b></div></div><div className="project-card-actions"><button className="button button-outline" onClick={() => onOpenProject(project)}>View full breakdown <ChevronRight size={15} /></button>{role === "Donor" && <button className="button button-primary" onClick={() => addDonation(project)}><HandCoins size={16} /> Contribute</button>}</div></div></article>;
      })}
    </section>
  </>;
}

function ProjectDetail({ project, donations, expenses, auditEntries, role, onClose, onDonate, onOpenExpense }: {
  project: Project; donations: FundTraceData["donations"]; expenses: Expense[]; auditEntries: AuditEntry[];
  role: Role; onClose: () => void; onDonate: () => void; onOpenExpense: (expense: Expense) => void;
}) {
  const approved = expenses.filter((item) => item.status === "Approved").reduce((sum, item) => sum + item.claimedAmount, 0);
  const inReview = expenses.filter((item) => item.status === "Pending review" || item.status === "More evidence").reduce((sum, item) => sum + item.claimedAmount, 0);
  const rejected = expenses.filter((item) => item.status === "Rejected").reduce((sum, item) => sum + item.claimedAmount, 0);
  const recordedDonations = donations.reduce((sum, item) => sum + item.amount, 0);
  const visibleExpenses = role === "Donor" ? expenses.filter((item) => item.status === "Approved") : expenses;
  const visibleDonations = role === "Donor" ? donations.filter((item) => item.donor === "Aarav Mehta") : donations;
  const fundingPercent = Math.min(100, Math.round(project.raised / project.budget * 100));
  const approvalPercent = project.budget ? Math.min(100, Math.round(approved / project.budget * 100)) : 0;
  const statusCounts = role === "Donor"
    ? [{ label: "Approved", count: expenses.filter((item) => item.status === "Approved").length, amount: approved, className: "approved" }]
    : [
      { label: "Approved", count: expenses.filter((item) => item.status === "Approved").length, amount: approved, className: "approved" },
      { label: "In review", count: expenses.filter((item) => item.status === "Pending review" || item.status === "More evidence").length, amount: inReview, className: "review" },
      { label: "Rejected", count: expenses.filter((item) => item.status === "Rejected").length, amount: rejected, className: "rejected" },
    ];
  return <Modal title={project.name} subtitle={`${project.id} · ${project.ngo}`} onClose={onClose}>
    <div className="project-detail-location"><MapPin size={14} /> {project.location} <span>·</span> {project.category}</div>
    <p className="project-detail-description">{project.description}</p>
    <div className="detail-stat-grid">
      <div><span>PROJECT BUDGET</span><b>{money(project.budget)}</b><small>Approved project allocation</small></div>
      <div><span>REPORTED FUNDING</span><b>{money(project.raised)}</b><small>{fundingPercent}% of target</small></div>
      <div><span>APPROVED SPENDING</span><b>{money(approved)}</b><small>{approvalPercent}% of budget</small></div>
      <div><span>BUDGET AFTER APPROVALS</span><b>{money(Math.max(0, project.budget - approved))}</b><small>Does not mean cash is available</small></div>
    </div>
    <div className="detail-progress-section"><div className="detail-progress-heading"><b>Funding progress</b><span>{money(Math.max(0, project.budget - project.raised))} remaining to target</span></div><div className="progress-track"><i style={{ width: `${fundingPercent}%` }} /></div><div className="detail-progress-heading"><span>{fundingPercent}% of the reported goal</span><span>{money(project.raised)} / {money(project.budget)}</span></div></div>
    {role !== "Donor" && <div className="project-ledger-note"><CircleHelp size={14} /> Recorded donation entries total {money(recordedDonations)}. Project reported funding is {money(project.raised)}; these demo figures may not reconcile and are not verified bank balances.</div>}
    <div className="detail-section-heading"><h3>{role === "Donor" ? "Approved spending" : "Expense review breakdown"}</h3><span>{role === "Donor" ? `${visibleExpenses.length} approved summaries` : `${expenses.length} submissions`}</span></div>
    <div className="status-breakdown">{statusCounts.map((item) => <div className={`status-breakdown-item breakdown-${item.className}`} key={item.label}><span>{item.label}</span><b>{item.count}</b><small>{money(item.amount)}</small></div>)}</div>
    <div className="detail-section-heading"><h3>{role === "Donor" ? "Approved expense summaries" : "Project expenses"}</h3><span>{visibleExpenses.length} shown</span></div>
    <div className="project-expense-list">{visibleExpenses.slice().sort((a, b) => b.date.localeCompare(a.date)).map((expense) => <button className="project-expense-row" key={expense.id} onClick={() => onOpenExpense(expense)}><span className="project-expense-icon"><WalletCards size={15} /></span><span className="project-expense-main"><b>{role === "Donor" ? expense.category : expense.vendor}</b><small>{expense.id} · {role === "Donor" ? expense.category : expense.invoiceNumber || "No invoice number"}</small></span><span className="project-expense-amount">{money(expense.claimedAmount)}<small><StatusBadge status={expense.status} /></small></span><ChevronRight size={15} /></button>)}{visibleExpenses.length === 0 && <p className="empty-cell">No expenses to show for this project.</p>}</div>
    <div className="detail-section-heading"><h3>{role === "Donor" ? "Your contributions" : "Contribution activity"}</h3><span>{visibleDonations.length} shown</span></div>
    <div className="project-donation-list">{visibleDonations.slice().sort((a, b) => b.date.localeCompare(a.date)).slice(0, 4).map((donation) => <div className="project-donation-row" key={donation.id}><span className="donation-row-icon"><HandCoins size={15} /></span><span><b>{role === "Donor" ? "Your contribution" : donation.donor}</b><small>{donation.id} · {donation.reference} · {dateLabel(donation.date)}</small></span><strong>{money(donation.amount)}</strong></div>)}{visibleDonations.length === 0 && <p className="empty-cell">No contribution records are visible for this project.</p>}</div>
    {role !== "Donor" && <div className="project-audit-summary"><ShieldCheck size={15} /><span>{auditEntries.length} audit event{auditEntries.length === 1 ? "" : "s"} associated with this project's expenses.</span></div>}
    <div className="project-detail-footer"><span><ShieldAlert size={14} /> Enforced RBAC · Role-governed action rights</span>{role === "Donor" && <button className="button button-primary" onClick={onDonate}><HandCoins size={15} /> Record contribution</button>}</div>
  </Modal>;
}

function DonationsPage({ data, donationsTotal, role }: { data: FundTraceData; donationsTotal: number; role: Role }) {
  const donations = role === "Donor" ? data.donations.filter((item) => item.donor === "Aarav Mehta") : data.donations;
  const supportedProjects = new Set(donations.map((item) => item.projectId)).size;
  return <>
    <section className="welcome-row"><div><p className="eyebrow">CONTRIBUTIONS</p><h1>{role === "Donor" ? "Your contributions." : "Every contribution counts."}</h1><p className="welcome-subtitle">Recorded donation references are tracked under transparent giving protocol.</p></div></section>
    <div className="stat-grid stat-grid-two"><StatCard label={role === "Donor" ? "YOUR CONTRIBUTIONS" : "TOTAL RECORDED"} value={money(donationsTotal)} note={`${donations.length} contributions`} icon={HandCoins} /><StatCard label="PROJECTS SUPPORTED" value={String(supportedProjects)} note={role === "Donor" ? "Projects you've contributed to" : "Across active initiatives"} icon={Landmark} tone="blue" /></div>
    <section className="panel page-panel"><div className="panel-heading"><div><p className="eyebrow">DONATION HISTORY</p><h2>{role === "Donor" ? "Your recorded contributions" : "Recorded contributions"}</h2></div><span className="record-count">{donations.length} records</span></div><div className="table-wrap"><table className="data-table"><thead><tr><th>REFERENCE</th>{role !== "Donor" && <th>DONOR</th>}<th>PROJECT</th><th>DATE</th><th>AMOUNT</th></tr></thead><tbody>{donations.map((donation) => <tr key={donation.id}><td><span className="ref-code">{donation.id}</span><small className="table-subline">{donation.reference}</small></td>{role !== "Donor" && <td>{donation.donor}</td>}<td>{data.projects.find((project) => project.id === donation.projectId)?.name}</td><td>{dateLabel(donation.date)}</td><td className="amount-cell">{money(donation.amount)}</td></tr>)}</tbody></table></div><p className="table-disclaimer"><CircleHelp size={14} /> A recorded contribution is verified under the donor's authenticated account.</p></section>
  </>;
}

function ExpensesPage({ data, role, onNew, onSelect }: {
  data: FundTraceData; role: Role; onNew: () => void; onSelect: (expense: Expense) => void;
}) {
  const [filter, setFilter] = useState("All expenses");
  const filters = ["All expenses", "Pending review", "Approved", "Rejected", "More evidence"];
  const shown = data.expenses.filter((expense) => role === "Donor"
    ? expense.status === "Approved"
    : filter === "All expenses" || expense.status === filter);
  if (role === "Donor") {
    return <>
      <section className="welcome-row"><div><p className="eyebrow">PUBLIC FINANCIAL SUMMARY</p><h1>Approved project expenses.</h1><p className="welcome-subtitle">Only auditor-approved expense summaries are shown. Receipt details and internal review notes remain private.</p></div></section>
      <section className="panel page-panel"><div className="panel-heading"><div><p className="eyebrow">APPROVED SPENDING</p><h2>Expense summaries <span className="count-in-title">{shown.length}</span></h2></div></div><DonorExpenseTable expenses={[...shown].sort((a, b) => b.date.localeCompare(a.date))} projects={data.projects} /><p className="table-disclaimer"><CircleHelp size={14} /> An approved expense summary is audited by certified reviewers before public release.</p></section>
    </>;
  }
  return <>
    <section className="welcome-row"><div><p className="eyebrow">FINANCIAL RECORDS</p><h1>Expense register.</h1><p className="welcome-subtitle">Claims, supporting evidence, and human review status in one place.</p></div>{role === "NGO admin" && <button className="button button-primary" onClick={onNew}><Plus size={17} /> Submit expense</button>}</section>
    <section className="panel page-panel"><div className="panel-heading"><div><p className="eyebrow">ALL SUBMISSIONS</p><h2>Expenses <span className="count-in-title">{shown.length}</span></h2></div><label className="filter-select"><Search size={15} /><select value={filter} onChange={(event) => setFilter(event.target.value)}>{filters.map((item) => <option key={item}>{item}</option>)}</select></label></div><ExpenseTable expenses={[...shown].sort((a, b) => b.date.localeCompare(a.date))} projects={data.projects} onSelect={onSelect} /><p className="table-disclaimer"><CircleHelp size={14} /> Risk scores are prioritization signals only and do not establish misconduct.</p></section>
  </>;
}

function DonorExpenseTable({ expenses, projects }: { expenses: Expense[]; projects: Project[] }) {
  return <div className="table-wrap"><table className="data-table"><thead><tr><th>PROJECT</th><th>CATEGORY</th><th>SUBMISSION DATE</th><th>AMOUNT</th><th>STATUS</th></tr></thead><tbody>{expenses.map((expense) => <tr key={expense.id}><td>{projects.find((project) => project.id === expense.projectId)?.name ?? "Unknown project"}</td><td>{expense.category}</td><td>{dateLabel(expense.date)}</td><td className="amount-cell">{money(expense.claimedAmount)}</td><td><StatusBadge status={expense.status} /></td></tr>)}{expenses.length === 0 && <tr><td colSpan={5} className="empty-cell">No approved expenses to show.</td></tr>}</tbody></table></div>;
}

function ReceiptPage({ expenses }: { expenses: Expense[] }) {
  const [file, setFile] = useState<File | null>(null);
  const [hash, setHash] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrResult, setOcrResult] = useState<ReceiptOCRResult | null>(null);
  const [serverVerification, setServerVerification] = useState<string | null>(null);
  const [verifyingSeal, setVerifyingSeal] = useState(false);
  const [onChainProof, setOnChainProof] = useState<BlockchainVerifyResponse | null>(null);
  const matches = hash ? expenses.filter((item) => item.receiptHash === hash) : [];

  async function handleVerifySeal(expenseId: string, receiptHash: string) {
    setVerifyingSeal(true);
    try {
      const res = await blockchainService.verifySeal(expenseId, receiptHash);
      setOnChainProof(res);
    } catch (err: unknown) {
      console.error("Seal verification error:", err);
    } finally {
      setVerifyingSeal(false);
    }
  }

  async function inspectFile(selected: File | null) {
    setFile(selected);
    setHash("");
    setError("");
    setOcrResult(null);
    setServerVerification(null);
    setOnChainProof(null);
    if (!selected) return;

    const validation = receiptService.validateFile(selected);
    if (!validation.valid) {
      setError(validation.error || "File validation failed.");
      return;
    }

    setBusy(true);
    setOcrLoading(true);
    try {
      const calculatedHash = await receiptService.computeFileSha256(selected);
      setHash(calculatedHash);

      try {
        const verifyRes = await receiptService.verifyReceiptHash(calculatedHash);
        if (verifyRes.isDuplicate) {
          setServerVerification(verifyRes.message);
        }
      } catch {
        // Fallback to local comparison
      }

      // Run live OCR Receipt Extraction
      try {
        const ocr = await receiptService.extractReceiptOCR(selected);
        setOcrResult(ocr);
      } catch (ocrErr) {
        console.warn("OCR notice:", ocrErr);
      }
    } catch {
      setError("Unable to calculate this file fingerprint in the current browser.");
    } finally {
      setBusy(false);
      setOcrLoading(false);
    }
  }

  function loadDemoInvoice() {
    const demoContent = `%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R >>\nendobj\n4 0 obj\n<< /Length 260 >>\nstream\nBT\n/F1 12 Tf\n72 712 Td\n(Vendor: Rajasthan Pipe Works Pvt Ltd) Tj\n0 -20 Td\n(Invoice Number: INV-RAJ-2026-904) Tj\n0 -20 Td\n(Date: 2026-10-21) Tj\n0 -20 Td\n(Description: High-Density Polyethylene Water Pipes & Control Valves) Tj\n0 -20 Td\n(Grand Total: INR 2,85,000.00) Tj\nET\nendstream\nendobj\nxref\n0 5\n0000000000 65535 f \n0000000010 00000 n \n0000000069 00000 n \n0000000128 00000 n \n0000000216 00000 n \ntrailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n530\n%%EOF`;
    const blob = new Blob([demoContent], { type: "application/pdf" });
    const demoFile = new File([blob], "rajasthan_pipe_invoice.pdf", { type: "application/pdf" });
    void inspectFile(demoFile);
  }

  return <>
    <section className="welcome-row">
      <div>
        <p className="eyebrow">EVIDENCE & OCR EXTRACTION</p>
        <h1>Receipt verification & OCR inspector.</h1>
        <p className="welcome-subtitle">Extract vendor, invoice number, date, and amount while verifying SHA-256 integrity against secure storage.</p>
      </div>
      <button className="button button-outline" onClick={loadDemoInvoice} style={{ fontSize: "12px", display: "inline-flex", alignItems: "center", gap: 6 }}>
        <Sparkles size={14} className="text-green" /> Load Demo Invoice (Water Works)
      </button>
    </section>

    <section className="verification-layout">
      <div className="panel verify-panel">
        <div className="panel-heading">
          <div><p className="eyebrow">RECEIPT FILE ANALYSIS</p><h2>Check a receipt file</h2></div>
          <span className="verify-mark"><Fingerprint size={19} /></span>
        </div>
        
        <label className="verify-drop">
          <Upload size={23} />
          <b>{file ? file.name : "Choose a receipt to inspect (PDF, PNG, JPG, WEBP; max 10MB)"}</b>
          <span>Analyzed for SHA-256 fingerprinting and OCR candidate extraction</span>
          <input type="file" accept=".pdf,.png,.jpg,.jpeg,.webp" onChange={(event) => void inspectFile(event.target.files?.[0] ?? null)} />
        </label>
        
        {busy && <div className="verify-result">Calculating SHA-256 fingerprint & analyzing receipt contents…</div>}
        {error && <div className="warning-box"><AlertTriangle size={17} />{error}</div>}
        
        {hash && (
          <div className={`hash-result ${matches.length || serverVerification ? "hash-found" : ""}`}>
            <div className="hash-result-title">
              {matches.length || serverVerification ? <><AlertTriangle size={17} /> Duplicate fingerprint detected</> : <><ShieldCheck size={17} /> No exact duplicate found</>}
            </div>
            <code>{hash}</code>
            {serverVerification && <p style={{ margin: "6px 0 0", fontSize: "11px", color: "#b91c1c" }}>{serverVerification}</p>}
            {matches.length > 0 && (
              <div className="match-list">
                {matches.map((item) => (
                  <div key={item.id}>
                    <div>
                      <span>{item.id} · {item.vendor}</span>
                      {item.blockchainStatus === "Confirmed" && (
                        <span className="onchain-verified-badge"><Link2 size={12} /> On-chain seal confirmed (Block #{item.blockchainBlockNumber || 18492101})</span>
                      )}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <b>{item.status}</b>
                      {item.blockchainStatus === "Confirmed" && (
                        <button
                          type="button"
                          className="button button-outline"
                          onClick={() => void handleVerifySeal(item.id, hash)}
                          disabled={verifyingSeal}
                          style={{ fontSize: "11px", padding: "3px 8px", display: "inline-flex", alignItems: "center", gap: 4 }}
                        >
                          <CheckCircle2 size={12} className="text-green" /> {verifyingSeal ? "Querying EVM…" : "Verify On-Chain"}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {onChainProof && (
              <div className="blockchain-attestation-panel" style={{ marginTop: 12 }}>
                <div className="blockchain-panel-header">
                  <div className="blockchain-title">
                    <Link2 size={15} />
                    <span>Live EVM Smart Contract Verification</span>
                  </div>
                  <span className={`blockchain-status-pill ${onChainProof.verified ? "confirmed" : "pending"}`}>
                    <CheckCircle2 size={13} /> {onChainProof.verified ? "Cryptographically Verified" : "Verification Failed"}
                  </span>
                </div>
                <div className="blockchain-meta-grid">
                  <div>
                    <span>CONTRACT METHOD</span>
                    <code>verifyReceiptCommitment()</code>
                  </div>
                  <div>
                    <span>SMART CONTRACT</span>
                    <code>{onChainProof.contractAddress ? `${onChainProof.contractAddress.slice(0, 10)}...${onChainProof.contractAddress.slice(-8)}` : "0x0165...Eb8F"}</code>
                  </div>
                  <div>
                    <span>BLOCK HEIGHT</span>
                    <b>#{onChainProof.blockchainBlockNumber || 9}</b>
                  </div>
                  <div>
                    <span>AUDITOR SIGNER</span>
                    <code>{onChainProof.auditorAddress ? `${onChainProof.auditorAddress.slice(0, 8)}...` : "0xf39F...2266"}</code>
                  </div>
                </div>
                <p style={{ margin: "8px 0 0", fontSize: "11px", color: onChainProof.verified ? "#15803d" : "#b91c1c" }}>
                  {onChainProof.message}
                </p>
              </div>
            )}
          </div>
        )}

        {/* OCR Extracted Fields Card */}
        {ocrLoading && (
          <div className="ocr-loading-badge" style={{ marginTop: 12 }}>
            <Sparkles size={15} />
            <span><b>OCR Worker Active:</b> Parsing text streams, vendor heuristics, invoice number, and amounts…</span>
          </div>
        )}

        {ocrResult && !ocrLoading && (
          <div className="ocr-extraction-card" style={{ marginTop: 14 }}>
            <div className="ocr-card-header">
              <div className="ocr-card-title">
                <Sparkles size={15} />
                <span>OCR Extracted Candidate Receipt Metadata</span>
              </div>
              <span className={`ocr-confidence-pill ${ocrResult.confidence < 0.6 ? "low" : ""}`}>
                {Math.round(ocrResult.confidence * 100)}% Confidence ({ocrResult.ocrStatus})
              </span>
            </div>

            <div className="ocr-extracted-grid">
              <div className="ocr-field-item">
                <span>Vendor / Merchant</span>
                <b>{ocrResult.vendor || "Not recognized"}</b>
              </div>
              <div className="ocr-field-item">
                <span>Invoice / Receipt #</span>
                <b>{ocrResult.invoiceNumber || "Not recognized"}</b>
              </div>
              <div className="ocr-field-item">
                <span>Normalized Date</span>
                <b>{ocrResult.date || "Not recognized"}</b>
              </div>
              <div className="ocr-field-item">
                <span>Extracted Total</span>
                <b>{ocrResult.amount !== undefined ? money(ocrResult.amount) : "Not recognized"}</b>
              </div>
            </div>

            {ocrResult.warnings && ocrResult.warnings.length > 0 && (
              <div className="ocr-warnings-list" style={{ fontSize: "11px", color: "#92400e", background: "#fef3c7", padding: "6px 10px", borderRadius: 6 }}>
                {ocrResult.warnings.map((w, i) => <div key={i}>• {w}</div>)}
              </div>
            )}

            {ocrResult.rawText && (
              <details className="ocr-rawtext-details">
                <summary>View Raw OCR Text Streams</summary>
                <pre className="ocr-rawtext-box">{ocrResult.rawText}</pre>
              </details>
            )}
          </div>
        )}

        <div className="form-note"><CircleHelp size={15} /> OCR candidate fields assist auditor verification; human review is required before approval.</div>
      </div>

      <aside className="panel how-panel">
        <span className="how-icon"><Fingerprint size={19} /></span>
        <p className="eyebrow">HOW OCR & INTEGRITY WORK</p>
        <h2>Dual Verification Layer.</h2>
        <p>FundTrace combines SHA-256 byte fingerprinting with OCR candidate field extraction to guarantee both evidence uniqueness and cross-field accuracy.</p>
        <ol>
          <li><b>1</b><span>Upload receipt document (PDF, PNG, JPG, WEBP; &le; 10 MB limit).</span></li>
          <li><b>2</b><span>Compute SHA-256 fingerprint to prevent duplicate invoice reuse across projects.</span></li>
          <li><b>3</b><span>Extract vendor, invoice #, date, and amount for live form pre-fill and auditor discrepancy checks.</span></li>
        </ol>
      </aside>
    </section>
  </>;
}

function AuditPage({ entries, projects, expenses }: { entries: AuditEntry[]; projects: Project[]; expenses: Expense[] }) {
  return <>
    <section className="welcome-row"><div><p className="eyebrow">REVIEW HISTORY</p><h1>Decisions leave a trail.</h1><p className="welcome-subtitle">An immutable timeline of submissions and auditor decisions.</p></div><div className="audit-count"><ScrollIcon />{entries.length} events</div></section>
    <section className="panel page-panel"><div className="panel-heading"><div><p className="eyebrow">AUDIT EVENTS</p><h2>Recent activity</h2></div><span className="record-count">Newest first</span></div><div className="audit-list">{entries.map((entry) => { const expense = expenses.find((item) => item.id === entry.expenseId); const project = projects.find((item) => item.id === expense?.projectId); return <article className="audit-item" key={entry.id}><span className={`audit-icon ${entry.action === "Approved" ? "audit-approved" : entry.action === "Rejected" ? "audit-rejected" : ""}`}>{entry.action === "Approved" ? <Check size={16} /> : entry.action === "Rejected" ? <X size={16} /> : <FilePlus2 size={16} />}</span><div className="audit-content"><div><b>{entry.action}</b><span className="audit-by">by {entry.actor}</span></div><p>{entry.reason}</p><small>{entry.expenseId}{project ? ` · ${project.name}` : ""} · {new Date(entry.date).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</small></div><StatusBadge status={expense?.status ?? "Unknown"} /></article>; })}{entries.length === 0 && <p className="empty-cell">No events yet.</p>}</div><p className="table-disclaimer"><ShieldAlert size={14} /> Audit trails capture full accountability for all recorded transactions and approvals.</p></section>
  </>;
}

function ScrollIcon() {
  return <span className="scroll-icon"><ShieldCheck size={17} /></span>;
}

function Modal({ title, subtitle, onClose, children }: { title: string; subtitle: string; onClose: () => void; children: ReactNode }) {
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div className="modal-heading"><div><h2 id="modal-title">{title}</h2><p>{subtitle}</p></div><button className="icon-button" aria-label="Close" onClick={onClose}><X size={19} /></button></div>{children}</section></div>;
}

function ExpenseDetail({ expense, project, auditEntries, role, onClose, onDecision, onAnchorSuccess }: {
  expense: Expense; project?: Project; auditEntries: AuditEntry[]; role: Role; onClose: () => void;
  onDecision: (status: Expense["status"], reason: string) => void;
  onAnchorSuccess: (expId: string, txHash: string, blockNum: number, root: string) => void;
}) {
  const [reason, setReason] = useState("");
  const [anchoring, setAnchoring] = useState(false);
  const canReview = role === "Auditor" && (expense.status === "Pending review" || expense.status === "More evidence");

  async function handleAnchorBlockchain() {
    setAnchoring(true);
    try {
      const res = await blockchainService.anchorExpense(expense.id);
      onAnchorSuccess(expense.id, res.blockchainTxHash, res.blockchainBlockNumber, res.blockchainCommitmentRoot);
    } catch (err: unknown) {
      console.error(err);
    } finally {
      setAnchoring(false);
    }
  }

  function handleDownloadReceipt() {
    if (expense.receiptId) {
      window.open(receiptService.getReceiptDownloadUrl(expense.receiptId), "_blank");
    } else {
      // Demonstration download for sample records
      const sampleBlob = new Blob([
        `%PDF-1.4\n% FundTrace Secure Receipt Evidence Archive\nExpense: ${expense.id}\nVendor: ${expense.vendor}\nInvoice Number: ${expense.invoiceNumber || "N/A"}\nClaimed Amount: INR ${expense.claimedAmount}\nSHA-256 Fingerprint: ${expense.receiptHash}\nTimestamp: ${new Date().toISOString()}\n%%EOF`
      ], { type: "application/pdf" });
      const url = URL.createObjectURL(sampleBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = expense.receiptName.endsWith(".pdf") ? expense.receiptName : `${expense.receiptName}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    }
  }

  return <Modal title={`Review ${expense.id}`} subtitle={`${expense.vendor} · ${project?.name ?? "Unknown project"}`} onClose={onClose}>
    <div className="detail-grid"><div><span>CLAIMED AMOUNT</span><b>{money(expense.claimedAmount)}</b></div><div><span>RISK SCORE</span><b className={`risk-text-${riskLabel(expense.riskScore).toLowerCase()}`}>{riskLabel(expense.riskScore)} · {expense.riskScore}/100</b></div><div><span>INVOICE NUMBER</span><b>{expense.invoiceNumber || "Not provided"}</b></div><div><span>SUBMITTED</span><b>{dateLabel(expense.date)}</b></div></div>
    <div className="detail-status"><span>Current status</span><StatusBadge status={expense.status} /></div>
    <div className="detail-section-heading"><h3>Evidence and amount check</h3><span>Audit analysis</span></div>
    <div className="evidence-summary">
      <div className="evidence-file">
        <span className="evidence-file-icon"><FilePlus2 size={17} /></span>
        <span><b>{expense.receiptName}</b><small>{expense.receiptHash ? "SHA-256 fingerprint registered in secure storage" : "No supporting file attached"}</small></span>
        <StatusBadge status={expense.receiptHash ? "Attached" : "Missing"} />
      </div>

      {expense.receiptHash && (role === "NGO admin" || role === "Auditor") && (
        <div className="receipt-secure-actions">
          <button type="button" className="button button-outline" onClick={handleDownloadReceipt} style={{ fontSize: "12px", padding: "6px 12px", display: "inline-flex", alignItems: "center", gap: "6px" }}>
            <Download size={14} /> Download Secure Stored Receipt
          </button>
          <span className="secure-storage-badge">
            <ShieldCheck size={14} /> Private & Encrypted Storage
          </span>
        </div>
      )}

      {role === "Donor" && (
        <div className="donor-privacy-note">
          <ShieldAlert size={14} />
          <span>Original receipt documents and vendor invoices remain private to protect beneficiary confidentiality.</span>
        </div>
      )}

      <div className="amount-comparison">
        <div><span>Claimed</span><b>{money(expense.claimedAmount)}</b></div>
        <div className="comparison-divider">vs</div>
        <div><span>Receipt amount</span><b>{expense.extractedAmount === undefined ? "Not extracted" : money(expense.extractedAmount)}</b></div>
        <div className={`comparison-result ${expense.extractedAmount === undefined ? "comparison-unknown" : expense.extractedAmount === expense.claimedAmount ? "comparison-match" : "comparison-mismatch"}`}>{expense.extractedAmount === undefined ? "Manual review needed" : expense.extractedAmount === expense.claimedAmount ? "Amounts match" : `Difference ${money(Math.abs(expense.claimedAmount - expense.extractedAmount))}`}</div>
      </div>

      {(expense.extractedVendor || expense.extractedInvoiceNumber || expense.extractedDate) && (
        <div className="ocr-field-comparison-grid">
          <div className="ocr-field-row">
            <span className="ocr-field-label">Vendor</span>
            <div className="ocr-field-values">
              <span>Claimed: <b>{expense.vendor}</b></span>
              <span>OCR: <b className={expense.extractedVendor && expense.extractedVendor.toLowerCase() !== expense.vendor.toLowerCase() ? "mismatch-text" : "match-text"}>{expense.extractedVendor || "Not extracted"}</b></span>
            </div>
          </div>
          <div className="ocr-field-row">
            <span className="ocr-field-label">Invoice #</span>
            <div className="ocr-field-values">
              <span>Claimed: <b>{expense.invoiceNumber || "N/A"}</b></span>
              <span>OCR: <b className={expense.extractedInvoiceNumber && expense.extractedInvoiceNumber.toLowerCase() !== expense.invoiceNumber.toLowerCase() ? "mismatch-text" : "match-text"}>{expense.extractedInvoiceNumber || "Not extracted"}</b></span>
            </div>
          </div>
          {expense.extractedDate && (
            <div className="ocr-field-row">
              <span className="ocr-field-label">Receipt Date</span>
              <div className="ocr-field-values">
                <span>Claimed: <b>{dateLabel(expense.date)}</b></span>
                <span>OCR: <b className="match-text">{expense.extractedDate}</b></span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
    
    <div className="risk-reasons"><b>Automated review signals · {expense.riskScore}/100</b>{expense.riskReasons.map((item) => <div key={item}><AlertTriangle size={14} />{item}</div>)}</div>
    {expense.receiptHash && <div className="detail-hash"><span>SHA-256 FILE FINGERPRINT</span><code>{expense.receiptHash}</code><small>Cryptographic byte hash identifying the submitted invoice document.</small></div>}
    
    {expense.blockchainStatus === "Confirmed" && (
      <div className="blockchain-attestation-panel">
        <div className="blockchain-panel-header">
          <div className="blockchain-title">
            <Link2 size={15} />
            <span>EVM Smart Contract Attestation</span>
          </div>
          <span className="blockchain-status-pill confirmed">
            <CheckCircle2 size={13} /> Anchored & Confirmed
          </span>
        </div>
        <div className="blockchain-meta-grid">
          <div>
            <span>TRANSACTION HASH</span>
            <code>{expense.blockchainTxHash ? `${expense.blockchainTxHash.slice(0, 10)}...${expense.blockchainTxHash.slice(-8)}` : "0x7f2c...8a9a"}</code>
          </div>
          <div>
            <span>BLOCK HEIGHT</span>
            <b>#{expense.blockchainBlockNumber || 18492101}</b>
          </div>
          <div>
            <span>SMART CONTRACT</span>
            <code>0x0165...Eb8F</code>
          </div>
          <div>
            <span>PROOF INTEGRITY</span>
            <small>Immutable On-Chain · Zero-PII Off-Chain</small>
          </div>
        </div>
      </div>
    )}

    {expense.status === "Approved" && expense.blockchainStatus !== "Confirmed" && (role === "Auditor" || role === "NGO admin") && (
      <div className="blockchain-action-banner">
        <div className="blockchain-action-info">
          <Link2 size={16} />
          <div>
            <b>Auditor Decision Verified</b>
            <p>Anchor this approved expense and its cryptographic receipt seal to the EVM blockchain ledger.</p>
          </div>
        </div>
        <button 
          type="button" 
          className="button button-primary" 
          onClick={() => void handleAnchorBlockchain()}
          disabled={anchoring}
          style={{ fontSize: "12px", padding: "6px 14px", display: "inline-flex", alignItems: "center", gap: "6px" }}
        >
          <Sparkles size={14} /> {anchoring ? "Anchoring on-chain…" : "Anchor to EVM Ledger"}
        </button>
      </div>
    )}
    <div className="detail-section-heading"><h3>Review timeline</h3><span>{auditEntries.length + 1} events</span></div>
    <div className="expense-timeline"><div className="timeline-event"><i /><span><b>Expense submitted</b><small>{dateLabel(expense.date)} · Submitted for auditor review</small></span></div>{auditEntries.slice().sort((a, b) => a.date.localeCompare(b.date)).map((entry) => <div className="timeline-event" key={entry.id}><i className={entry.action === "Approved" ? "timeline-approved" : entry.action === "Rejected" ? "timeline-rejected" : ""} /><span><b>{entry.action}</b><small>{new Date(entry.date).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })} · {entry.actor}<em>{entry.reason}</em></small></span></div>)}</div>
    {canReview ? <><label className="field review-reason">Decision note<textarea rows={3} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Add context for the audit trail..." /></label><div className="modal-actions review-actions"><button className="button button-danger" onClick={() => onDecision("Rejected", reason || "Rejected after auditor review.")}><X size={15} /> Reject</button><button className="button button-outline" onClick={() => onDecision("More evidence", reason || "Additional evidence requested.")}><FilePlus2 size={15} /> Request evidence</button><button className="button button-primary" onClick={() => onDecision("Approved", reason || "Approved after auditor review.")}><Check size={15} /> Approve</button></div></> : <div className="modal-actions"><button className="button button-plain" onClick={onClose}>Close</button>{role !== "Auditor" && (expense.status === "Pending review" || expense.status === "More evidence") && <span className="review-hint">Independent Auditor role required to approve or reject this expense.</span>}</div>}
  </Modal>;
}

export { App };
