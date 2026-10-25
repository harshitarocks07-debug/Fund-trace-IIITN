import { request } from './api';

export interface Expense {
  id: number;
  ngo_id: number;
  ngo_name?: string;
  project_id?: number;
  project_title?: string;
  title: string;
  description?: string;
  category: string;
  amount: number;
  currency: string;
  payment_mode: string;
  vendor_name?: string;
  invoice_number?: string;
  invoice_date?: string;
  receipt_hash?: string;
  receipt_url?: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'FLAGGED' | 'REIMBURSED';
  is_verified: boolean;
  verified_at?: string;
  reviewed_by?: string;
  review_notes?: string;
  tx_hash?: string;
  created_at: string;
}

export interface ExpenseCreate {
  title: string;
  description?: string;
  category: string;
  amount: number;
  currency?: string;
  ngo_id: number;
  project_id?: number;
  payment_mode?: string;
  vendor_name?: string;
  invoice_number?: string;
  invoice_date?: string;
  receipt_url?: string;
  receipt_hash?: string;
  status?: string;
}

export interface ExpenseUpdate {
  title?: string;
  description?: string;
  category?: string;
  amount?: number;
  vendor_name?: string;
  invoice_number?: string;
  invoice_date?: string;
  receipt_url?: string;
  project_id?: number;
  payment_mode?: string;
}

export interface ExpenseStatusUpdate {
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'FLAGGED' | 'REIMBURSED';
  review_notes?: string;
  reviewed_by?: string;
}

export interface ExpenseListResponse {
  items: Expense[];
  total: number;
  total_amount: number;
  approved_amount: number;
  pending_amount: number;
  skip: number;
  limit: number;
}

export interface ExpenseStats {
  total_expenses_count: number;
  total_amount: number;
  approved_amount: number;
  pending_amount: number;
  rejected_amount: number;
  currency: string;
  by_category: Array<{ category: string; count: number; amount: number }>;
  by_project: Array<{ project_id: number; project_title: string; count: number; amount: number }>;
  recent_expenses: Array<any>;
}

const FALLBACK_EXPENSES: Expense[] = [
  {
    id: 1,
    ngo_id: 1,
    ngo_name: 'Vidya Jyoti Foundation',
    project_id: 1,
    project_title: 'Digital Classrooms for Rural Vidarbha',
    title: 'Classroom Tablets & Solar Power Units',
    description: 'Procurement of 25 rugged Android learning tablets and 5 solar backup chargers for remote schools.',
    category: 'Hardware',
    amount: 185000,
    currency: 'INR',
    payment_mode: 'BANK_TRANSFER',
    vendor_name: 'Vidarbha Digital Systems Pvt Ltd',
    invoice_number: 'VDS-2024-0412',
    invoice_date: '2026-02-10',
    receipt_hash: 'QmZ4tjB7F8329kLP890123abcde',
    status: 'APPROVED',
    is_verified: true,
    verified_at: '2026-02-11T12:00:00Z',
    reviewed_by: 'Compliance Auditor (S. Kulkarni)',
    review_notes: 'All hardware physically verified and tagged in school inventory asset ledger.',
    tx_hash: '0x99a12c88410294eab40182bb1920acde8141028399104fae',
    created_at: '2026-02-10T14:30:00Z',
  },
  {
    id: 2,
    ngo_id: 1,
    ngo_name: 'Vidya Jyoti Foundation',
    project_id: 1,
    project_title: 'Digital Classrooms for Rural Vidarbha',
    title: 'Teacher Digital Literacy Workshops - Batch 1',
    description: '5-day master trainer capacity building for 30 rural school educators.',
    category: 'Training',
    amount: 95000,
    currency: 'INR',
    payment_mode: 'BANK_TRANSFER',
    vendor_name: 'EdTech Shiksha Foundation',
    invoice_number: 'EDT-2024-118',
    invoice_date: '2026-02-05',
    receipt_hash: 'QmY8kpM123456789abcdef0123',
    status: 'APPROVED',
    is_verified: true,
    verified_at: '2026-02-06T11:00:00Z',
    reviewed_by: 'Compliance Auditor (S. Kulkarni)',
    review_notes: 'Attendance sheets and post-workshop evaluation certificates attached.',
    tx_hash: '0x88c1b994821a00fc241198aa76c00d41eb31a89cde994320',
    created_at: '2026-02-05T09:15:00Z',
  },
  {
    id: 3,
    ngo_id: 1,
    ngo_name: 'Vidya Jyoti Foundation',
    project_id: 1,
    project_title: 'Digital Classrooms for Rural Vidarbha',
    title: 'Hands-on Science & STEM Experiment Kits',
    description: '50 modular science lab kits distributed across 5 zilla parishad schools.',
    category: 'Materials',
    amount: 64000,
    currency: 'INR',
    payment_mode: 'UPI',
    vendor_name: 'Nagpur Scientific & Lab Suppliers',
    invoice_number: 'NSLS-9982',
    invoice_date: '2026-01-28',
    receipt_hash: 'QmA9plK45678901234abcdef01',
    status: 'APPROVED',
    is_verified: true,
    verified_at: '2026-01-29T10:00:00Z',
    reviewed_by: 'Senior Program Officer',
    review_notes: 'Delivery challans signed by school headmasters verified.',
    tx_hash: '0x12fa9087c55b6201ea74d998120faec71881944510b641ef',
    created_at: '2026-01-28T16:00:00Z',
  },
  {
    id: 4,
    ngo_id: 2,
    ngo_name: 'Arogya Seva Healthcare Trust',
    project_id: 2,
    project_title: 'Mobile Medical Van & Diagnostic Camps',
    title: 'Mobile Clinic Diagnostic Testing Kits',
    description: 'Rapid malaria, blood sugar, and hemoglobin test strips and portable centrifuge.',
    category: 'Medical',
    amount: 120000,
    currency: 'INR',
    payment_mode: 'BANK_TRANSFER',
    vendor_name: 'CareBio Diagnostics Ltd',
    invoice_number: 'CBD-2024-8841',
    invoice_date: '2026-02-08',
    receipt_hash: 'QmB11cd77889900aabbccddeeff',
    status: 'APPROVED',
    is_verified: true,
    verified_at: '2026-02-09T15:30:00Z',
    reviewed_by: 'Medical Audit Lead',
    review_notes: 'Batch expiration dates beyond 2027 confirmed; stored in cold chain.',
    tx_hash: '0x77ba9108c991e4215891aab876104bcde81099238914cbe8',
    created_at: '2026-02-08T11:45:00Z',
  },
  {
    id: 5,
    ngo_id: 2,
    ngo_name: 'Arogya Seva Healthcare Trust',
    project_id: 2,
    project_title: 'Mobile Medical Van & Diagnostic Camps',
    title: 'Mobile Health Van Diesel & Vehicle Maintenance',
    description: 'Routine scheduled service, new radial tyres, and diesel fuel card recharge.',
    category: 'Logistics',
    amount: 38000,
    currency: 'INR',
    payment_mode: 'CARD',
    vendor_name: 'Mahindra Authorized Service Center',
    invoice_number: 'MASC-7712',
    invoice_date: '2026-02-14',
    receipt_hash: 'QmC22ee99001122aabbccddee00',
    status: 'PENDING',
    is_verified: false,
    review_notes: 'Pending odometer logbook verification and fuel receipts.',
    created_at: '2026-02-14T17:10:00Z',
  },
];

