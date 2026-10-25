import { useState } from 'react';
import { Navbar, NavView } from './components/Navbar';
import { NGODashboard } from './pages/NGODashboard';
import { NGOManagementPage } from './pages/NGOManagementPage';
import { ProjectsPage } from './pages/ProjectsPage';
import { DonationsPage } from './pages/DonationsPage';
import { ExpensesPage } from './pages/ExpensesPage';
import { AuditLogsPage } from './pages/AuditLogsPage';
import { ReceiptVerificationPage } from './pages/ReceiptVerificationPage';

export function App() {
  const [currentView, setCurrentView] = useState<NavView>('dashboard');
  const [selectedNgoId, setSelectedNgoId] = useState<number>(1);

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0f172a', color: '#f8fafc' }}>
      <Navbar
        currentView={currentView}
        onNavigate={setCurrentView}
      />

      <main>
        {currentView === 'dashboard' && (
          <NGODashboard
            ngoId={selectedNgoId}
            onNavigateToDirectory={() => setCurrentView('directory')}
          />
        )}
        {currentView === 'directory' && (
          <NGOManagementPage
            onSelectNGO={(id) => {
              setSelectedNgoId(id);
              setCurrentView('dashboard');
            }}
          />
        )}
        {currentView === 'projects' && (
          <ProjectsPage />
        )}
        {currentView === 'donations' && (
          <DonationsPage />
        )}
        {currentView === 'expenses' && (
          <ExpensesPage />
        )}
        {currentView === 'audits' && (
          <AuditLogsPage />
        )}
        {currentView === 'receipts' && (
          <ReceiptVerificationPage />
        )}
      </main>
    </div>
  );
}

export default App;
