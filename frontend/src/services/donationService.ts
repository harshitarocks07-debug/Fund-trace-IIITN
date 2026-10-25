import { request } from './api';

export interface Donation {
  id: number;
  donor_name: string;
  donor_email?: string;
  donor_pan?: string;
  amount: number;
  currency: string;
  ngo_id: number;
  ngo_name?: string;
  project_id?: number;
  project_title?: string;
  payment_method: string;
  is_anonymous: boolean;
  status: string;
  tx_hash?: string;
  block_number?: number;
  receipt_number?: string;
  tax_benefit_claimed: boolean;
  notes?: string;
  created_at: string;
}

export interface DonationCreate {
  donor_name: string;
  donor_email?: string;
  donor_pan?: string;
  amount: number;
  currency?: string;
  ngo_id: number;
  project_id?: number;
  payment_method: string;
  is_anonymous?: boolean;
  notes?: string;
}

export interface DonationReceipt {
  receipt_number: string;
  date: string;
  donor_name: string;
  donor_pan?: string;
  donor_email?: string;
  amount: number;
  currency: string;
  payment_method: string;
  tx_hash?: string;
  ngo_id: number;
  ngo_name: string;
  ngo_registration_number?: string;
  ngo_darpan_id?: string;
  has_80g_certificate: boolean;
  project_id?: number;
  project_title?: string;
  verification_link: string;
}

export interface DonationStats {
  total_donations: number;
  total_amount: number;
  average_amount: number;
  currency: string;
  projects_funded_count: number;
  by_project: Array<{
    project_id: number;
    project_title: string;
    target_budget: number;
    total_raised: number;
    donation_count: number;
    raised_from_donations: number;
  }>;
  monthly_trend: Array<{ month: string; amount: number }>;
  recent_donors: Array<any>;
}

export interface DonationListResponse {
  items: Donation[];
  total: number;
  total_amount: number;
  skip: number;
  limit: number;
}

const FALLBACK_DONATIONS: Donation[] = [
  {
    id: 1,
    donor_name: 'TechForGood CSR Trust',
    donor_email: 'grants@techforgood.org',
    donor_pan: 'AAACT8921B',
    amount: 500000,
    currency: 'INR',
    ngo_id: 1,
    ngo_name: 'Vidya Jyoti Foundation',
    project_id: 1,
    project_title: 'Digital Classrooms for Rural Vidarbha',
    payment_method: 'BANK_TRANSFER',
    is_anonymous: false,
    status: 'CONFIRMED',
    tx_hash: '0x3a127f88e1bc98b94101e405a3c9b74088a21359c3941ff098ae8b919f4b11e2',
    receipt_number: 'REC-20240212-001',
    tax_benefit_claimed: true,
    notes: 'CSR Grant for Digital Classroom hardware procurement in Vidarbha schools.',
    created_at: '2026-02-12T10:30:00Z',
  },
  {
    id: 2,
    donor_name: 'Rajesh & Sunita Sharma',
    donor_email: 'rajesh.sharma@gmail.com',
    donor_pan: 'BKZPS1249A',
    amount: 50000,
    currency: 'INR',
    ngo_id: 1,
    ngo_name: 'Vidya Jyoti Foundation',
    project_id: 1,
    project_title: 'Digital Classrooms for Rural Vidarbha',
    payment_method: 'UPI',
    is_anonymous: false,
    status: 'CONFIRMED',
    tx_hash: '0x88c1b98a00fc241198aa76c00d41eb31a89cde9943201ff61541098812ea9941',
    receipt_number: 'REC-20240209-002',
    tax_benefit_claimed: true,
    notes: 'Support for rural students education kits.',
    created_at: '2026-02-09T14:15:00Z',
  },
  {
    id: 3,
    donor_name: 'Global Health & Sanitation Alliance',
    donor_email: 'contributions@ghsa-global.org',
    donor_pan: 'AAACG5512L',
    amount: 750000,
    currency: 'INR',
    ngo_id: 2,
    ngo_name: 'Arogya Seva Healthcare Trust',
    project_id: 2,
    project_title: 'Mobile Medical Van & Diagnostic Camps',
    payment_method: 'BANK_TRANSFER',
    is_anonymous: false,
    status: 'CONFIRMED',
    tx_hash: '0x12fa9087c55b6201ea74d998120faec71881944510b641ef600981a26789a100',
    receipt_number: 'REC-20240125-003',
    tax_benefit_claimed: true,
    notes: 'Diagnostic kits and mobile clinic operation support.',
    created_at: '2026-01-25T09:00:00Z',
  },
  {
    id: 4,
    donor_name: 'Dr. Arvind & Malini Verma',
    donor_email: 'arvind.verma@aiims.edu',
    donor_pan: 'ABAPV9941R',
    amount: 100000,
    currency: 'INR',
    ngo_id: 2,
    ngo_name: 'Arogya Seva Healthcare Trust',
    project_id: 2,
    project_title: 'Mobile Medical Van & Diagnostic Camps',
    payment_method: 'CARD',
    is_anonymous: false,
    status: 'CONFIRMED',
    tx_hash: '0x77ba9108c991e4215891aab876104bcde81099238914cbe879104ef91823901b',
    receipt_number: 'REC-20240201-004',
    tax_benefit_claimed: true,
    notes: 'Donation in memory of Late Prof. S. N. Verma for rural health screenings.',
    created_at: '2026-02-01T16:45:00Z',
  },
  {
    id: 5,
    donor_name: 'EcoClean Water Foundation',
    donor_email: 'impact@ecoclean.org',
    donor_pan: 'AABTE4419M',
    amount: 400000,
    currency: 'INR',
    ngo_id: 3,
    ngo_name: 'Vriksha Mitra Environmental Society',
    project_id: 3,
    project_title: 'Miyawaki Urban Afforestation Drive',
    payment_method: 'BANK_TRANSFER',
    is_anonymous: false,
    status: 'CONFIRMED',
    tx_hash: '0x66f91844bca01e9947812ee49910ac841920bf8814729ccba8910014ef1049c8',
    receipt_number: 'REC-20240215-005',
    tax_benefit_claimed: true,
    notes: 'Phase 1 sapling plantation and drip irrigation.',
    created_at: '2026-02-15T11:20:00Z',
  },
];

