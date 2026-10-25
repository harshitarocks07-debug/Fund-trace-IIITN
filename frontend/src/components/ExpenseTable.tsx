import React from 'react';

export interface ExpenseItem {
  id: string | number;
  description: string;
  category: string;
  amount: number;
  date: string;
  status: 'Verified' | 'Pending' | 'Flagged' | string;
  receiptUrl?: string;
}

interface ExpenseTableProps {
  expenses?: ExpenseItem[];
}

export const ExpenseTable: React.FC<ExpenseTableProps> = ({
  expenses = [
    { id: 1, description: 'Classroom Tablets & Solar Chargers', category: 'Hardware', amount: 185000, date: '2026-02-10', status: 'Verified' },
    { id: 2, description: 'Teacher Training Workshops - Vidarbha', category: 'Training', amount: 95000, date: '2026-02-05', status: 'Verified' },
    { id: 3, description: 'STEM Kits & Science Supplies', category: 'Materials', amount: 64000, date: '2026-01-28', status: 'Verified' },
    { id: 4, description: 'Mobile Clinic Fuel & Logistics', category: 'Transport', amount: 42000, date: '2026-01-20', status: 'Verified' },
  ],
}) => {
  return (
    <div
      style={{
        backgroundColor: '#1e293b',
        border: '1px solid #334155',
        borderRadius: '12px',
        overflow: 'hidden',
      }}
    >
      <div style={{ padding: '20px 24px', borderBottom: '1px solid #334155' }}>
        <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#f8fafc' }}>
          Audited Utilization Expenses
        </h3>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
          <thead>
            <tr style={{ backgroundColor: '#0f172a', borderBottom: '1px solid #334155', color: '#94a3b8' }}>
              <th style={{ padding: '12px 20px', fontWeight: 600 }}>Description</th>
              <th style={{ padding: '12px 20px', fontWeight: 600 }}>Category</th>
              <th style={{ padding: '12px 20px', fontWeight: 600 }}>Date</th>
              <th style={{ padding: '12px 20px', fontWeight: 600, textAlign: 'right' }}>Amount</th>
              <th style={{ padding: '12px 20px', fontWeight: 600, textAlign: 'center' }}>Audit Status</th>
            </tr>
          </thead>
          <tbody>
            {expenses.map((item) => (
              <tr key={item.id} style={{ borderBottom: '1px solid #334155', color: '#cbd5e1' }}>
                <td style={{ padding: '14px 20px', fontWeight: 500, color: '#f8fafc' }}>{item.description}</td>
                <td style={{ padding: '14px 20px' }}>
                  <span style={{ backgroundColor: '#334155', padding: '3px 8px', borderRadius: '4px', fontSize: '11px' }}>
                    {item.category}
                  </span>
                </td>
                <td style={{ padding: '14px 20px', color: '#94a3b8' }}>{item.date}</td>
                <td style={{ padding: '14px 20px', textAlign: 'right', fontWeight: 600, color: '#f8fafc' }}>
                  ₹{item.amount.toLocaleString()}
                </td>
                <td style={{ padding: '14px 20px', textAlign: 'center' }}>
                  <span style={{ color: '#10b981', backgroundColor: 'rgba(16, 185, 129, 0.1)', padding: '3px 8px', borderRadius: '9999px', fontSize: '11px', fontWeight: 600 }}>
                    {item.status}
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

export default ExpenseTable;
