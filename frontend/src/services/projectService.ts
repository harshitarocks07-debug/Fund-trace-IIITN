import { request } from './api';

export interface Project {
  id: number;
  ngo_id: number;
  title: string;
  description?: string | null;
  category: string;
  target_budget: number;
  raised_amount: number;
  utilized_amount: number;
  status: 'PLANNING' | 'ACTIVE' | 'COMPLETED' | 'PAUSED' | 'CANCELLED';
  start_date?: string | null;
  end_date?: string | null;
  location?: string | null;
  beneficiaries_target: number;
  beneficiaries_reached: number;
  milestones?: string | null;
  wallet_address?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  ngo_name?: string | null;
  funding_progress_pct?: number;
  budget_utilization_pct?: number;
  remaining_budget?: number;
}

export interface ProjectListResponse {
  items: Project[];
  total: number;
  skip: number;
  limit: number;
}

export interface ProjectBudgetSummary {
  project_id: number;
  title: string;
  target_budget: number;
  raised_amount: number;
  utilized_amount: number;
  funding_percentage: number;
  utilization_percentage: number;
  unutilized_funds: number;
  budget_gap: number;
  status: string;
  beneficiaries_target: number;
  beneficiaries_reached: number;
}

const MOCK_PROJECTS: Project[] = [
  {
    id: 1,
    ngo_id: 1,
    title: 'Rural Digital Classrooms 2026',
    description: 'Deploying solar-powered digital tablets, educational software, and interactive projector units across 28 rural Zilla Parishad schools in Vidarbha.',
    category: 'Education',
    target_budget: 1500000,
    raised_amount: 1250000,
    utilized_amount: 890000,
    status: 'ACTIVE',
    start_date: '2025-11-15T00:00:00Z',
    end_date: '2026-05-15T00:00:00Z',
    location: 'Nagpur & Wardha, Maharashtra',
    beneficiaries_target: 3500,
    beneficiaries_reached: 2200,
    milestones: 'M1: Solar Unit Installs (Done), M2: Tablet Distribution (Done), M3: Teacher Pedagogy Training (Ongoing)',
    wallet_address: '0x89205A3A3b2A69De6Dbf7f01ED13B2108B2c43e7',
    is_active: true,
    created_at: '2025-11-01T00:00:00Z',
    updated_at: '2026-02-10T00:00:00Z',
    ngo_name: 'Vidya Jyoti Foundation',
    funding_progress_pct: 83.33,
    budget_utilization_pct: 71.2,
    remaining_budget: 250000,
  },
  {
    id: 2,
    ngo_id: 1,
    title: 'STEM Science & Robotics Kits',
    description: 'Equipping secondary school student laboratories with hands-on mechanics, electronics, and coding starter packages.',
    category: 'Education',
    target_budget: 600000,
    raised_amount: 600000,
    utilized_amount: 600000,
    status: 'COMPLETED',
    start_date: '2025-08-01T00:00:00Z',
    end_date: '2026-01-20T00:00:00Z',
    location: 'Bhandara, Maharashtra',
    beneficiaries_target: 1200,
    beneficiaries_reached: 1250,
    milestones: 'Procurement (Done), Delivery (Done), Teacher Workshops (Done), Final Audit (Done)',
    wallet_address: '0x2546BcD3c84621e976D8185a91A922aE77ECEc30',
    is_active: true,
    created_at: '2025-07-15T00:00:00Z',
    updated_at: '2026-01-22T00:00:00Z',
    ngo_name: 'Vidya Jyoti Foundation',
    funding_progress_pct: 100.0,
    budget_utilization_pct: 100.0,
    remaining_budget: 0,
  },
  {
    id: 3,
    ngo_id: 2,
    title: 'Mobile Diagnostic Health Van Fleet',
    description: 'Deploying tele-diagnostic medical vans with ECG, CBC analysis, and blood glucose meters to tribal communities.',
    category: 'Healthcare',
    target_budget: 2400000,
    raised_amount: 2100000,
    utilized_amount: 1750000,
    status: 'ACTIVE',
    start_date: '2025-10-01T00:00:00Z',
    end_date: '2026-04-30T00:00:00Z',
    location: 'Mewat & Alwar Districts',
    beneficiaries_target: 15000,
    beneficiaries_reached: 11800,
    milestones: 'Vehicle Customization (Done), Medical Device Setup (Done), Community Camps (Ongoing)',
    wallet_address: '0xb47e3cd837dDF8e4c57F05d70Ab865de6e193BBB',
    is_active: true,
    created_at: '2025-09-20T00:00:00Z',
    updated_at: '2026-02-14T00:00:00Z',
    ngo_name: 'Arogya Seva Trust',
    funding_progress_pct: 87.5,
    budget_utilization_pct: 83.33,
    remaining_budget: 300000,
  },
  {
    id: 4,
    ngo_id: 3,
    title: 'Western Ghats Agro-Forestry Corridor',
    description: 'Planting 100,000 indigenous fruit-bearing and endemic tree saplings with geo-tagged survival verification.',
    category: 'Environment',
    target_budget: 1200000,
    raised_amount: 450000,
    utilized_amount: 200000,
    status: 'PLANNING',
    start_date: '2026-03-01T00:00:00Z',
    end_date: '2026-09-30T00:00:00Z',
    location: 'Coorg & Wayanad',
    beneficiaries_target: 5000,
    beneficiaries_reached: 0,
    milestones: 'Nursery Prep (Ongoing), Community Land Demarcation (Done), Sapling Plantation (Pending)',
    wallet_address: '0x0D8775F648430679A709E98d2b0Cb6250d2887EF',
    is_active: true,
    created_at: '2026-01-10T00:00:00Z',
    updated_at: '2026-02-01T00:00:00Z',
    ngo_name: 'Vana Raksha Mission',
    funding_progress_pct: 37.5,
    budget_utilization_pct: 44.44,
    remaining_budget: 750000,
  },
];

