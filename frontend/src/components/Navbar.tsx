import React from 'react';

interface NavbarProps {
  currentView: 'dashboard' | 'directory' | 'projects' | 'donations' | 'expenses';
  onNavigate: (view: 'dashboard' | 'directory' | 'projects' | 'donations' | 'expenses') => void;
  ngoName?: string;
}

export const Navbar: React.FC<NavbarProps> = ({ currentView, onNavigate, ngoName = 'Vidya Jyoti Foundation' }) => {
  return (
    <header
      style={{
        backgroundColor: '#0f172a',
        borderBottom: '1px solid #1e293b',
        position: 'sticky',
        top: 0,
        zIndex: 50,
        padding: '0 24px',
      }}
    >
      <div
        style={{
          maxWidth: '1400px',
          margin: '0 auto',
          height: '68px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        {/* Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }} onClick={() => onNavigate('dashboard')}>
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)',
              fontSize: '20px',
            }}
          >
            🛡️
          </div>
          <div>
            <div style={{ fontSize: '18px', fontWeight: 800, letterSpacing: '-0.02em', color: '#f8fafc' }}>
              FundTrace<span style={{ color: '#38bdf8' }}>.io</span>
            </div>
            <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 500 }}>
              NGO Management & Transparency Ledger
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={() => onNavigate('dashboard')}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              border: 'none',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'all 0.15s ease',
              backgroundColor: currentView === 'dashboard' ? '#1e293b' : 'transparent',
              color: currentView === 'dashboard' ? '#38bdf8' : '#94a3b8',
              borderBottom: currentView === 'dashboard' ? '2px solid #38bdf8' : '2px solid transparent',
            }}
          >
            <span>🏛️</span> NGO Profile & Dashboard
          </button>

          <button
            onClick={() => onNavigate('directory')}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              border: 'none',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'all 0.15s ease',
              backgroundColor: currentView === 'directory' ? '#1e293b' : 'transparent',
              color: currentView === 'directory' ? '#38bdf8' : '#94a3b8',
              borderBottom: currentView === 'directory' ? '2px solid #38bdf8' : '2px solid transparent',
            }}
          >
            <span>📋</span> NGO Directory & Verification
          </button>

          <button
            onClick={() => onNavigate('projects')}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              border: 'none',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'all 0.15s ease',
              backgroundColor: currentView === 'projects' ? '#1e293b' : 'transparent',
              color: currentView === 'projects' ? '#38bdf8' : '#94a3b8',
              borderBottom: currentView === 'projects' ? '2px solid #38bdf8' : '2px solid transparent',
            }}
          >
            <span>🚀</span> Projects & Budgets
          </button>

          <button
            onClick={() => onNavigate('donations')}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              border: 'none',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'all 0.15s ease',
              backgroundColor: currentView === 'donations' ? '#1e293b' : 'transparent',
              color: currentView === 'donations' ? '#38bdf8' : '#94a3b8',
              borderBottom: currentView === 'donations' ? '2px solid #38bdf8' : '2px solid transparent',
            }}
          >
            <span>💝</span> Donations & Ledger
          </button>

          <button
            onClick={() => onNavigate('expenses')}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              border: 'none',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'all 0.15s ease',
              backgroundColor: currentView === 'expenses' ? '#1e293b' : 'transparent',
              color: currentView === 'expenses' ? '#38bdf8' : '#94a3b8',
              borderBottom: currentView === 'expenses' ? '2px solid #38bdf8' : '2px solid transparent',
            }}
          >
            <span>💸</span> Expenses & Audit
          </button>
        </nav>

        {/* User / Org context */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-end',
            }}
          >
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#f1f5f9' }}>
              {ngoName}
            </span>
            <span style={{ fontSize: '11px', color: '#10b981', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#10b981' }} />
              Verified NGO Partner
            </span>
          </div>

          <div
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '50%',
              backgroundColor: '#334155',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '16px',
              fontWeight: 700,
              color: '#38bdf8',
              border: '2px solid #3b82f6',
            }}
          >
            VJ
          </div>
        </div>
      </div>
    </header>
  );
};

export default Navbar;
