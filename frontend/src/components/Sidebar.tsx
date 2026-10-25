import { Activity, BadgeIndianRupee, Boxes, FileCheck2, HandCoins, LayoutDashboard, Leaf, ScrollText, ShieldCheck } from "lucide-react";
import type { Role } from "../types";

export type PageKey = "Overview" | "Projects" | "Donations" | "Expenses" | "Receipt verification" | "Audit log";

const navigation = [
  { label: "Overview", icon: LayoutDashboard },
  { label: "Projects", icon: Boxes },
  { label: "Donations", icon: HandCoins },
  { label: "Expenses", icon: BadgeIndianRupee },
  { label: "Receipt verification", icon: FileCheck2 },
  { label: "Audit log", icon: ScrollText },
] as const;

export function Sidebar({ page, setPage, role, setRole }: {
  page: PageKey;
  setPage: (page: PageKey) => void;
  role: Role;
  setRole: (role: Role) => void;
}) {
  return (
    <aside className="sidebar">
      <a className="brand" href="#" onClick={(event) => { event.preventDefault(); setPage("Overview"); }}>
        <span className="brand-mark"><Leaf size={20} /></span>
        <span>fundtrace<span className="brand-period">.</span><small>TRANSPARENT GIVING</small></span>
      </a>
      <div className="workspace-label">WORKSPACE</div>
      <nav className="side-nav" aria-label="Main navigation">
        {navigation.filter(({ label }) => role !== "Donor" || (label !== "Receipt verification" && label !== "Audit log")).map(({ label, icon: Icon }) => (
          <button key={label} className={`nav-item ${page === label ? "active" : ""}`} onClick={() => setPage(label)}>
            <Icon size={18} strokeWidth={1.8} /><span>{label}</span>
            {label === "Expenses" && role === "Auditor" && <b className="nav-count">2</b>}
          </button>
        ))}
      </nav>
      <div className="sidebar-bottom">
        <div className="security-note">
          <ShieldCheck size={18} />
          <div><b>Evidence-first</b><span>Every claim has a trail.</span></div>
        </div>
        <div className="role-switch">
          <label htmlFor="role-select">DEMO ROLE</label>
          <select id="role-select" value={role} onChange={(event) => setRole(event.target.value as Role)}>
            <option>NGO admin</option>
            <option>Auditor</option>
            <option>Donor</option>
          </select>
        </div>
        <div className="sidebar-foot"><Activity size={14} /> Demo workspace <span className="online-dot" /></div>
      </div>
    </aside>
  );
}