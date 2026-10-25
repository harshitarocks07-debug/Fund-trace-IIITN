import React from 'react';
import { StatCard } from '../components/StatCard';
import { DonationChart } from '../components/DonationChart';

export const DonorDashboard: React.FC = () => {
  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '32px 24px' }}>
      <div style={{ marginBottom: '28px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#f8fafc', marginBottom: '6px' }}>
          Donor Portfolio & Tax Impact
        </h1>
        <p style={{ fontSize: '14px', color: '#94a3b8' }}>
          Track contributions, download instant 80G tax certificates, and trace fund milestones.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px', marginBottom: '32px' }}>
        <StatCard title="Total Donated" value="₹1,25,000" subtitle="FY 2025-26" color="emerald" icon="💝" />
        <StatCard title="Tax Deductions" value="₹62,500" subtitle="Section 80G benefit" color="blue" icon="🧾" />
        <StatCard title="Supported NGOs" value="3" subtitle="Verified organizations" color="purple" icon="🏛️" />
        <StatCard title="Lives Touched" value="480" subtitle="Quantified impact" color="amber" icon="🌟" />
      </div>

      <DonationChart />
    </div>
  );
};

