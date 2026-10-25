import type { LucideIcon } from "lucide-react";

interface StatCardProps {
  label: string;
  value: string;
  note: string;
  icon: LucideIcon;
  tone?: "green" | "amber" | "blue" | "rose";
}

export function StatCard({ label, value, note, icon: Icon, tone = "green" }: StatCardProps) {
  return (
    <article className="stat-card">
      <div className={`stat-icon stat-icon-${tone}`}><Icon size={19} /></div>
      <div className="stat-copy">
        <p className="eyebrow">{label}</p>
        <strong>{value}</strong>
        <span>{note}</span>
      </div>
    </article>
  );
}