import React from 'react';

interface StatusBadgeProps {
  status: string;
  size?: 'sm' | 'md' | 'lg';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, size = 'md' }) => {
  const normStatus = (status || 'PENDING').toUpperCase();

  let bgClass = 'bg-amber-500/10 text-amber-400 border-amber-500/30';
  let dotColor = '#f59e0b';
  let label = normStatus;

  if (normStatus === 'VERIFIED' || normStatus === 'APPROVED' || normStatus === 'ACTIVE') {
    bgClass = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
    dotColor = '#10b981';
    label = 'Verified';
  } else if (normStatus === 'PENDING' || normStatus === 'IN_REVIEW') {
    bgClass = 'bg-amber-500/10 text-amber-400 border-amber-500/30';
    dotColor = '#f59e0b';
    label = 'Pending Review';
  } else if (normStatus === 'REJECTED') {
    bgClass = 'bg-rose-500/10 text-rose-400 border-rose-500/30';
    dotColor = '#f43f5e';
    label = 'Rejected';
  } else if (normStatus === 'SUSPENDED') {
    bgClass = 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    dotColor = '#94a3b8';
    label = 'Suspended';
  }

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-xs px-2.5 py-1',
    lg: 'text-sm px-3.5 py-1.5',
  }[size];

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        borderRadius: '9999px',
        fontWeight: 500,
        borderWidth: '1px',
        borderStyle: 'solid',
      }}
      className={`${bgClass} ${sizeClasses}`}
    >
      <span
        style={{
          width: '6px',
          height: '6px',
          borderRadius: '50%',
          backgroundColor: dotColor,
        }}
      />
      {label}
    </span>
  );
};

export default StatusBadge;
