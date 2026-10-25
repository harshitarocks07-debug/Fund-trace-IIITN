import React, { useState, useEffect } from 'react';
import { ngoService, NGOProfile, NGOStats } from '../services/ngoService';
import { StatusBadge } from '../components/StatusBadge';
import { StatCard } from '../components/StatCard';

interface NGODashboardProps {
  ngoId?: number;
  onNavigateToDirectory?: () => void;
}

export const NGODashboard: React.FC<NGODashboardProps> = ({ ngoId = 1, onNavigateToDirectory }) => {
  const [ngo, setNgo] = useState<NGOProfile | null>(null);
  const [stats, setStats] = useState<NGOStats | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'edit' | 'compliance' | 'traceability'>('overview');
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Form edit state
  const [formData, setFormData] = useState<Partial<NGOProfile>>({});

  useEffect(() => {
    loadNGOData(ngoId);
  }, [ngoId]);

  const loadNGOData = async (id: number) => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const data = await ngoService.getNGOById(id);
      setNgo(data);
      setFormData(data);

      const statsData = await ngoService.getNGOStats(id);
      setStats(statsData);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to load NGO profile');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData(prev => ({ ...prev, [name]: checked }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ngo) return;

    setIsSaving(true);
    setSaveSuccess(null);
    setErrorMessage(null);

    try {
      const updated = await ngoService.updateNGO(ngo.id, formData);
      setNgo(updated);
      setFormData(updated);

      // Refresh stats as well (score might change)
      const statsData = await ngoService.getNGOStats(ngo.id);
      setStats(statsData);

      setSaveSuccess('NGO profile updated and synchronized successfully!');
      setTimeout(() => setSaveSuccess(null), 4000);
    } catch (err: any) {
      setErrorMessage(err.message || 'Error updating NGO profile');
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '60px 20px', textAlign: 'center', color: '#94a3b8' }}>
        <div style={{ fontSize: '32px', marginBottom: '16px' }}>⏳</div>
        <p style={{ fontSize: '16px', fontWeight: 500 }}>Loading NGO profile and management metrics...</p>
      </div>
    );
  }

  if (!ngo) {
    return (
      <div style={{ padding: '60px 20px', textAlign: 'center' }}>
        <p style={{ color: '#ef4444', fontSize: '18px', marginBottom: '16px' }}>
          {errorMessage || 'NGO Profile Not Found'}
        </p>
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
          <button
            onClick={() => loadNGOData(1)}
            style={{
              padding: '10px 20px',
              backgroundColor: '#3b82f6',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            Load Default NGO Profile
          </button>
          {onNavigateToDirectory && (
            <button
              onClick={onNavigateToDirectory}
              style={{
                padding: '10px 20px',
                backgroundColor: '#334155',
                color: '#f8fafc',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              Browse Directory
            </button>
          )}
        </div>
      </div>
    );
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '32px 24px' }}>
      {/* Notifications */}
      {saveSuccess && (
        <div
          style={{
            backgroundColor: 'rgba(16, 185, 129, 0.15)',
            border: '1px solid rgba(16, 185, 129, 0.4)',
            color: '#34d399',
            padding: '14px 20px',
            borderRadius: '10px',
            marginBottom: '24px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            fontSize: '14px',
            fontWeight: 500,
          }}
        >
          <span>✅</span>
          <span>{saveSuccess}</span>
        </div>
      )}

      {errorMessage && (
        <div
          style={{
            backgroundColor: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid rgba(239, 68, 68, 0.4)',
            color: '#f87171',
            padding: '14px 20px',
            borderRadius: '10px',
            marginBottom: '24px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            fontSize: '14px',
            fontWeight: 500,
          }}
        >
          <span>⚠️</span>
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Header Profile Hero Card */}
      <div
        style={{
          backgroundColor: '#1e293b',
          border: '1px solid #334155',
          borderRadius: '16px',
          padding: '28px',
          marginBottom: '32px',
          boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.2)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: '24px',
          }}
        >
          {/* Logo & Main Details */}
          <div style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
            <img
              src={ngo.logo_url || 'https://images.unsplash.com/photo-1577896851231-70ef18881754?auto=format&fit=crop&w=150&q=80'}
              alt={ngo.name}
              style={{
                width: '84px',
                height: '84px',
                borderRadius: '14px',
                objectFit: 'cover',
                border: '2px solid #475569',
                backgroundColor: '#0f172a',
              }}
            />
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '6px' }}>
                <h1 style={{ fontSize: '26px', fontWeight: 800, color: '#f8fafc', letterSpacing: '-0.02em' }}>
                  {ngo.name}
                </h1>
                <StatusBadge status={ngo.verification_status} size="md" />
                <span
                  style={{
                    backgroundColor: 'rgba(56, 189, 248, 0.1)',
                    color: '#38bdf8',
                    border: '1px solid rgba(56, 189, 248, 0.3)',
                    padding: '2px 10px',
                    borderRadius: '9999px',
                    fontSize: '12px',
                    fontWeight: 600,
                  }}
                >
                  {ngo.category}
                </span>
              </div>

              {ngo.legal_name && (
                <div style={{ fontSize: '13px', color: '#94a3b8', marginBottom: '10px' }}>
                  Legal Name: <span style={{ color: '#cbd5e1', fontWeight: 500 }}>{ngo.legal_name}</span>
                </div>
              )}

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', fontSize: '12px', color: '#64748b' }}>
                <div>
                  Reg No: <span style={{ color: '#94a3b8', fontFamily: 'monospace', fontWeight: 600 }}>{ngo.registration_number}</span>
                </div>
                {ngo.darpan_id && (
                  <div>
                    Darpan ID: <span style={{ color: '#94a3b8', fontFamily: 'monospace', fontWeight: 600 }}>{ngo.darpan_id}</span>
                  </div>
                )}
                {ngo.pan_number && (
                  <div>
                    PAN: <span style={{ color: '#94a3b8', fontFamily: 'monospace', fontWeight: 600 }}>{ngo.pan_number}</span>
                  </div>
                )}
                {ngo.city && (
                  <div>
                    Location: <span style={{ color: '#cbd5e1' }}>{ngo.city}, {ngo.state || ngo.country}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Transparency Rating Pill / Score */}
          <div
            style={{
              backgroundColor: '#0f172a',
              border: '1px solid #334155',
              borderRadius: '12px',
              padding: '16px 20px',
              textAlign: 'center',
              minWidth: '180px',
            }}
          >
            <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#94a3b8', fontWeight: 600, marginBottom: '4px' }}>
              Transparency Score
            </div>
            <div style={{ fontSize: '32px', fontWeight: 800, color: ngo.transparency_score >= 80 ? '#10b981' : '#f59e0b' }}>
              {ngo.transparency_score}<span style={{ fontSize: '16px', color: '#64748b' }}>/100</span>
            </div>
            <div style={{ fontSize: '11px', color: '#10b981', fontWeight: 600, marginTop: '4px' }}>
              ✨ High Audit Rating
            </div>
            {onNavigateToDirectory && (
              <button
                onClick={onNavigateToDirectory}
                style={{
                  marginTop: '12px',
                  width: '100%',
                  padding: '6px 12px',
                  backgroundColor: '#1e293b',
                  color: '#38bdf8',
                  border: '1px solid #334155',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontWeight: 600,
                }}
              >
                📋 Switch NGO
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Metric Cards Row */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: '20px',
          marginBottom: '32px',
        }}
      >
        <StatCard
          title="Total Funds Raised"
          value={formatCurrency(ngo.total_funds_received || 0)}
          subtitle="Lifetime verified donations"
          icon="💰"
          color="emerald"
        />
        <StatCard
          title="Funds Utilized"
          value={formatCurrency(ngo.total_funds_utilized || 0)}
          subtitle={`${stats?.utilization_rate || 0}% fund utilization rate`}
          icon="📊"
          color="blue"
        />
        <StatCard
          title="Active Projects"
          value={ngo.active_projects_count ?? 0}
          subtitle="Currently ongoing programs"
          icon="🚀"
          color="indigo"
        />
        <StatCard
          title="Beneficiaries Reached"
          value={(ngo.beneficiaries_count ?? 0).toLocaleString()}
          subtitle="Direct impact footprint"
          icon="🤝"
          color="purple"
        />
      </div>

      {/* Navigation Tabs */}
      <div
        style={{
          display: 'flex',
          borderBottom: '1px solid #334155',
          marginBottom: '28px',
          gap: '8px',
        }}
      >
        <button
          onClick={() => setActiveTab('overview')}
          style={{
            padding: '12px 20px',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'overview' ? '3px solid #38bdf8' : '3px solid transparent',
            color: activeTab === 'overview' ? '#38bdf8' : '#94a3b8',
            fontSize: '14px',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
        >
          📖 Organization Overview
        </button>

        <button
          onClick={() => setActiveTab('edit')}
          style={{
            padding: '12px 20px',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'edit' ? '3px solid #38bdf8' : '3px solid transparent',
            color: activeTab === 'edit' ? '#38bdf8' : '#94a3b8',
            fontSize: '14px',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
        >
          ✏️ Edit & Maintain Profile
        </button>

        <button
          onClick={() => setActiveTab('compliance')}
          style={{
            padding: '12px 20px',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'compliance' ? '3px solid #38bdf8' : '3px solid transparent',
            color: activeTab === 'compliance' ? '#38bdf8' : '#94a3b8',
            fontSize: '14px',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
        >
          📜 Compliance & Verification
        </button>

        <button
          onClick={() => setActiveTab('traceability')}
          style={{
            padding: '12px 20px',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'traceability' ? '3px solid #38bdf8' : '3px solid transparent',
            color: activeTab === 'traceability' ? '#38bdf8' : '#94a3b8',
            fontSize: '14px',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
        >
          ⛓️ Blockchain & Financial Details
        </button>
      </div>

      {/* TAB CONTENT 1: OVERVIEW */}
      {activeTab === 'overview' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '24px' }}>
          {/* Mission & Vision */}
          <div
            style={{
              backgroundColor: '#1e293b',
              border: '1px solid #334155',
              borderRadius: '12px',
              padding: '24px',
            }}
          >
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#f8fafc', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>🎯</span> Mission & Objectives
            </h3>
            <p style={{ fontSize: '14px', lineHeight: '1.6', color: '#cbd5e1', marginBottom: '20px' }}>
              {ngo.mission || 'No mission statement provided.'}
            </p>

            <h4 style={{ fontSize: '14px', fontWeight: 600, color: '#94a3b8', marginBottom: '8px' }}>
              Vision
            </h4>
            <p style={{ fontSize: '14px', lineHeight: '1.6', color: '#cbd5e1', marginBottom: '20px' }}>
              {ngo.vision || 'No vision statement provided.'}
            </p>

            <h4 style={{ fontSize: '14px', fontWeight: 600, color: '#94a3b8', marginBottom: '8px' }}>
              Detailed Description
            </h4>
            <p style={{ fontSize: '14px', lineHeight: '1.6', color: '#94a3b8' }}>
              {ngo.description || 'No detailed background provided.'}
            </p>
          </div>

          {/* Contact & Operational Geography */}
          <div
            style={{
              backgroundColor: '#1e293b',
              border: '1px solid #334155',
              borderRadius: '12px',
              padding: '24px',
            }}
          >
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#f8fafc', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>📍</span> Contact & Operational Areas
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <span style={{ fontSize: '12px', color: '#64748b', display: 'block' }}>Email Address</span>
                <span style={{ fontSize: '14px', color: '#cbd5e1', fontWeight: 500 }}>{ngo.contact_email}</span>
              </div>

              <div>
                <span style={{ fontSize: '12px', color: '#64748b', display: 'block' }}>Phone Number</span>
                <span style={{ fontSize: '14px', color: '#cbd5e1', fontWeight: 500 }}>{ngo.contact_phone}</span>
              </div>

              <div>
                <span style={{ fontSize: '12px', color: '#64748b', display: 'block' }}>Official Website</span>
                <a
                  href={ngo.website || '#'}
                  target="_blank"
                  rel="noreferrer"
                  style={{ fontSize: '14px', color: '#38bdf8', textDecoration: 'none', fontWeight: 500 }}
                >
                  {ngo.website || 'Not specified'}
                </a>
              </div>

              <div>
                <span style={{ fontSize: '12px', color: '#64748b', display: 'block' }}>Registered Headquarters</span>
                <span style={{ fontSize: '14px', color: '#cbd5e1' }}>
                  {ngo.address ? `${ngo.address}, ` : ''}
                  {ngo.city ? `${ngo.city}, ` : ''}
                  {ngo.state ? `${ngo.state} - ` : ''}
                  {ngo.pincode} ({ngo.country})
                </span>
              </div>

              <div>
                <span style={{ fontSize: '12px', color: '#64748b', display: 'block' }}>Operating Regions</span>
                <span style={{ fontSize: '14px', color: '#cbd5e1' }}>
                  {ngo.operating_regions || 'All India'}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT 2: EDIT PROFILE */}
      {activeTab === 'edit' && (
        <form
          onSubmit={handleSaveProfile}
          style={{
            backgroundColor: '#1e293b',
            border: '1px solid #334155',
            borderRadius: '12px',
            padding: '28px',
          }}
        >
          <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#f8fafc' }}>
                Maintain NGO Profile & Information
              </h3>
              <p style={{ fontSize: '13px', color: '#94a3b8' }}>
                Keep your organization's legal, operational, and financial records up to date.
              </p>
            </div>

            <button
              type="submit"
              disabled={isSaving}
              style={{
                backgroundColor: '#3b82f6',
                color: '#fff',
                padding: '10px 24px',
                borderRadius: '8px',
                border: 'none',
                fontWeight: 600,
                cursor: isSaving ? 'not-allowed' : 'pointer',
                opacity: isSaving ? 0.7 : 1,
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              {isSaving ? 'Saving Changes...' : '💾 Save Profile'}
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', marginBottom: '24px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', color: '#94a3b8', marginBottom: '6px' }}>Organization Name *</label>
              <input
                type="text"
                name="name"
                value={formData.name || ''}
                onChange={handleInputChange}
                required
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  backgroundColor: '#0f172a',
                  border: '1px solid #334155',
                  borderRadius: '8px',
                  color: '#fff',
                  fontSize: '14px',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', color: '#94a3b8', marginBottom: '6px' }}>Legal / Registered Entity Name</label>
              <input
                type="text"
                name="legal_name"
                value={formData.legal_name || ''}
                onChange={handleInputChange}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  backgroundColor: '#0f172a',
                  border: '1px solid #334155',
                  borderRadius: '8px',
                  color: '#fff',
                  fontSize: '14px',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', color: '#94a3b8', marginBottom: '6px' }}>Sector / Category</label>
              <select
                name="category"
                value={formData.category || 'Education'}
                onChange={handleInputChange}
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
                <option value="Education">Education</option>
                <option value="Healthcare">Healthcare</option>
                <option value="Environment">Environment & Ecology</option>
                <option value="Rural Development">Rural Development</option>
                <option value="Women Empowerment">Women Empowerment</option>
                <option value="Child Welfare">Child Welfare</option>
                <option value="Disaster Relief">Disaster Relief</option>
                <option value="Animal Welfare">Animal Welfare</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', color: '#94a3b8', marginBottom: '6px' }}>Founding Year</label>
              <input
                type="number"
                name="founding_year"
                value={formData.founding_year || ''}
                onChange={handleInputChange}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  backgroundColor: '#0f172a',
                  border: '1px solid #334155',
                  borderRadius: '8px',
                  color: '#fff',
                  fontSize: '14px',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', color: '#94a3b8', marginBottom: '6px' }}>Official Contact Email *</label>
              <input
                type="email"
                name="contact_email"
                value={formData.contact_email || ''}
                onChange={handleInputChange}
                required
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  backgroundColor: '#0f172a',
                  border: '1px solid #334155',
                  borderRadius: '8px',
                  color: '#fff',
                  fontSize: '14px',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', color: '#94a3b8', marginBottom: '6px' }}>Contact Phone *</label>
              <input
                type="text"
                name="contact_phone"
                value={formData.contact_phone || ''}
                onChange={handleInputChange}
                required
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  backgroundColor: '#0f172a',
                  border: '1px solid #334155',
                  borderRadius: '8px',
                  color: '#fff',
                  fontSize: '14px',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', color: '#94a3b8', marginBottom: '6px' }}>Website URL</label>
              <input
                type="url"
                name="website"
                value={formData.website || ''}
                onChange={handleInputChange}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  backgroundColor: '#0f172a',
                  border: '1px solid #334155',
                  borderRadius: '8px',
                  color: '#fff',
                  fontSize: '14px',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', color: '#94a3b8', marginBottom: '6px' }}>Logo Image URL</label>
              <input
                type="url"
                name="logo_url"
                value={formData.logo_url || ''}
                onChange={handleInputChange}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  backgroundColor: '#0f172a',
                  border: '1px solid #334155',
                  borderRadius: '8px',
                  color: '#fff',
                  fontSize: '14px',
                }}
              />
            </div>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '13px', color: '#94a3b8', marginBottom: '6px' }}>Mission Statement</label>
            <textarea
              name="mission"
              rows={2}
              value={formData.mission || ''}
              onChange={handleInputChange}
              style={{
                width: '100%',
                padding: '10px 14px',
                backgroundColor: '#0f172a',
                border: '1px solid #334155',
                borderRadius: '8px',
                color: '#fff',
                fontSize: '14px',
                resize: 'vertical',
              }}
            />
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '13px', color: '#94a3b8', marginBottom: '6px' }}>Vision</label>
            <textarea
              name="vision"
              rows={2}
              value={formData.vision || ''}
              onChange={handleInputChange}
              style={{
                width: '100%',
                padding: '10px 14px',
                backgroundColor: '#0f172a',
                border: '1px solid #334155',
                borderRadius: '8px',
                color: '#fff',
                fontSize: '14px',
                resize: 'vertical',
              }}
            />
          </div>

          <div style={{ marginBottom: '24px' }}>
            <label style={{ display: 'block', fontSize: '13px', color: '#94a3b8', marginBottom: '6px' }}>Detailed Description & Activities</label>
            <textarea
              name="description"
              rows={3}
              value={formData.description || ''}
              onChange={handleInputChange}
              style={{
                width: '100%',
                padding: '10px 14px',
                backgroundColor: '#0f172a',
                border: '1px solid #334155',
                borderRadius: '8px',
                color: '#fff',
                fontSize: '14px',
                resize: 'vertical',
              }}
            />
          </div>

          <h4 style={{ fontSize: '14px', fontWeight: 600, color: '#f8fafc', marginBottom: '14px', borderTop: '1px solid #334155', paddingTop: '16px' }}>
            Geographical Footprint
          </h4>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>City</label>
              <input
                type="text"
                name="city"
                value={formData.city || ''}
                onChange={handleInputChange}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  backgroundColor: '#0f172a',
                  border: '1px solid #334155',
                  borderRadius: '6px',
                  color: '#fff',
                  fontSize: '13px',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>State</label>
              <input
                type="text"
                name="state"
                value={formData.state || ''}
                onChange={handleInputChange}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  backgroundColor: '#0f172a',
                  border: '1px solid #334155',
                  borderRadius: '6px',
                  color: '#fff',
                  fontSize: '13px',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>Pincode</label>
              <input
                type="text"
                name="pincode"
                value={formData.pincode || ''}
                onChange={handleInputChange}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  backgroundColor: '#0f172a',
                  border: '1px solid #334155',
                  borderRadius: '6px',
                  color: '#fff',
                  fontSize: '13px',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>Operating Regions</label>
              <input
                type="text"
                name="operating_regions"
                value={formData.operating_regions || ''}
                onChange={handleInputChange}
                placeholder="Districts or cities separated by commas"
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  backgroundColor: '#0f172a',
                  border: '1px solid #334155',
                  borderRadius: '6px',
                  color: '#fff',
                  fontSize: '13px',
                }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '20px' }}>
            <button
              type="submit"
              disabled={isSaving}
              style={{
                backgroundColor: '#3b82f6',
                color: '#fff',
                padding: '12px 32px',
                borderRadius: '8px',
                border: 'none',
                fontWeight: 600,
                cursor: isSaving ? 'not-allowed' : 'pointer',
              }}
            >
              {isSaving ? 'Saving Changes...' : 'Save Updated NGO Profile'}
            </button>
          </div>
        </form>
      )}

      {/* TAB CONTENT 3: COMPLIANCE */}
      {activeTab === 'compliance' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div
            style={{
              backgroundColor: '#1e293b',
              border: '1px solid #334155',
              borderRadius: '12px',
              padding: '24px',
            }}
          >
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#f8fafc', marginBottom: '6px' }}>
              Tax & Statutory Compliance Status
            </h3>
            <p style={{ fontSize: '13px', color: '#94a3b8', marginBottom: '24px' }}>
              These certifications determine eligibility for tax-deductible donor contributions and international grant reception.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
              {/* 80G Card */}
              <div
                style={{
                  backgroundColor: '#0f172a',
                  border: '1px solid #334155',
                  borderRadius: '10px',
                  padding: '18px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div>
                  <div style={{ fontSize: '15px', fontWeight: 600, color: '#f8fafc' }}>
                    Section 80G Certificate
                  </div>
                  <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                    Tax deduction eligibility for Indian donors
                  </div>
                </div>
                <span
                  style={{
                    backgroundColor: ngo.has_80g_certificate ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                    color: ngo.has_80g_certificate ? '#10b981' : '#f87171',
                    padding: '4px 10px',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: 600,
                  }}
                >
                  {ngo.has_80g_certificate ? 'Active & Verified' : 'Not Uploaded'}
                </span>
              </div>

              {/* 12A Card */}
              <div
                style={{
                  backgroundColor: '#0f172a',
                  border: '1px solid #334155',
                  borderRadius: '10px',
                  padding: '18px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div>
                  <div style={{ fontSize: '15px', fontWeight: 600, color: '#f8fafc' }}>
                    Section 12A Registration
                  </div>
                  <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                    Income tax exemption status for trusts
                  </div>
                </div>
                <span
                  style={{
                    backgroundColor: ngo.has_12a_certificate ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                    color: ngo.has_12a_certificate ? '#10b981' : '#f87171',
                    padding: '4px 10px',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: 600,
                  }}
                >
                  {ngo.has_12a_certificate ? 'Active & Verified' : 'Not Uploaded'}
                </span>
              </div>

              {/* FCRA Card */}
              <div
                style={{
                  backgroundColor: '#0f172a',
                  border: '1px solid #334155',
                  borderRadius: '10px',
                  padding: '18px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div>
                  <div style={{ fontSize: '15px', fontWeight: 600, color: '#f8fafc' }}>
                    FCRA International Approval
                  </div>
                  <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                    {ngo.fcra_number ? `FCRA No: ${ngo.fcra_number}` : 'Foreign Contribution Regulation'}
                  </div>
                </div>
                <span
                  style={{
                    backgroundColor: ngo.has_fcra_registration ? 'rgba(16, 185, 129, 0.15)' : 'rgba(148, 163, 184, 0.15)',
                    color: ngo.has_fcra_registration ? '#10b981' : '#94a3b8',
                    padding: '4px 10px',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: 600,
                  }}
                >
                  {ngo.has_fcra_registration ? 'FCRA Approved' : 'Domestic Only'}
                </span>
              </div>
            </div>

            {/* Verification Audit Trail */}
            <div style={{ marginTop: '24px', backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '10px', padding: '18px' }}>
              <div style={{ fontSize: '14px', fontWeight: 600, color: '#f8fafc', marginBottom: '8px' }}>
                Auditor Assessment Notes
              </div>
              <p style={{ fontSize: '13px', color: '#94a3b8', lineHeight: '1.5' }}>
                {ngo.verification_notes || 'Pending annual compliance audit review.'}
              </p>
              {ngo.verified_at && (
                <div style={{ fontSize: '12px', color: '#64748b', marginTop: '8px' }}>
                  Last certified on: {new Date(ngo.verified_at).toLocaleDateString()}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT 4: BLOCKCHAIN & FINANCIAL TRACEABILITY */}
      {activeTab === 'traceability' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '24px' }}>
          {/* Bank Account Details */}
          <div
            style={{
              backgroundColor: '#1e293b',
              border: '1px solid #334155',
              borderRadius: '12px',
              padding: '24px',
            }}
          >
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#f8fafc', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>🏦</span> Dedicated NGO Bank Account
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <span style={{ fontSize: '12px', color: '#64748b', display: 'block' }}>Bank Name</span>
                <span style={{ fontSize: '14px', color: '#cbd5e1', fontWeight: 600 }}>{ngo.bank_name || 'State Bank of India'}</span>
              </div>

              <div>
                <span style={{ fontSize: '12px', color: '#64748b', display: 'block' }}>Account Number</span>
                <span style={{ fontSize: '14px', color: '#cbd5e1', fontFamily: 'monospace', fontWeight: 600 }}>
                  {ngo.bank_account_number || '••••••••••••'}
                </span>
              </div>

              <div>
                <span style={{ fontSize: '12px', color: '#64748b', display: 'block' }}>IFSC / Branch Code</span>
                <span style={{ fontSize: '14px', color: '#cbd5e1', fontFamily: 'monospace', fontWeight: 600 }}>
                  {ngo.bank_ifsc || 'SBIN0004512'}
                </span>
              </div>
            </div>
          </div>

          {/* Blockchain Smart Contract Wallet */}
          <div
            style={{
              backgroundColor: '#1e293b',
              border: '1px solid #334155',
              borderRadius: '12px',
              padding: '24px',
            }}
          >
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#f8fafc', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>🔗</span> On-Chain Transparency Ledger
            </h3>

            <p style={{ fontSize: '13px', color: '#94a3b8', lineHeight: '1.5', marginBottom: '16px' }}>
              All donations routed through FundTrace are hashed and recorded with cryptographic immutability on the public ledger.
            </p>

            <div style={{ marginBottom: '16px' }}>
              <span style={{ fontSize: '12px', color: '#64748b', display: 'block', marginBottom: '4px' }}>
                Registered Public Wallet Address
              </span>
              <div
                style={{
                  backgroundColor: '#0f172a',
                  border: '1px solid #334155',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  fontFamily: 'monospace',
                  fontSize: '13px',
                  color: '#38bdf8',
                  wordBreak: 'break-all',
                }}
              >
                {ngo.wallet_address || 'No wallet linked'}
              </div>
            </div>

            <div
              style={{
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                border: '1px solid rgba(59, 130, 246, 0.3)',
                padding: '12px',
                borderRadius: '8px',
                fontSize: '12px',
                color: '#93c5fd',
              }}
            >
              💡 Audited by FundTrace Smart Contract: <code>FundTraceLedger.sol</code>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NGODashboard;

