import React from 'react';
import {
  Package,
  Layers,
  MapPin,
  Clock,
  Activity,
  DollarSign,
  TrendingUp,
  AlertTriangle,
  Edit2,
  Trash2,
  Calendar,
  ShieldCheck,
  CheckCircle2,
} from 'lucide-react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { NeonBadge } from '../common/NeonBadge';
import { soundFX } from '../../services/audioService';
import { InventoryItem } from '../../types';

interface ProductDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: InventoryItem | null;
  onEdit: (product: InventoryItem) => void;
  onDelete: (product: InventoryItem) => void;
}

export const ProductDetailsModal: React.FC<ProductDetailsModalProps> = ({
  isOpen,
  onClose,
  product,
  onEdit,
  onDelete,
}) => {
  if (!product) return null;

  const onHand = product.on_hand_units ?? product.onHandUnits ?? 0;
  const reserved = product.reserved_units ?? product.reservedUnits ?? 0;
  const available = product.available_units ?? product.availableUnits ?? Math.max(0, onHand - reserved);
  const safety = product.safety_stock_units ?? product.safetyStockUnits ?? 0;
  const reorder = product.reorder_trigger ?? product.reorderTrigger ?? 0;
  const reorderQty = product.reorder_quantity ?? product.reorderQuantity ?? 0;
  const avgDemand = product.average_daily_demand ?? product.averageDailyDemand;
  const leadTime = product.lead_time_days ?? product.leadTimeDays ?? 14;
  const daysSupply = product.days_of_supply ?? product.daysOfSupply ?? 0;
  const bufferPct = product.buffer_health_percentage ?? product.bufferPct ?? (safety > 0 ? Math.round((available / safety) * 100) : 100);
  const price = product.price ?? 100.0;
  const totalValuation = onHand * price;

  const statusColor =
    product.status === 'critical'
      ? 'text-rose-400 bg-rose-500/10 border-rose-500/30'
      : product.status === 'warning'
      ? 'text-amber-400 bg-amber-500/10 border-amber-500/30'
      : 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30';

  const progressBg =
    product.status === 'critical'
      ? 'bg-rose-500'
      : product.status === 'warning'
      ? 'bg-amber-400'
      : 'bg-emerald-400';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Product Dossier: ${product.name}`}
      size="xl"
    >
      <div className="space-y-6">
        {/* Top Header Card */}
        <div className="p-4 rounded-2xl glass-panel border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono-telemetry uppercase text-cyan-400 bg-cyan-500/10 px-2.5 py-0.5 rounded border border-cyan-500/30">
                {product.category}
              </span>
              <NeonBadge variant={product.status} size="sm">
                {product.status.toUpperCase()}
              </NeonBadge>
            </div>
            <h3 className="text-lg font-bold text-white mt-2">{product.name}</h3>
            <p className="text-xs text-slate-400 font-mono-telemetry mt-0.5">
              SKU: <strong className="text-slate-200">{product.sku}</strong> • Facility: <strong className="text-slate-200">{product.facility}</strong>
              {product.location ? ` (${product.location})` : ''}
            </p>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-center">
            <Button
              variant="outline"
              size="sm"
              leftIcon={<Edit2 className="w-3.5 h-3.5" />}
              onClick={() => {
                soundFX.playClick();
                onEdit(product);
              }}
            >
              Edit Product
            </Button>
            <Button
              variant="danger"
              size="sm"
              leftIcon={<Trash2 className="w-3.5 h-3.5" />}
              onClick={() => {
                soundFX.playClick();
                onDelete(product);
              }}
            >
              Delete
            </Button>
          </div>
        </div>

        {/* Buffer Health Meter */}
        <div className="p-4 rounded-xl bg-slate-900/80 border border-white/10 space-y-2">
          <div className="flex items-center justify-between text-xs font-mono-telemetry">
            <span className="text-slate-400 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-cyan-400" />
              Buffer Health Ratio & Coverage:
            </span>
            <span className="font-bold text-white">
              {bufferPct}% ({daysSupply} Days of Supply)
            </span>
          </div>
          <div className="w-full h-3 rounded-full bg-slate-800 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${progressBg}`}
              style={{ width: `${Math.min(bufferPct, 100)}%` }}
            />
          </div>
          <div className="flex justify-between text-[11px] font-mono-telemetry text-slate-500 pt-1">
            <span>Safety Floor: {safety.toLocaleString()} units</span>
            <span>Reorder Trigger: {reorder.toLocaleString()} units</span>
            <span>Available: {available.toLocaleString()} units</span>
          </div>
        </div>

        {/* 4-Box Telemetry Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3.5 rounded-xl bg-slate-900/60 border border-white/5 font-mono-telemetry">
            <span className="text-[10px] uppercase text-slate-400 block">On-Hand Stock</span>
            <span className="text-base font-bold text-white mt-1 block">
              {onHand.toLocaleString()}
            </span>
            <span className="text-[10px] text-slate-500">Gross physical units</span>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-900/60 border border-white/5 font-mono-telemetry">
            <span className="text-[10px] uppercase text-slate-400 block">Reserved Stock</span>
            <span className="text-base font-bold text-amber-300 mt-1 block">
              {reserved.toLocaleString()}
            </span>
            <span className="text-[10px] text-slate-500">Allocated to orders</span>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-900/60 border border-white/5 font-mono-telemetry">
            <span className="text-[10px] uppercase text-slate-400 block">Available Units</span>
            <span className="text-base font-bold text-emerald-300 mt-1 block">
              {available.toLocaleString()}
            </span>
            <span className="text-[10px] text-slate-500">Net unreserved</span>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-900/60 border border-white/5 font-mono-telemetry">
            <span className="text-[10px] uppercase text-slate-400 block">Inventory Valuation</span>
            <span className="text-base font-bold text-cyan-300 mt-1 block">
              ${totalValuation.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span className="text-[10px] text-slate-500">${price.toFixed(2)}/unit</span>
          </div>
        </div>

        {/* Detailed Specs Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Thresholds */}
          <div className="p-4 rounded-xl bg-slate-900/50 border border-white/5 space-y-3 font-mono-telemetry text-xs">
            <h5 className="text-[11px] font-bold uppercase text-slate-300 tracking-wider flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-blue-400" />
              Replenishment & Safety Floor
            </h5>
            <div className="flex justify-between py-1 border-b border-white/5">
              <span className="text-slate-400">Safety Stock Floor:</span>
              <span className="font-semibold text-white">{safety.toLocaleString()} units</span>
            </div>
            <div className="flex justify-between py-1 border-b border-white/5">
              <span className="text-slate-400">Reorder Point:</span>
              <span className="font-semibold text-white">{reorder.toLocaleString()} units</span>
            </div>
            <div className="flex justify-between py-1 border-b border-white/5">
              <span className="text-slate-400">Economic Batch Quantity:</span>
              <span className="font-semibold text-white">{reorderQty.toLocaleString()} units</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-slate-400">Safety Stock Valuation:</span>
              <span className="font-semibold text-slate-300">
                ${(safety * price).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          {/* Velocity & Lead Time */}
          <div className="p-4 rounded-xl bg-slate-900/50 border border-white/5 space-y-3 font-mono-telemetry text-xs">
            <h5 className="text-[11px] font-bold uppercase text-slate-300 tracking-wider flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-purple-400" />
              Run-Rate Velocity & Lead Time
            </h5>
            <div className="flex justify-between py-1 border-b border-white/5">
              <span className="text-slate-400">Average Daily Demand:</span>
              <span className="font-semibold text-white">
                {avgDemand !== undefined && avgDemand !== null ? `${avgDemand} units/day` : 'Not configured'}
              </span>
            </div>
            <div className="flex justify-between py-1 border-b border-white/5">
              <span className="text-slate-400">Supplier Lead Time:</span>
              <span className="font-semibold text-white">{leadTime} days</span>
            </div>
            <div className="flex justify-between py-1 border-b border-white/5">
              <span className="text-slate-400">Days of Inventory Remaining:</span>
              <span className="font-semibold text-cyan-300">{daysSupply} days</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-slate-400">Inventory Status Flag:</span>
              <span className="font-semibold uppercase tracking-wider text-white">{product.status}</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-4 border-t border-white/10 text-xs font-mono-telemetry text-slate-500">
          <span>
            Database ID: <code className="text-slate-400">{product.id}</code>
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              soundFX.playClick();
              onClose();
            }}
          >
            Close Dossier
          </Button>
        </div>
      </div>
    </Modal>
  );
};
