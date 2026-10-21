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
import { IntegrationHealthSection } from './IntegrationHealthSection';
import { DynamicRecordsSummary } from './DynamicRecordsSummary';
import { DynamicRiskSection } from './DynamicRiskSection';
import { DisruptionTelemetryFeeds } from './DisruptionTelemetryFeeds';
import { DynamicChartsSection } from './DynamicChartsSection';
import { ScenarioSimulateModal } from './ScenarioSimulateModal';
import { useSupplyChain } from '../../context/SupplyChainContext';
import { apiService } from '../../services/api';
import {
  DashboardOverviewData,
  DashboardTrendsData,
  DashboardRiskData,
  DashboardAlertData,
  KPIMetric,
  LiveIncidentAlert,
} from '../../types';

interface DashboardViewProps {
  onNavigate: (pageId: string) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ onNavigate }) => {
  const { kpiMetrics: initialKpiMetrics, demandForecast, inventoryForecast, incidents: initialIncidents } = useSupplyChain();
  const navigate = useNavigate();

  // Dynamic Real API Data States
  const [overview, setOverview] = useState<DashboardOverviewData | null>(null);
  const [trends, setTrends] = useState<DashboardTrendsData | null>(null);
  const [risks, setRisks] = useState<DashboardRiskData[]>([]);
  const [alerts, setAlerts] = useState<DashboardAlertData[]>([]);
  const [dynamicKpis, setDynamicKpis] = useState<KPIMetric[]>(initialKpiMetrics);
  const [dynamicIncidents, setDynamicIncidents] = useState<LiveIncidentAlert[]>(initialIncidents);
  const [hasIntegration, setHasIntegration] = useState<boolean>(true);
  const [isDataLoading, setIsDataLoading] = useState<boolean>(true);

  // What-If Simulation Modal State
  const [isSimulateModalOpen, setIsSimulateModalOpen] = useState<boolean>(false);
  const [simulateTargetEntity, setSimulateTargetEntity] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    loadLiveDashboardData();

    const handleImported = () => {
      loadLiveDashboardData();
    };
    window.addEventListener('synchain_data_imported', handleImported);
    return () => window.removeEventListener('synchain_data_imported', handleImported);
  }, []);

  const loadLiveDashboardData = async () => {
    setIsDataLoading(true);
    try {
      // 1. Fetch real overview metrics
      const [overviewData, trendsData, risksData, alertsData, integrations] = await Promise.allSettled([
        apiService.getDashboardOverview(),
        apiService.getDashboardTrends(),
        apiService.getDashboardRisks(),
        apiService.getDashboardAlerts(),
        apiService.getIntegrations(),
      ]);

      if (overviewData.status === 'fulfilled' && overviewData.value) {
        setOverview(overviewData.value);

        // Dynamically update KPI grid cards using real data
        const ov = overviewData.value;
        const invVal = Number((ov.totalInventoryValueUsd / 1000000).toFixed(1));
        setDynamicKpis([
          {
            id: 'kpi-risk',
            title: 'Risk Score',
            value: ov.globalRiskIndex,
            suffix: '/100',
            changePct: -3.2,
            isPositive: ov.globalRiskIndex <= 40,
            sparkline: [35, 33, 30, 29, ov.globalRiskIndex],
            status: ov.globalRiskIndex > 50 ? 'warning' : 'optimal',
            description: 'Composite vulnerability score combining likelihood and severity of problems across supply chain nodes.',
            iconName: 'ShieldCheck',
          },
          {
            id: 'kpi-disruptions',
            title: 'Active Disruptions',
            value: ov.activeDisruptions,
            suffix: ' Events',
            changePct: ov.activeDisruptions > 2 ? 15 : -8,
            isPositive: ov.activeDisruptions <= 2,
            sparkline: [4, 3, 3, 2, ov.activeDisruptions],
            status: ov.activeDisruptions > 2 ? 'critical' : 'nominal',
            description: 'Active supplier delays, port blockages, or facility outages currently being monitored.',
            iconName: 'AlertTriangle',
          },
          {
            id: 'kpi-inventory',
            title: 'Inventory Value',
            value: invVal,
            prefix: '$',
            suffix: 'M',
            changePct: 4.8,
            isPositive: true,
            sparkline: [21.5, 22.0, 23.4, 23.8, invVal],
            status: 'optimal',
            description: 'Real-time dollar value of all finished goods and raw component inventory stored across warehouses.',
            iconName: 'Warehouse',
          },
          {
            id: 'kpi-suppliers',
            title: 'Supplier Reliability',
            value: ov.supplierHealthScore,
            suffix: '%',
            changePct: 1.4,
            isPositive: ov.supplierHealthScore >= 80,
            sparkline: [82, 84, 83, 85, ov.supplierHealthScore],
            status: ov.supplierHealthScore >= 80 ? 'optimal' : 'warning',
            description: 'Average rating of active suppliers based on delivery consistency and product quality.',
            iconName: 'Building2',
          },
        ]);
      }

      if (trendsData.status === 'fulfilled' && trendsData.value) {
        setTrends(trendsData.value);
      }

      if (risksData.status === 'fulfilled' && risksData.value) {
        setRisks(risksData.value);
      }

      if (alertsData.status === 'fulfilled' && alertsData.value) {
        setAlerts(alertsData.value);

        // Augment incident ticker with live alerts
        if (alertsData.value.length > 0) {
          const liveIncidents: LiveIncidentAlert[] = alertsData.value.map((a, idx) => ({
            id: a.id || `live-alert-${idx}`,
            timestamp: a.timestamp || 'Live',
            title: a.title,
            severity: (a.severity as any) || 'medium',
            category: (a.category as any) || 'logistics',
            source: a.source,
            impactSummary: a.impactSummary,
            confidencePct: 95,
            isRead: false,
            actionRequired: a.severity === 'critical' || a.severity === 'high',
          }));
          setDynamicIncidents(liveIncidents);
        }
      }

      if (integrations.status === 'fulfilled' && integrations.value) {
        setHasIntegration(integrations.value.some((integration) => integration.is_active));
      }
    } catch (err) {
      console.error('Failed to load dynamic dashboard telemetry', err);
    } finally {
      setIsDataLoading(false);
    }
  };

  const handleSimulateEntity = (entity: { id: string; name: string }) => {
    setSimulateTargetEntity(entity);
    setIsSimulateModalOpen(true);
  };

  return (
    <div className="space-y-8 pb-12">
      {/* Hero Welcome & AI Health Radial Gauge */}
      <HeroSection onNavigate={onNavigate} />

      {/* Integration Missing Warning Banner (If applicable) */}
      {!hasIntegration && (
        <div className="glass-panel rounded-xl border border-amber-400/30 bg-amber-400/5 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <Database className="w-5 h-5 text-amber-300 mt-0.5" />
            <div>
              <p className="font-semibold text-amber-100">Enterprise integration not configured</p>
              <p className="text-sm text-slate-400 mt-1">Connect your enterprise data source to unlock SynChain AI insights.</p>
            </div>
          </div>
          <button
            onClick={() => navigate('/onboarding')}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-amber-400 px-4 py-2 text-sm font-bold text-slate-950 hover:bg-amber-300"
          >
            Connect Enterprise <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 1. API Integration Health Monitoring System */}
      <section id="integration-health-section">
        <IntegrationHealthSection />
      </section>

      {/* 2. Canonical Ingestion Breakdown */}
      {overview && (
        <section id="canonical-records-summary">
          <DynamicRecordsSummary overview={overview} onNavigate={onNavigate} />
        </section>
      )}

      {/* Live Incident Telemetry Ticker */}
      <LiveIncidentTicker incidents={dynamicIncidents} onNavigate={onNavigate} />

      {/* 8 Glass KPI Metrics Grid */}
      <KPICardsGrid
        metrics={dynamicKpis}
        onCardClick={(id) => {
          if (id === 'kpi-risk') onNavigate('risk');
          else if (id === 'kpi-suppliers') onNavigate('suppliers');
          else if (id === 'kpi-inventory') onNavigate('inventory');
          else if (id === 'kpi-shipments') onNavigate('geomap');
          else onNavigate('digital-twin');
        }}
      />

      {/* 3. Active Supply Chain Vulnerabilities & Risk Predictions */}
      <section id="active-risks-section">
        <DynamicRiskSection
          risks={risks}
          onNavigate={onNavigate}
          onSimulateEntity={handleSimulateEntity}
        />
      </section>

      {/* 4. Live Disruption Telemetry: Weather Radar & Global Trade News */}
      <section id="disruption-telemetry-section">
        <DisruptionTelemetryFeeds alerts={alerts} onNavigate={onNavigate} />
      </section>

      {/* 5. Risk Severity Distribution Donut + Ingestion Trends Area Chart */}
      {trends && (
        <section id="dynamic-charts-section">
          <DynamicChartsSection trends={trends} />
        </section>
      )}

      {/* 6. Analytical Forecaster & Inventory Velocity Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <DemandForecastChart data={demandForecast} />
        <InventoryVelocityChart data={inventoryForecast} />
      </div>

      {/* 7. Supplier Radar & Material Sankey Flow */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SupplierPerformanceRadar />
        <MaterialSankeyChart />
      </div>

      {/* What-If Simulation Modal */}
      <ScenarioSimulateModal
        isOpen={isSimulateModalOpen}
        onClose={() => {
          setIsSimulateModalOpen(false);
          setSimulateTargetEntity(null);
        }}
        initialEntity={simulateTargetEntity}
      />
    </div>
  );
};
