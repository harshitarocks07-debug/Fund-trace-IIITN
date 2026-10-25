import { request } from './api';

export interface NGOProfile {
  id: number;
  user_id?: number | null;
  name: string;
  legal_name?: string | null;
  registration_number: string;
  darpan_id?: string | null;
  pan_number?: string | null;
  category: string;
  mission?: string | null;
  vision?: string | null;
  description?: string | null;
  founding_year?: number | null;
  contact_email: string;
  contact_phone: string;
  website?: string | null;
  logo_url?: string | null;
  cover_image_url?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
  country: string;
  operating_regions?: string | null;
  bank_name?: string | null;
  bank_account_number?: string | null;
  bank_ifsc?: string | null;
  wallet_address?: string | null;
  verification_status: 'PENDING' | 'VERIFIED' | 'REJECTED' | 'SUSPENDED';
  verification_notes?: string | null;
  verified_at?: string | null;
  verified_by_user_id?: number | null;
  has_80g_certificate: boolean;
  has_12a_certificate: boolean;
  has_fcra_registration: boolean;
  fcra_number?: string | null;
  transparency_score: number;
  total_funds_received: number;
  total_funds_utilized: number;
  active_projects_count: number;
  beneficiaries_count: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface NGOListResponse {
  items: NGOProfile[];
  total: number;
  skip: number;
  limit: number;
}

export interface NGOStats {
  ngo_id: number;
  name: string;
  total_funds_received: number;
  total_funds_utilized: number;
  utilization_rate: number;
  active_projects_count: number;
  beneficiaries_count: number;
  transparency_score: number;
  verification_status: string;
  compliance: {
    has_80g: boolean;
    has_12a: boolean;
    has_fcra: boolean;
    fcra_number?: string | null;
    darpan_id?: string | null;
    wallet_registered: boolean;
  };
}

// Fallback initial dataset if backend is unreachable during demo
const MOCK_NGOS: NGOProfile[] = [
  {
    id: 1,
    name: 'Vidya Jyoti Foundation',
    legal_name: 'Vidya Jyoti Educational Trust India',
    registration_number: 'MH-NGP-2018-00452',
    darpan_id: 'MH/2018/0198421',
    pan_number: 'AAATV1234F',
    category: 'Education',
    mission: 'Empowering underprivileged children with tech-enabled modern education and digital literacy across rural Maharashtra.',
    vision: 'A world where quality education is accessible to every child regardless of socio-economic background.',
    description: 'Vidya Jyoti runs 28 digital community classrooms, provides stem kits, and trains teachers in rural school districts.',
    founding_year: 2018,
    contact_email: 'contact@vidyajyoti.org',
    contact_phone: '+91-98234-56789',
    website: 'https://vidyajyoti.org',
    logo_url: 'https://images.unsplash.com/photo-1577896851231-70ef18881754?auto=format&fit=crop&w=150&q=80',
    address: '14, Seminary Hills',
    city: 'Nagpur',
    state: 'Maharashtra',
    pincode: '440006',
    country: 'India',
    operating_regions: 'Nagpur, Wardha, Bhandara, Chandrapur',
    bank_name: 'State Bank of India',
    bank_account_number: '309182390112',
    bank_ifsc: 'SBIN0004512',
    wallet_address: '0x71C84013476f5b783abE7C351724C164539Db89a',
    verification_status: 'VERIFIED',
    verification_notes: 'All legal documents, 80G, 12A, and Darpan ID verified by National Auditor Board.',
    verified_at: '2026-01-15T10:00:00Z',
    has_80g_certificate: true,
    has_12a_certificate: true,
    has_fcra_registration: true,
    fcra_number: '083780512',
    transparency_score: 95.0,
    total_funds_received: 4500000,
    total_funds_utilized: 3820000,
    active_projects_count: 6,
    beneficiaries_count: 12400,
    is_active: true,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-02-10T00:00:00Z',
  },
  {
    id: 2,
    name: 'Arogya Seva Trust',
    legal_name: 'Arogya Seva Healthcare & Relief Foundation',
    registration_number: 'DL-ND-2020-00918',
    darpan_id: 'DL/2020/0248102',
    pan_number: 'AABCA5678K',
    category: 'Healthcare',
    mission: 'Delivering preventive healthcare, mobile diagnostic clinics, and critical medicine supply to tribal and remote areas.',
    vision: 'Universal health coverage and zero preventable deaths from lack of primary medical care.',
    description: 'Operates a fleet of 12 mobile clinics equipped with tele-medicine facilities and basic path labs.',
    founding_year: 2020,
    contact_email: 'info@arogyaseva.org',
    contact_phone: '+91-98101-23456',
    website: 'https://arogyaseva.org',
    logo_url: 'https://images.unsplash.com/photo-1584515979956-d9f6e5d09982?auto=format&fit=crop&w=150&q=80',
    address: 'Plot 55, Institutional Area, Sector 44',
    city: 'Gurugram',
    state: 'Haryana',
    pincode: '122003',
    country: 'India',
    operating_regions: 'NCR, Rajasthan, Haryana, Himachal Pradesh',
    bank_name: 'HDFC Bank',
    bank_account_number: '50200038918273',
    bank_ifsc: 'HDFC0001204',
    wallet_address: '0x28C6c06298d514Db089934071355E5743bf21d60',
    verification_status: 'VERIFIED',
    verification_notes: 'Tax certificates and medical officer oversight verified.',
    verified_at: '2026-02-01T12:00:00Z',
    has_80g_certificate: true,
    has_12a_certificate: true,
    has_fcra_registration: false,
    transparency_score: 90.0,
    total_funds_received: 7800000,
    total_funds_utilized: 6950000,
    active_projects_count: 8,
    beneficiaries_count: 35000,
    is_active: true,
    created_at: '2026-01-05T00:00:00Z',
    updated_at: '2026-02-12T00:00:00Z',
  },
  {
    id: 3,
    name: 'Vana Raksha Mission',
    legal_name: 'Vana Raksha Ecology & Reforestation Society',
    registration_number: 'KA-BLR-2022-00312',
    darpan_id: 'KA/2022/0311490',
    pan_number: 'AAACV9012M',
    category: 'Environment',
    mission: 'Reforesting degraded western ghats corridors and fostering community-led water shed management.',
    vision: 'Restored biodiversity corridors and carbon-neutral self-sustaining community forests.',
    description: 'Planted over 300,000 native species trees with geotagged tracking and survival monitoring.',
    founding_year: 2022,
    contact_email: 'grow@vanaraksha.eco',
    contact_phone: '+91-98450-89123',
    website: 'https://vanaraksha.eco',
    logo_url: 'https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?auto=format&fit=crop&w=150&q=80',
    address: '72, Eco Green Hub, Indiranagar',
    city: 'Bengaluru',
    state: 'Karnataka',
    pincode: '560038',
    country: 'India',
    operating_regions: 'Karnataka Western Ghats, Nilgiris',
    bank_name: 'ICICI Bank',
    bank_account_number: '000201589302',
    bank_ifsc: 'ICIC0000002',
    wallet_address: '0x1F98431c8aD98523631AE4a59f267346ea31F984',
    verification_status: 'PENDING',
    verification_notes: 'Registration submitted; awaiting field inspection report.',
    has_80g_certificate: true,
    has_12a_certificate: true,
    has_fcra_registration: false,
    transparency_score: 80.0,
    total_funds_received: 2100000,
    total_funds_utilized: 1500000,
    active_projects_count: 3,
    beneficiaries_count: 8500,
    is_active: true,
    created_at: '2026-02-01T00:00:00Z',
    updated_at: '2026-02-14T00:00:00Z',
  }
];

export const ngoService = {
  async listNGOs(params?: {
    search?: string;
    category?: string;
    status?: string;
    city?: string;
    skip?: number;
    limit?: number;
  }): Promise<NGOListResponse> {
    const query = new URLSearchParams();
    if (params?.search) query.set('search', params.search);
    if (params?.category) query.set('category', params.category);
    if (params?.status) query.set('status', params.status);
    if (params?.city) query.set('city', params.city);
    if (params?.skip !== undefined) query.set('skip', params.skip.toString());
    if (params?.limit !== undefined) query.set('limit', params.limit.toString());

    const qs = query.toString();
    const endpoint = `/ngos/${qs ? `?${qs}` : ''}`;

    try {
      return await request<NGOListResponse>(endpoint);
    } catch {
      // Return filtered mock data on backend failure
      let filtered = [...MOCK_NGOS];
      if (params?.search) {
        const s = params.search.toLowerCase();
        filtered = filtered.filter(n => n.name.toLowerCase().includes(s) || n.registration_number.toLowerCase().includes(s) || (n.city && n.city.toLowerCase().includes(s)));
      }
      if (params?.category && params.category !== 'all') {
        filtered = filtered.filter(n => n.category.toLowerCase() === params.category?.toLowerCase());
      }
      if (params?.status && params.status !== 'all') {
        filtered = filtered.filter(n => n.verification_status.toLowerCase() === params.status?.toLowerCase());
      }
      return {
        items: filtered,
        total: filtered.length,
        skip: params?.skip || 0,
        limit: params?.limit || 50,
      };
    }
  },

  async getNGOById(id: number): Promise<NGOProfile> {
    try {
      return await request<NGOProfile>(`/ngos/${id}`);
    } catch {
      const found = MOCK_NGOS.find(n => n.id === id);
      if (found) return found;
      throw new Error(`NGO with id ${id} not found`);
    }
  },

  async getMyProfile(): Promise<NGOProfile> {
    try {
      return await request<NGOProfile>('/ngos/me');
    } catch {
      return MOCK_NGOS[0];
    }
  },

  async createNGO(data: Partial<NGOProfile>): Promise<NGOProfile> {
    try {
      return await request<NGOProfile>('/ngos/', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    } catch {
      const newNgo: NGOProfile = {
        id: Date.now(),
        name: data.name || 'New NGO',
        legal_name: data.legal_name || data.name,
        registration_number: data.registration_number || `REG-${Date.now()}`,
        darpan_id: data.darpan_id,
        pan_number: data.pan_number,
        category: data.category || 'Education',
        mission: data.mission,
        vision: data.vision,
        description: data.description,
        founding_year: data.founding_year || 2024,
        contact_email: data.contact_email || 'contact@ngo.org',
        contact_phone: data.contact_phone || '+91-00000-00000',
        website: data.website,
        logo_url: data.logo_url,
        cover_image_url: data.cover_image_url,
        address: data.address,
        city: data.city,
        state: data.state,
        pincode: data.pincode,
        country: data.country || 'India',
        operating_regions: data.operating_regions,
        bank_name: data.bank_name,
        bank_account_number: data.bank_account_number,
        bank_ifsc: data.bank_ifsc,
        wallet_address: data.wallet_address,
        verification_status: 'PENDING',
        verification_notes: 'Under initial review',
        has_80g_certificate: !!data.has_80g_certificate,
        has_12a_certificate: !!data.has_12a_certificate,
        has_fcra_registration: !!data.has_fcra_registration,
        fcra_number: data.fcra_number,
        transparency_score: 70.0,
        total_funds_received: 0,
        total_funds_utilized: 0,
        active_projects_count: 0,
        beneficiaries_count: 0,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      MOCK_NGOS.unshift(newNgo);
      return newNgo;
    }
  },

  async updateNGO(id: number, data: Partial<NGOProfile>): Promise<NGOProfile> {
    try {
      return await request<NGOProfile>(`/ngos/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
    } catch {
      const idx = MOCK_NGOS.findIndex(n => n.id === id);
      if (idx !== -1) {
        MOCK_NGOS[idx] = { ...MOCK_NGOS[idx], ...data, updated_at: new Date().toISOString() };
        return MOCK_NGOS[idx];
      }
      throw new Error(`NGO ${id} not found`);
    }
  },

  async updateNGOStatus(id: number, status: string, notes?: string): Promise<NGOProfile> {
    try {
      return await request<NGOProfile>(`/ngos/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ verification_status: status, verification_notes: notes }),
      });
    } catch {
      const idx = MOCK_NGOS.findIndex(n => n.id === id);
      if (idx !== -1) {
        MOCK_NGOS[idx].verification_status = status as any;
        if (notes) MOCK_NGOS[idx].verification_notes = notes;
        if (status === 'VERIFIED') {
          MOCK_NGOS[idx].verified_at = new Date().toISOString();
          MOCK_NGOS[idx].transparency_score = Math.min(100, MOCK_NGOS[idx].transparency_score + 15);
        }
        return MOCK_NGOS[idx];
      }
      throw new Error(`NGO ${id} not found`);
    }
  },

  async getNGOStats(id: number): Promise<NGOStats> {
    try {
      return await request<NGOStats>(`/ngos/${id}/stats`);
    } catch {
      const ngo = await this.getNGOById(id);
      const utilization_rate = ngo.total_funds_received > 0 ? (ngo.total_funds_utilized / ngo.total_funds_received) * 100 : 0;
      return {
        ngo_id: ngo.id,
        name: ngo.name,
        total_funds_received: ngo.total_funds_received,
        total_funds_utilized: ngo.total_funds_utilized,
        utilization_rate: Math.round(utilization_rate * 10) / 10,
        active_projects_count: ngo.active_projects_count,
        beneficiaries_count: ngo.beneficiaries_count,
        transparency_score: ngo.transparency_score,
        verification_status: ngo.verification_status,
        compliance: {
          has_80g: ngo.has_80g_certificate,
          has_12a: ngo.has_12a_certificate,
          has_fcra: ngo.has_fcra_registration,
          fcra_number: ngo.fcra_number,
          darpan_id: ngo.darpan_id,
          wallet_registered: !!ngo.wallet_address,
        },
      };
    }
  },
};

