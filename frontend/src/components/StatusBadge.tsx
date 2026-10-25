import type { ExpenseStatus, RiskLevel } from "../types";

export function StatusBadge({ status }: { status: ExpenseStatus | RiskLevel | string }) {
  const className = status.toLowerCase().replace(/\s+/g, "-");
  return <span className={`badge badge-${className}`}>{status}</span>;
}