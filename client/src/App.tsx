import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ShiftProvider } from './context/ShiftContext';
import { CartProvider } from './context/CartContext';
import { PPOBProvider } from './context/PPOBContext';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { BottomNav } from './components/BottomNav';
import { CashierPOS } from './pages/CashierPOS';
import { InventoryPage } from './pages/InventoryPage';
import { PPOBManagerPage } from './pages/PPOBManagerPage';
import { ShiftManagementPage } from './pages/ShiftManagementPage';
import { AccountingPage } from './pages/AccountingPage';
import { ReportsPage } from './pages/ReportsPage';
import { SettingsPage } from './pages/SettingsPage';
import { ServicePage } from './pages/ServicePage';
import { CustomerPage } from './pages/CustomerPage';
import { SupplierPage } from './pages/SupplierPage';
import { LoginPage } from './pages/LoginPage';
import { ErrorBoundary } from './components/ErrorBoundary';

const MainLayout: React.FC = () => {
  const { currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState<string>('pos');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => {
    return localStorage.getItem('pos_sidebar_collapsed') === 'true';
  });

  const toggleSidebar = () => {
    setIsSidebarCollapsed(prev => {
      const next = !prev;
      localStorage.setItem('pos_sidebar_collapsed', String(next));
      return next;
    });
  };

  // If user is not authenticated, show modern responsive login screen
  if (!currentUser) {
    return <LoginPage />;
  }

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-slate-100 font-sans">
      {/* Global Top Bar Header */}
      <Header 
        isSidebarCollapsed={isSidebarCollapsed} 
        onToggleSidebar={toggleSidebar} 
      />

      {/* Main Content Layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Navigation Sidebar (hidden on mobile, visible on desktop/tablet) */}
        <Sidebar 
          activeTab={activeTab} 
          setActiveTab={setActiveTab} 
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={toggleSidebar}
        />

        {/* Active Page View */}
        <main className="flex-1 flex flex-col overflow-hidden relative">
          <ErrorBoundary>
            {activeTab === 'pos' && <CashierPOS />}
            {activeTab === 'services' && <ServicePage />}
            {activeTab === 'customers' && <CustomerPage />}
            {activeTab === 'suppliers' && <SupplierPage />}
            {activeTab === 'inventory' && <InventoryPage />}
            {activeTab === 'ppob' && <PPOBManagerPage />}
            {activeTab === 'shift' && <ShiftManagementPage />}
            {activeTab === 'accounting' && <AccountingPage />}
            {activeTab === 'reports' && <ReportsPage />}
            {activeTab === 'settings' && <SettingsPage />}
          </ErrorBoundary>
        </main>
      </div>

      {/* Mobile Bottom Navigation Bar (md:hidden) */}
      <BottomNav activeTab={activeTab} setActiveTab={setActiveTab} />
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <ShiftProvider>
        <PPOBProvider>
          <CartProvider>
            <ErrorBoundary fallbackTitle="Terjadi Kendala Memuat Aplikasi POS">
              <MainLayout />
            </ErrorBoundary>
          </CartProvider>
        </PPOBProvider>
      </ShiftProvider>
    </AuthProvider>
  );
};

export default App;