export const projectService = {
  async listProjects(params?: {
    ngo_id?: number;
    status?: string;
    category?: string;
    search?: string;
    skip?: number;
    limit?: number;
  }): Promise<ProjectListResponse> {
    const query = new URLSearchParams();
    if (params?.ngo_id) query.set('ngo_id', params.ngo_id.toString());
    if (params?.status && params.status !== 'all') query.set('status', params.status);
    if (params?.category && params.category !== 'all') query.set('category', params.category);
    if (params?.search) query.set('search', params.search);
    if (params?.skip !== undefined) query.set('skip', params.skip.toString());
    if (params?.limit !== undefined) query.set('limit', params.limit.toString());

    const qs = query.toString();
    const endpoint = `/projects/${qs ? `?${qs}` : ''}`;

    try {
      return await request<ProjectListResponse>(endpoint);
    } catch {
      let filtered = [...MOCK_PROJECTS];
      if (params?.ngo_id) {
        filtered = filtered.filter((p) => p.ngo_id === params.ngo_id);
      }
      if (params?.status && params.status !== 'all') {
        filtered = filtered.filter((p) => p.status.toUpperCase() === params.status?.toUpperCase());
      }
      if (params?.category && params.category !== 'all') {
        filtered = filtered.filter((p) => p.category.toLowerCase() === params.category?.toLowerCase());
      }
      if (params?.search) {
        const s = params.search.toLowerCase();
        filtered = filtered.filter(
          (p) =>
            p.title.toLowerCase().includes(s) ||
            (p.description && p.description.toLowerCase().includes(s)) ||
            (p.location && p.location.toLowerCase().includes(s))
        );
      }
      return {
        items: filtered,
        total: filtered.length,
        skip: params?.skip || 0,
        limit: params?.limit || 50,
      };
    }
  },

  async getProject(id: number): Promise<Project> {
    try {
      return await request<Project>(`/projects/${id}`);
    } catch {
      const found = MOCK_PROJECTS.find((p) => p.id === id);
      if (found) return found;
      throw new Error(`Project with ID ${id} not found.`);
    }
  },

  async createProject(data: {
    ngo_id: number;
    title: string;
    description?: string;
    category: string;
    target_budget: number;
    status?: string;
    start_date?: string;
    end_date?: string;
    location?: string;
    beneficiaries_target?: number;
    milestones?: string;
    wallet_address?: string;
  }): Promise<Project> {
    try {
      return await request<Project>('/projects/', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    } catch {
      const newProj: Project = {
        id: Date.now(),
        ngo_id: data.ngo_id,
        title: data.title,
        description: data.description,
        category: data.category || 'Education',
        target_budget: data.target_budget,
        raised_amount: 0,
        utilized_amount: 0,
        status: (data.status as any) || 'PLANNING',
        start_date: data.start_date,
        end_date: data.end_date,
        location: data.location,
        beneficiaries_target: data.beneficiaries_target || 0,
        beneficiaries_reached: 0,
        milestones: data.milestones,
        wallet_address: data.wallet_address,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        ngo_name: data.ngo_id === 1 ? 'Vidya Jyoti Foundation' : data.ngo_id === 2 ? 'Arogya Seva Trust' : 'NGO Partner',
        funding_progress_pct: 0,
        budget_utilization_pct: 0,
        remaining_budget: data.target_budget,
      };
      MOCK_PROJECTS.unshift(newProj);
      return newProj;
    }
  },

  async updateProject(id: number, data: Partial<Project>): Promise<Project> {
    try {
      return await request<Project>(`/projects/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
    } catch {
      const idx = MOCK_PROJECTS.findIndex((p) => p.id === id);
      if (idx !== -1) {
        const updated = { ...MOCK_PROJECTS[idx], ...data, updated_at: new Date().toISOString() };
        const target = updated.target_budget || 1;
        updated.funding_progress_pct = Math.min(100, Math.round(((updated.raised_amount || 0) / target) * 100));
        updated.budget_utilization_pct =
          updated.raised_amount > 0 ? Math.min(100, Math.round(((updated.utilized_amount || 0) / updated.raised_amount) * 100)) : 0;
        updated.remaining_budget = Math.max(0, updated.target_budget - (updated.raised_amount || 0));
        MOCK_PROJECTS[idx] = updated;
        return updated;
      }
      throw new Error(`Project ${id} not found.`);
    }
  },

  async updateProjectStatus(
    id: number,
    status: string,
    beneficiaries_reached?: number,
    notes?: string
  ): Promise<Project> {
    try {
      return await request<Project>(`/projects/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({
          status,
          beneficiaries_reached,
          status_notes: notes,
        }),
      });
    } catch {
      const idx = MOCK_PROJECTS.findIndex((p) => p.id === id);
      if (idx !== -1) {
        MOCK_PROJECTS[idx].status = status as any;
        if (beneficiaries_reached !== undefined) {
          MOCK_PROJECTS[idx].beneficiaries_reached = beneficiaries_reached;
        }
        MOCK_PROJECTS[idx].updated_at = new Date().toISOString();
        return MOCK_PROJECTS[idx];
      }
      throw new Error(`Project ${id} not found.`);
    }
  },

  async getProjectBudget(id: number): Promise<ProjectBudgetSummary> {
    try {
      return await request<ProjectBudgetSummary>(`/projects/${id}/budget`);
    } catch {
      const p = await this.getProject(id);
      const target = p.target_budget || 1;
      const fundingPct = Math.round(((p.raised_amount || 0) / target) * 100);
      const utilPct = p.raised_amount > 0 ? Math.round(((p.utilized_amount || 0) / p.raised_amount) * 100) : 0;
      return {
        project_id: p.id,
        title: p.title,
        target_budget: p.target_budget,
        raised_amount: p.raised_amount,
        utilized_amount: p.utilized_amount,
        funding_percentage: fundingPct,
        utilization_percentage: utilPct,
        unutilized_funds: Math.max(0, p.raised_amount - p.utilized_amount),
        budget_gap: Math.max(0, p.target_budget - p.raised_amount),
        status: p.status,
        beneficiaries_target: p.beneficiaries_target,
        beneficiaries_reached: p.beneficiaries_reached,
      };
    }
  },

  async deleteProject(id: number): Promise<boolean> {
    try {
      await request(`/projects/${id}`, { method: 'DELETE' });
      return true;
    } catch {
      const idx = MOCK_PROJECTS.findIndex((p) => p.id === id);
      if (idx !== -1) {
        MOCK_PROJECTS.splice(idx, 1);
        return true;
      }
      return false;
    }
  },
};

export default projectService;
