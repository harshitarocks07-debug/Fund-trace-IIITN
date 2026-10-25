import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { AlertTriangle, BadgeCheck, Check, ChevronRight, CircleHelp, FilePlus2, Fingerprint, HandCoins, Landmark, MapPin, Plus, Search, ShieldAlert, ShieldCheck, Sparkles, Upload, WalletCards, X } from "lucide-react";
import { DonationChart } from "./components/DonationChart";
import { ExpenseTable } from "./components/ExpenseTable";
import { Navbar } from "./components/Navbar";
import { Sidebar, type PageKey } from "./components/Sidebar";
import { StatCard } from "./components/StatCard";
import { StatusBadge } from "./components/StatusBadge";
import { formatINR, initialData } from "./utils/demoData";
import type { AuditEntry, Expense, FundTraceData, Project, Role } from "./types";

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

async function getFileHash(file: File): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export default function App() {
  const [data, setData] = useState<FundTraceData>(loadData);
  const [role, setRole] = useState<Role>(() => (localStorage.getItem(ROLE_KEY) as Role | null) ?? "NGO admin");
  const [page, setPage] = useState<PageKey>("Overview");
  const [expenseModal, setExpenseModal] = useState(false);
  const [projectModal, setProjectModal] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [toast, setToast] = useState("");

  useEffect(() => { localStorage.setItem(DATA_KEY, JSON.stringify(data)); }, [data]);
  useEffect(() => { localStorage.setItem(ROLE_KEY, role); }, [role]);
  useEffect(() => {
    if (role === "Donor" && (page === "Receipt verification" || page === "Audit log")) setPage("Overview");
  }, [role, page]);
  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(""), 3200);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const approvedTotal = data.expenses.filter((item) => item.status === "Approved").reduce((sum, item) => sum + item.claimedAmount, 0);
  const visibleDonations = role === "Donor" ? data.donations.filter((item) => item.donor === "Aarav Mehta") : data.donations;
  const donationsTotal = visibleDonations.reduce((sum, item) => sum + item.amount, 0);
  const pending = data.expenses.filter((item) => item.status === "Pending review" || item.status === "More evidence");
  const latestExpenses = [...data.expenses].sort((a, b) => b.date.localeCompare(a.date));

  function recordAudit(expense: Expense, action: string, reason: string) {
    const entry: AuditEntry = {
      id: newId("AUD", data.auditLog),
      expenseId: expense.id,
      action,
      actor: role === "Auditor" ? "Priya Nair" : "Helping Hands admin",
      reason,
      date: new Date().toISOString(),
    };
    setData((current) => ({ ...current, auditLog: [entry, ...current.auditLog] }));
  }

  function decideExpense(expense: Expense, status: Expense["status"], reason: string) {
    if (role !== "Auditor") {
      setToast("Switch to the Auditor demo role to record a review decision.");
      return;
    }
    const action = status === "Approved" ? "Approved" : status === "Rejected" ? "Rejected" : "More evidence requested";
    setData((current) => ({
      ...current,
      expenses: current.expenses.map((item) => item.id === expense.id ? { ...item, status } : item),
    }));
    recordAudit(expense, action, reason);
    setSelectedExpense(null);
    setToast(`${expense.id} marked ${status.toLowerCase()}. This is a demo audit record; nothing was submitted on-chain.`);
  }

  async function addExpense(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const projectId = String(form.get("projectId"));
    const project = data.projects.find((item) => item.id === projectId);
    if (!project) return;
    const claimedAmount = Number(form.get("amount"));
    const extractedValue = String(form.get("receiptAmount") ?? "");
    const extractedAmount = extractedValue ? Number(extractedValue) : undefined;
    const receiptValue = form.get("receipt");
    const file = receiptValue instanceof File ? receiptValue : undefined;
    let receiptHash = "";
    if (file?.size) {
      try {
        receiptHash = await getFileHash(file);
      } catch {
        setToast("Could not fingerprint the selected file. Please try another file.");
        return;
      }
    }
    const reasons: string[] = [];
    let score = 0;
    if (receiptHash && data.expenses.some((item) => item.receiptHash === receiptHash)) {
      reasons.push("Exact receipt file has already been submitted");
      score += 45;
    }
    if (extractedAmount !== undefined && extractedAmount !== claimedAmount) {
      reasons.push(`Claimed amount differs from entered receipt amount by ${money(Math.abs(claimedAmount - extractedAmount))}`);
      score += 30;
    }
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
    if (reasons.length === 0) reasons.push("No automatic warning triggered; human review is still required");
    score = Math.min(100, score);

    const expense: Expense = {
      id: newId("EXP", data.expenses),
      projectId,
      vendor: String(form.get("vendor")).trim(),
      category: String(form.get("category")),
      invoiceNumber: String(form.get("invoiceNumber")).trim(),
      claimedAmount,
      extractedAmount,
      receiptName: file?.size ? file.name : "No receipt attached",
      receiptHash,
      status: "Pending review",
      riskScore: score,
      riskReasons: reasons,
      date: new Date().toISOString().slice(0, 10),
      blockchainStatus: "Not submitted",
    };
    setData((current) => ({ ...current, expenses: [expense, ...current.expenses] }));
    recordAudit(expense, "Expense submitted", "Submitted for auditor review.");
    setExpenseModal(false);
    setToast(`${expense.id} submitted for review. Risk score: ${score}/100 (${riskLabel(score)}).`);
  }

  function addProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const project: Project = {
      id: newId("PRJ", data.projects),
      name: String(form.get("name")).trim(),
      ngo: "Helping Hands Foundation",
      description: String(form.get("description")).trim(),
      budget: Number(form.get("budget")),
      raised: 0,
      location: String(form.get("location")).trim(),
      category: String(form.get("category")),
    };
    setData((current) => ({ ...current, projects: [project, ...current.projects] }));
    setProjectModal(false);
    setToast(`${project.name} added to the demo workspace.`);
  }

  function addDonation(project: Project) {
    const donation = {
      id: newId("DON", data.donations),
      projectId: project.id,
      donor: "Aarav Mehta",
      amount: 10_000,
      date: new Date().toISOString().slice(0, 10),
      reference: `DEMO-${Date.now().toString().slice(-6)}`,
    };
    setData((current) => ({
      ...current,
      donations: [donation, ...current.donations],
      projects: current.projects.map((item) => item.id === project.id ? { ...item, raised: item.raised + donation.amount } : item),
    }));
    setToast(`${money(donation.amount)} demo contribution recorded. This does not move real money.`);
  }

  return (
    <div className="app-shell">
      <Sidebar page={page} setPage={setPage} role={role} setRole={setRole} />
      <div className="main-column">
        <Navbar role={role} page={page} />
        <main className="main-content">
          <div className="demo-banner"><Sparkles size={15} /><span><b>Interactive demo</b> · Sample data is stored in this browser. Payments, OCR, authentication and blockchain are not connected.</span><button onClick={() => { localStorage.removeItem(DATA_KEY); window.location.reload(); }}>Reset demo</button></div>
          {page === "Overview" && <Overview
            role={role} data={data} donationsTotal={donationsTotal} approvedTotal={approvedTotal}
            pending={pending} latestExpenses={latestExpenses} onNewExpense={() => setExpenseModal(true)}
            onSelectExpense={setSelectedExpense} setPage={setPage} addDonation={addDonation} onOpenProject={setSelectedProject}
          />}
          {page === "Projects" && <ProjectsPage projects={data.projects} donations={data.donations} expenses={data.expenses} role={role} addDonation={addDonation} onCreate={() => setProjectModal(true)} onOpenProject={setSelectedProject} />}
          {page === "Donations" && <DonationsPage data={data} donationsTotal={donationsTotal} role={role} />}
          {page === "Expenses" && <ExpensesPage data={data} role={role} onNew={() => setExpenseModal(true)} onSelect={setSelectedExpense} />}
          {page === "Receipt verification" && role !== "Donor" && <ReceiptPage expenses={data.expenses} />}
          {page === "Audit log" && role !== "Donor" && <AuditPage entries={data.auditLog} projects={data.projects} expenses={data.expenses} />}
          <footer className="app-footer"><span>FundTrace · transparent giving, accountable spending</span><span>Prototype only · not financial or fraud certification</span></footer>
        </main>
      </div>
      {expenseModal && <Modal title="Submit an expense" subtitle="Add a claim and its supporting evidence." onClose={() => setExpenseModal(false)}>
        <form className="form-grid" onSubmit={(event) => void addExpense(event)}>
          <label className="field field-full">Project<select required name="projectId">{data.projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label>
          <label className="field">Vendor name<input required name="vendor" placeholder="e.g. ABC Building Supplies" /></label>
          <label className="field">Category<select name="category"><option>Construction</option><option>Materials</option><option>Transportation</option><option>Medical supplies</option><option>Other</option></select></label>
          <label className="field">Invoice number<input name="invoiceNumber" placeholder="INV-2026-001" /></label>
          <label className="field">Claimed amount (₹)<input required name="amount" type="number" min="1" step="1" placeholder="200000" /></label>
          <label className="field">Receipt amount (₹)<input name="receiptAmount" type="number" min="0" step="1" placeholder="Enter manually for comparison" /><small>Demo only: no OCR is connected.</small></label>
          <label className="file-drop field-full"><Upload size={18} /><span>Attach receipt or invoice</span><small>File stays in this browser session; only its SHA-256 fingerprint is saved.</small><input name="receipt" type="file" accept=".pdf,image/*" /></label>
          <div className="form-note field-full"><CircleHelp size={15} /> Risk indicators prioritize review; they do not establish fraud.</div>
          <div className="modal-actions field-full"><button type="button" className="button button-plain" onClick={() => setExpenseModal(false)}>Cancel</button><button className="button button-primary"><FilePlus2 size={16} /> Submit for review</button></div>
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
        <div><p className="eyebrow">SUNDAY, 25 OCTOBER 2026 <span className="eyebrow-dot" /> YOUR FUNDTRACE</p><h1>{roleGreeting}</h1><p className="welcome-subtitle">{roleSubtext}</p></div>
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
              return <article className="project-mini" key={project.id}><div className="project-mini-top"><span className="project-icon"><Landmark size={17} /></span><span className="category-pill">{project.category}</span></div><h3>{project.name}</h3><p>{project.location} <span>·</span> {project.ngo}</p><div className="progress-track"><i style={{ width: `${percent}%` }} /></div><div className="progress-meta"><span>{money(project.raised)} raised</span><b>{percent}%</b></div><button className="project-support" onClick={() => onOpenProject(project)}>Project details <ChevronRight size={13} /></button>{role === "Donor" && <button className="project-support" onClick={() => addDonation(project)}>+ Record demo contribution</button>}</article>;
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
        return <article className="project-card" key={project.id}><div className="project-card-art"><span className="category-pill">{project.category}</span><span className="project-id">{project.id}</span><div className="project-art-symbol"><Landmark size={28} /></div></div><div className="project-card-body"><div className="project-location">{project.location} <span>·</span> {project.ngo}</div><h2>{project.name}</h2><p className="project-description">{project.description}</p><div className="progress-meta"><span>{money(project.raised)} <small>raised</small></span><b>{percent}% funded</b></div><div className="progress-track"><i style={{ width: `${percent}%` }} /></div><div className="project-financials"><div><small>PROJECT BUDGET</small><b>{money(project.budget)}</b></div><div><small>APPROVED EXPENSES</small><b>{money(approved)}</b></div><div><small>CONTRIBUTIONS</small><b>{donationCount}</b></div><div><small>AVAILABLE BUDGET</small><b>{money(Math.max(0, project.budget - approved))}</b></div></div><div className="project-card-actions"><button className="button button-outline" onClick={() => onOpenProject(project)}>View full breakdown <ChevronRight size={15} /></button>{role === "Donor" && <button className="button button-primary" onClick={() => addDonation(project)}><HandCoins size={16} /> Demo contribution</button>}</div></div></article>;
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
    <div className="project-detail-footer"><span><ShieldAlert size={14} /> Demo data · no payment, bank, or chain verification</span>{role === "Donor" && <button className="button button-primary" onClick={onDonate}><HandCoins size={15} /> Record demo contribution</button>}</div>
  </Modal>;
}

function DonationsPage({ data, donationsTotal, role }: { data: FundTraceData; donationsTotal: number; role: Role }) {
  const donations = role === "Donor" ? data.donations.filter((item) => item.donor === "Aarav Mehta") : data.donations;
  const supportedProjects = new Set(donations.map((item) => item.projectId)).size;
  return <>
    <section className="welcome-row"><div><p className="eyebrow">CONTRIBUTIONS</p><h1>{role === "Donor" ? "Your contributions." : "Every contribution counts."}</h1><p className="welcome-subtitle">Recorded donation references are demo entries and are not payment confirmations.</p></div></section>
    <div className="stat-grid stat-grid-two"><StatCard label={role === "Donor" ? "YOUR CONTRIBUTIONS" : "TOTAL RECORDED"} value={money(donationsTotal)} note={`${donations.length} contributions`} icon={HandCoins} /><StatCard label="PROJECTS SUPPORTED" value={String(supportedProjects)} note={role === "Donor" ? "Projects you've contributed to" : "Across active initiatives"} icon={Landmark} tone="blue" /></div>
    <section className="panel page-panel"><div className="panel-heading"><div><p className="eyebrow">DONATION HISTORY</p><h2>{role === "Donor" ? "Your recorded contributions" : "Recorded contributions"}</h2></div><span className="record-count">{donations.length} records</span></div><div className="table-wrap"><table className="data-table"><thead><tr><th>REFERENCE</th>{role !== "Donor" && <th>DONOR</th>}<th>PROJECT</th><th>DATE</th><th>AMOUNT</th></tr></thead><tbody>{donations.map((donation) => <tr key={donation.id}><td><span className="ref-code">{donation.id}</span><small className="table-subline">{donation.reference}</small></td>{role !== "Donor" && <td>{donation.donor}</td>}<td>{data.projects.find((project) => project.id === donation.projectId)?.name}</td><td>{dateLabel(donation.date)}</td><td className="amount-cell">{money(donation.amount)}</td></tr>)}</tbody></table></div><p className="table-disclaimer"><CircleHelp size={14} /> A recorded contribution is not proof that funds were transferred. Payment verification is not connected in this demo.</p></section>
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
      <section className="panel page-panel"><div className="panel-heading"><div><p className="eyebrow">APPROVED SPENDING</p><h2>Expense summaries <span className="count-in-title">{shown.length}</span></h2></div></div><DonorExpenseTable expenses={[...shown].sort((a, b) => b.date.localeCompare(a.date))} projects={data.projects} /><p className="table-disclaimer"><CircleHelp size={14} /> An approved expense summary is not proof of payment. Payment verification is not connected in this demo.</p></section>
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
  const matches = hash ? expenses.filter((item) => item.receiptHash === hash) : [];
  async function inspectFile(selected: File | null) {
    setFile(selected);
    setHash("");
    setError("");
    if (!selected) return;
    setBusy(true);
    try {
      setHash(await getFileHash(selected));
    } catch {
      setError("Unable to calculate this file fingerprint in the current browser.");
    } finally {
      setBusy(false);
    }
  }
  return <>
    <section className="welcome-row"><div><p className="eyebrow">EVIDENCE CHECK</p><h1>Verify a receipt fingerprint.</h1><p className="welcome-subtitle">Compare the exact file contents against fingerprints recorded in this browser.</p></div></section>
    <section className="verification-layout">
      <div className="panel verify-panel"><div className="panel-heading"><div><p className="eyebrow">SHA-256 FINGERPRINT</p><h2>Check a receipt file</h2></div><span className="verify-mark"><Fingerprint size={19} /></span></div>
        <label className="verify-drop"><Upload size={23} /><b>{file ? file.name : "Choose a receipt to inspect"}</b><span>PDF or image · processed locally in your browser</span><input type="file" accept=".pdf,image/*" onChange={(event) => void inspectFile(event.target.files?.[0] ?? null)} /></label>
        {busy && <div className="verify-result">Calculating SHA-256 fingerprint…</div>}
        {error && <div className="warning-box"><AlertTriangle size={17} />{error}</div>}
        {hash && <div className={`hash-result ${matches.length ? "hash-found" : ""}`}><div className="hash-result-title">{matches.length ? <><AlertTriangle size={17} /> Fingerprint already exists</> : <><ShieldCheck size={17} /> No exact match found in this demo</>}</div><code>{hash}</code>{matches.length > 0 && <div className="match-list">{matches.map((item) => <div key={item.id}><span>{item.id} · {item.vendor}</span><b>{item.status}</b></div>)}</div>}</div>}
        <div className="form-note"><CircleHelp size={15} /> A matching hash means the file bytes match. It does not prove the receipt is genuine.</div>
      </div>
      <aside className="panel how-panel"><span className="how-icon"><Fingerprint size={19} /></span><p className="eyebrow">HOW IT WORKS</p><h2>A digital seal for the file.</h2><p>FundTrace calculates a SHA-256 fingerprint from the file contents. Even a one-byte change produces a different fingerprint.</p><ol><li><b>1</b><span>Select a file. It is read locally and not uploaded.</span></li><li><b>2</b><span>Compare its fingerprint with saved demo records.</span></li><li><b>3</b><span>Investigate matches; do not treat them as proof of fraud.</span></li></ol><div className="chain-notice"><ShieldAlert size={16} /><span>Blockchain anchoring is not connected. No transaction is sent.</span></div></aside>
    </section>
  </>;
}

function AuditPage({ entries, projects, expenses }: { entries: AuditEntry[]; projects: Project[]; expenses: Expense[] }) {
  return <>
    <section className="welcome-row"><div><p className="eyebrow">REVIEW HISTORY</p><h1>Decisions leave a trail.</h1><p className="welcome-subtitle">A browser-local demo timeline of submissions and auditor decisions.</p></div><div className="audit-count"><ScrollIcon />{entries.length} events</div></section>
    <section className="panel page-panel"><div className="panel-heading"><div><p className="eyebrow">AUDIT EVENTS</p><h2>Recent activity</h2></div><span className="record-count">Newest first</span></div><div className="audit-list">{entries.map((entry) => { const expense = expenses.find((item) => item.id === entry.expenseId); const project = projects.find((item) => item.id === expense?.projectId); return <article className="audit-item" key={entry.id}><span className={`audit-icon ${entry.action === "Approved" ? "audit-approved" : entry.action === "Rejected" ? "audit-rejected" : ""}`}>{entry.action === "Approved" ? <Check size={16} /> : entry.action === "Rejected" ? <X size={16} /> : <FilePlus2 size={16} />}</span><div className="audit-content"><div><b>{entry.action}</b><span className="audit-by">by {entry.actor}</span></div><p>{entry.reason}</p><small>{entry.expenseId}{project ? ` · ${project.name}` : ""} · {new Date(entry.date).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</small></div><StatusBadge status={expense?.status ?? "Unknown"} /></article>; })}{entries.length === 0 && <p className="empty-cell">No events yet.</p>}</div><p className="table-disclaimer"><ShieldAlert size={14} /> This is a local demo log. It is not tamper-proof and is not anchored to a blockchain.</p></section>
  </>;
}

function ScrollIcon() {
  return <span className="scroll-icon"><ShieldCheck size={17} /></span>;
}

function Modal({ title, subtitle, onClose, children }: { title: string; subtitle: string; onClose: () => void; children: ReactNode }) {
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div className="modal-heading"><div><h2 id="modal-title">{title}</h2><p>{subtitle}</p></div><button className="icon-button" aria-label="Close" onClick={onClose}><X size={19} /></button></div>{children}</section></div>;
}

function ExpenseDetail({ expense, project, auditEntries, role, onClose, onDecision }: {
  expense: Expense; project?: Project; auditEntries: AuditEntry[]; role: Role; onClose: () => void;
  onDecision: (status: Expense["status"], reason: string) => void;
}) {
  const [reason, setReason] = useState("");
  const canReview = role === "Auditor" && (expense.status === "Pending review" || expense.status === "More evidence");
  return <Modal title={`Review ${expense.id}`} subtitle={`${expense.vendor} · ${project?.name ?? "Unknown project"}`} onClose={onClose}>
    <div className="detail-grid"><div><span>CLAIMED AMOUNT</span><b>{money(expense.claimedAmount)}</b></div><div><span>RISK SCORE</span><b className={`risk-text-${riskLabel(expense.riskScore).toLowerCase()}`}>{riskLabel(expense.riskScore)} · {expense.riskScore}/100</b></div><div><span>INVOICE NUMBER</span><b>{expense.invoiceNumber || "Not provided"}</b></div><div><span>SUBMITTED</span><b>{dateLabel(expense.date)}</b></div></div>
    <div className="detail-status"><span>Current status</span><StatusBadge status={expense.status} /></div>
    <div className="detail-section-heading"><h3>Evidence and amount check</h3><span>Manual/demo analysis</span></div>
    <div className="evidence-summary"><div className="evidence-file"><span className="evidence-file-icon"><FilePlus2 size={17} /></span><span><b>{expense.receiptName}</b><small>{expense.receiptHash ? "Fingerprint recorded in browser demo" : "No supporting file attached"}</small></span><StatusBadge status={expense.receiptHash ? "Attached" : "Missing"} /></div><div className="amount-comparison"><div><span>Claimed</span><b>{money(expense.claimedAmount)}</b></div><div className="comparison-divider">vs</div><div><span>Receipt amount</span><b>{expense.extractedAmount === undefined ? "Not extracted" : money(expense.extractedAmount)}</b></div><div className={`comparison-result ${expense.extractedAmount === undefined ? "comparison-unknown" : expense.extractedAmount === expense.claimedAmount ? "comparison-match" : "comparison-mismatch"}`}>{expense.extractedAmount === undefined ? "Manual review needed" : expense.extractedAmount === expense.claimedAmount ? "Amounts match" : `Difference ${money(Math.abs(expense.claimedAmount - expense.extractedAmount))}`}</div></div></div>
    <div className="risk-reasons"><b>Automated review signals · {expense.riskScore}/100</b>{expense.riskReasons.map((item) => <div key={item}><AlertTriangle size={14} />{item}</div>)}</div>
    {expense.receiptHash && <div className="detail-hash"><span>SHA-256 FILE FINGERPRINT</span><code>{expense.receiptHash}</code><small>Identifies these exact file bytes; it does not authenticate the document.</small></div>}
    <div className="detail-section-heading"><h3>Review timeline</h3><span>{auditEntries.length + 1} events</span></div>
    <div className="expense-timeline"><div className="timeline-event"><i /><span><b>Expense submitted</b><small>{dateLabel(expense.date)} · Submitted for auditor review</small></span></div>{auditEntries.slice().sort((a, b) => a.date.localeCompare(b.date)).map((entry) => <div className="timeline-event" key={entry.id}><i className={entry.action === "Approved" ? "timeline-approved" : entry.action === "Rejected" ? "timeline-rejected" : ""} /><span><b>{entry.action}</b><small>{new Date(entry.date).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })} · {entry.actor}<em>{entry.reason}</em></small></span></div>)}</div>
    <div className="chain-notice"><ShieldAlert size={16} /><span>Blockchain status: Not submitted. Decisions are not written to a chain in this demo.</span></div>
    {canReview ? <><label className="field review-reason">Decision note<textarea rows={3} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Add context for the audit trail..." /></label><div className="modal-actions review-actions"><button className="button button-danger" onClick={() => onDecision("Rejected", reason || "Rejected after auditor review.")}><X size={15} /> Reject</button><button className="button button-outline" onClick={() => onDecision("More evidence", reason || "Additional evidence requested.")}><FilePlus2 size={15} /> Request evidence</button><button className="button button-primary" onClick={() => onDecision("Approved", reason || "Approved after auditor review.")}><Check size={15} /> Approve</button></div></> : <div className="modal-actions"><button className="button button-plain" onClick={onClose}>Close</button>{role !== "Auditor" && (expense.status === "Pending review" || expense.status === "More evidence") && <span className="review-hint">Switch role to Auditor to record a decision.</span>}</div>}
  </Modal>;
}