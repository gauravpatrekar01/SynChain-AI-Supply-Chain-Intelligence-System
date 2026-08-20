import React from 'react';
import { AlertCircle, ArrowUpRight, Radio } from 'lucide-react';
import { LiveIncidentAlert } from '../../types';
import { NeonBadge } from '../common/NeonBadge';
import { soundFX } from '../../services/audioService';

interface LiveIncidentTickerProps {
  incidents: LiveIncidentAlert[];
  onNavigate: (pageId: string) => void;
}

export const LiveIncidentTicker: React.FC<LiveIncidentTickerProps> = ({ incidents, onNavigate }) => {
  return (
    <div className="rounded-2xl glass-panel border border-white/10 p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
      {/* Left Badge */}
      <div className="flex items-center gap-2.5 shrink-0">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-semibold">
          <Radio className="w-3.5 h-3.5 animate-pulse text-rose-500" />
          <span>LIVE TELEMETRY STREAM</span>
        </div>
      </div>

      {/* Center Scrolling / Ticker Incident List */}
      <div className="flex-1 overflow-x-auto flex items-center gap-4 py-1 no-scrollbar">
        {incidents.slice(0, 3).map((incident) => (
          <div
            key={incident.id}
            onClick={() => {
              soundFX.playClick();
              onNavigate('risk');
            }}
            className="flex items-center gap-3 px-3.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 hover:border-blue-500/30 transition-all shrink-0 cursor-pointer text-xs group"
          >
            <NeonBadge variant={incident.severity} size="sm">
              {incident.severity.toUpperCase()}
            </NeonBadge>
            <span className="font-medium text-slate-200 group-hover:text-white max-w-[280px] truncate">
              {incident.title}
            </span>
            <span className="text-slate-400 font-mono-telemetry text-[11px] shrink-0">
              {incident.timestamp}
            </span>
          </div>
        ))}
      </div>

      {/* Right Quick Link */}
      <button
        onClick={() => {
          soundFX.playClick();
          onNavigate('recommendations');
        }}
        className="shrink-0 text-xs text-blue-400 hover:text-blue-300 font-medium flex items-center gap-1 cursor-pointer group"
      >
        <span>View AI Mitigations</span>
        <ArrowUpRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
      </button>
    </div>
  );
};