export const expenseService = {
  async listExpenses(params?: {
    ngo_id?: number;
    project_id?: number;
    status?: string;
    category?: string;
    search?: string;
    skip?: number;
    limit?: number;
  }): Promise<ExpenseListResponse> {
    try {
      const q = new URLSearchParams();
      if (params?.ngo_id) q.set('ngo_id', String(params.ngo_id));
      if (params?.project_id) q.set('project_id', String(params.project_id));
      if (params?.status) q.set('status', params.status);
      if (params?.category) q.set('category', params.category);
      if (params?.search) q.set('search', params.search);
      if (params?.skip !== undefined) q.set('skip', String(params.skip));
      if (params?.limit !== undefined) q.set('limit', String(params.limit));

      const qs = q.toString() ? `?${q.toString()}` : '';
      return await request<ExpenseListResponse>(`/expenses/${qs}`);
    } catch {
      let filtered = [...FALLBACK_EXPENSES];
      if (params?.ngo_id) filtered = filtered.filter(e => e.ngo_id === params.ngo_id);
      if (params?.project_id) filtered = filtered.filter(e => e.project_id === params.project_id);
      if (params?.status) filtered = filtered.filter(e => e.status.toUpperCase() === params.status?.toUpperCase());
      if (params?.category) filtered = filtered.filter(e => e.category.toLowerCase().includes(params.category!.toLowerCase()));
      if (params?.search) {
        const s = params.search.toLowerCase();
        filtered = filtered.filter(
          e =>
            e.title.toLowerCase().includes(s) ||
            e.vendor_name?.toLowerCase().includes(s) ||
            e.invoice_number?.toLowerCase().includes(s) ||
            e.project_title?.toLowerCase().includes(s) ||
            e.receipt_hash?.toLowerCase().includes(s)
        );
      }

      const totalAmount = filtered.reduce((acc, curr) => acc + curr.amount, 0);
      const approvedAmount = filtered.filter(e => e.status === 'APPROVED' || e.status === 'REIMBURSED').reduce((acc, curr) => acc + curr.amount, 0);
      const pendingAmount = filtered.filter(e => e.status === 'PENDING').reduce((acc, curr) => acc + curr.amount, 0);

      return {
        items: filtered,
        total: filtered.length,
        total_amount: totalAmount,
        approved_amount: approvedAmount,
        pending_amount: pendingAmount,
        skip: params?.skip || 0,
        limit: params?.limit || 50,
      };
    }
  },

  async submitExpense(data: ExpenseCreate): Promise<Expense> {
    try {
      return await request<Expense>('/expenses/', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    } catch {
      const isApproved = data.status === 'APPROVED';
      const newExp: Expense = {
        id: Date.now(),
        ngo_id: data.ngo_id,
        project_id: data.project_id,
        title: data.title,
        description: data.description,
        category: data.category,
        amount: data.amount,
        currency: data.currency || 'INR',
        payment_mode: data.payment_mode || 'BANK_TRANSFER',
        vendor_name: data.vendor_name,
        invoice_number: data.invoice_number,
        invoice_date: data.invoice_date || new Date().toISOString(),
        receipt_hash: data.receipt_hash || 'Qm' + Math.random().toString(16).slice(2) + Math.random().toString(16).slice(2),
        receipt_url: data.receipt_url,
        status: (data.status as any) || 'PENDING',
        is_verified: isApproved,
        verified_at: isApproved ? new Date().toISOString() : undefined,
        tx_hash: isApproved ? '0x' + Math.random().toString(16).slice(2) + Math.random().toString(16).slice(2) : undefined,
        created_at: new Date().toISOString(),
      };
      FALLBACK_EXPENSES.unshift(newExp);
      return newExp;
    }
  },

  async getExpense(id: number): Promise<Expense> {
    try {
      return await request<Expense>(`/expenses/${id}`);
    } catch {
      const match = FALLBACK_EXPENSES.find(e => e.id === id);
      if (!match) throw new Error('Expense not found');
      return match;
    }
  },

  async updateExpense(id: number, data: ExpenseUpdate): Promise<Expense> {
    try {
      return await request<Expense>(`/expenses/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
    } catch {
      const exp = FALLBACK_EXPENSES.find(e => e.id === id);
      if (!exp) throw new Error('Expense not found');
      Object.assign(exp, data);
      return exp;
    }
  },

  async updateExpenseStatus(id: number, data: ExpenseStatusUpdate): Promise<Expense> {
    try {
      return await request<Expense>(`/expenses/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
    } catch {
      const exp = FALLBACK_EXPENSES.find(e => e.id === id);
      if (!exp) throw new Error('Expense not found');
      exp.status = data.status;
      exp.review_notes = data.review_notes;
      exp.reviewed_by = data.reviewed_by || 'Auditor';
      if (data.status === 'APPROVED' || data.status === 'REIMBURSED') {
        exp.is_verified = true;
        exp.verified_at = new Date().toISOString();
        if (!exp.tx_hash) {
          exp.tx_hash = '0x' + Math.random().toString(16).slice(2) + Math.random().toString(16).slice(2);
        }
      } else {
        exp.is_verified = false;
      }
      return exp;
    }
  },

  async getExpenseStats(ngoId?: number, projectId?: number): Promise<ExpenseStats> {
    try {
      const q = new URLSearchParams();
      if (ngoId) q.set('ngo_id', String(ngoId));
      if (projectId) q.set('project_id', String(projectId));
      const qs = q.toString() ? `?${q.toString()}` : '';
      return await request<ExpenseStats>(`/expenses/stats/summary${qs}`);
    } catch {
      const totalAmount = FALLBACK_EXPENSES.reduce((sum, e) => sum + e.amount, 0);
      const approved = FALLBACK_EXPENSES.filter(e => e.status === 'APPROVED').reduce((sum, e) => sum + e.amount, 0);
      const pending = FALLBACK_EXPENSES.filter(e => e.status === 'PENDING').reduce((sum, e) => sum + e.amount, 0);

      return {
        total_expenses_count: FALLBACK_EXPENSES.length,
        total_amount: totalAmount,
        approved_amount: approved,
        pending_amount: pending,
        rejected_amount: 0,
        currency: 'INR',
        by_category: [
          { category: 'Hardware', count: 1, amount: 185000 },
          { category: 'Training', count: 1, amount: 95000 },
          { category: 'Materials', count: 1, amount: 64000 },
          { category: 'Medical', count: 1, amount: 120000 },
          { category: 'Logistics', count: 1, amount: 38000 },
        ],
        by_project: [
          { project_id: 1, project_title: 'Digital Classrooms for Rural Vidarbha', count: 3, amount: 344000 },
          { project_id: 2, project_title: 'Mobile Medical Van & Diagnostic Camps', count: 2, amount: 158000 },
        ],
        recent_expenses: FALLBACK_EXPENSES.slice(0, 5),
      };
    }
  },

  async deleteExpense(id: number): Promise<boolean> {
    try {
      await request(`/expenses/${id}`, { method: 'DELETE' });
      return true;
    } catch {
      const idx = FALLBACK_EXPENSES.findIndex(e => e.id === id);
      if (idx !== -1) FALLBACK_EXPENSES.splice(idx, 1);
      return true;
    }
  },
};
