import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
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
import { mergeIntegrationHealth } from './integrationHealthState';
import {
  AllIntegrationsHealthResponse,
  IntegrationHealthDetailResponse,
  IntegrationConnectionStatus,
  ConfigStatus,
} from '../../types';

function requestError(error: unknown, fallback: string): string {
  if (axios.isAxiosError(error)) {
    if (error.response?.status === 401) return 'Your session has expired. Sign in again to check integrations.';
    if (error.response?.status === 403) return 'Your account cannot access integration diagnostics.';
    if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
      return 'The health check timed out. The last available results are retained; try again.';
    }
    if (!error.response) return 'Cannot reach the health monitor. Check that the backend is running and try again.';
  }
  return fallback;
}

function formatCheckedAt(value?: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toLocaleString();
}

export const IntegrationHealthSection: React.FC = () => {
  const [healthData, setHealthData] = useState<AllIntegrationsHealthResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [checkingName, setCheckingName] = useState<string | null>(null);
  const [isCheckingAll, setIsCheckingAll] = useState<boolean>(false);
  const [selectedIntegration, setSelectedIntegration] = useState<string | null>(null);
  const [detailData, setDetailData] = useState<IntegrationHealthDetailResponse | null>(null);
  const [isDetailLoading, setIsDetailLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const summaryRequest = useRef(0);
  const detailRequest = useRef(0);
  const requestInProgress = useRef(false);
  const modalRef = useRef<HTMLDivElement>(null);
  const isBusy = isLoading || isCheckingAll || checkingName !== null;
  const lastUpdated = formatCheckedAt(healthData?.timestamp);

  const loadHealthData = useCallback(async () => {
    if (requestInProgress.current) return;
    requestInProgress.current = true;
    const request = ++summaryRequest.current;
    setIsLoading(true);
    setError(null);
    try {
      const data = await apiService.getIntegrationsHealth();
      if (request === summaryRequest.current) {
        setHealthData(data);
        window.dispatchEvent(new Event('synchain_integration_health_updated'));
      }
    } catch (err) {
      if (request === summaryRequest.current) setError(requestError(err, 'Unable to load integration health. Please try again.'));
    } finally {
      if (request === summaryRequest.current) {
        requestInProgress.current = false;
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    void loadHealthData();
    return () => {
      summaryRequest.current += 1;
      detailRequest.current += 1;
      requestInProgress.current = false;
    };
  }, [loadHealthData]);

  const closeDiagnostics = useCallback(() => {
    detailRequest.current += 1;
    setSelectedIntegration(null);
    setDetailData(null);
    setDetailError(null);
    setIsDetailLoading(false);
  }, []);

  useEffect(() => {
    if (!selectedIntegration) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    modalRef.current?.focus();
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeDiagnostics();
      if (event.key !== 'Tab') return;
      const buttons = modalRef.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)');
      if (!buttons?.length) return;
      const first = buttons[0];
      const last = buttons[buttons.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === modalRef.current)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('keydown', handleKey);
      previousFocus?.focus();
    };
  }, [selectedIntegration, closeDiagnostics]);

  const handleCheckAll = async () => {
    if (requestInProgress.current) return;
    requestInProgress.current = true;
    const request = ++summaryRequest.current;
    soundFX.playClick();
    setIsCheckingAll(true);
    setError(null);
    try {
      const data = await apiService.triggerHealthCheck();
      if (request !== summaryRequest.current) return;
      setHealthData(data);
      window.dispatchEvent(new Event('synchain_integration_health_updated'));
      soundFX.playSuccess();
    } catch (err) {
      if (request !== summaryRequest.current) return;
      soundFX.playError();
      setError(requestError(err, 'Unable to refresh integration health. The last available results are shown.'));
    } finally {
      if (request === summaryRequest.current) {
        requestInProgress.current = false;
        setIsCheckingAll(false);
      }
    }
  };

  const handleCheckSingle = async (name: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (requestInProgress.current) return;
    requestInProgress.current = true;
    const request = ++summaryRequest.current;
    soundFX.playClick();
    setCheckingName(name);
    setError(null);
    try {
      const data = await apiService.triggerHealthCheck(name);
      if (request !== summaryRequest.current) return;
      setHealthData((prev) => mergeIntegrationHealth(prev, data));
      window.dispatchEvent(new Event('synchain_integration_health_updated'));
      soundFX.playSuccess();
    } catch (err) {
      if (request !== summaryRequest.current) return;
      soundFX.playError();
      setError(requestError(err, `Unable to check ${name}. The last available results are shown.`));
    } finally {
      if (request === summaryRequest.current) {
        requestInProgress.current = false;
        setCheckingName(null);
      }
    }
  };

  const openDiagnostics = async (name: string) => {
    soundFX.playClick();
    const request = ++detailRequest.current;
    setSelectedIntegration(name);
    setDetailData(null);
    setDetailError(null);
    setIsDetailLoading(true);
    try {
      const detail = await apiService.getIntegrationHealthDetail(name);
      if (request === detailRequest.current) setDetailData(detail);
    } catch (err) {
      if (request === detailRequest.current) setDetailError(requestError(err, `Unable to load diagnostics for ${name}. Please try again.`));
    } finally {
      if (request === detailRequest.current) setIsDetailLoading(false);
    }
  };

  const getStatusBadge = (status: IntegrationConnectionStatus, configuration?: ConfigStatus, enabled = true) => {
    if (!enabled || configuration === 'not_configured') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-500/10 text-slate-400 border border-slate-500/20">
          <HelpCircle className="w-3 h-3" />
          {configuration === 'not_configured' ? 'Not Configured' : 'Disabled'}
        </span>
      );
    }
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
            Not Verified
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
              <h2 className="text-lg font-bold text-slate-100 tracking-tight">Connected Services Status</h2>
              {healthData && (
                <span className="text-xs px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 border border-slate-700/60 font-mono">
                  {healthData.healthy_count}/{healthData.total_count} Healthy
                </span>
              )}
            </div>
            <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
              Checks whether external services are working correctly, including response speed and data freshness.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="hidden md:inline-flex items-center gap-1.5 text-xs text-slate-400 font-mono">
            <Clock className="w-3.5 h-3.5 text-slate-500" />
            {lastUpdated ? `Last checked ${lastUpdated}` : 'Awaiting first check'}
          </span>
          <button
            onClick={handleCheckAll}
            disabled={isBusy}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-lg shadow-blue-500/20 transition-all disabled:opacity-50 cursor-pointer active:scale-95"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isCheckingAll ? 'animate-spin' : ''}`} />
            {isCheckingAll ? 'Testing All Services...' : 'Check All Integrations'}
          </button>
        </div>
      </div>

      {error && (
        <div role="alert" className="flex items-center justify-between gap-4 p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-sm text-rose-200">
          <span className="flex items-center gap-2"><AlertTriangle className="w-4 h-4 shrink-0" />{error}</span>
          <button type="button" onClick={loadHealthData} disabled={isBusy} className="shrink-0 px-3 py-1.5 rounded-lg border border-rose-500/30 hover:bg-rose-500/10 disabled:opacity-50">
            Retry
          </button>
        </div>
      )}

      {/* Integrations Grid */}
      {isLoading && !healthData ? (
        <div role="status" aria-label="Loading integration health" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
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
              <article
                key={item.name}
                className="group relative p-5 rounded-2xl bg-slate-900/60 hover:bg-slate-900/90 backdrop-blur-xl border border-slate-800/80 hover:border-slate-700 transition-all duration-200 shadow-lg hover:shadow-xl hover:shadow-blue-900/10 flex flex-col justify-between"
              >
                <div>
                  {/* Top Bar: Icon + Status */}
                  <div className="flex items-center justify-between mb-3.5">
                    <div className="p-2 rounded-xl bg-slate-800/80 border border-slate-700/60 group-hover:scale-105 transition-transform">
                      {getCategoryIcon(item.category)}
                    </div>
                    {getStatusBadge(item.connection_status, item.configuration_status, item.is_enabled)}
                  </div>

                  {/* Title & Category */}
                  <h3 className="font-semibold text-slate-100 text-sm tracking-tight group-hover:text-blue-400 transition-colors">
                    {item.name}
                  </h3>
                  <p className="text-xs text-slate-400 capitalize mt-0.5">{item.category.replace('_', ' ')}</p>

                  {/* Latency & Freshness Metric */}
                  <div className="mt-4 pt-3 border-t border-slate-800/60 grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-xs text-slate-400 font-medium block">Response Time</span>
                      <span className={`font-mono font-semibold ${latencyColor}`}>
                        {item.response_time_ms > 0 ? `${Math.round(item.response_time_ms)} ms` : '—'}
                      </span>
                    </div>
                    <div>
                      <span className="text-xs text-slate-400 font-medium block">Data Freshness</span>
                      <span className="font-medium text-slate-200 truncate block">
                        {item.data_freshness || 'Not reported'}
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
                    disabled={isBusy}
                    aria-label={`Check ${item.name} now`}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium text-slate-300 bg-slate-800/80 hover:bg-slate-750 hover:text-white border border-slate-700/60 transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    <RefreshCw className={`w-3 h-3 ${isCheckingThis ? 'animate-spin text-blue-400' : ''}`} />
                    {isCheckingThis ? 'Testing...' : 'Check Now'}
                  </button>

                  <button type="button" onClick={() => openDiagnostics(item.name)} aria-label={`View diagnostics for ${item.name}`} className="inline-flex items-center gap-0.5 text-xs text-slate-400 hover:text-blue-400 font-medium transition-colors cursor-pointer">
                    Diagnostics
                    <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      ) : !error ? (
        <div className="p-8 text-center rounded-2xl bg-slate-900/40 border border-slate-800 text-slate-400">
          <p>No active integrations discovered.</p>
        </div>
      ) : null}

      {/* Diagnostics Modal */}
      {selectedIntegration && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
          <div ref={modalRef} role="dialog" aria-modal="true" aria-labelledby="integration-diagnostics-title" tabIndex={-1} className="relative w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-3xl bg-slate-900 border border-slate-800 p-6 sm:p-8 shadow-2xl space-y-6 text-slate-100">
            {/* Modal Header */}
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-2xl bg-slate-800 border border-slate-700 text-blue-400">
                  {detailData ? getCategoryIcon(detailData.integration.category) : <Activity className="w-6 h-6" />}
                </div>
                <div>
                  <h3 id="integration-diagnostics-title" className="text-xl font-bold tracking-tight text-white">{selectedIntegration}</h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Diagnostic Telemetry &amp; Historical Health Verification
                  </p>
                </div>
              </div>
              <button
                onClick={closeDiagnostics}
                aria-label="Close integration diagnostics"
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {isDetailLoading ? (
              <div role="status" className="py-12 flex flex-col items-center justify-center gap-3 text-slate-400">
                <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
                <p className="text-sm">Loading integration diagnostics...</p>
              </div>
            ) : detailError ? (
              <div role="alert" className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-sm text-rose-200 space-y-3">
                <p>{detailError}</p>
                <button type="button" onClick={() => openDiagnostics(selectedIntegration)} className="px-3 py-1.5 rounded-lg border border-rose-500/30 hover:bg-rose-500/10">Retry diagnostics</button>
              </div>
            ) : detailData ? (
              <div className="space-y-6">
                {/* Status & Latency Banner */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80 text-xs">
                  <div>
                    <span className="text-slate-400 uppercase tracking-wider text-[10px] block">Connection</span>
                    <div className="mt-1">{getStatusBadge(detailData.integration.connection_status, detailData.integration.configuration_status, detailData.integration.is_enabled)}</div>
                  </div>
                  <div>
                    <span className="text-slate-400 uppercase tracking-wider text-[10px] block">Response Latency</span>
                    <span className="mt-1 font-mono font-bold text-sm text-slate-200 block">
                      {detailData.integration.response_time_ms > 0 ? `${Math.round(detailData.integration.response_time_ms)} ms` : '—'}
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
                      {detailData.integration.data_freshness || 'Not reported'}
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
                              {formatCheckedAt(h.checked_at) || 'Time not recorded'}
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
                      <li>Verify that the configured OpenWeather API key is active and has access to the requested endpoint.</li>
                    )}
                    {detailData.integration.category === 'database' && (
                      <li>Verify database connectivity and the SSL requirements of your database provider.</li>
                    )}
                    <li>After updating a service configuration, use Check Now to verify connectivity again.</li>
                  </ul>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
};
