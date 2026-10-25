import { useState } from "react";
import { Bell, ChevronDown, LogOut, Search, ShieldCheck, KeyRound } from "lucide-react";
import type { AuthUser, Role } from "../types";

export interface NavbarProps {
  currentUser?: AuthUser | null;
  role: Role;
  page: string;
  onOpenAuth: () => void;
  onLogout: () => void;
  ngoName?: string;
}

export function Navbar({ currentUser, role, page, onOpenAuth, onLogout }: NavbarProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const displayName = currentUser?.full_name || (role === "Auditor" ? "Priya Nair" : role === "Donor" ? "Aarav Mehta" : "Helping Hands Admin");
  const displayEmail = currentUser?.email || (role === "Auditor" ? "auditor@trustcheck.org" : role === "Donor" ? "donor@aarav.org" : "admin@helpinghands.org");
  const initials = displayName.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();

  const roleBadgeClass = role === "Donor" 
    ? "badge-donor" 
    : role === "NGO admin" 
      ? "badge-ngo" 
      : "badge-auditor";

  return (
    <header className="topbar">
      <div className="breadcrumbs">
        <span>FundTrace Workspace</span>
        <b>/</b>
        <strong>{page}</strong>
      </div>

      <div className="topbar-right">
        <div className="search-box">
          <Search size={16} />
          <input aria-label="Search" placeholder="Search claims, receipts, projects..." />
        </div>

        <button className="icon-button notification-button" aria-label="Notifications">
          <Bell size={18} />
          <i />
        </button>

        <div className="user-dropdown-container">
          <div 
            className="user-menu" 
            role="button" 
            tabIndex={0}
            onClick={() => setDropdownOpen(!dropdownOpen)}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setDropdownOpen(!dropdownOpen); }}
          >
            <span className="avatar">{initials}</span>
            <span className="user-name">
              {displayName}
              <small className={`role-pill ${roleBadgeClass}`}>
                <ShieldCheck size={11} style={{ marginRight: 3 }} />
                {role}
              </small>
            </span>
            <ChevronDown size={15} />
          </div>

          {dropdownOpen && (
            <div className="user-popover-menu">
              <div className="popover-user-info">
                <strong>{displayName}</strong>
                <span>{displayEmail}</span>
                <span className={`role-pill ${roleBadgeClass}`} style={{ marginTop: 4 }}>
                  {role} {currentUser?.organization ? `· ${currentUser.organization}` : ""}
                </span>
              </div>
              <hr />
              <button 
                type="button" 
                className="popover-action-item"
                onClick={() => {
                  setDropdownOpen(false);
                  onOpenAuth();
                }}
              >
                <KeyRound size={15} />
                <span>Switch / Register User</span>
              </button>
              <button 
                type="button" 
                className="popover-action-item text-danger"
                onClick={() => {
                  setDropdownOpen(false);
                  onLogout();
                }}
              >
                <LogOut size={15} />
                <span>Sign Out</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

export default Navbar;
