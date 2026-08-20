import React, { memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import {
  Building2,
  Factory,
  Warehouse,
  Anchor,
  AlertTriangle,
  CheckCircle,
} from 'lucide-react';
import { DigitalTwinNode } from '../../types';

export const CustomNode = memo(({ data, selected }: NodeProps<any>) => {
  const nodeData = data as DigitalTwinNode;

  const getNodeIcon = () => {
    switch (nodeData.type) {
      case 'tier2_supplier':
        return <Building2 className="w-4 h-4 text-purple-400" />;
      case 'tier1_supplier':
        return <Building2 className="w-4 h-4 text-blue-400" />;
      case 'factory':
        return <Factory className="w-4 h-4 text-emerald-400" />;
      case 'port':
        return <Anchor className="w-4 h-4 text-cyan-400" />;
      case 'warehouse':
      default:
        return <Warehouse className="w-4 h-4 text-amber-400" />;
    }
  };

  const getStatusGlow = () => {
    switch (nodeData.status) {
      case 'critical':
        return 'border-rose-500 shadow-[0_0_20px_rgba(239,68,68,0.5)] ring-2 ring-rose-500/50';
      case 'warning':
        return 'border-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.4)] ring-2 ring-amber-500/40';
      case 'optimal':
      default:
        return 'border-emerald-500/40 hover:border-blue-400 hover:shadow-[0_0_15px_rgba(59,130,246,0.3)]';
    }
  };

  const capUtilization = nodeData.capacityUtilization || 85;

  return (
    <div
      className={`w-64 rounded-xl p-3.5 glass-dropdown border transition-all duration-300 ${getStatusGlow()} ${
        selected ? 'ring-2 ring-cyan-400 shadow-[0_0_25px_rgba(6,182,212,0.6)]' : ''
      }`}
    >
      <Handle type="target" position={Position.Left} className="w-2.5 h-2.5 bg-blue-400 border-2 border-slate-900" />

      {/* Header */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="p-1.5 rounded-lg bg-slate-800/90 shrink-0">{getNodeIcon()}</div>
          <div className="truncate">
            <h4 className="text-xs font-bold text-white truncate">{nodeData.label}</h4>
            <p className="text-[10px] text-slate-400 uppercase tracking-wider font-mono-telemetry">
              {nodeData.country} • {nodeData.type?.replace('_', ' ')}
            </p>
          </div>
        </div>

        <div className="shrink-0">
          {nodeData.status === 'optimal' ? (
            <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
          ) : (
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
          )}
        </div>
      </div>

      {/* Telemetry Bar: Capacity */}
      <div className="space-y-1 my-2">
        <div className="flex items-center justify-between text-[10px] font-mono-telemetry text-slate-300">
          <span>Capacity Utilization</span>
          <span className="font-semibold text-white">{capUtilization}%</span>
        </div>
        <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
          <div
            className={`h-full rounded-full ${
              capUtilization > 90
                ? 'bg-rose-500'
                : capUtilization > 75
                ? 'bg-amber-400'
                : 'bg-emerald-400'
            }`}
            style={{ width: `${capUtilization}%` }}
          />
        </div>
      </div>

      {/* Bottom Metrics */}
      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/5 text-[10px] font-mono-telemetry">
        <div className="text-slate-400">
          Lead Time: <span className="text-slate-200 font-semibold">{nodeData.leadTimeDays || 7}d</span>
        </div>
        <div className="text-right text-slate-400">
          Risk: <span className={`font-semibold ${(nodeData.riskScore || 0) > 60 ? 'text-rose-400' : 'text-emerald-400'}`}>{nodeData.riskScore || 20}/100</span>
        </div>
      </div>

      <Handle type="source" position={Position.Right} className="w-2.5 h-2.5 bg-purple-400 border-2 border-slate-900" />
    </div>
  );
});

CustomNode.displayName = 'CustomNode';
