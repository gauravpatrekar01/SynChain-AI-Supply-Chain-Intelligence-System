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
import { ForecastView } from '../forecast/ForecastView';
import { RiskMatrixView } from '../risk/RiskMatrixView';
import { SupplierRegistryView } from '../suppliers/SupplierRegistryView';
import { InventoryBufferView } from '../inventory/InventoryBufferView';
import { LiveShipmentsView } from '../shipments/LiveShipmentsView';
import { ReportsView } from '../reports/ReportsView';
import { SettingsView } from '../settings/SettingsView';
import { DataIngestionView } from '../ingestion/DataIngestionView';

export const MainLayout: React.FC = () => {
  const [currentPage, setCurrentPage] = useState<string>('dashboard');

  const renderCurrentPage = () => {
    switch (currentPage) {
      case 'digital-twin':
        return <DigitalTwinView onNavigate={setCurrentPage} />;
      case 'geomap':
        return <GeoFleetMap onNavigate={setCurrentPage} />;
      case 'scenario-builder':
        return <ScenarioBuilder onNavigate={setCurrentPage} />;
      case 'simulation-results':
        return <SimulationResultsView onNavigate={setCurrentPage} />;
      case 'recommendations':
        return <RecommendationsView />;
      case 'forecast':
        return <ForecastView />;
      case 'risk':
        return <RiskMatrixView onNavigate={setCurrentPage} />;
      case 'suppliers':
        return <SupplierRegistryView />;
      case 'inventory':
        return <InventoryBufferView />;
      case 'shipments':
        return <LiveShipmentsView onNavigate={setCurrentPage} />;
      case 'reports':
        return <ReportsView />;
      case 'data-sources':
      case 'ingestion':
        return <DataIngestionView onNavigate={setCurrentPage} />;
      case 'settings':
        return <SettingsView />;
      case 'dashboard':
      default:
        return <DashboardView onNavigate={setCurrentPage} />;
    }
  };

  return (
    <div className="relative min-h-screen flex text-slate-100 selection:bg-blue-500 selection:text-white overflow-hidden">
      {/* Background Interactive Starfield / Neural Canvas */}
      <NeuralBackground />

      {/* Collapsible Futuristic Sidebar */}
      <Sidebar currentPage={currentPage} onNavigate={setCurrentPage} />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        {/* Top Navbar */}
        <TopNavbar onNavigate={setCurrentPage} />

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
      <NotificationDrawer onNavigate={setCurrentPage} />

      {/* Command Palette (Ctrl+K) */}
      <CommandPalette onNavigate={setCurrentPage} />
    </div>
  );
};
