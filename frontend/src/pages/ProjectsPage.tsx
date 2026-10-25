import React, { useState, useEffect } from 'react';
import { projectService, Project, ProjectBudgetSummary } from '../services/projectService';
import { StatCard } from '../components/StatCard';

interface ProjectsPageProps {
  onSelectProject?: (projectId: number) => void;
}

export const ProjectsPage: React.FC<ProjectsPageProps> = ({ onSelectProject }) => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [editProject, setEditProject] = useState<Project | null>(null);
  const [statusProject, setStatusProject] = useState<Project | null>(null);
  const [budgetModalProject, setBudgetModalProject] = useState<ProjectBudgetSummary | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // New Project Form Data
  const [newProject, setNewProject] = useState({
    ngo_id: 1,
    title: '',
    description: '',
    category: 'Education',
    target_budget: 500000,
    status: 'PLANNING',
    start_date: '',
    end_date: '',
    location: '',
    beneficiaries_target: 1000,
    milestones: '',
    wallet_address: '',
  });

  // Status Update State
  const [newStatus, setNewStatus] = useState<string>('ACTIVE');
  const [beneficiariesReached, setBeneficiariesReached] = useState<number>(0);
  const [statusNotes, setStatusNotes] = useState<string>('');

  useEffect(() => {
    fetchProjects();
  }, [searchTerm, selectedStatus, selectedCategory]);

  const fetchProjects = async () => {
    setLoading(true);
    try {
      const res = await projectService.listProjects({
        search: searchTerm || undefined,
        status: selectedStatus !== 'all' ? selectedStatus : undefined,
        category: selectedCategory !== 'all' ? selectedCategory : undefined,
      });
      setProjects(res.items);
    } catch (err) {
      console.error('Failed to load projects', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await projectService.createProject(newProject);
      setIsCreateModalOpen(false);
      setNewProject({
        ngo_id: 1,
        title: '',
        description: '',
        category: 'Education',
        target_budget: 500000,
        status: 'PLANNING',
        start_date: '',
        end_date: '',
        location: '',
        beneficiaries_target: 1000,
        milestones: '',
        wallet_address: '',
      });
      await fetchProjects();
    } catch (err: any) {
      alert(err.message || 'Error creating project');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editProject) return;
    setIsSubmitting(true);
    try {
      await projectService.updateProject(editProject.id, editProject);
      setEditProject(null);
      await fetchProjects();
    } catch (err: any) {
      alert(err.message || 'Error updating project');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!statusProject) return;
    setIsSubmitting(true);
    try {
      await projectService.updateProjectStatus(
        statusProject.id,
        newStatus,
        beneficiariesReached,
        statusNotes
      );
      setStatusProject(null);
      await fetchProjects();
    } catch (err: any) {
      alert(err.message || 'Error updating status');
    } finally {
      setIsSubmitting(false);
    }
  };

  const openBudgetBreakdown = async (projectId: number) => {
    if (onSelectProject) onSelectProject(projectId);
    try {
      const summary = await projectService.getProjectBudget(projectId);
      setBudgetModalProject(summary);
    } catch (err: any) {
      alert(err.message || 'Error loading budget analytics');
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const totalAllocated = projects.reduce((acc, p) => acc + (p.target_budget || 0), 0);
  const totalRaised = projects.reduce((acc, p) => acc + (p.raised_amount || 0), 0);
  const activeCount = projects.filter((p) => p.status === 'ACTIVE').length;
  const avgUtilization =
    totalRaised > 0
      ? Math.round((projects.reduce((acc, p) => acc + (p.utilized_amount || 0), 0) / totalRaised) * 100)
      : 0;

  const getStatusBadgeStyle = (status: string) => {
    switch (status.toUpperCase()) {
      case 'ACTIVE':
        return { bg: 'rgba(16, 185, 129, 0.15)', text: '#10b981', border: 'rgba(16, 185, 129, 0.3)', label: 'Active' };
      case 'COMPLETED':
        return { bg: 'rgba(168, 85, 247, 0.15)', text: '#c084fc', border: 'rgba(168, 85, 247, 0.3)', label: 'Completed' };
      case 'PLANNING':
        return { bg: 'rgba(56, 189, 248, 0.15)', text: '#38bdf8', border: 'rgba(56, 189, 248, 0.3)', label: 'Planning' };
      case 'PAUSED':
        return { bg: 'rgba(245, 158, 11, 0.15)', text: '#fbbf24', border: 'rgba(245, 158, 11, 0.3)', label: 'Paused' };
      default:
        return { bg: 'rgba(239, 68, 68, 0.15)', text: '#f87171', border: 'rgba(239, 68, 68, 0.3)', label: status };
    }
  };

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '32px 24px' }}>
      {/* Top Banner Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px',
          marginBottom: '28px',
        }}
      >
        <div>
          <h1 style={{ fontSize: '26px', fontWeight: 800, color: '#f8fafc', letterSpacing: '-0.02em', marginBottom: '6px' }}>
            Project Management & Budget Tracking
          </h1>
          <p style={{ fontSize: '14px', color: '#94a3b8' }}>
            Create and maintain projects, define target budgets, and track real-time milestone execution.
          </p>
        </div>

        <button
          onClick={() => setIsCreateModalOpen(true)}
          style={{
            backgroundColor: '#3b82f6',
            color: '#fff',
            padding: '10px 22px',
            borderRadius: '8px',
            border: 'none',
            fontWeight: 600,
            fontSize: '14px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)',
          }}
        >
          <span>➕</span> Create New Project
        </button>
      </div>

      {/* Metric Cards Row */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '20px',
          marginBottom: '32px',
        }}
      >
        <StatCard title="Active Projects" value={activeCount} subtitle="Currently delivering impact" icon="🚀" color="emerald" />
        <StatCard title="Total Budget Allocated" value={formatCurrency(totalAllocated)} subtitle="Across all programs" icon="📊" color="blue" />
        <StatCard title="Total Funds Raised" value={formatCurrency(totalRaised)} subtitle="Verified donor allocations" icon="💰" color="indigo" />
        <StatCard title="Budget Utilization" value={`${avgUtilization}%`} subtitle="Audited expense ratio" icon="⚡" color="purple" />
      </div>

      {/* Filter and Search Bar */}
      <div
        style={{
          backgroundColor: '#1e293b',
          border: '1px solid #334155',
          borderRadius: '12px',
          padding: '18px 20px',
          marginBottom: '28px',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '16px',
          alignItems: 'center',
        }}
      >
        <div style={{ flex: '1 1 280px' }}>
          <input
            type="text"
            placeholder="Search projects by title, location, or keywords..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 16px',
              backgroundColor: '#0f172a',
              border: '1px solid #334155',
              borderRadius: '8px',
              color: '#f8fafc',
              fontSize: '14px',
            }}
          />
        </div>

        <div style={{ minWidth: '170px' }}>
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 14px',
              backgroundColor: '#0f172a',
              border: '1px solid #334155',
              borderRadius: '8px',
              color: '#f8fafc',
              fontSize: '14px',
            }}
          >
            <option value="all">All Statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="PLANNING">Planning</option>
            <option value="COMPLETED">Completed</option>
            <option value="PAUSED">Paused</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </div>

        <div style={{ minWidth: '170px' }}>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 14px',
              backgroundColor: '#0f172a',
              border: '1px solid #334155',
              borderRadius: '8px',
              color: '#f8fafc',
              fontSize: '14px',
            }}
          >
            <option value="all">All Sectors</option>
            <option value="Education">Education</option>
            <option value="Healthcare">Healthcare</option>
            <option value="Environment">Environment</option>
            <option value="Rural Development">Rural Development</option>
          </select>
        </div>
      </div>

      {/* Projects Grid */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: '#94a3b8' }}>
          Loading projects...
        </div>
      ) : projects.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: '60px',
            backgroundColor: '#1e293b',
            borderRadius: '12px',
            border: '1px solid #334155',
          }}
        >
          <div style={{ fontSize: '36px', marginBottom: '12px' }}>📂</div>
          <h3 style={{ fontSize: '18px', fontWeight: 600, color: '#f8fafc', marginBottom: '8px' }}>
            No projects found
          </h3>
          <p style={{ fontSize: '14px', color: '#94a3b8' }}>
            Try adjusting your search criteria or create a new project.
          </p>
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(420px, 1fr))',
            gap: '24px',
          }}
        >
          {projects.map((project) => {
            const fundingPct = Math.min(100, Math.round(((project.raised_amount || 0) / (project.target_budget || 1)) * 100));
            const utilPct =
              (project.raised_amount || 0) > 0
                ? Math.min(100, Math.round(((project.utilized_amount || 0) / (project.raised_amount || 1)) * 100))
                : 0;
            const badge = getStatusBadgeStyle(project.status);

            return (
              <div
                key={project.id}
                style={{
                  backgroundColor: '#1e293b',
                  border: '1px solid #334155',
                  borderRadius: '14px',
                  padding: '24px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                }}
              >
                <div>
                  {/* Card Header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                    <span
                      style={{
                        backgroundColor: 'rgba(56, 189, 248, 0.1)',
                        color: '#38bdf8',
                        border: '1px solid rgba(56, 189, 248, 0.3)',
                        padding: '2px 10px',
                        borderRadius: '9999px',
                        fontSize: '11px',
                        fontWeight: 600,
                      }}
                    >
                      {project.category}
                    </span>

                    <span
                      style={{
                        backgroundColor: badge.bg,
                        color: badge.text,
                        border: `1px solid ${badge.border}`,
                        padding: '3px 10px',
                        borderRadius: '9999px',
                        fontSize: '11px',
                        fontWeight: 600,
                      }}
                    >
                      {badge.label}
                    </span>
                  </div>

                  <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#f8fafc', marginBottom: '6px' }}>
                    {project.title}
                  </h3>

                  {project.ngo_name && (
                    <div style={{ fontSize: '12px', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px' }}>
                      <span>🏛️</span>
                      <span>{project.ngo_name}</span>
                    </div>
                  )}

                  <p
                    style={{
                      fontSize: '13px',
                      color: '#cbd5e1',
                      lineHeight: '1.5',
                      marginBottom: '20px',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }}
                  >
                    {project.description || 'No description provided.'}
                  </p>

                  {/* Financial & Budget Progress Bars */}
                  <div style={{ marginBottom: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '6px' }}>
                      <span style={{ color: '#94a3b8' }}>Funding Progress</span>
                      <span style={{ color: '#f8fafc', fontWeight: 600 }}>
                        {formatCurrency(project.raised_amount || 0)} / {formatCurrency(project.target_budget || 0)} ({fundingPct}%)
                      </span>
                    </div>
                    <div style={{ height: '8px', backgroundColor: '#0f172a', borderRadius: '4px', overflow: 'hidden' }}>
                      <div style={{ width: `${fundingPct}%`, height: '100%', backgroundColor: '#10b981', transition: 'width 0.3s ease' }} />
                    </div>
                  </div>

                  <div style={{ marginBottom: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '6px' }}>
                      <span style={{ color: '#94a3b8' }}>Budget Utilization</span>
                      <span style={{ color: '#f8fafc', fontWeight: 600 }}>
                        {formatCurrency(project.utilized_amount || 0)} spent ({utilPct}%)
                      </span>
                    </div>
                    <div style={{ height: '8px', backgroundColor: '#0f172a', borderRadius: '4px', overflow: 'hidden' }}>
                      <div style={{ width: `${utilPct}%`, height: '100%', backgroundColor: '#3b82f6', transition: 'width 0.3s ease' }} />
                    </div>
                  </div>

                  {/* Impact & Location Details */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: '12px',
                      backgroundColor: '#0f172a',
                      padding: '12px',
                      borderRadius: '8px',
                      marginBottom: '20px',
                      fontSize: '12px',
                    }}
                  >
                    <div>
                      <span style={{ color: '#64748b', display: 'block' }}>Beneficiaries</span>
                      <span style={{ color: '#f8fafc', fontWeight: 600 }}>
                        {(project.beneficiaries_reached || 0).toLocaleString()} / {(project.beneficiaries_target || 0).toLocaleString()}
                      </span>
                    </div>
                    <div>
                      <span style={{ color: '#64748b', display: 'block' }}>Location</span>
                      <span style={{ color: '#f8fafc', fontWeight: 600 }}>
                        {project.location || 'Pan-India'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Card Action Buttons */}
                <div style={{ display: 'flex', gap: '8px', borderTop: '1px solid #334155', paddingTop: '16px' }}>
                  <button
                    onClick={() => setEditProject(project)}
                    style={{
                      flex: 1,
                      padding: '8px',
                      backgroundColor: '#3b82f6',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    ✏️ Edit Budget
                  </button>

                  <button
                    onClick={() => {
                      setStatusProject(project);
                      setNewStatus(project.status);
                      setBeneficiariesReached(project.beneficiaries_reached || 0);
                    }}
                    style={{
                      flex: 1,
                      padding: '8px',
                      backgroundColor: '#334155',
                      color: '#cbd5e1',
                      border: 'none',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    🔄 Update Status
                  </button>

                  <button
                    onClick={() => openBudgetBreakdown(project.id)}
                    style={{
                      padding: '8px 12px',
                      backgroundColor: '#0f172a',
                      color: '#38bdf8',
                      border: '1px solid #334155',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                    title="View Detailed Budget Analytics"
                  >
                    📊
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* CREATE PROJECT MODAL */}
      {isCreateModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
            zIndex: 100,
          }}
        >
          <div
            style={{
              backgroundColor: '#1e293b',
              border: '1px solid #334155',
              borderRadius: '16px',
              maxWidth: '680px',
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: '28px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#f8fafc' }}>
                Create New Project & Define Budget
              </h2>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '22px', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateProject}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                <div style={{ gridColumn: 'span 2' }}>
                  <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>Project Title *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Rural Digital Classrooms 2026"
                    value={newProject.title}
                    onChange={(e) => setNewProject({ ...newProject, title: e.target.value })}
                    style={{ width: '100%', padding: '10px 12px', backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '6px', color: '#fff', fontSize: '13px' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>Sector / Category *</label>
                  <select
                    value={newProject.category}
                    onChange={(e) => setNewProject({ ...newProject, category: e.target.value })}
                    style={{ width: '100%', padding: '10px 12px', backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '6px', color: '#fff', fontSize: '13px' }}
                  >
                    <option value="Education">Education</option>
                    <option value="Healthcare">Healthcare</option>
                    <option value="Environment">Environment</option>
                    <option value="Rural Development">Rural Development</option>
                    <option value="Disaster Relief">Disaster Relief</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>Target Budget (₹ INR) *</label>
                  <input
                    type="number"
                    required
                    min="1"
                    placeholder="500000"
                    value={newProject.target_budget}
                    onChange={(e) => setNewProject({ ...newProject, target_budget: parseFloat(e.target.value) || 0 })}
                    style={{ width: '100%', padding: '10px 12px', backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '6px', color: '#fff', fontSize: '13px' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>Initial Lifecycle Status</label>
                  <select
                    value={newProject.status}
                    onChange={(e) => setNewProject({ ...newProject, status: e.target.value })}
                    style={{ width: '100%', padding: '10px 12px', backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '6px', color: '#fff', fontSize: '13px' }}
                  >
                    <option value="PLANNING">Planning</option>
                    <option value="ACTIVE">Active (Ongoing)</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>Target Beneficiaries Count</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="1000"
                    value={newProject.beneficiaries_target}
                    onChange={(e) => setNewProject({ ...newProject, beneficiaries_target: parseInt(e.target.value) || 0 })}
                    style={{ width: '100%', padding: '10px 12px', backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '6px', color: '#fff', fontSize: '13px' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>Location / Operating District</label>
                  <input
                    type="text"
                    placeholder="e.g. Nagpur, Maharashtra"
                    value={newProject.location}
                    onChange={(e) => setNewProject({ ...newProject, location: e.target.value })}
                    style={{ width: '100%', padding: '10px 12px', backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '6px', color: '#fff', fontSize: '13px' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>Project Smart Contract Wallet</label>
                  <input
                    type="text"
                    placeholder="0x..."
                    value={newProject.wallet_address}
                    onChange={(e) => setNewProject({ ...newProject, wallet_address: e.target.value })}
                    style={{ width: '100%', padding: '10px 12px', backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '6px', color: '#fff', fontSize: '13px', fontFamily: 'monospace' }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>Project Description</label>
                <textarea
                  rows={2}
                  placeholder="Detail the operational aims, equipment, and execution plan..."
                  value={newProject.description}
                  onChange={(e) => setNewProject({ ...newProject, description: e.target.value })}
                  style={{ width: '100%', padding: '10px 12px', backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '6px', color: '#fff', fontSize: '13px' }}
                />
              </div>

              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>Milestone Deliverables</label>
                <input
                  type="text"
                  placeholder="e.g. M1: Site Survey (Done), M2: Equipment Dispatch, M3: Testing"
                  value={newProject.milestones}
                  onChange={(e) => setNewProject({ ...newProject, milestones: e.target.value })}
                  style={{ width: '100%', padding: '10px 12px', backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '6px', color: '#fff', fontSize: '13px' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  style={{ padding: '8px 16px', backgroundColor: '#334155', color: '#cbd5e1', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  style={{ padding: '8px 24px', backgroundColor: '#3b82f6', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' }}
                >
                  {isSubmitting ? 'Creating Project...' : 'Create Project'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT PROJECT & BUDGET MODAL */}
      {editProject && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
            zIndex: 100,
          }}
        >
          <div
            style={{
              backgroundColor: '#1e293b',
              border: '1px solid #334155',
              borderRadius: '16px',
              maxWidth: '620px',
              width: '100%',
              padding: '28px',
            }}
          >
            <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#f8fafc', marginBottom: '16px' }}>
              Edit Project & Budget: {editProject.title}
            </h2>

            <form onSubmit={handleUpdateProject}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                <div style={{ gridColumn: 'span 2' }}>
                  <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>Title</label>
                  <input
                    type="text"
                    value={editProject.title}
                    onChange={(e) => setEditProject({ ...editProject, title: e.target.value })}
                    style={{ width: '100%', padding: '8px 12px', backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '6px', color: '#fff', fontSize: '13px' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>Target Budget (₹ INR)</label>
                  <input
                    type="number"
                    value={editProject.target_budget}
                    onChange={(e) => setEditProject({ ...editProject, target_budget: parseFloat(e.target.value) || 0 })}
                    style={{ width: '100%', padding: '8px 12px', backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '6px', color: '#fff', fontSize: '13px' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>Raised Amount (₹ INR)</label>
                  <input
                    type="number"
                    value={editProject.raised_amount}
                    onChange={(e) => setEditProject({ ...editProject, raised_amount: parseFloat(e.target.value) || 0 })}
                    style={{ width: '100%', padding: '8px 12px', backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '6px', color: '#fff', fontSize: '13px' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>Utilized Amount (₹ INR)</label>
                  <input
                    type="number"
                    value={editProject.utilized_amount}
                    onChange={(e) => setEditProject({ ...editProject, utilized_amount: parseFloat(e.target.value) || 0 })}
                    style={{ width: '100%', padding: '8px 12px', backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '6px', color: '#fff', fontSize: '13px' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>Location</label>
                  <input
                    type="text"
                    value={editProject.location || ''}
                    onChange={(e) => setEditProject({ ...editProject, location: e.target.value })}
                    style={{ width: '100%', padding: '8px 12px', backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '6px', color: '#fff', fontSize: '13px' }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>Milestone Deliverables</label>
                <input
                  type="text"
                  value={editProject.milestones || ''}
                  onChange={(e) => setEditProject({ ...editProject, milestones: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '6px', color: '#fff', fontSize: '13px' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                <button
                  type="button"
                  onClick={() => setEditProject(null)}
                  style={{ padding: '8px 16px', backgroundColor: '#334155', color: '#cbd5e1', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  style={{ padding: '8px 20px', backgroundColor: '#3b82f6', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' }}
                >
                  {isSubmitting ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* UPDATE STATUS MODAL */}
      {statusProject && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
            zIndex: 100,
          }}
        >
          <div
            style={{
              backgroundColor: '#1e293b',
              border: '1px solid #334155',
              borderRadius: '16px',
              maxWidth: '500px',
              width: '100%',
              padding: '24px',
            }}
          >
            <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#f8fafc', marginBottom: '16px' }}>
              Track & Transition Status: {statusProject.title}
            </h2>

            <form onSubmit={handleUpdateStatus}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '6px' }}>Project Lifecycle Status</label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value)}
                  style={{ width: '100%', padding: '10px 14px', backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '8px', color: '#fff', fontSize: '14px' }}
                >
                  <option value="PLANNING">Planning</option>
                  <option value="ACTIVE">Active (Ongoing Implementation)</option>
                  <option value="COMPLETED">Completed (Milestones Met)</option>
                  <option value="PAUSED">Paused</option>
                  <option value="CANCELLED">Cancelled</option>
                </select>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '6px' }}>Cumulative Beneficiaries Reached</label>
                <input
                  type="number"
                  min="0"
                  value={beneficiariesReached}
                  onChange={(e) => setBeneficiariesReached(parseInt(e.target.value) || 0)}
                  style={{ width: '100%', padding: '10px 14px', backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '8px', color: '#fff', fontSize: '14px' }}
                />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '6px' }}>Status Update / Milestone Notes</label>
                <textarea
                  rows={3}
                  value={statusNotes}
                  onChange={(e) => setStatusNotes(e.target.value)}
                  placeholder="e.g. Milestone 2 accomplished, tablet distribution complete."
                  style={{ width: '100%', padding: '10px 14px', backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '8px', color: '#fff', fontSize: '13px' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                <button
                  type="button"
                  onClick={() => setStatusProject(null)}
                  style={{ padding: '8px 16px', backgroundColor: '#334155', color: '#cbd5e1', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  style={{ padding: '8px 20px', backgroundColor: '#3b82f6', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' }}
                >
                  {isSubmitting ? 'Updating...' : 'Update Status'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* BUDGET ANALYTICS MODAL */}
      {budgetModalProject && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
            zIndex: 100,
          }}
        >
          <div
            style={{
              backgroundColor: '#1e293b',
              border: '1px solid #334155',
              borderRadius: '16px',
              maxWidth: '560px',
              width: '100%',
              padding: '28px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div>
                <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#f8fafc' }}>
                  Budget Breakdown & Analytics
                </h2>
                <div style={{ fontSize: '13px', color: '#38bdf8', fontWeight: 500 }}>
                  {budgetModalProject.title}
                </div>
              </div>
              <button
                onClick={() => setBudgetModalProject(null)}
                style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '22px', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
              <div style={{ backgroundColor: '#0f172a', padding: '16px', borderRadius: '10px' }}>
                <span style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase' }}>Target Budget</span>
                <div style={{ fontSize: '18px', fontWeight: 700, color: '#f8fafc', marginTop: '4px' }}>
                  {formatCurrency(budgetModalProject.target_budget)}
                </div>
              </div>

              <div style={{ backgroundColor: '#0f172a', padding: '16px', borderRadius: '10px' }}>
                <span style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase' }}>Funds Raised</span>
                <div style={{ fontSize: '18px', fontWeight: 700, color: '#10b981', marginTop: '4px' }}>
                  {formatCurrency(budgetModalProject.raised_amount)} ({budgetModalProject.funding_percentage}%)
                </div>
              </div>

              <div style={{ backgroundColor: '#0f172a', padding: '16px', borderRadius: '10px' }}>
                <span style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase' }}>Audited Expenditure</span>
                <div style={{ fontSize: '18px', fontWeight: 700, color: '#38bdf8', marginTop: '4px' }}>
                  {formatCurrency(budgetModalProject.utilized_amount)} ({budgetModalProject.utilization_percentage}%)
                </div>
              </div>

              <div style={{ backgroundColor: '#0f172a', padding: '16px', borderRadius: '10px' }}>
                <span style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase' }}>Funding Gap</span>
                <div style={{ fontSize: '18px', fontWeight: 700, color: '#f59e0b', marginTop: '4px' }}>
                  {formatCurrency(budgetModalProject.budget_gap)}
                </div>
              </div>
            </div>

            <div style={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '10px', padding: '16px', marginBottom: '20px', fontSize: '13px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ color: '#94a3b8' }}>Unutilized Raised Balance:</span>
                <span style={{ color: '#10b981', fontWeight: 600 }}>{formatCurrency(budgetModalProject.unutilized_funds)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#94a3b8' }}>Beneficiaries Impacted:</span>
                <span style={{ color: '#f8fafc', fontWeight: 600 }}>
                  {budgetModalProject.beneficiaries_reached} / {budgetModalProject.beneficiaries_target}
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setBudgetModalProject(null)}
                style={{ padding: '8px 20px', backgroundColor: '#334155', color: '#f8fafc', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' }}
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

export default ProjectsPage;
