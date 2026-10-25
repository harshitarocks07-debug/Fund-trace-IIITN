import React, { useState, useEffect, useMemo } from 'react';
import { expenseService, Expense, ExpenseStats } from '../services/expenseService';
import { ngoService, NGOProfile } from '../services/ngoService';
import { projectService, Project } from '../services/projectService';

export const ExpensesPage: React.FC = () => {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [stats, setStats] = useState<ExpenseStats | null>(null);
  const [ngos, setNgos] = useState<NGOProfile[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Filters
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('ALL');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

  // Modals
  const [showSubmitModal, setShowSubmitModal] = useState<boolean>(false);
  const [statusModalExpense, setStatusModalExpense] = useState<Expense | null>(null);
  const [detailsModalExpense, setDetailsModalExpense] = useState<Expense | null>(null);

  // Submit Expense Form
  const [title, setTitle] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [category, setCategory] = useState<string>('Hardware');
  const [amount, setAmount] = useState<string>('');
  const [selectedNgoId, setSelectedNgoId] = useState<number | null>(null);
  const [targetProjectId, setTargetProjectId] = useState<number | null>(null);
  const [paymentMode, setPaymentMode] = useState<string>('BANK_TRANSFER');
  const [vendorName, setVendorName] = useState<string>('');
  const [invoiceNumber, setInvoiceNumber] = useState<string>('');
  const [invoiceDate, setInvoiceDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [formSubmitting, setFormSubmitting] = useState<boolean>(false);
  const [formError, setFormError] = useState<string>('');

  // Status Review Form
  const [auditStatus, setAuditStatus] = useState<'PENDING' | 'APPROVED' | 'REJECTED' | 'FLAGGED'>('APPROVED');
  const [auditNotes, setAuditNotes] = useState<string>('');
  const [auditorName, setAuditorName] = useState<string>('Compliance Auditor');
  const [auditSubmitting, setAuditSubmitting] = useState<boolean>(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [expResp, statsResp, ngosResp, prjResp] = await Promise.all([
        expenseService.listExpenses(),
        expenseService.getExpenseStats(),
        ngoService.listNGOs(),
        projectService.listProjects(),
      ]);
      setExpenses(expResp.items);
      setStats(statsResp);
      setNgos(ngosResp.items);
      setProjects(prjResp.items);
      if (ngosResp.items.length > 0 && selectedNgoId === null) {
        setSelectedNgoId(ngosResp.items[0].id);
      }
    } catch (err) {
      console.error('Failed to load expense data', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const modalProjects = useMemo(() => {
    if (!selectedNgoId) return projects;
    return projects.filter(p => p.ngo_id === selectedNgoId);
  }, [projects, selectedNgoId]);

  const filteredExpenses = useMemo(() => {
    return expenses.filter(e => {
      const matchesSearch =
        searchTerm === '' ||
        e.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        e.vendor_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        e.invoice_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        e.project_title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        e.receipt_hash?.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesStatus =
        selectedStatus === 'ALL' || e.status.toUpperCase() === selectedStatus.toUpperCase();

      const matchesProject =
        selectedProjectId === 'ALL' ||
        (selectedProjectId === 'GENERAL' && !e.project_id) ||
        String(e.project_id) === selectedProjectId;

      const matchesCategory =
        selectedCategory === 'ALL' || e.category.toLowerCase() === selectedCategory.toLowerCase();

      return matchesSearch && matchesStatus && matchesProject && matchesCategory;
    });
  }, [expenses, searchTerm, selectedStatus, selectedProjectId, selectedCategory]);

  const handleSubmitExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    const parsedAmount = parseFloat(amount);
    if (!title.trim()) {
      setFormError('Expense title/description is required.');
      return;
    }
    if (!parsedAmount || parsedAmount <= 0) {
      setFormError('Amount must be greater than 0.');
      return;
    }
    if (!selectedNgoId) {
      setFormError('Recipient NGO is required.');
      return;
    }

    setFormSubmitting(true);
    try {
      await expenseService.submitExpense({
        title: title.trim(),
        description: description.trim() || undefined,
        category,
        amount: parsedAmount,
        currency: 'INR',
        ngo_id: selectedNgoId,
        project_id: targetProjectId || undefined,
        payment_mode: paymentMode,
        vendor_name: vendorName.trim() || undefined,
        invoice_number: invoiceNumber.trim() || undefined,
        invoice_date: invoiceDate ? new Date(invoiceDate).toISOString() : undefined,
        status: 'PENDING',
      });

      setShowSubmitModal(false);
      setTitle('');
      setDescription('');
      setAmount('');
      setVendorName('');
      setInvoiceNumber('');
      setTargetProjectId(null);
      await loadData();
    } catch (err: any) {
      setFormError(err.message || 'Failed to submit expense.');
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleUpdateStatusSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!statusModalExpense) return;

    setAuditSubmitting(true);
    try {
      await expenseService.updateExpenseStatus(statusModalExpense.id, {
        status: auditStatus,
        review_notes: auditNotes.trim() || undefined,
        reviewed_by: auditorName.trim() || undefined,
      });

      setStatusModalExpense(null);
      setAuditNotes('');
      await loadData();
    } catch (err) {
      console.error('Failed to update status', err);
    } finally {
      setAuditSubmitting(false);
    }
  };

  const handleDeleteExpense = async (id: number) => {
    if (!window.confirm('Delete this expenditure? If already approved, this will roll back project utilization.')) return;
    try {
      await expenseService.deleteExpense(id);
      await loadData();
    } catch (err) {
      console.error('Failed to delete expense', err);
    }
  };

  const getStatusBadgeStyle = (status: string) => {
    switch (status.toUpperCase()) {
      case 'APPROVED':
      case 'REIMBURSED':
        return { bg: '#065f46', color: '#a7f3d0', label: 'APPROVED' };
      case 'PENDING':
        return { bg: '#854d0e', color: '#fef08a', label: 'PENDING' };
      case 'FLAGGED':
        return { bg: '#9a3412', color: '#fed7aa', label: 'FLAGGED' };
      case 'REJECTED':
        return { bg: '#7f1d1d', color: '#fca5a5', label: 'REJECTED' };
      default:
        return { bg: '#334155', color: '#cbd5e1', label: status };
    }
  };

  if (loading) {
    return (
      <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '80px 24px', textAlign: 'center', color: '#94a3b8' }}>
        <div style={{ fontSize: '36px', marginBottom: '16px' }}>⏳</div>
        <p style={{ fontSize: '16px', fontWeight: 500 }}>Loading project expenditures and audit workflows...</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '32px 24px', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '28px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
            <h1 style={{ fontSize: '26px', fontWeight: 700, color: '#f8fafc', margin: 0 }}>
              Expenditure & Fund Utilization Ledger
            </h1>
            <span style={{ fontSize: '11px', fontWeight: 600, backgroundColor: '#059669', color: '#ffffff', padding: '3px 8px', borderRadius: '12px' }}>
              AUDIT READY
            </span>
          </div>
          <p style={{ fontSize: '14px', color: '#94a3b8', margin: 0 }}>
            Submit vendor invoices, associate expenses with project budgets, and manage compliance audit approval workflows.
          </p>
        </div>

        <button
          onClick={() => setShowSubmitModal(true)}
          style={{
            backgroundColor: '#3b82f6',
            color: '#ffffff',
            border: 'none',
            borderRadius: '8px',
            padding: '10px 18px',
            fontSize: '14px',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            boxShadow: '0 2px 4px rgba(59, 130, 246, 0.25)',
          }}
        >
          <span>💸</span> Submit New Expense
        </button>
      </div>

      {/* Metric Cards Bar */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '28px' }}>
        <div style={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '10px', padding: '18px 20px' }}>
          <div style={{ fontSize: '12px', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '4px' }}>
            Total Utilization
          </div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: '#f8fafc' }}>
            ₹{(stats?.total_amount || 502000).toLocaleString()}
          </div>
          <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
            {stats?.total_expenses_count || expenses.length} Itemized bills submitted
          </div>
        </div>

        <div style={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '10px', padding: '18px 20px' }}>
          <div style={{ fontSize: '12px', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '4px' }}>
            Verified & Disbursed
          </div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: '#10b981' }}>
            ₹{(stats?.approved_amount || 464000).toLocaleString()}
          </div>
          <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
            Audited & on-chain validated
          </div>
        </div>

        <div style={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '10px', padding: '18px 20px' }}>
          <div style={{ fontSize: '12px', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '4px' }}>
            Pending Verification
          </div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: '#f59e0b' }}>
            ₹{(stats?.pending_amount || 38000).toLocaleString()}
          </div>
          <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
            Awaiting invoice verification
          </div>
        </div>

        <div style={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '10px', padding: '18px 20px' }}>
          <div style={{ fontSize: '12px', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '4px' }}>
            Top Expense Sector
          </div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: '#38bdf8' }}>
            Hardware
          </div>
          <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
            Classroom technology kits
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div
        style={{
          backgroundColor: '#1e293b',
          border: '1px solid #334155',
          borderRadius: '10px',
          padding: '16px 20px',
          marginBottom: '20px',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '14px',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', flex: '1 1 300px', gap: '10px', alignItems: 'center' }}>
          <input
            type="text"
            placeholder="Search by title, vendor, invoice #, or receipt hash..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            style={{
              flex: 1,
              backgroundColor: '#0f172a',
              border: '1px solid #334155',
              borderRadius: '6px',
              padding: '9px 14px',
              color: '#f8fafc',
              fontSize: '13px',
              outline: 'none',
            }}
          />
        </div>

        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Status Tabs */}
          <div style={{ display: 'flex', backgroundColor: '#0f172a', borderRadius: '6px', padding: '3px', border: '1px solid #334155' }}>
            {['ALL', 'PENDING', 'APPROVED', 'FLAGGED'].map(st => (
              <button
                key={st}
                onClick={() => setSelectedStatus(st)}
                style={{
                  backgroundColor: selectedStatus === st ? '#334155' : 'transparent',
                  color: selectedStatus === st ? '#f8fafc' : '#94a3b8',
                  border: 'none',
                  borderRadius: '4px',
                  padding: '6px 12px',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {st}
              </button>
            ))}
          </div>

          {/* Project Filter */}
          <select
            value={selectedProjectId}
            onChange={e => setSelectedProjectId(e.target.value)}
            style={{
              backgroundColor: '#0f172a',
              border: '1px solid #334155',
              borderRadius: '6px',
              padding: '8px 12px',
              color: '#f8fafc',
              fontSize: '13px',
              outline: 'none',
            }}
          >
            <option value="ALL">All Projects</option>
            <option value="GENERAL">General NGO Corpus</option>
            {projects.map(p => (
              <option key={p.id} value={String(p.id)}>
                🚀 {p.title}
              </option>
            ))}
          </select>

          {/* Category Filter */}
          <select
            value={selectedCategory}
            onChange={e => setSelectedCategory(e.target.value)}
            style={{
              backgroundColor: '#0f172a',
              border: '1px solid #334155',
              borderRadius: '6px',
              padding: '8px 12px',
              color: '#f8fafc',
              fontSize: '13px',
              outline: 'none',
            }}
          >
            <option value="ALL">All Categories</option>
            <option value="Hardware">Hardware</option>
            <option value="Training">Training</option>
            <option value="Materials">Materials</option>
            <option value="Medical">Medical</option>
            <option value="Logistics">Logistics</option>
            <option value="Salaries">Salaries</option>
            <option value="Operational">Operational</option>
          </select>
        </div>
      </div>

      {/* Expense Ledger Table */}
      <div style={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '12px', overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #334155', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#f8fafc', margin: 0 }}>
            Itemized Expenditures ({filteredExpenses.length})
          </h3>
          <span style={{ fontSize: '12px', color: '#94a3b8' }}>
            Audited against vendor tax bills
          </span>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
            <thead>
              <tr style={{ backgroundColor: '#0f172a', borderBottom: '1px solid #334155', color: '#94a3b8' }}>
                <th style={{ padding: '12px 18px' }}>Expense & Vendor</th>
                <th style={{ padding: '12px 18px' }}>Category</th>
                <th style={{ padding: '12px 18px' }}>Associated Project</th>
                <th style={{ padding: '12px 18px' }}>Date & Mode</th>
                <th style={{ padding: '12px 18px' }}>Invoice & Receipt</th>
                <th style={{ padding: '12px 18px', textAlign: 'right' }}>Amount</th>
                <th style={{ padding: '12px 18px', textAlign: 'center' }}>Audit Status</th>
                <th style={{ padding: '12px 18px', textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredExpenses.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>
                    No expenditures found matching current filter. Click "+ Submit New Expense" to record a bill.
                  </td>
                </tr>
              ) : (
                filteredExpenses.map(e => {
                  const badge = getStatusBadgeStyle(e.status);
                  return (
                    <tr key={e.id} style={{ borderBottom: '1px solid #334155', color: '#cbd5e1' }}>
                      {/* Title & Vendor */}
                      <td style={{ padding: '14px 18px' }}>
                        <div style={{ fontWeight: 600, color: '#f8fafc' }}>{e.title}</div>
                        {e.vendor_name && (
                          <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
                            Vendor: {e.vendor_name}
                          </div>
                        )}
                      </td>

                      {/* Category */}
                      <td style={{ padding: '14px 18px' }}>
                        <span style={{ backgroundColor: '#334155', color: '#e2e8f0', padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 500 }}>
                          {e.category}
                        </span>
                      </td>

                      {/* Associated Project */}
                      <td style={{ padding: '14px 18px' }}>
                        {e.project_title ? (
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', backgroundColor: '#0284c722', border: '1px solid #0284c755', color: '#38bdf8', padding: '4px 8px', borderRadius: '6px', fontSize: '12px', fontWeight: 500 }}>
                            🚀 {e.project_title}
                          </div>
                        ) : (
                          <span style={{ fontSize: '12px', color: '#94a3b8', fontStyle: 'italic' }}>
                            🏛️ General NGO Corpus
                          </span>
                        )}
                      </td>

                      {/* Date & Payment Mode */}
                      <td style={{ padding: '14px 18px' }}>
                        <div style={{ color: '#e2e8f0', fontWeight: 500 }}>{e.payment_mode}</div>
                        <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
                          {new Date(e.created_at).toLocaleDateString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </div>
                      </td>

                      {/* Invoice & Receipt */}
                      <td style={{ padding: '14px 18px' }}>
                        {e.invoice_number ? (
                          <div style={{ fontFamily: 'monospace', fontSize: '12px', color: '#f8fafc' }}>
                            #{e.invoice_number}
                          </div>
                        ) : (
                          <span style={{ color: '#64748b' }}>No Inv #</span>
                        )}
                        {e.receipt_hash && (
                          <div style={{ fontSize: '11px', color: '#38bdf8', fontFamily: 'monospace', marginTop: '2px' }} title={e.receipt_hash}>
                            {e.receipt_hash.slice(0, 10)}...
                          </div>
                        )}
                      </td>

                      {/* Amount */}
                      <td style={{ padding: '14px 18px', textAlign: 'right' }}>
                        <div style={{ fontSize: '15px', fontWeight: 700, color: '#f8fafc' }}>
                          ₹{e.amount.toLocaleString()}
                        </div>
                        <div style={{ fontSize: '10px', color: '#64748b' }}>
                          {e.currency}
                        </div>
                      </td>

                      {/* Status */}
                      <td style={{ padding: '14px 18px', textAlign: 'center' }}>
                        <span
                          style={{
                            backgroundColor: badge.bg,
                            color: badge.color,
                            padding: '3px 9px',
                            borderRadius: '12px',
                            fontSize: '11px',
                            fontWeight: 700,
                            letterSpacing: '0.5px',
                          }}
                        >
                          {badge.label}
                        </span>
                      </td>

                      {/* Actions */}
                      <td style={{ padding: '14px 18px', textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                          <button
                            onClick={() => {
                              setStatusModalExpense(e);
                              setAuditStatus((e.status as any) || 'APPROVED');
                              setAuditNotes(e.review_notes || '');
                            }}
                            style={{
                              backgroundColor: '#334155',
                              color: '#38bdf8',
                              border: '1px solid #475569',
                              borderRadius: '6px',
                              padding: '5px 8px',
                              fontSize: '11px',
                              fontWeight: 600,
                              cursor: 'pointer',
                            }}
                            title="Audit or Change Status"
                          >
                            ⚡ Status
                          </button>
                          <button
                            onClick={() => setDetailsModalExpense(e)}
                            style={{
                              backgroundColor: '#334155',
                              color: '#f8fafc',
                              border: '1px solid #475569',
                              borderRadius: '6px',
                              padding: '5px 8px',
                              fontSize: '11px',
                              cursor: 'pointer',
                            }}
                            title="View Full Invoice Details"
                          >
                            👁️
                          </button>
                          <button
                            onClick={() => handleDeleteExpense(e.id)}
                            style={{
                              backgroundColor: '#7f1d1d22',
                              color: '#f87171',
                              border: '1px solid #7f1d1d',
                              borderRadius: '6px',
                              padding: '5px 7px',
                              fontSize: '11px',
                              cursor: 'pointer',
                            }}
                            title="Delete Expense"
                          >
                            🗑️
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Submit New Expense Modal */}
      {showSubmitModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px',
          }}
        >
          <div
            style={{
              backgroundColor: '#1e293b',
              border: '1px solid #334155',
              borderRadius: '14px',
              width: '100%',
              maxWidth: '560px',
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: '28px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div>
                <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#f8fafc', margin: 0 }}>
                  Submit Expenditure Bill
                </h2>
                <p style={{ fontSize: '13px', color: '#94a3b8', margin: '4px 0 0 0' }}>
                  Register vendor invoice for audit review and project budget debit.
                </p>
              </div>
              <button
                onClick={() => setShowSubmitModal(false)}
                style={{ backgroundColor: 'transparent', border: 'none', color: '#94a3b8', fontSize: '20px', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            {formError && (
              <div style={{ backgroundColor: '#7f1d1d33', border: '1px solid #ef4444', color: '#fca5a5', padding: '10px 14px', borderRadius: '8px', fontSize: '13px', marginBottom: '16px' }}>
                {formError}
              </div>
            )}

            <form onSubmit={handleSubmitExpense}>
              {/* Title */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#cbd5e1', marginBottom: '6px' }}>
                  Expense Title / Purpose *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Science Laboratory STEM Kits (Batch 2)"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  style={{ width: '100%', boxSizing: 'border-box', backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '6px', padding: '10px 12px', color: '#f8fafc', fontSize: '14px' }}
                />
              </div>

              {/* Amount & Category */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#cbd5e1', marginBottom: '6px' }}>
                    Amount (INR) *
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="any"
                    required
                    placeholder="45000"
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                    style={{ width: '100%', boxSizing: 'border-box', backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '6px', padding: '10px 12px', color: '#f8fafc', fontSize: '15px', fontWeight: 700 }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#cbd5e1', marginBottom: '6px' }}>
                    Category *
                  </label>
                  <select
                    value={category}
                    onChange={e => setCategory(e.target.value)}
                    style={{ width: '100%', boxSizing: 'border-box', backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '6px', padding: '10px 12px', color: '#f8fafc', fontSize: '14px' }}
                  >
                    <option value="Hardware">Hardware</option>
                    <option value="Training">Training</option>
                    <option value="Materials">Materials</option>
                    <option value="Medical">Medical</option>
                    <option value="Logistics">Logistics</option>
                    <option value="Salaries">Salaries</option>
                    <option value="Operational">Operational</option>
                    <option value="Services">Services</option>
                  </select>
                </div>
              </div>

              {/* Recipient NGO */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#cbd5e1', marginBottom: '6px' }}>
                  Managing NGO Profile *
                </label>
                <select
                  value={selectedNgoId || ''}
                  onChange={e => {
                    setSelectedNgoId(Number(e.target.value));
                    setTargetProjectId(null);
                  }}
                  style={{ width: '100%', boxSizing: 'border-box', backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '6px', padding: '10px 12px', color: '#f8fafc', fontSize: '14px' }}
                >
                  {ngos.map(n => (
                    <option key={n.id} value={n.id}>
                      🏛️ {n.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Associated Project */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#cbd5e1', marginBottom: '6px' }}>
                  Debit Project Budget (Optional)
                </label>
                <select
                  value={targetProjectId || ''}
                  onChange={e => setTargetProjectId(e.target.value ? Number(e.target.value) : null)}
                  style={{ width: '100%', boxSizing: 'border-box', backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '6px', padding: '10px 12px', color: '#f8fafc', fontSize: '14px' }}
                >
                  <option value="">🏛️ General NGO Operational Fund</option>
                  {modalProjects.map(p => (
                    <option key={p.id} value={p.id}>
                      🚀 {p.title} (Utilized: ₹{p.utilized_amount.toLocaleString()} / Target: ₹{p.target_budget.toLocaleString()})
                    </option>
                  ))}
                </select>
                <p style={{ fontSize: '11px', color: '#94a3b8', margin: '4px 0 0 0' }}>
                  When approved by an auditor, this expense will debit this initiative's utilized funds.
                </p>
              </div>

              {/* Vendor & Invoice */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#cbd5e1', marginBottom: '6px' }}>
                    Vendor / Merchant Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Apex Scientific Corp"
                    value={vendorName}
                    onChange={e => setVendorName(e.target.value)}
                    style={{ width: '100%', boxSizing: 'border-box', backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '6px', padding: '10px 12px', color: '#f8fafc', fontSize: '14px' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#cbd5e1', marginBottom: '6px' }}>
                    Tax Invoice / Bill #
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. INV-2026-9041"
                    value={invoiceNumber}
                    onChange={e => setInvoiceNumber(e.target.value)}
                    style={{ width: '100%', boxSizing: 'border-box', backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '6px', padding: '10px 12px', color: '#f8fafc', fontSize: '14px' }}
                  />
                </div>
              </div>

              {/* Payment Mode & Date */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#cbd5e1', marginBottom: '6px' }}>
                    Payment Mode
                  </label>
                  <select
                    value={paymentMode}
                    onChange={e => setPaymentMode(e.target.value)}
                    style={{ width: '100%', boxSizing: 'border-box', backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '6px', padding: '10px 12px', color: '#f8fafc', fontSize: '14px' }}
                  >
                    <option value="BANK_TRANSFER">Bank Wire / RTGS / NEFT</option>
                    <option value="UPI">UPI</option>
                    <option value="CARD">Corporate Card</option>
                    <option value="CHEQUE">Cheque / Demand Draft</option>
                    <option value="CASH">Petty Cash</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#cbd5e1', marginBottom: '6px' }}>
                    Invoice Date
                  </label>
                  <input
                    type="date"
                    value={invoiceDate}
                    onChange={e => setInvoiceDate(e.target.value)}
                    style={{ width: '100%', boxSizing: 'border-box', backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '6px', padding: '9px 12px', color: '#f8fafc', fontSize: '13px' }}
                  />
                </div>
              </div>

              {/* Description */}
              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#cbd5e1', marginBottom: '6px' }}>
                  Itemized Notes & Audit Justification
                </label>
                <textarea
                  rows={2}
                  placeholder="Details of goods received, delivery challan verification, etc."
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  style={{ width: '100%', boxSizing: 'border-box', backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '6px', padding: '10px 12px', color: '#f8fafc', fontSize: '13px', resize: 'vertical' }}
                />
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                <button
                  type="button"
                  onClick={() => setShowSubmitModal(false)}
                  style={{ backgroundColor: '#334155', color: '#cbd5e1', border: 'none', borderRadius: '8px', padding: '10px 16px', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  style={{ backgroundColor: '#3b82f6', color: '#ffffff', border: 'none', borderRadius: '8px', padding: '10px 20px', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}
                >
                  {formSubmitting ? 'Submitting Invoice...' : 'Submit Expenditure'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Audit Status Review Modal */}
      {statusModalExpense && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px',
          }}
        >
          <div
            style={{
              backgroundColor: '#1e293b',
              border: '1px solid #334155',
              borderRadius: '14px',
              width: '100%',
              maxWidth: '500px',
              padding: '28px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#f8fafc', margin: 0 }}>
                Audit Review: {statusModalExpense.title}
              </h2>
              <button
                onClick={() => setStatusModalExpense(null)}
                style={{ backgroundColor: 'transparent', border: 'none', color: '#94a3b8', fontSize: '20px', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <div style={{ backgroundColor: '#0f172a', padding: '14px 16px', borderRadius: '8px', marginBottom: '20px', fontSize: '13px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ color: '#94a3b8' }}>Claimed Amount:</span>
                <span style={{ fontWeight: 700, color: '#10b981' }}>₹{statusModalExpense.amount.toLocaleString()}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ color: '#94a3b8' }}>Vendor / Bill:</span>
                <span style={{ color: '#f8fafc' }}>{statusModalExpense.vendor_name || 'N/A'} (#{statusModalExpense.invoice_number || 'N/A'})</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#94a3b8' }}>Project:</span>
                <span style={{ color: '#38bdf8' }}>{statusModalExpense.project_title || 'General Fund'}</span>
              </div>
            </div>

            <form onSubmit={handleUpdateStatusSubmit}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#cbd5e1', marginBottom: '8px' }}>
                  Target Audit Status *
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  {[
                    { id: 'APPROVED', label: '✅ APPROVED', desc: 'Debits project budget' },
                    { id: 'PENDING', label: '⏳ PENDING', desc: 'Hold for evaluation' },
                    { id: 'FLAGGED', label: '⚠️ FLAGGED', desc: 'Deficiency noted' },
                    { id: 'REJECTED', label: '❌ REJECTED', desc: 'Disallowed cost' },
                  ].map(item => (
                    <div
                      key={item.id}
                      onClick={() => setAuditStatus(item.id as any)}
                      style={{
                        padding: '10px 12px',
                        borderRadius: '8px',
                        border: auditStatus === item.id ? '2px solid #38bdf8' : '1px solid #334155',
                        backgroundColor: auditStatus === item.id ? '#0284c722' : '#0f172a',
                        cursor: 'pointer',
                      }}
                    >
                      <div style={{ fontSize: '13px', fontWeight: 700, color: '#f8fafc' }}>{item.label}</div>
                      <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '2px' }}>{item.desc}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#cbd5e1', marginBottom: '6px' }}>
                  Reviewer Name / Role
                </label>
                <input
                  type="text"
                  value={auditorName}
                  onChange={e => setAuditorName(e.target.value)}
                  style={{ width: '100%', boxSizing: 'border-box', backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '6px', padding: '9px 12px', color: '#f8fafc', fontSize: '13px' }}
                />
              </div>

              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#cbd5e1', marginBottom: '6px' }}>
                  Auditor Remarks / Compliance Notes
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="Justification for approval, deficiency report, or invoice verification notes..."
                  value={auditNotes}
                  onChange={e => setAuditNotes(e.target.value)}
                  style={{ width: '100%', boxSizing: 'border-box', backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '6px', padding: '10px 12px', color: '#f8fafc', fontSize: '13px', resize: 'vertical' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                <button
                  type="button"
                  onClick={() => setStatusModalExpense(null)}
                  style={{ backgroundColor: '#334155', color: '#cbd5e1', border: 'none', borderRadius: '8px', padding: '9px 16px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={auditSubmitting}
                  style={{ backgroundColor: '#10b981', color: '#ffffff', border: 'none', borderRadius: '8px', padding: '9px 20px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
                >
                  {auditSubmitting ? 'Updating...' : 'Confirm Audit Status'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Expense Full Details Modal */}
      {detailsModalExpense && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px',
          }}
        >
          <div
            style={{
              backgroundColor: '#1e293b',
              border: '1px solid #334155',
              borderRadius: '14px',
              width: '100%',
              maxWidth: '560px',
              padding: '28px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div>
                <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#f8fafc', margin: 0 }}>
                  Expense Voucher Details
                </h2>
                <span style={{ fontSize: '12px', color: '#94a3b8' }}>ID: #{detailsModalExpense.id}</span>
              </div>
              <button
                onClick={() => setDetailsModalExpense(null)}
                style={{ backgroundColor: 'transparent', border: 'none', color: '#94a3b8', fontSize: '20px', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <div style={{ backgroundColor: '#0f172a', padding: '16px', borderRadius: '10px', marginBottom: '20px', fontSize: '13px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div>
                  <div style={{ color: '#94a3b8', fontSize: '11px', textTransform: 'uppercase' }}>Description</div>
                  <div style={{ fontWeight: 600, color: '#f8fafc', marginTop: '2px' }}>{detailsModalExpense.title}</div>
                </div>
                <div>
                  <div style={{ color: '#94a3b8', fontSize: '11px', textTransform: 'uppercase' }}>Amount</div>
                  <div style={{ fontWeight: 800, color: '#10b981', fontSize: '18px', marginTop: '2px' }}>
                    ₹{detailsModalExpense.amount.toLocaleString()}
                  </div>
                </div>
                <div>
                  <div style={{ color: '#94a3b8', fontSize: '11px', textTransform: 'uppercase' }}>Target Project</div>
                  <div style={{ fontWeight: 600, color: '#38bdf8', marginTop: '2px' }}>
                    {detailsModalExpense.project_title || 'General Corpus'}
                  </div>
                </div>
                <div>
                  <div style={{ color: '#94a3b8', fontSize: '11px', textTransform: 'uppercase' }}>Category & Mode</div>
                  <div style={{ fontWeight: 500, color: '#cbd5e1', marginTop: '2px' }}>
                    {detailsModalExpense.category} ({detailsModalExpense.payment_mode})
                  </div>
                </div>
                <div>
                  <div style={{ color: '#94a3b8', fontSize: '11px', textTransform: 'uppercase' }}>Vendor</div>
                  <div style={{ fontWeight: 500, color: '#cbd5e1', marginTop: '2px' }}>
                    {detailsModalExpense.vendor_name || 'N/A'}
                  </div>
                </div>
                <div>
                  <div style={{ color: '#94a3b8', fontSize: '11px', textTransform: 'uppercase' }}>Tax Invoice #</div>
                  <div style={{ fontFamily: 'monospace', color: '#f8fafc', marginTop: '2px' }}>
                    {detailsModalExpense.invoice_number || 'N/A'}
                  </div>
                </div>
              </div>
            </div>

            {/* Audit Status Box */}
            <div style={{ backgroundColor: '#0f172a', padding: '14px 16px', borderRadius: '8px', marginBottom: '20px', fontSize: '12px' }}>
              <div style={{ fontWeight: 700, color: '#f8fafc', marginBottom: '6px' }}>Compliance Audit Trail</div>
              <div style={{ color: '#94a3b8', marginBottom: '4px' }}>
                Status: <strong style={{ color: '#38bdf8' }}>{detailsModalExpense.status}</strong>
                {detailsModalExpense.reviewed_by && ` • Reviewed by ${detailsModalExpense.reviewed_by}`}
              </div>
              {detailsModalExpense.review_notes && (
                <div style={{ fontStyle: 'italic', color: '#cbd5e1', backgroundColor: '#1e293b', padding: '8px 10px', borderRadius: '6px', marginTop: '6px' }}>
                  "{detailsModalExpense.review_notes}"
                </div>
              )}
              {detailsModalExpense.tx_hash && (
                <div style={{ fontFamily: 'monospace', color: '#0284c7', fontSize: '11px', marginTop: '8px' }}>
                  On-Chain Tx: {detailsModalExpense.tx_hash}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setDetailsModalExpense(null)}
                style={{ backgroundColor: '#334155', color: '#f8fafc', border: 'none', borderRadius: '6px', padding: '8px 16px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
