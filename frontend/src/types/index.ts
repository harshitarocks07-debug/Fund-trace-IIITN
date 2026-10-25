export type Role = "Donor" | "NGO admin" | "Auditor";
export type ExpenseStatus = "Pending review" | "Approved" | "Rejected" | "More evidence";
export type RiskLevel = "Low" | "Medium" | "High" | "Critical";

export interface Project {
  id: string;
  name: string;
  ngo: string;
  description: string;
  budget: number;
  raised: number;
  location: string;
  category: string;
}

export interface Donation {
  id: string;
  projectId: string;
  donor: string;
  amount: number;
  date: string;
  reference: string;
}

export interface Expense {
  id: string;
  projectId: string;
  vendor: string;
  category: string;
  invoiceNumber: string;
  claimedAmount: number;
  receiptName: string;
  receiptHash: string;
  extractedAmount?: number;
  status: ExpenseStatus;
  riskScore: number;
  riskReasons: string[];
  date: string;
  blockchainStatus: "Not submitted";
}

export interface AuditEntry {
  id: string;
  expenseId: string;
  action: string;
  actor: string;
  reason: string;
  date: string;
}

export interface FundTraceData {
  projects: Project[];
  donations: Donation[];
  expenses: Expense[];
  auditLog: AuditEntry[];
}
