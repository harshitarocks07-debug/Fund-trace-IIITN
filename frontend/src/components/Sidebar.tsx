import React from 'react';

interface SidebarProps {
  currentView: string;
  onNavigate: (view: any) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentView, onNavigate }) => {
  const menuItems = [
    { id: 'dashboard', label: 'NGO Dashboard', icon: '🏛️' },
    { id: 'directory', label: 'NGO Directory', icon: '📋' },
    { id: 'projects', label: 'Projects', icon: '🚀' },
    { id: 'donations', label: 'Donations', icon: '💰' },
    { id: 'expenses', label: 'Expenses', icon: '📑' },
    { id: 'audits', label: 'Audit Logs', icon: '🛡️' },
  ];

  return (
    <aside
      style={{
        width: '240px',
        backgroundColor: '#0f172a',
        borderRight: '1px solid #1e293b',
        padding: '24px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
      }}
    >
      <div style={{ fontSize: '11px', textTransform: 'uppercase', color: '#64748b', fontWeight: 600, padding: '0 12px 8px' }}>
        Menu
      </div>
      {menuItems.map((item) => (
        <button
          key={item.id}
          onClick={() => onNavigate(item.id)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '10px 14px',
            borderRadius: '8px',
            border: 'none',
            backgroundColor: currentView === item.id ? '#1e293b' : 'transparent',
            color: currentView === item.id ? '#38bdf8' : '#94a3b8',
            fontWeight: currentView === item.id ? 600 : 500,
            fontSize: '14px',
            cursor: 'pointer',
            textAlign: 'left',
            transition: 'all 0.15s ease',
          }}
        >
          <span>{item.icon}</span>
          <span>{item.label}</span>
        </button>
      ))}
    </aside>
  );
};

export default Sidebar;
