import React from "react";
import { ArrowUpRight, MoreHorizontal } from "lucide-react";
import type { Expense, Project } from "../types";
import { formatINR } from "../utils/demoData";
import { StatusBadge } from "./StatusBadge";

export interface ExpenseItem {
  id: string | number;
  description?: string;
  category: string;
  amount?: number;
  claimedAmount?: number;
  date: string;
  status: "Verified" | "Pending" | "Flagged" | string;
  receiptUrl?: string;
  vendor?: string;
  projectId?: string;
  riskScore?: number;
}

interface ExpenseTableProps {
  expenses?: (Expense | ExpenseItem)[];
  projects?: Project[];
  onSelect?: (expense: any) => void;
}

export function ExpenseTable({
  expenses = [],
  projects = [],
  onSelect,
}: ExpenseTableProps) {
  // If projects is provided or onSelect is provided or items have rich Expense fields, render the interactive table:
  const isRichExpense =
    projects.length > 0 ||
    Boolean(onSelect) ||
    expenses.some(
      (e) => "claimedAmount" in e || "vendor" in e || "riskScore" in e
    );

  if (isRichExpense) {
    return (
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>EXPENSE / VENDOR</th>
              <th>PROJECT</th>
              <th>AMOUNT</th>
              <th>RISK</th>
              <th>STATUS</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {(expenses as Expense[]).map((expense) => {
              const project = projects.find(
                (item) => item.id === expense.projectId
              );
              const score = expense.riskScore ?? 0;
              const risk =
                score >= 75
                  ? "Critical"
                  : score >= 50
                  ? "High"
                  : score >= 25
                  ? "Medium"
                  : "Low";
              const amt =
                expense.claimedAmount ?? (expense as any).amount ?? 0;
              const titleOrVendor =
                expense.vendor || (expense as any).description || expense.id;
              return (
                <tr
                  key={expense.id}
                  onClick={() => onSelect?.(expense)}
                  className={onSelect ? "clickable-row" : ""}
                >
                  <td>
                    <div className="primary-cell">
                      {expense.id}
                      <small>{titleOrVendor}</small>
                    </div>
                  </td>
                  <td>
                    <span className="muted-cell">
                      {project?.name ?? "Unknown project"}
                    </span>
                  </td>
                  <td className="amount-cell">{formatINR(amt)}</td>
                  <td>
                    <span className={`risk-score risk-${risk.toLowerCase()}`}>
                      <i />
                      {risk} · {score}
                    </span>
                  </td>
                  <td>
                    <StatusBadge status={expense.status} />
                  </td>
                  <td>
                    <button
                      className="row-action"
                      aria-label={`View ${expense.id}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        onSelect?.(expense);
                      }}
                    >
                      {onSelect ? (
                        <ArrowUpRight size={16} />
                      ) : (
                        <MoreHorizontal size={17} />
                      )}
                    </button>
                  </td>
                </tr>
              );
            })}
            {expenses.length === 0 && (
              <tr>
                <td colSpan={6} className="empty-cell">
                  No expenses match this view.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    );
  }

  // Fallback to simple table if used in simple summary mode:
  return (
    <div
      style={{
        backgroundColor: "#1e293b",
        border: "1px solid #334155",
        borderRadius: "12px",
        overflow: "hidden",
      }}
    >
      <div
        style={{ padding: "20px 24px", borderBottom: "1px solid #334155" }}
      >
        <h3 style={{ fontSize: "16px", fontWeight: 700, color: "#f8fafc" }}>
          Audited Utilization Expenses
        </h3>
      </div>
      <div style={{ overflowX: "auto" }}>
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            textAlign: "left",
            fontSize: "13px",
          }}
        >
          <thead>
            <tr
              style={{
                backgroundColor: "#0f172a",
                borderBottom: "1px solid #334155",
                color: "#94a3b8",
              }}
            >
              <th style={{ padding: "12px 20px", fontWeight: 600 }}>
                Description
              </th>
              <th style={{ padding: "12px 20px", fontWeight: 600 }}>
                Category
              </th>
              <th style={{ padding: "12px 20px", fontWeight: 600 }}>Date</th>
              <th
                style={{
                  padding: "12px 20px",
                  fontWeight: 600,
                  textAlign: "right",
                }}
              >
                Amount
              </th>
              <th
                style={{
                  padding: "12px 20px",
                  fontWeight: 600,
                  textAlign: "center",
                }}
              >
                Audit Status
              </th>
            </tr>
          </thead>
          <tbody>
            {(expenses as ExpenseItem[]).map((item) => (
              <tr
                key={item.id}
                style={{
                  borderBottom: "1px solid #334155",
                  color: "#cbd5e1",
                }}
              >
                <td
                  style={{
                    padding: "14px 20px",
                    fontWeight: 500,
                    color: "#f8fafc",
                  }}
                >
                  {item.description || item.vendor || item.id}
                </td>
                <td style={{ padding: "14px 20px" }}>
                  <span
                    style={{
                      backgroundColor: "#334155",
                      padding: "3px 8px",
                      borderRadius: "4px",
                      fontSize: "11px",
                    }}
                  >
                    {item.category}
                  </span>
                </td>
                <td style={{ padding: "14px 20px", color: "#94a3b8" }}>
                  {item.date}
                </td>
                <td
                  style={{
                    padding: "14px 20px",
                    textAlign: "right",
                    fontWeight: 600,
                    color: "#f8fafc",
                  }}
                >
                  ₹{(item.amount || item.claimedAmount || 0).toLocaleString()}
                </td>
                <td style={{ padding: "14px 20px", textAlign: "center" }}>
                  <StatusBadge status={item.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default ExpenseTable;