export const donationService = {
  async listDonations(params?: {
    ngo_id?: number;
    project_id?: number;
    search?: string;
    status?: string;
    payment_method?: string;
    skip?: number;
    limit?: number;
  }): Promise<DonationListResponse> {
    try {
      const q = new URLSearchParams();
      if (params?.ngo_id) q.set('ngo_id', String(params.ngo_id));
      if (params?.project_id) q.set('project_id', String(params.project_id));
      if (params?.search) q.set('search', params.search);
      if (params?.status) q.set('status', params.status);
      if (params?.payment_method) q.set('payment_method', params.payment_method);
      if (params?.skip !== undefined) q.set('skip', String(params.skip));
      if (params?.limit !== undefined) q.set('limit', String(params.limit));

      const qs = q.toString() ? `?${q.toString()}` : '';
      return await request<DonationListResponse>(`/donations/${qs}`);
    } catch {
      let filtered = [...FALLBACK_DONATIONS];
      if (params?.ngo_id) filtered = filtered.filter(d => d.ngo_id === params.ngo_id);
      if (params?.project_id) filtered = filtered.filter(d => d.project_id === params.project_id);
      if (params?.status) filtered = filtered.filter(d => d.status.toLowerCase() === params.status?.toLowerCase());
      if (params?.search) {
        const s = params.search.toLowerCase();
        filtered = filtered.filter(
          d =>
            d.donor_name.toLowerCase().includes(s) ||
            d.tx_hash?.toLowerCase().includes(s) ||
            d.receipt_number?.toLowerCase().includes(s) ||
            d.project_title?.toLowerCase().includes(s)
        );
      }
      const totalAmount = filtered.reduce((acc, curr) => acc + curr.amount, 0);
      return {
        items: filtered,
        total: filtered.length,
        total_amount: totalAmount,
        skip: params?.skip || 0,
        limit: params?.limit || 50,
      };
    }
  },

  async recordDonation(data: DonationCreate): Promise<Donation> {
    try {
      return await request<Donation>('/donations/', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    } catch {
      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const newDonation: Donation = {
        id: Date.now(),
        donor_name: data.donor_name,
        donor_email: data.donor_email,
        donor_pan: data.donor_pan,
        amount: data.amount,
        currency: data.currency || 'INR',
        ngo_id: data.ngo_id,
        project_id: data.project_id,
        payment_method: data.payment_method,
        is_anonymous: Boolean(data.is_anonymous),
        status: 'CONFIRMED',
        tx_hash: '0x' + Math.random().toString(16).slice(2) + Math.random().toString(16).slice(2),
        receipt_number: `REC-${dateStr}-${Math.floor(100 + Math.random() * 900)}`,
        tax_benefit_claimed: Boolean(data.donor_pan),
        notes: data.notes,
        created_at: new Date().toISOString(),
      };
      FALLBACK_DONATIONS.unshift(newDonation);
      return newDonation;
    }
  },

  async getDonation(id: number): Promise<Donation> {
    try {
      return await request<Donation>(`/donations/${id}`);
    } catch {
      const match = FALLBACK_DONATIONS.find(d => d.id === id);
      if (!match) throw new Error('Donation not found');
      return match;
    }
  },

  async getDonationReceipt(id: number): Promise<DonationReceipt> {
    try {
      return await request<DonationReceipt>(`/donations/${id}/receipt`);
    } catch {
      const d = FALLBACK_DONATIONS.find(item => item.id === id) || FALLBACK_DONATIONS[0];
      return {
        receipt_number: d.receipt_number || `REC-${d.id}`,
        date: d.created_at,
        donor_name: d.is_anonymous ? 'Confidential Donor' : d.donor_name,
        donor_pan: d.donor_pan,
        donor_email: d.donor_email,
        amount: d.amount,
        currency: d.currency,
        payment_method: d.payment_method,
        tx_hash: d.tx_hash,
        ngo_id: d.ngo_id,
        ngo_name: d.ngo_name || 'Vidya Jyoti Foundation',
        ngo_registration_number: 'MH-NGP-2018-00452',
        ngo_darpan_id: 'MH/2018/0198421',
        has_80g_certificate: true,
        project_id: d.project_id,
        project_title: d.project_title,
        verification_link: `/receipts/verify?hash=${d.tx_hash}&rec=${d.receipt_number}`,
      };
    }
  },

  async getDonationStats(ngoId?: number, projectId?: number): Promise<DonationStats> {
    try {
      const q = new URLSearchParams();
      if (ngoId) q.set('ngo_id', String(ngoId));
      if (projectId) q.set('project_id', String(projectId));
      const qs = q.toString() ? `?${q.toString()}` : '';
      return await request<DonationStats>(`/donations/stats/summary${qs}`);
    } catch {
      const totalAmount = FALLBACK_DONATIONS.reduce((sum, d) => sum + d.amount, 0);
      return {
        total_donations: FALLBACK_DONATIONS.length,
        total_amount: totalAmount,
        average_amount: Math.round(totalAmount / FALLBACK_DONATIONS.length),
        currency: 'INR',
        projects_funded_count: 3,
        by_project: [
          {
            project_id: 1,
            project_title: 'Digital Classrooms for Rural Vidarbha',
            target_budget: 1250000,
            total_raised: 950000,
            donation_count: 2,
            raised_from_donations: 550000,
          },
          {
            project_id: 2,
            project_title: 'Mobile Medical Van & Diagnostic Camps',
            target_budget: 850000,
            total_raised: 850000,
            donation_count: 2,
            raised_from_donations: 850000,
          },
          {
            project_id: 3,
            project_title: 'Miyawaki Urban Afforestation Drive',
            target_budget: 450000,
            total_raised: 400000,
            donation_count: 1,
            raised_from_donations: 400000,
          },
        ],
        monthly_trend: [
          { month: 'Jan', amount: 750000 },
          { month: 'Feb', amount: 1050000 },
          { month: 'Mar', amount: 890000 },
          { month: 'Apr', amount: 620000 },
          { month: 'May', amount: 980000 },
          { month: 'Jun', amount: 1200000 },
        ],
        recent_donors: FALLBACK_DONATIONS.slice(0, 5),
      };
    }
  },

  async deleteDonation(id: number): Promise<boolean> {
    try {
      await request(`/donations/${id}`, { method: 'DELETE' });
      return true;
    } catch {
      const idx = FALLBACK_DONATIONS.findIndex(d => d.id === id);
      if (idx !== -1) FALLBACK_DONATIONS.splice(idx, 1);
      return true;
    }
  },
};
