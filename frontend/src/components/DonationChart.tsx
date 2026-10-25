import React from 'react';

interface DonationChartProps {
  data?: { month: string; amount: number }[];
}

export const DonationChart: React.FC<DonationChartProps> = ({
  data = [
    { month: 'Jan', amount: 450000 },
    { month: 'Feb', amount: 620000 },
    { month: 'Mar', amount: 890000 },
    { month: 'Apr', amount: 750000 },
    { month: 'May', amount: 980000 },
    { month: 'Jun', amount: 1200000 },
  ],
}) => {
  const max = Math.max(...data.map(d => d.amount), 1);

  return (
    <div
      style={{
        backgroundColor: '#1e293b',
        border: '1px solid #334155',
        borderRadius: '12px',
        padding: '24px',
      }}
    >
      <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#f8fafc', marginBottom: '20px' }}>
        Donation Trends & Flow Analysis
      </h3>

      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '16px', height: '180px', paddingTop: '20px' }}>
        {data.map((item, i) => {
          const heightPercent = Math.round((item.amount / max) * 100);
          return (
            <div
              key={i}
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '8px',
                height: '100%',
                justifyContent: 'flex-end',
              }}
            >
              <div
                style={{
                  width: '100%',
                  maxWidth: '36px',
                  height: `${heightPercent}%`,
                  backgroundColor: '#3b82f6',
                  borderRadius: '6px 6px 0 0',
                  transition: 'height 0.3s ease',
                }}
                title={`₹${item.amount.toLocaleString()}`}
              />
              <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 500 }}>
                {item.month}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default DonationChart;
