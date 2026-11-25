import { useEffect, useState } from 'react';
import { AppModule } from './types';
import { StoreProvider } from './context/StoreContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AppShell } from './components/layout/AppShell';
import { ToastContainer } from './components/ui/ToastContainer';
import { AuthScreen } from './components/auth/AuthScreen';
import { DashboardModule } from './components/modules/DashboardModule';
import { POSTerminalModule } from './components/modules/POSTerminalModule';
import { InventoryModule } from './components/modules/InventoryModule';
import { PurchasesModule } from './components/modules/PurchasesModule';
import { CustomersSalesModule } from './components/modules/CustomersSalesModule';
import { ExpensesAccountingModule } from './components/modules/ExpensesAccountingModule';
import { DecisionEngineModule } from './components/modules/DecisionEngineModule';
import { IntegrationsHubModule } from './components/modules/IntegrationsHubModule';
import { SettingsModule } from './components/modules/SettingsModule';

function ERPWorkspace() {
  const { currentUser, authLoading, canAccessModule } = useAuth();
  const [activeModule, setActiveModule] = useState<AppModule>('dashboard');

  // Ensure signed-in user always lands on a module they are permitted to access (e.g. Cashier -> POS)
  useEffect(() => {
    if (!currentUser) return;
    if (!canAccessModule(activeModule)) {
      const fallback: AppModule =
        currentUser.role === 'admin'
          ? 'dashboard'
          : currentUser.allowedModules[0] ?? 'pos';
      setActiveModule(fallback);
    }
  }, [currentUser, activeModule, canAccessModule]);

  const handleSelectModule = (mod: AppModule) => {
    if (!canAccessModule(mod)) return;
    setActiveModule(mod);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#f4f6f9] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-teal-700 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!currentUser) {
    return (
      <>
        <AuthScreen />
        <ToastContainer />
      </>
    );
  }

  const effectiveModule: AppModule = canAccessModule(activeModule)
    ? activeModule
    : currentUser.allowedModules[0] ?? 'pos';

  const renderModule = () => {
    switch (effectiveModule) {
      case 'dashboard':
        return <DashboardModule onNavigate={handleSelectModule} />;
      case 'pos':
        return <POSTerminalModule />;
      case 'inventory':
        return <InventoryModule />;
      case 'purchases':
        return <PurchasesModule />;
      case 'customers':
        return <CustomersSalesModule />;
      case 'expenses':
        return <ExpensesAccountingModule />;
      case 'decisions':
        return <DecisionEngineModule onNavigate={handleSelectModule} />;
      case 'integrations':
        return <IntegrationsHubModule />;
      case 'settings':
        return <SettingsModule />;
      default:
        return <POSTerminalModule />;
    }
  };

  return (
    <>
      <AppShell activeModule={effectiveModule} onSelectModule={handleSelectModule}>
        {renderModule()}
      </AppShell>
      <ToastContainer />
    </>
  );
}

export default function App() {
  return (
    <StoreProvider>
      <AuthProvider>
        <ERPWorkspace />
      </AuthProvider>
    </StoreProvider>
  );
}
