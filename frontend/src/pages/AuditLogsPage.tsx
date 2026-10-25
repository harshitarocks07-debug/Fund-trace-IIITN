import React from 'react';

export const AuditLogsPage: React.FC = () => {
  const logs = [
    { id: 1, action: 'NGO Verified', target: 'Vidya Jyoti Foundation', performedBy: 'National Board Auditor #4', timestamp: '2026-02-15 14:32', status: 'SUCCESS' },
    { id: 2, action: 'Profile Updated', target: 'Arogya Seva Trust', performedBy: 'Org Admin (contact@arogyaseva.org)', timestamp: '2026-02-14 11:20', status: 'SUCCESS' },
    { id: 3, action: 'Document Uploaded', target: 'Vana Raksha Mission', performedBy: 'Org Admin (grow@vanaraksha.eco)', timestamp: '2026-02-12 09:15', status: 'SUCCESS' },
    { id: 4, action: 'Audit Review Requested', target: 'Vana Raksha Mission', performedBy: 'System Engine', timestamp: '2026-02-12 09:16', status: 'INFO' },
  ];

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '32px 24px' }}>
      <div style={{ marginBottom: '28px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#f8fafc', marginBottom: '6px' }}>
          Platform Audit Logs
        </h1>
        <p style={{ fontSize: '14px', color: '#94a3b8' }}>
          Cryptographically signed system activity and governance logs.
        </p>
      </div>

      <div style={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '12px', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
          <thead>
            <tr style={{ backgroundColor: '#0f172a', borderBottom: '1px solid #334155', color: '#94a3b8' }}>
              <th style={{ padding: '12px 20px' }}>Action</th>
              <th style={{ padding: '12px 20px' }}>Target Entity</th>
              <th style={{ padding: '12px 20px' }}>Actor</th>
              <th style={{ padding: '12px 20px' }}>Timestamp</th>
              <th style={{ padding: '12px 20px', textAlign: 'center' }}>Result</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log.id} style={{ borderBottom: '1px solid #334155', color: '#cbd5e1' }}>
                <td style={{ padding: '14px 20px', fontWeight: 600, color: '#f8fafc' }}>{log.action}</td>
                <td style={{ padding: '14px 20px' }}>{log.target}</td>
                <td style={{ padding: '14px 20px', color: '#94a3b8' }}>{log.performedBy}</td>
                <td style={{ padding: '14px 20px', color: '#64748b' }}>{log.timestamp}</td>
                <td style={{ padding: '14px 20px', textAlign: 'center' }}>
                  <span style={{ color: '#10b981', backgroundColor: 'rgba(16, 185, 129, 0.1)', padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600 }}>
                    {log.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

