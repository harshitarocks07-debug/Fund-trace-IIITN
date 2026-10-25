import React, { useState, useEffect } from 'react';
import { ngoService, NGOProfile } from '../services/ngoService';
import { StatusBadge } from '../components/StatusBadge';

interface NGOManagementPageProps {
  onSelectNGO: (ngoId: number) => void;
}

export const NGOManagementPage: React.FC<NGOManagementPageProps> = ({ onSelectNGO }) => {
  const [ngos, setNgos] = useState<NGOProfile[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');

  // Modals
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState<boolean>(false);
  const [reviewNGO, setReviewNGO] = useState<NGOProfile | null>(null);
  const [reviewStatus, setReviewStatus] = useState<string>('VERIFIED');
  const [reviewNotes, setReviewNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // New NGO Form
  const [newNGO, setNewNGO] = useState({
    name: '',
    legal_name: '',
    registration_number: '',
    darpan_id: '',
    category: 'Education',
    contact_email: '',
    contact_phone: '',
    website: '',
    city: '',
    state: '',
    mission: '',
    has_80g_certificate: false,
    has_12a_certificate: false,
    wallet_address: '',
  });

  useEffect(() => {
    fetchNGOs();
  }, [searchTerm, selectedCategory, selectedStatus]);

  const fetchNGOs = async () => {
    setLoading(true);
    try {
      const res = await ngoService.listNGOs({
        search: searchTerm || undefined,
        category: selectedCategory !== 'all' ? selectedCategory : undefined,
        status: selectedStatus !== 'all' ? selectedStatus : undefined,
      });
      setNgos(res.items);
      setTotal(res.total);
    } catch (err) {
      console.error('Error fetching NGOs:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNGO = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await ngoService.createNGO(newNGO);
      setIsRegisterModalOpen(false);
      setNewNGO({
        name: '',
        legal_name: '',
        registration_number: '',
        darpan_id: '',
        category: 'Education',
        contact_email: '',
        contact_phone: '',
        website: '',
        city: '',
        state: '',
        mission: '',
        has_80g_certificate: false,
        has_12a_certificate: false,
        wallet_address: '',
      });
      await fetchNGOs();
    } catch (err: any) {
      alert(err.message || 'Error creating NGO');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewNGO) return;
    setIsSubmitting(true);
    try {
      await ngoService.updateNGOStatus(reviewNGO.id, reviewStatus, reviewNotes);
      setReviewNGO(null);
      await fetchNGOs();
    } catch (err: any) {
      alert(err.message || 'Error updating status');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '32px 24px' }}>
      {/* Top Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px',
          marginBottom: '28px',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '6px' }}>
            <h1 style={{ fontSize: '26px', fontWeight: 800, color: '#f8fafc', letterSpacing: '-0.02em', margin: 0 }}>
              NGO Directory & Management
            </h1>
            {total > 0 && (
              <span style={{ fontSize: '12px', fontWeight: 600, backgroundColor: '#334155', color: '#38bdf8', padding: '3px 10px', borderRadius: '12px' }}>
                {total} Registered
              </span>
            )}
          </div>
          <p style={{ fontSize: '14px', color: '#94a3b8', margin: 0 }}>
            Manage registered non-profit organizations, verify compliance documents, and inspect transparency scores.
          </p>
        </div>

        <button
          onClick={() => setIsRegisterModalOpen(true)}
          style={{
            backgroundColor: '#3b82f6',
            color: '#fff',
            padding: '10px 20px',
            borderRadius: '8px',
            border: 'none',
            fontWeight: 600,
            fontSize: '14px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)',
          }}
        >
          <span>➕</span> Register New NGO
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div
        style={{
          backgroundColor: '#1e293b',
          border: '1px solid #334155',
          borderRadius: '12px',
          padding: '18px 20px',
          marginBottom: '28px',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '16px',
          alignItems: 'center',
        }}
      >
        <div style={{ flex: '1 1 280px' }}>
          <input
            type="text"
            placeholder="Search by NGO name, registration number, city..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 16px',
              backgroundColor: '#0f172a',
              border: '1px solid #334155',
              borderRadius: '8px',
              color: '#f8fafc',
              fontSize: '14px',
            }}
          />
        </div>

        <div style={{ minWidth: '170px' }}>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 14px',
              backgroundColor: '#0f172a',
              border: '1px solid #334155',
              borderRadius: '8px',
              color: '#f8fafc',
              fontSize: '14px',
            }}
          >
            <option value="all">All Sectors</option>
            <option value="Education">Education</option>
            <option value="Healthcare">Healthcare</option>
            <option value="Environment">Environment</option>
            <option value="Rural Development">Rural Development</option>
            <option value="Women Empowerment">Women Empowerment</option>
            <option value="Disaster Relief">Disaster Relief</option>
          </select>
        </div>

        <div style={{ minWidth: '170px' }}>
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 14px',
              backgroundColor: '#0f172a',
              border: '1px solid #334155',
              borderRadius: '8px',
              color: '#f8fafc',
              fontSize: '14px',
            }}
          >
            <option value="all">All Statuses</option>
            <option value="VERIFIED">Verified</option>
            <option value="PENDING">Pending Review</option>
            <option value="REJECTED">Rejected</option>
            <option value="SUSPENDED">Suspended</option>
          </select>
        </div>
      </div>

      {/* NGOs Grid */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: '#94a3b8' }}>
          Loading non-profits...
        </div>
      ) : ngos.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: '60px',
            backgroundColor: '#1e293b',
            borderRadius: '12px',
            border: '1px solid #334155',
          }}
        >
          <div style={{ fontSize: '36px', marginBottom: '12px' }}>🔍</div>
          <h3 style={{ fontSize: '18px', fontWeight: 600, color: '#f8fafc', marginBottom: '8px' }}>
            No NGOs found matching criteria
          </h3>
          <p style={{ fontSize: '14px', color: '#94a3b8', marginBottom: '16px' }}>
            Try adjusting your search filters or register a new NGO profile.
          </p>
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
            gap: '24px',
          }}
        >
          {ngos.map((ngo) => (
            <div
              key={ngo.id}
              style={{
                backgroundColor: '#1e293b',
                border: '1px solid #334155',
                borderRadius: '14px',
                padding: '24px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                transition: 'transform 0.15s ease, border-color 0.15s ease',
              }}
            >
              <div>
                {/* Card Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <img
                      src={ngo.logo_url || 'https://images.unsplash.com/photo-1577896851231-70ef18881754?auto=format&fit=crop&w=150&q=80'}
                      alt={ngo.name}
                      style={{
                        width: '46px',
                        height: '46px',
                        borderRadius: '10px',
                        objectFit: 'cover',
                        border: '1px solid #475569',
                      }}
                    />
                    <div>
                      <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#f8fafc', marginBottom: '2px' }}>
                        {ngo.name}
                      </h3>
                      <span style={{ fontSize: '12px', color: '#38bdf8', fontWeight: 500 }}>
                        {ngo.category} • {ngo.city || 'India'}
                      </span>
                    </div>
                  </div>
                  <StatusBadge status={ngo.verification_status} size="sm" />
                </div>

                {/* Registration Info */}
                <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '12px', fontFamily: 'monospace' }}>
                  Reg: {ngo.registration_number}
                </div>

                {/* Mission excerpt */}
                <p
                  style={{
                    fontSize: '13px',
                    color: '#94a3b8',
                    lineHeight: '1.5',
                    marginBottom: '16px',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}
                >
                  {ngo.mission || ngo.description || 'No description provided.'}
                </p>

                {/* Quick Metrics */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '10px',
                    backgroundColor: '#0f172a',
                    padding: '12px',
                    borderRadius: '8px',
                    marginBottom: '16px',
                  }}
                >
                  <div>
                    <div style={{ fontSize: '11px', color: '#64748b' }}>Raised</div>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: '#10b981' }}>
                      {formatCurrency(ngo.total_funds_received || 0)}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '11px', color: '#64748b' }}>Transparency</div>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: ngo.transparency_score >= 80 ? '#10b981' : '#f59e0b' }}>
                      {ngo.transparency_score}/100
                    </div>
                  </div>
                </div>
              </div>

              {/* Actions Footer */}
              <div style={{ display: 'flex', gap: '10px', borderTop: '1px solid #334155', paddingTop: '16px' }}>
                <button
                  onClick={() => onSelectNGO(ngo.id)}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    backgroundColor: '#3b82f6',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Manage Profile
                </button>

                <button
                  onClick={() => {
                    setReviewNGO(ngo);
                    setReviewStatus(ngo.verification_status);
                    setReviewNotes(ngo.verification_notes || '');
                  }}
                  style={{
                    padding: '8px 14px',
                    backgroundColor: '#334155',
                    color: '#cbd5e1',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Auditor Review
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* REGISTER NGO MODAL */}
      {isRegisterModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
            zIndex: 100,
          }}
        >
          <div
            style={{
              backgroundColor: '#1e293b',
              border: '1px solid #334155',
              borderRadius: '16px',
              maxWidth: '680px',
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: '28px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#f8fafc' }}>
                Register New NGO Profile
              </h2>
              <button
                onClick={() => setIsRegisterModalOpen(false)}
                style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '22px', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateNGO}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>NGO Name *</label>
                  <input
                    type="text"
                    required
                    value={newNGO.name}
                    onChange={(e) => setNewNGO({ ...newNGO, name: e.target.value })}
                    style={{ width: '100%', padding: '8px 12px', backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '6px', color: '#fff', fontSize: '13px' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>Registration Number *</label>
                  <input
                    type="text"
                    required
                    value={newNGO.registration_number}
                    onChange={(e) => setNewNGO({ ...newNGO, registration_number: e.target.value })}
                    style={{ width: '100%', padding: '8px 12px', backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '6px', color: '#fff', fontSize: '13px' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>Darpan ID</label>
                  <input
                    type="text"
                    value={newNGO.darpan_id}
                    onChange={(e) => setNewNGO({ ...newNGO, darpan_id: e.target.value })}
                    style={{ width: '100%', padding: '8px 12px', backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '6px', color: '#fff', fontSize: '13px' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>Sector / Category</label>
                  <select
                    value={newNGO.category}
                    onChange={(e) => setNewNGO({ ...newNGO, category: e.target.value })}
                    style={{ width: '100%', padding: '8px 12px', backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '6px', color: '#fff', fontSize: '13px' }}
                  >
                    <option value="Education">Education</option>
                    <option value="Healthcare">Healthcare</option>
                    <option value="Environment">Environment</option>
                    <option value="Rural Development">Rural Development</option>
                    <option value="Women Empowerment">Women Empowerment</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>Official Email *</label>
                  <input
                    type="email"
                    required
                    value={newNGO.contact_email}
                    onChange={(e) => setNewNGO({ ...newNGO, contact_email: e.target.value })}
                    style={{ width: '100%', padding: '8px 12px', backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '6px', color: '#fff', fontSize: '13px' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>Phone Number *</label>
                  <input
                    type="text"
                    required
                    value={newNGO.contact_phone}
                    onChange={(e) => setNewNGO({ ...newNGO, contact_phone: e.target.value })}
                    style={{ width: '100%', padding: '8px 12px', backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '6px', color: '#fff', fontSize: '13px' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>City</label>
                  <input
                    type="text"
                    value={newNGO.city}
                    onChange={(e) => setNewNGO({ ...newNGO, city: e.target.value })}
                    style={{ width: '100%', padding: '8px 12px', backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '6px', color: '#fff', fontSize: '13px' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>State</label>
                  <input
                    type="text"
                    value={newNGO.state}
                    onChange={(e) => setNewNGO({ ...newNGO, state: e.target.value })}
                    style={{ width: '100%', padding: '8px 12px', backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '6px', color: '#fff', fontSize: '13px' }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>Mission Statement</label>
                <textarea
                  rows={2}
                  value={newNGO.mission}
                  onChange={(e) => setNewNGO({ ...newNGO, mission: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '6px', color: '#fff', fontSize: '13px' }}
                />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>Public Blockchain Wallet Address</label>
                <input
                  type="text"
                  placeholder="0x..."
                  value={newNGO.wallet_address}
                  onChange={(e) => setNewNGO({ ...newNGO, wallet_address: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '6px', color: '#fff', fontSize: '13px', fontFamily: 'monospace' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '20px', marginBottom: '24px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#cbd5e1' }}>
                  <input
                    type="checkbox"
                    checked={newNGO.has_80g_certificate}
                    onChange={(e) => setNewNGO({ ...newNGO, has_80g_certificate: e.target.checked })}
                  />
                  Has 80G Tax Exemption
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#cbd5e1' }}>
                  <input
                    type="checkbox"
                    checked={newNGO.has_12a_certificate}
                    onChange={(e) => setNewNGO({ ...newNGO, has_12a_certificate: e.target.checked })}
                  />
                  Has 12A Registration
                </label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                <button
                  type="button"
                  onClick={() => setIsRegisterModalOpen(false)}
                  style={{ padding: '8px 16px', backgroundColor: '#334155', color: '#cbd5e1', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  style={{ padding: '8px 20px', backgroundColor: '#3b82f6', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' }}
                >
                  {isSubmitting ? 'Submitting...' : 'Register Profile'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* AUDITOR VERIFICATION MODAL */}
      {reviewNGO && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
            zIndex: 100,
          }}
        >
          <div
            style={{
              backgroundColor: '#1e293b',
              border: '1px solid #334155',
              borderRadius: '16px',
              maxWidth: '520px',
              width: '100%',
              padding: '24px',
            }}
          >
            <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#f8fafc', marginBottom: '8px' }}>
              Auditor Verification: {reviewNGO.name}
            </h2>
            <p style={{ fontSize: '13px', color: '#94a3b8', marginBottom: '20px' }}>
              Assign verification status and audit notes for public compliance badges.
            </p>

            <form onSubmit={handleUpdateStatus}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '13px', color: '#94a3b8', marginBottom: '6px' }}>
                  Verification Status
                </label>
                <select
                  value={reviewStatus}
                  onChange={(e) => setReviewStatus(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    backgroundColor: '#0f172a',
                    border: '1px solid #334155',
                    borderRadius: '8px',
                    color: '#fff',
                    fontSize: '14px',
                  }}
                >
                  <option value="VERIFIED">✅ VERIFIED (Approved)</option>
                  <option value="PENDING">⏳ PENDING (Under Review)</option>
                  <option value="REJECTED">❌ REJECTED (Missing Documentation)</option>
                  <option value="SUSPENDED">⚠️ SUSPENDED (Audit Discrepancy)</option>
                </select>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '13px', color: '#94a3b8', marginBottom: '6px' }}>
                  Auditor Findings / Justification Notes
                </label>
                <textarea
                  rows={4}
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  placeholder="e.g. 80G and Darpan ID verified against Ministry portal records."
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    backgroundColor: '#0f172a',
                    border: '1px solid #334155',
                    borderRadius: '8px',
                    color: '#fff',
                    fontSize: '13px',
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                <button
                  type="button"
                  onClick={() => setReviewNGO(null)}
                  style={{ padding: '8px 16px', backgroundColor: '#334155', color: '#cbd5e1', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  style={{ padding: '8px 20px', backgroundColor: '#3b82f6', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' }}
                >
                  {isSubmitting ? 'Saving...' : 'Update Audit Status'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default NGOManagementPage;

