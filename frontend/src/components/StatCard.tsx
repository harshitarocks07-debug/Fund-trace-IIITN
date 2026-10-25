import React from 'react';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: string;
  trend?: string;
  color?: 'emerald' | 'blue' | 'indigo' | 'amber' | 'purple';
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtitle,
  icon,
  trend,
  color = 'blue',
}) => {
  const colorMap = {
    emerald: {
      bg: 'rgba(16, 185, 129, 0.1)',
      text: '#10b981',
      border: 'rgba(16, 185, 129, 0.2)',
    },
    blue: {
      bg: 'rgba(59, 130, 246, 0.1)',
      text: '#3b82f6',
      border: 'rgba(59, 130, 246, 0.2)',
    },
    indigo: {
      bg: 'rgba(99, 102, 241, 0.1)',
      text: '#6366f1',
      border: 'rgba(99, 102, 241, 0.2)',
    },
    amber: {
      bg: 'rgba(245, 158, 11, 0.1)',
      text: '#f59e0b',
      border: 'rgba(245, 158, 11, 0.2)',
    },
    purple: {
      bg: 'rgba(168, 85, 247, 0.1)',
      text: '#a855f7',
      border: 'rgba(168, 85, 247, 0.2)',
    },
  };

  const scheme = colorMap[color] || colorMap.blue;

  return (
    <div
      style={{
        backgroundColor: '#1e293b',
        border: '1px solid #334155',
        borderRadius: '12px',
        padding: '20px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        position: 'relative',
        overflow: 'hidden',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
        <span style={{ fontSize: '13px', fontWeight: 500, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {title}
        </span>
        {icon && (
          <div
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '8px',
              backgroundColor: scheme.bg,
              border: `1px solid ${scheme.border}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '18px',
            }}
          >
            {icon}
          </div>
        )}
      </div>

      <div>
        <div style={{ fontSize: '26px', fontWeight: 700, color: '#f8fafc', letterSpacing: '-0.02em', marginBottom: '4px' }}>
          {value}
        </div>
        {(subtitle || trend) && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#94a3b8' }}>
            {trend && (
              <span style={{ color: scheme.text, fontWeight: 600 }}>
                {trend}
              </span>
            )}
            {subtitle && <span>{subtitle}</span>}
          </div>
        )}
      </div>
    </div>
  );
};

export default StatCard;
