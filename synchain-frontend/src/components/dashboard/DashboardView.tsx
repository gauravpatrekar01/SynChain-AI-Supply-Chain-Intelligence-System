import React, { useEffect, useState } from 'react';
import { ArrowRight, Database } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { HeroSection } from './HeroSection';
import { KPICardsGrid } from './KPICardsGrid';
import { DemandForecastChart } from './DemandForecastChart';
import { InventoryVelocityChart } from './InventoryVelocityChart';
import { SupplierPerformanceRadar } from './SupplierPerformanceRadar';
import { MaterialSankeyChart } from './MaterialSankeyChart';
import { LiveIncidentTicker } from './LiveIncidentTicker';
import { useSupplyChain } from '../../context/SupplyChainContext';
import { apiService } from '../../services/api';

interface DashboardViewProps {
  onNavigate: (pageId: string) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ onNavigate }) => {
  const { kpiMetrics, demandForecast, inventoryForecast, incidents } = useSupplyChain();
  const navigate = useNavigate();
  const [hasIntegration, setHasIntegration] = useState(true);

  useEffect(() => {
    apiService.getIntegrations().then((integrations) => setHasIntegration(integrations.some((integration) => integration.is_active))).catch(() => undefined);
  }, []);

  return (
    <div className="space-y-6">
      {/* Hero Welcome & AI Health Radial Gauge */}
      <HeroSection onNavigate={onNavigate} />

      {!hasIntegration && <div className="glass-panel rounded-xl border border-amber-400/30 bg-amber-400/5 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"><div className="flex items-start gap-3"><Database className="w-5 h-5 text-amber-300 mt-0.5" /><div><p className="font-semibold text-amber-100">Enterprise integration not configured</p><p className="text-sm text-slate-400 mt-1">Connect your enterprise data source to unlock SynChain AI insights.</p></div></div><button onClick={() => navigate('/onboarding')} className="inline-flex items-center justify-center gap-2 rounded-lg bg-amber-400 px-4 py-2 text-sm font-bold text-slate-950 hover:bg-amber-300">Connect Enterprise <ArrowRight className="w-4 h-4" /></button></div>}

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
