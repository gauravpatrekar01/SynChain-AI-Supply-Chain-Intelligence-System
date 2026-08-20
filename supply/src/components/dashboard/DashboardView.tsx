import React from 'react';
import { HeroSection } from './HeroSection';
import { KPICardsGrid } from './KPICardsGrid';
import { DemandForecastChart } from './DemandForecastChart';
import { InventoryVelocityChart } from './InventoryVelocityChart';
import { SupplierPerformanceRadar } from './SupplierPerformanceRadar';
import { MaterialSankeyChart } from './MaterialSankeyChart';
import { LiveIncidentTicker } from './LiveIncidentTicker';
import { useSupplyChain } from '../../context/SupplyChainContext';

interface DashboardViewProps {
  onNavigate: (pageId: string) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ onNavigate }) => {
  const { kpiMetrics, demandForecast, inventoryForecast, incidents } = useSupplyChain();

  return (
    <div className="space-y-6">
      {/* Hero Welcome & AI Health Radial Gauge */}
      <HeroSection onNavigate={onNavigate} />

      {/* Live Incident Telemetry Ticker */}
      <LiveIncidentTicker incidents={incidents} onNavigate={onNavigate} />

      {/* 8 Glass KPI Metrics Grid */}
      <KPICardsGrid
        metrics={kpiMetrics}
        onCardClick={(id) => {
          if (id === 'kpi-risk') onNavigate('risk');
          else if (id === 'kpi-suppliers') onNavigate('suppliers');
          else if (id === 'kpi-inventory') onNavigate('inventory');
          else if (id === 'kpi-shipments') onNavigate('geomap');
          else onNavigate('digital-twin');
        }}
      />

      {/* 2x2 Grid of Interactive ECharts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <DemandForecastChart data={demandForecast} />
        <InventoryVelocityChart data={inventoryForecast} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SupplierPerformanceRadar />
        <MaterialSankeyChart />
      </div>
    </div>
  );
};
