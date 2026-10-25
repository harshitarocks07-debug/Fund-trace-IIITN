import { ArrowUpRight, MoreHorizontal } from "lucide-react";
import type { Expense, Project } from "../types";
import { formatINR } from "../utils/demoData";
import { StatusBadge } from "./StatusBadge";

export function ExpenseTable({ expenses, projects, onSelect }: {
  expenses: Expense[];
  projects: Project[];
  onSelect?: (expense: Expense) => void;
}) {
  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead><tr><th>EXPENSE / VENDOR</th><th>PROJECT</th><th>AMOUNT</th><th>RISK</th><th>STATUS</th><th /></tr></thead>
        <tbody>
          {expenses.map((expense) => {
            const project = projects.find((item) => item.id === expense.projectId);
            const risk = expense.riskScore >= 75 ? "Critical" : expense.riskScore >= 50 ? "High" : expense.riskScore >= 25 ? "Medium" : "Low";
            return (
              <tr key={expense.id} onClick={() => onSelect?.(expense)} className={onSelect ? "clickable-row" : ""}>
                <td><div className="primary-cell">{expense.id}<small>{expense.vendor}</small></div></td>
                <td><span className="muted-cell">{project?.name ?? "Unknown project"}</span></td>
                <td className="amount-cell">{formatINR(expense.claimedAmount)}</td>
                <td><span className={`risk-score risk-${risk.toLowerCase()}`}><i />{risk} · {expense.riskScore}</span></td>
                <td><StatusBadge status={expense.status} /></td>
                <td><button className="row-action" aria-label={`View ${expense.id}`} onClick={(event) => { event.stopPropagation(); onSelect?.(expense); }}>{onSelect ? <ArrowUpRight size={16} /> : <MoreHorizontal size={17} />}</button></td>
              </tr>
            );
          })}
          {expenses.length === 0 && <tr><td colSpan={6} className="empty-cell">No expenses match this view.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}