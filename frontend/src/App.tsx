import React, { useState } from 'react';
import { Navbar } from './components/Navbar';
import { NGODashboard } from './pages/NGODashboard';
import { NGOManagementPage } from './pages/NGOManagementPage';
import { ProjectsPage } from './pages/ProjectsPage';
import { DonationsPage } from './pages/DonationsPage';
import { ExpensesPage } from './pages/ExpensesPage';

export function App() {
  const [currentView, setCurrentView] = useState<'dashboard' | 'directory' | 'projects' | 'donations' | 'expenses'>('dashboard');
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
      </main>
    </div>
  );
}

export default App;
