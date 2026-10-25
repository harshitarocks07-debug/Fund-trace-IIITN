import React from 'react';

interface LandingPageProps {
  onGetStarted?: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onGetStarted }) => {
  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '60px 24px', textAlign: 'center' }}>
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          padding: '6px 16px',
          borderRadius: '9999px',
          backgroundColor: 'rgba(56, 189, 248, 0.1)',
          border: '1px solid rgba(56, 189, 248, 0.3)',
          color: '#38bdf8',
          fontSize: '13px',
          fontWeight: 600,
          marginBottom: '24px',
        }}
      >
        <span>🛡️</span> Blockchain-Powered NGO Transparency
      </div>

      <h1 style={{ fontSize: '44px', fontWeight: 900, color: '#f8fafc', letterSpacing: '-0.03em', lineHeight: 1.15, marginBottom: '20px' }}>
        Trace Every Rupee from <br />
        <span style={{ color: '#38bdf8' }}>Donor to Beneficiary</span>
      </h1>

      <p style={{ fontSize: '18px', color: '#94a3b8', maxWidth: '700px', margin: '0 auto 36px', lineHeight: 1.6 }}>
        FundTrace unites non-profit organizations, donors, and regulatory auditors with cryptographic receipts, automated 80G tax certificates, and public milestone tracking.
      </p>

      <div style={{ display: 'flex', justifyContent: 'center', gap: '16px' }}>
        <button
          onClick={onGetStarted}
          style={{
            padding: '12px 28px',
            backgroundColor: '#3b82f6',
            color: '#fff',
            borderRadius: '8px',
            border: 'none',
            fontSize: '15px',
            fontWeight: 600,
            cursor: 'pointer',
            boxShadow: '0 4px 14px rgba(59, 130, 246, 0.4)',
          }}
        >
          Explore NGO Portal & Directory
        </button>
      </div>
    </div>
  );
};

