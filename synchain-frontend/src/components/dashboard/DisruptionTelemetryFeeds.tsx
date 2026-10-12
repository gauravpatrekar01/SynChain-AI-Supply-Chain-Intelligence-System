import React from 'react';
import { CloudRain, Newspaper, Wind, Thermometer, ExternalLink, ShieldCheck, Radio } from 'lucide-react';
import { DashboardAlertData } from '../../types';

interface DisruptionTelemetryFeedsProps {
  alerts: DashboardAlertData[];
  onNavigate: (pageId: string) => void;
}

export const DisruptionTelemetryFeeds: React.FC<DisruptionTelemetryFeedsProps> = ({ alerts, onNavigate }) => {
  const weatherAlerts = alerts.filter((a) => a.category === 'weather');
  const newsAlerts = alerts.filter((a) => a.category === 'news');

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Weather Telemetry Panel */}
      <div className="p-6 rounded-2xl bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 shadow-2xl flex flex-col justify-between space-y-4">
        <div>
          <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
                <CloudRain className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-100 text-sm tracking-tight flex items-center gap-2">
                  Satellite Weather Corridors
                  <span className="flex h-2 w-2 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                  </span>
                </h3>
                <p className="text-xs text-slate-400">Live telemetry via OpenWeather API</p>
              </div>
            </div>
            <button
              onClick={() => onNavigate('geomap')}
              className="text-xs text-blue-400 hover:text-blue-300 font-medium transition-colors cursor-pointer"
            >
              Fleet Map
            </button>
          </div>

          <div className="mt-4 space-y-3">
            {weatherAlerts.length > 0 ? (
              weatherAlerts.map((w) => (
                <div
                  key={w.id}
                  className="p-4 rounded-xl bg-slate-950/40 border border-slate-800/60 hover:border-slate-700/80 transition-colors space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-200 text-xs">{w.title}</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-amber-300 border border-amber-500/20">
                      {w.source}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">{w.impactSummary}</p>
                  {w.details && (
                    <div className="flex items-center gap-4 text-xs font-mono text-slate-400 pt-1">
                      {w.details.temp_c !== undefined && (
                        <span className="flex items-center gap-1">
                          <Thermometer className="w-3.5 h-3.5 text-blue-400" />
                          {w.details.temp_c}°C
                        </span>
                      )}
                      {w.details.wind_speed !== undefined && (
                        <span className="flex items-center gap-1">
                          <Wind className="w-3.5 h-3.5 text-cyan-400" />
                          {w.details.wind_speed} m/s
                        </span>
                      )}
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="p-6 rounded-xl bg-slate-950/20 border border-slate-800/40 text-center space-y-2 text-slate-400">
                <ShieldCheck className="w-6 h-6 text-emerald-400 mx-auto" />
                <p className="text-xs">No active meteorological disruptions across key hub runways.</p>
              </div>
            )}
          </div>
        </div>

        <div className="pt-3 border-t border-slate-800/60 text-[11px] text-slate-400 flex items-center justify-between">
          <span>Active Probes: Memphis, Austin, London Corridors</span>
          <span className="text-emerald-400 font-mono">Radar Nominal</span>
        </div>
      </div>

      {/* Disruption News Intelligence Panel */}
      <div className="p-6 rounded-2xl bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 shadow-2xl flex flex-col justify-between space-y-4">
        <div>
          <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400">
                <Newspaper className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-100 text-sm tracking-tight flex items-center gap-2">
                  Disruption News &amp; Trade Telemetry
                  <Radio className="w-3.5 h-3.5 text-purple-400 animate-pulse" />
                </h3>
                <p className="text-xs text-slate-400">Live global news stream via NewsData.io API</p>
              </div>
            </div>
            <button
              onClick={() => onNavigate('reports')}
              className="text-xs text-blue-400 hover:text-blue-300 font-medium transition-colors cursor-pointer"
            >
              Reports
            </button>
          </div>

          <div className="mt-4 space-y-3">
            {newsAlerts.length > 0 ? (
              newsAlerts.map((n) => (
                <div
                  key={n.id}
                  className="p-4 rounded-xl bg-slate-950/40 border border-slate-800/60 hover:border-slate-700/80 transition-colors space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-200 text-xs line-clamp-1">{n.title}</span>
                    <span className="text-[10px] text-slate-400 font-mono shrink-0 ml-2">{n.timestamp}</span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed line-clamp-2">{n.impactSummary}</p>
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[11px] text-purple-400 font-mono">{n.source}</span>
                    {n.details?.link && (
                      <a
                        href={n.details.link}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] text-blue-400 hover:text-blue-300 transition-colors"
                      >
                        Source Article
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="p-6 rounded-xl bg-slate-950/20 border border-slate-800/40 text-center space-y-2 text-slate-400">
                <Newspaper className="w-6 h-6 text-slate-500 mx-auto" />
                <p className="text-xs">No active supply chain news disruption events logged in the last 24h.</p>
              </div>
            )}
          </div>
        </div>

        <div className="pt-3 border-t border-slate-800/60 text-[11px] text-slate-400 flex items-center justify-between">
          <span>Global Disruption Feed Query: 'supply chain'</span>
          <span className="text-purple-400 font-mono">Real-Time Ingestion</span>
        </div>
      </div>
    </div>
  );
};
