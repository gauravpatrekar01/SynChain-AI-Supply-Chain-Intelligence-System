import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sidebar } from './Sidebar';
import { TopNavbar } from './TopNavbar';
import { NotificationDrawer } from './NotificationDrawer';
import { CommandPalette } from '../common/CommandPalette';
import { NeuralBackground } from '../common/NeuralBackground';
import { DashboardView } from '../dashboard/DashboardView';
import { DigitalTwinView } from '../digitaltwin/DigitalTwinView';
import { GeoFleetMap } from '../geomap/GeoFleetMap';
import { ScenarioBuilder } from '../simulation/ScenarioBuilder';
import { SimulationResultsView } from '../simulation/SimulationResultsView';
import { RecommendationsView } from '../recommendations/RecommendationsView';
import { DecisionSimulatorView } from '../simulation/DecisionSimulatorView';
import { RiskMatrixView } from '../risk/RiskMatrixView';
import { SupplierRegistryView } from '../suppliers/SupplierRegistryView';
import { InventoryBufferView } from '../inventory/InventoryBufferView';
import { LiveShipmentsView } from '../shipments/LiveShipmentsView';
import { ReportsView } from '../reports/ReportsView';
import { SettingsView } from '../settings/SettingsView';
import { DataIngestionView } from '../ingestion/DataIngestionView';
import { SupplyChainIntelligenceView } from '../intelligence/SupplyChainIntelligenceView';
import { AnalysisView } from '../analysis/AnalysisView';
import { ForecastView } from '../forecast/ForecastView';
import { SalesForecastingView } from '../sales/SalesForecastingView';

const PAGE_IDS = [
  'dashboard',
  'analysis',
  'digital-twin',
  'geomap',
  'scenario-builder',
  'simulation-results',
  'recommendations',
  'forecast',
  'sales-forecasting',
  'risk',
  'suppliers',
  'inventory',
  'shipments',
  'reports',
  'data-sources',
  'ingestion',
  'intelligence',
  'settings',
  'decision-simulator',
];

export const MainLayout: React.FC = () => {
  const [currentPage, setCurrentPage] = useState<string>(() => {
    const savedPage = sessionStorage.getItem('synchain_dashboard_page');
    return savedPage && PAGE_IDS.includes(savedPage) ? savedPage : 'dashboard';
  });

  const navigateToPage = (pageId: string) => {
    sessionStorage.setItem('synchain_dashboard_page', pageId);
    setCurrentPage(pageId);
  };

  const renderCurrentPage = () => {
    switch (currentPage) {
      case 'analysis':
        return <AnalysisView />;
      case 'digital-twin':
        return <DigitalTwinView onNavigate={navigateToPage} />;
      case 'geomap':
        return <GeoFleetMap onNavigate={navigateToPage} />;
      case 'scenario-builder':
        return <ScenarioBuilder onNavigate={navigateToPage} />;
      case 'simulation-results':
        return <SimulationResultsView onNavigate={navigateToPage} />;
      case 'recommendations':
        return <RecommendationsView />;
      case 'decision-simulator':
        return <DecisionSimulatorView />;
      case 'forecast':
        return <ForecastView />;
      case 'sales-forecasting':
        return <SalesForecastingView />;
      case 'risk':
        return <RiskMatrixView onNavigate={navigateToPage} />;
      case 'suppliers':
        return <SupplierRegistryView />;
      case 'inventory':
        return <InventoryBufferView />;
      case 'shipments':
        return <LiveShipmentsView onNavigate={navigateToPage} />;
      case 'reports':
        return <ReportsView />;
      case 'data-sources':
      case 'ingestion':
        return <DataIngestionView onNavigate={navigateToPage} />;
      case 'intelligence':
        return <SupplyChainIntelligenceView />;
      case 'settings':
        return <SettingsView />;
      case 'dashboard':
      default:
        return <DashboardView onNavigate={navigateToPage} />;
    }
  };

  return (
    <div className="relative min-h-screen flex text-slate-100 selection:bg-blue-500 selection:text-white overflow-hidden">
      {/* Background Interactive Starfield / Neural Canvas */}
      <NeuralBackground />

      {/* Collapsible Futuristic Sidebar */}
      <Sidebar currentPage={currentPage} onNavigate={navigateToPage} />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        {/* Top Navbar */}
        <TopNavbar onNavigate={navigateToPage} />

        {/* Dynamic Page View with Framer Motion Transition */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentPage}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              className="max-w-7xl mx-auto"
            >
              {renderCurrentPage()}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {/* Notification Drawer */}
      <NotificationDrawer onNavigate={navigateToPage} />

      {/* Command Palette (Ctrl+K) */}
      <CommandPalette onNavigate={navigateToPage} />
    </div>
  );
};
