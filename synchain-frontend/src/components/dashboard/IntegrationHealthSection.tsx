import React, { useState, useEffect } from 'react';
import {
  Activity,
  AlertTriangle,
  XCircle,
  RefreshCw,
  Server,
  Cloud,
  Database,
  Mail,
  Newspaper,
  Sun,
  ShieldAlert,
  Clock,
  Zap,
  Info,
  ChevronRight,
  X,
  HelpCircle,
} from 'lucide-react';
import { apiService } from '../../services/api';
import { soundFX } from '../../services/audioService';
import {
  AllIntegrationsHealthResponse,
  IntegrationHealthDetailResponse,
  IntegrationConnectionStatus,
} from '../../types';

export const IntegrationHealthSection: React.FC = () => {
  const [healthData, setHealthData] = useState<AllIntegrationsHealthResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [checkingName, setCheckingName] = useState<string | null>(null);
  const [isCheckingAll, setIsCheckingAll] = useState<boolean>(false);
  const [selectedIntegration, setSelectedIntegration] = useState<string | null>(null);
  const [detailData, setDetailData] = useState<IntegrationHealthDetailResponse | null>(null);
  const [isDetailLoading, setIsDetailLoading] = useState<boolean>(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  useEffect(() => {
    loadHealthData();
  }, []);

  const loadHealthData = async () => {
    setIsLoading(true);
    try {
      const data = await apiService.getIntegrationsHealth();
      setHealthData(data);
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Failed to load integration health data', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCheckAll = async () => {
    soundFX.playClick();
    setIsCheckingAll(true);
    try {
      const data = await apiService.triggerHealthCheck();
      setHealthData(data);
      setLastUpdated(new Date());
      soundFX.playSuccess();
    } catch (err) {
      soundFX.playError();
      console.error('Check all integrations failed', err);
    } finally {
      setIsCheckingAll(false);
    }
  };

  const handleCheckSingle = async (name: string, e: React.MouseEvent) => {
    e.stopPropagation();
    soundFX.playClick();
    setCheckingName(name);
    try {
      const data = await apiService.triggerHealthCheck(name);
      if (data.integrations.length > 0) {
        const updatedItem = data.integrations[0];
        setHealthData((prev) => {
          if (!prev) return prev;
          const newIntegrations = prev.integrations.map((item) =>
            item.name.toLowerCase() === updatedItem.name.toLowerCase() ? updatedItem : item
          );
          const healthy_c = newIntegrations.filter((i) => i.connection_status === 'healthy').length;
          const degraded_c = newIntegrations.filter((i) => i.connection_status === 'degraded').length;
          const unhealthy_c = newIntegrations.filter((i) => i.connection_status === 'unhealthy').length;
          return {
            ...prev,
            healthy_count: healthy_c,
            degraded_count: degraded_c,
            unhealthy_count: unhealthy_c,
            integrations: newIntegrations,
          };
        });
      }
      soundFX.playSuccess();
    } catch (err) {
      soundFX.playError();
      console.error(`Check for ${name} failed`, err);
    } finally {
      setCheckingName(null);
    }
  };

  const openDiagnostics = async (name: string) => {
    soundFX.playClick();
    setSelectedIntegration(name);
    setIsDetailLoading(true);
    try {
      const detail = await apiService.getIntegrationHealthDetail(name);
      setDetailData(detail);
    } catch (err) {
      console.error('Failed to load diagnostics', err);
    } finally {
      setIsDetailLoading(false);
    }
  };

  const getStatusBadge = (status: IntegrationConnectionStatus) => {
    switch (status) {
      case 'healthy':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-[0_0_12px_rgba(16,185,129,0.15)]">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Healthy
          </span>
        );
      case 'degraded':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20 shadow-[0_0_12px_rgba(245,158,11,0.15)]">
            <AlertTriangle className="w-3 h-3 text-amber-400" />
            Degraded
          </span>
        );
      case 'unhealthy':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20 shadow-[0_0_12px_rgba(244,63,94,0.15)]">
            <XCircle className="w-3 h-3 text-rose-400" />
            Unhealthy
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-500/10 text-slate-400 border border-slate-500/20">
            <HelpCircle className="w-3 h-3 text-slate-400" />
            Not Configured
          </span>
        );
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'database':
        return <Database className="w-5 h-5 text-indigo-400" />;
      case 'graph_database':
        return <Activity className="w-5 h-5 text-cyan-400" />;
      case 'erp':
      case 'custom_erp':
        return <Server className="w-5 h-5 text-blue-400" />;
      case 'weather':
        return <Sun className="w-5 h-5 text-amber-400" />;
      case 'news':
        return <Newspaper className="w-5 h-5 text-purple-400" />;
      case 'storage':
        return <Cloud className="w-5 h-5 text-sky-400" />;
      case 'email':
        return <Mail className="w-5 h-5 text-emerald-400" />;
      default:
        return <Zap className="w-5 h-5 text-slate-400" />;
    }
  };

  return (
    <div className="space-y-4">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 shadow-2xl">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-blue-500/20 to-indigo-500/10 border border-blue-500/30 text-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.2)]">
            <Activity className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="text-lg font-bold text-slate-100 tracking-tight">API Integration Health Monitor</h2>
              {healthData && (
                <span className="text-xs px-2 py-0.5 rounded-md bg-slate-800 text-slate-400 border border-slate-700/60 font-mono">
                  {healthData.healthy_count}/{healthData.total_count} Live
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Real-time connectivity diagnostics, response latency, and source data freshness across external services
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="hidden md:inline-flex items-center gap-1.5 text-xs text-slate-400 font-mono">
            <Clock className="w-3.5 h-3.5 text-slate-500" />
            Updated {lastUpdated.toLocaleTimeString()}
          </span>
          <button
            onClick={handleCheckAll}
            disabled={isCheckingAll}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-lg shadow-blue-500/20 transition-all disabled:opacity-50 cursor-pointer active:scale-95"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isCheckingAll ? 'animate-spin' : ''}`} />
            {isCheckingAll ? 'Testing All Services...' : 'Check All Integrations'}
          </button>
        </div>
      </div>

      {/* Integrations Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[...Array(7)].map((_, i) => (
            <div
              key={i}
              className="p-5 rounded-2xl bg-slate-900/40 border border-slate-800/60 animate-pulse space-y-3"
            >
              <div className="flex justify-between items-center">
                <div className="w-8 h-8 rounded-lg bg-slate-800" />
                <div className="w-20 h-5 rounded-full bg-slate-800" />
              </div>
              <div className="w-32 h-4 rounded bg-slate-800" />
              <div className="w-24 h-3 rounded bg-slate-850" />
              <div className="pt-2 border-t border-slate-800/40 flex justify-between">
                <div className="w-16 h-3 rounded bg-slate-800" />
                <div className="w-16 h-3 rounded bg-slate-800" />
              </div>
            </div>
          ))}
        </div>
      ) : healthData && healthData.integrations.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {healthData.integrations.map((item) => {
            const isCheckingThis = checkingName === item.name;
            const latencyColor =
              item.response_time_ms < 500
                ? 'text-emerald-400'
                : item.response_time_ms < 3000
                ? 'text-amber-400'
                : 'text-rose-400';

            return (
              <div
                key={item.name}
                onClick={() => openDiagnostics(item.name)}
                className="group relative p-5 rounded-2xl bg-slate-900/60 hover:bg-slate-900/90 backdrop-blur-xl border border-slate-800/80 hover:border-slate-700 transition-all duration-200 cursor-pointer shadow-lg hover:shadow-xl hover:shadow-blue-900/10 flex flex-col justify-between"
              >
                <div>
                  {/* Top Bar: Icon + Status */}
                  <div className="flex items-center justify-between mb-3.5">
                    <div className="p-2 rounded-xl bg-slate-800/80 border border-slate-700/60 group-hover:scale-105 transition-transform">
                      {getCategoryIcon(item.category)}
                    </div>
                    {getStatusBadge(item.connection_status)}
                  </div>

                  {/* Title & Category */}
                  <h3 className="font-semibold text-slate-100 text-sm tracking-tight group-hover:text-blue-400 transition-colors">
                    {item.name}
                  </h3>
                  <p className="text-xs text-slate-400 capitalize mt-0.5">{item.category.replace('_', ' ')}</p>

                  {/* Latency & Freshness Metric */}
                  <div className="mt-4 pt-3 border-t border-slate-800/60 grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-[11px] text-slate-400 uppercase tracking-wider block">Latency</span>
                      <span className={`font-mono font-medium ${latencyColor}`}>
                        {item.response_time_ms > 0 ? `${item.response_time_ms} ms` : '—'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[11px] text-slate-400 uppercase tracking-wider block">Data Freshness</span>
                      <span className="font-medium text-slate-300 truncate block">
                        {item.data_freshness || 'Active'}
                      </span>
                    </div>
                  </div>

                  {/* Sanitized Error Callout if Degraded/Unhealthy */}
                  {item.error_message && (
                    <div className="mt-3 p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-[11px] flex items-start gap-2">
                      <ShieldAlert className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
                      <p className="line-clamp-2 leading-relaxed">{item.error_message}</p>
                    </div>
                  )}
                </div>

                {/* Bottom Actions */}
                <div className="mt-4 pt-3 border-t border-slate-800/40 flex items-center justify-between">
                  <button
                    onClick={(e) => handleCheckSingle(item.name, e)}
                    disabled={isCheckingThis}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium text-slate-300 bg-slate-800/80 hover:bg-slate-750 hover:text-white border border-slate-700/60 transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    <RefreshCw className={`w-3 h-3 ${isCheckingThis ? 'animate-spin text-blue-400' : ''}`} />
                    {isCheckingThis ? 'Testing...' : 'Check Now'}
                  </button>

                  <span className="inline-flex items-center gap-0.5 text-xs text-slate-400 group-hover:text-blue-400 font-medium transition-colors">
                    Diagnostics
                    <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="p-8 text-center rounded-2xl bg-slate-900/40 border border-slate-800 text-slate-400">
          <p>No active integrations discovered.</p>
        </div>
      )}

      {/* Diagnostics Modal */}
      {selectedIntegration && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-3xl bg-slate-900 border border-slate-800 p-6 sm:p-8 shadow-2xl space-y-6 text-slate-100">
            {/* Modal Header */}
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-2xl bg-slate-800 border border-slate-700 text-blue-400">
                  {detailData ? getCategoryIcon(detailData.integration.category) : <Activity className="w-6 h-6" />}
                </div>
                <div>
                  <h3 className="text-xl font-bold tracking-tight text-white">{selectedIntegration}</h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Diagnostic Telemetry &amp; Historical Health Verification
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setSelectedIntegration(null);
                  setDetailData(null);
                }}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {isDetailLoading || !detailData ? (
              <div className="py-12 flex flex-col items-center justify-center gap-3 text-slate-400">
                <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
                <p className="text-sm">Running live diagnostic telemetry...</p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Status & Latency Banner */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80 text-xs">
                  <div>
                    <span className="text-slate-400 uppercase tracking-wider text-[10px] block">Connection</span>
                    <div className="mt-1">{getStatusBadge(detailData.integration.connection_status)}</div>
                  </div>
                  <div>
                    <span className="text-slate-400 uppercase tracking-wider text-[10px] block">Response Latency</span>
                    <span className="mt-1 font-mono font-bold text-sm text-slate-200 block">
                      {detailData.integration.response_time_ms} ms
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 uppercase tracking-wider text-[10px] block">Config Status</span>
                    <span className="mt-1 font-medium text-slate-300 block capitalize">
                      {detailData.integration.configuration_status.replace('_', ' ')}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 uppercase tracking-wider text-[10px] block">Freshness</span>
                    <span className="mt-1 font-medium text-slate-300 block">
                      {detailData.integration.data_freshness || 'Operational'}
                    </span>
                  </div>
                </div>

                {/* Error Banner if Present */}
                {detailData.integration.error_message && (
                  <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 space-y-2">
                    <div className="flex items-center gap-2 text-rose-400 font-semibold text-xs uppercase tracking-wider">
                      <ShieldAlert className="w-4 h-4" />
                      Error Category: {detailData.integration.error_category || 'Fault Detected'}
                    </div>
                    <p className="text-xs font-mono bg-slate-950/50 p-2.5 rounded-lg border border-rose-500/20 text-rose-200">
                      {detailData.integration.error_message}
                    </p>
                  </div>
                )}

                {/* Provider Diagnostics Metadata */}
                {detailData.integration.details && Object.keys(detailData.integration.details).length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2.5">
                      Provider Diagnostic Metadata
                    </h4>
                    <div className="p-3.5 rounded-xl bg-slate-950/40 border border-slate-800 text-xs font-mono grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {Object.entries(detailData.integration.details).map(([k, v]) => (
                        <div key={k} className="flex justify-between py-1 border-b border-slate-850 last:border-0">
                          <span className="text-slate-400">{k}:</span>
                          <span className="text-slate-200 font-semibold">{String(v)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Historical Checks Log */}
                <div>
                  <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2.5">
                    Recent Health Check Verification History
                  </h4>
                  {detailData.history.length > 0 ? (
                    <div className="max-h-48 overflow-y-auto rounded-xl border border-slate-800 divide-y divide-slate-850 text-xs font-mono">
                      {detailData.history.map((h) => (
                        <div key={h.id} className="p-2.5 flex items-center justify-between hover:bg-slate-850/40">
                          <div className="flex items-center gap-2">
                            {getStatusBadge(h.status)}
                            <span className="text-slate-300">
                              {h.checked_at ? new Date(h.checked_at).toLocaleTimeString() : 'Recent'}
                            </span>
                          </div>
                          <span className="text-slate-400">{h.latency_ms} ms</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 italic">No previous check history recorded.</p>
                  )}
                </div>

                {/* Troubleshooting Recommendations */}
                <div className="p-4 rounded-2xl bg-blue-500/5 border border-blue-500/20 text-xs space-y-2">
                  <div className="flex items-center gap-2 text-blue-400 font-semibold uppercase tracking-wider">
                    <Info className="w-4 h-4" />
                    Troubleshooting Guidance
                  </div>
                  <ul className="list-disc list-inside text-slate-300 space-y-1">
                    {detailData.integration.category === 'graph_database' && (
                      <>
                        <li>Verify that your Neo4j Aura database instance is not paused in the Neo4j console.</li>
                        <li>Ensure `NEO4J_URI` uses the encrypted `neo4j+s://` protocol and host resolves.</li>
                      </>
                    )}
                    {detailData.integration.category === 'erp' && (
                      <>
                        <li>Check that your ERPNext server at localhost or configured URL is running.</li>
                        <li>Verify `ERPNEXT_API_KEY` and `ERPNEXT_API_SECRET` match your user token in ERPNext.</li>
                      </>
                    )}
                    {detailData.integration.category === 'weather' && (
                      <li>OpenWeather API keys require up to 10 minutes to activate after generation on openweathermap.org.</li>
                    )}
                    {detailData.integration.category === 'database' && (
                      <li>PostgreSQL connection operates with SSL mode require on Neon cloud. Pool pre-ping is active.</li>
                    )}
                    <li>Credentials and tokens are encrypted and never transmitted in plaintext to client browsers.</li>
                  </ul>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
