import type { FundTraceData } from "../types";

export const initialData: FundTraceData = {
  projects: [
    {
      id: "PRJ-001",
      name: "Rural School Construction",
      ngo: "Helping Hands Foundation",
      description: "Build safe, durable classrooms for children in rural communities.",
      budget: 1_000_000,
      raised: 1_000_000,
      location: "Madhya Pradesh",
      category: "Education",
    },
    {
      id: "PRJ-002",
      name: "Clean Water for Bhairavpur",
      ngo: "Jal Seva Collective",
      description: "Install community water points and test local drinking water.",
      budget: 750_000,
      raised: 512_000,
      location: "Rajasthan",
      category: "Clean water",
    },
    {
      id: "PRJ-003",
      name: "Mobile Health Clinic",
      ngo: "Swasthya Outreach",
      description: "Bring primary healthcare and essential screenings to remote villages.",
      budget: 1_200_000,
      raised: 824_500,
      location: "Maharashtra",
      category: "Healthcare",
    },
  ],
  donations: [
    { id: "DON-1042", projectId: "PRJ-001", donor: "Aarav Mehta", amount: 500_000, date: "2026-10-14", reference: "PAY-8K2F19" },
    { id: "DON-1041", projectId: "PRJ-001", donor: "Nisha Rao", amount: 300_000, date: "2026-10-12", reference: "PAY-3M7J21" },
    { id: "DON-1038", projectId: "PRJ-002", donor: "Kavya Shah", amount: 125_000, date: "2026-10-10", reference: "PAY-9P1D04" },
    { id: "DON-1032", projectId: "PRJ-001", donor: "Rohan Das", amount: 200_000, date: "2026-10-08", reference: "PAY-7B5L38" },
    { id: "DON-1026", projectId: "PRJ-003", donor: "Mira Kapoor", amount: 82_500, date: "2026-10-03", reference: "PAY-2X6W14" },
  ],
  expenses: [
    {
      id: "EXP-001", projectId: "PRJ-001", vendor: "ABC Building Supplies", category: "Construction",
      invoiceNumber: "INV-2026-101", claimedAmount: 200_000, extractedAmount: 200_000,
      receiptName: "invoice_001.pdf", receiptHash: "a81f4d2c9b7e6a1083d5f7c1e9a2b4d6f8c0e1a3b5d7f9c2e4a6b8d0f2a4c6e8",
      status: "Approved", riskScore: 12, riskReasons: ["Amount matches submitted invoice"],
      date: "2026-10-18", blockchainStatus: "Not submitted",
    },
    {
      id: "EXP-002", projectId: "PRJ-001", vendor: "Shree Cement Depot", category: "Materials",
      invoiceNumber: "INV-2026-118", claimedAmount: 160_000, extractedAmount: 120_000,
      receiptName: "cement_invoice.jpg", receiptHash: "bf92cfa7d1e34c008b56cfc711e90a5c0d89f72a15c4e3b6098d7f2a1c5e6b48",
      status: "Pending review", riskScore: 58, riskReasons: ["Claimed amount differs from entered receipt amount by ₹40,000"],
      date: "2026-10-21", blockchainStatus: "Not submitted",
    },
    {
      id: "EXP-003", projectId: "PRJ-002", vendor: "Rajasthan Pipe Works", category: "Water infrastructure",
      invoiceNumber: "RPW-884", claimedAmount: 285_000,
      receiptName: "pipeworks_invoice.pdf", receiptHash: "a81f4d2c9b7e6a1083d5f7c1e9a2b4d6f8c0e1a3b5d7f9c2e4a6b8d0f2a4c6e8",
      status: "Pending review", riskScore: 82,
      riskReasons: ["Receipt fingerprint matches another submission", "High-value claim requires review"],
      date: "2026-10-22", blockchainStatus: "Not submitted",
    },
    {
      id: "EXP-004", projectId: "PRJ-003", vendor: "Mobile Care Services", category: "Medical supplies",
      invoiceNumber: "MCS-2026-42", claimedAmount: 74_500, extractedAmount: 74_500,
      receiptName: "clinic_supplies.pdf", receiptHash: "3c22d9a86e7f1b4a9c0d2e5f6a8b1c3d4e5f60718293a4b5c6d7e8f901234567",
      status: "More evidence", riskScore: 38, riskReasons: ["Auditor requested an itemized vendor receipt"],
      date: "2026-10-23", blockchainStatus: "Not submitted",
    },
  ],
  auditLog: [
    { id: "AUD-006", expenseId: "EXP-004", action: "More evidence requested", actor: "Priya Nair", reason: "Please attach an itemized receipt from the vendor.", date: "2026-10-24T10:35:00" },
    { id: "AUD-005", expenseId: "EXP-001", action: "Approved", actor: "Priya Nair", reason: "Receipt details reviewed; claim is supported.", date: "2026-10-23T16:20:00" },
  ],
};

export function formatINR(value: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}
