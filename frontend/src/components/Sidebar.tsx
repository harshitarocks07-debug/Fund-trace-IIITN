import { Activity, BadgeIndianRupee, Boxes, Building2, FileCheck2, GitFork, HandCoins, LayoutDashboard, Leaf, LogIn, ScrollText, ShieldAlert, ShieldCheck } from "lucide-react";
import type { AuthUser, Role } from "../types";

export type PageKey = "Overview" | "Projects" | "Donations" | "Expenses" | "Receipt verification" | "Multi-hop flows" | "Funding integrity" | "Audit log" | "NGO Directory";

const navigation = [
  { label: "Overview", icon: LayoutDashboard },
  { label: "NGO Directory", icon: Building2 },
  { label: "Projects", icon: Boxes },
  { label: "Donations", icon: HandCoins },
  { label: "Expenses", icon: BadgeIndianRupee },
  { label: "Receipt verification", icon: FileCheck2 },
  { label: "Multi-hop flows", icon: GitFork },
  { label: "Funding integrity", icon: ShieldAlert },
  { label: "Audit log", icon: ScrollText },
] as const;

export interface SidebarProps {
  page?: PageKey | string;
  setPage?: (page: PageKey) => void;
  role?: Role;
  setRole?: (role: Role) => void;
  currentUser?: AuthUser | null;
  onOpenAuth?: () => void;
  pendingCount?: number;
  currentView?: string;
  onNavigate?: (view: any) => void;
}

export function Sidebar({ 
  page = "Overview", 
  setPage, 
  role = "Donor", 
  setRole,
  currentUser,
  onOpenAuth,
  pendingCount = 0,
  currentView,
  onNavigate,
}: SidebarProps) {
  const activePage = (page || currentView || "Overview") as PageKey;
  const handlePageSelect = (p: PageKey) => {
    if (setPage) setPage(p);
    if (onNavigate) onNavigate(p.toLowerCase());
  };

  return (
    <aside className="sidebar">
      <a className="brand" href="#" onClick={(event) => { event.preventDefault(); handlePageSelect("Overview"); }}>
        <span className="brand-mark"><Leaf size={20} /></span>
        <span>fundtrace<span className="brand-period">.</span><small>TRANSPARENT GIVING</small></span>
      </a>

      <div className="workspace-label">ROLE-BASED WORKSPACE</div>

      <nav className="side-nav" aria-label="Main navigation">
        {navigation
          .filter(({ label }) => role !== "Donor" || (label !== "Receipt verification" && label !== "Audit log"))
          .map(({ label, icon: Icon }) => (
            <button key={label} className={`nav-item ${activePage === label ? "active" : ""}`} onClick={() => handlePageSelect(label as PageKey)}>
              <Icon size={18} strokeWidth={1.8} />
              <span>{label}</span>
              {label === "Expenses" && role === "Auditor" && pendingCount > 0 && (
                <b className="nav-count">{pendingCount}</b>
              )}
            </button>
          ))}
      </nav>

      <div className="sidebar-bottom">
        <div className="security-note">
          <ShieldCheck size={18} />
          <div>
            <b>Enforced RBAC</b>
            <span>{role === "Auditor" ? "Audit & Verification permissions" : role === "NGO admin" ? "Project & Expense management" : "Contributor & Tracking permissions"}</span>
          </div>
        </div>

        <div className="role-switch">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.4rem" }}>
            <label htmlFor="role-select" style={{ marginBottom: 0 }}>ACTIVE ROLE</label>
            {onOpenAuth && (
              <button 
                type="button" 
                onClick={onOpenAuth}
                style={{ 
                  background: "transparent", 
                  border: "none", 
                  color: "var(--color-primary, #0d9488)", 
                  cursor: "pointer", 
                  fontSize: "0.75rem",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "2px",
                  fontWeight: 600
                }}
              >
                <LogIn size={11} /> Register / Login
              </button>
            )}
          </div>
          {setRole && (
            <select 
              id="role-select" 
              value={role} 
              onChange={(event) => setRole(event.target.value as Role)}
            >
              <option value="NGO admin">NGO admin</option>
              <option value="Auditor">Auditor</option>
              <option value="Donor">Donor</option>
            </select>
          )}
        </div>

        <div className="sidebar-foot">
          <Activity size={14} /> 
          <span>{currentUser ? `${currentUser.role} session` : "Authenticated"}</span>
          <span className="online-dot" />
        </div>
      </div>
    </aside>
  );
}

export default Sidebar;
