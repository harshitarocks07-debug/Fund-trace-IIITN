import React from 'react';
import { StatCard } from '../components/StatCard';
import { NGOManagementPage } from './NGOManagementPage';

export const AuditorDashboard: React.FC = () => {
  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '32px 24px' }}>
      <div style={{ marginBottom: '28px' }}>
        <h1 style={{ fontSize: '26px', fontWeight: 800, color: '#f8fafc', marginBottom: '6px' }}>
          Auditor & Compliance Portal
        </h1>
        <p style={{ fontSize: '14px', color: '#94a3b8' }}>
          Independent verification portal for statutory review, 80G certification, and fraud alerts.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '20px', marginBottom: '32px' }}>
        <StatCard title="Pending NGO Audits" value="4" subtitle="Awaiting review" color="amber" icon="⏳" />
        <StatCard title="Verified NGOs" value="38" subtitle="Fully compliant" color="emerald" icon="✅" />
        <StatCard title="Flagged Transactions" value="0" subtitle="Zero discrepancies" color="blue" icon="🛡️" />
        <StatCard title="Average Audit Time" value="1.8 days" subtitle="Fast turnaround" color="purple" icon="⚡" />
      </div>

      <NGOManagementPage onSelectNGO={(id) => console.log('Audit NGO', id)} />
    </div>
  );
};

