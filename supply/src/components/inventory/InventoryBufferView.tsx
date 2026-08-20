import React, { useState } from 'react';
import { Package, AlertTriangle, CheckCircle, RefreshCw, Layers, ArrowUpRight } from 'lucide-react';
import { NeonBadge } from '../common/NeonBadge';
import { Button } from '../common/Button';
import { soundFX } from '../../services/audioService';

interface InventoryItem {
  sku: string;
  name: string;
  category: string;
  facility: string;
  onHandUnits: number;
  safetyStockUnits: number;
  daysOfSupply: number;
  status: 'optimal' | 'warning' | 'critical';
  reorderTrigger: number;
}

export const InventoryBufferView: React.FC = () => {
  const [items] = useState<InventoryItem[]>([
    {
      sku: 'IC-3NM-A18',
      name: '3nm Ultra AI Neural Processor',
      category: 'Logic Silicon',
      facility: 'Giga Austin Warehouse',
      onHandUnits: 45000,
      safetyStockUnits: 30000,
      daysOfSupply: 42,
      status: 'optimal',
      reorderTrigger: 35000,
    },
    {
      sku: 'HBM3E-24G',
      name: 'High Bandwidth Memory 24GB',
      category: 'Memory IC',
      facility: 'Memphis SuperHub',
      onHandUnits: 18500,
      safetyStockUnits: 25000,
      daysOfSupply: 14,
      status: 'warning',
      reorderTrigger: 28000,
    },
    {
      sku: 'BATT-LFP-82K',
      name: '82kWh LFP Battery Cell Modules',
      category: 'Energy Storage',
      facility: 'Munich Mega Assembly',
      onHandUnits: 8200,
      safetyStockUnits: 6000,
      daysOfSupply: 38,
      status: 'optimal',
      reorderTrigger: 7500,
    },
    {
      sku: 'HARN-LV-CU',
      name: 'High Voltage Automotive Copper Harness',
      category: 'Wiring & Connectors',
      facility: 'Shanghai Distribution Hub',
      onHandUnits: 4200,
      safetyStockUnits: 9000,
      daysOfSupply: 6,
      status: 'critical',
      reorderTrigger: 10000,
    },
    {
      sku: 'SENS-LIDAR-V4',
      name: 'Solid-State LiDAR Optical Transceiver',
      category: 'Sensors',
      facility: 'Giga Austin Warehouse',
      onHandUnits: 22000,
      safetyStockUnits: 15000,
      daysOfSupply: 50,
      status: 'optimal',
      reorderTrigger: 18000,
    },
  ]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl sm:text-2xl font-bold text-white font-display tracking-tight">
              Global Inventory & Safety Stock Buffer
            </h2>
            <NeonBadge variant="cyan" size="sm">
              MULTI-ECHELON
            </NeonBadge>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Real-time stock velocity, safety buffer floor monitoring, and automated ERP reorder triggers.
          </p>
        </div>

        <Button
          variant="glow"
          size="sm"
          leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
          onClick={() => soundFX.playClick()}
        >
          Re-Calculate Multi-Echelon Buffer
        </Button>
      </div>

      {/* Inventory Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {items.map((item) => {
          const bufferPct = Math.round((item.onHandUnits / item.safetyStockUnits) * 100);

          return (
            <div
              key={item.sku}
              className="p-5 rounded-2xl glass-panel border border-white/10 hover:border-blue-500/40 space-y-4 transition-all"
            >
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-[10px] font-mono-telemetry uppercase text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/30">
                    {item.category}
                  </span>
                  <h4 className="text-sm font-bold text-white mt-1.5">{item.name}</h4>
                  <p className="text-[11px] text-slate-400 font-mono-telemetry">{item.sku} • {item.facility}</p>
                </div>
                <NeonBadge variant={item.status} size="sm">
                  {item.status.toUpperCase()}
                </NeonBadge>
              </div>

              {/* Buffer Bar */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-mono-telemetry">
                  <span className="text-slate-400">Buffer Health:</span>
                  <span className="font-semibold text-white">{bufferPct}% ({item.daysOfSupply} Days)</span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      item.status === 'critical'
                        ? 'bg-rose-500'
                        : item.status === 'warning'
                        ? 'bg-amber-400'
                        : 'bg-emerald-400'
                    }`}
                    style={{ width: `${Math.min(bufferPct, 100)}%` }}
                  />
                </div>
              </div>

              {/* Metrics */}
              <div className="grid grid-cols-2 gap-2 p-3 rounded-xl bg-slate-900/80 border border-white/5 text-xs font-mono-telemetry">
                <div>
                  <span className="text-slate-400 block text-[10px]">On Hand:</span>
                  <span className="font-bold text-white">{item.onHandUnits.toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Safety Floor:</span>
                  <span className="text-slate-300">{item.safetyStockUnits.toLocaleString()}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
