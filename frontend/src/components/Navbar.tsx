import { Bell, ChevronDown, Search } from "lucide-react";
import type { Role } from "../types";

export function Navbar({ role, page }: { role: Role; page: string }) {
  const initials = role === "Auditor" ? "PN" : role === "Donor" ? "AM" : "HK";
  const name = role === "Auditor" ? "Priya Nair" : role === "Donor" ? "Aarav Mehta" : "Helping Hands";
  return (
    <header className="topbar">
      <div className="breadcrumbs"><span>Workspace</span><b>/</b><strong>{page}</strong></div>
      <div className="topbar-right">
        <div className="search-box"><Search size={16} /><input aria-label="Search" placeholder="Search anything..." /></div>
        <button className="icon-button notification-button" aria-label="Notifications"><Bell size={18} /><i /></button>
        <div className="user-menu"><span className="avatar">{initials}</span><span className="user-name">{name}<small>{role}</small></span><ChevronDown size={15} /></div>
      </div>
    </header>
  );
}