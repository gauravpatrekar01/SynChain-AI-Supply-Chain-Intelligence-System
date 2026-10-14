import React from 'react';
import {
  Building2,
  MapPin,
  Mail,
  Phone,
  User,
  ShieldCheck,
  AlertTriangle,
  DollarSign,
  Clock,
  Box,
  Truck,
  Edit,
  Trash2,
  ExternalLink,
  Layers,
} from 'lucide-react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { NeonBadge } from '../common/NeonBadge';
import { Supplier, HealthStatus } from '../../types';
import { soundFX } from '../../services/audioService';

interface SupplierDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  supplier: Supplier | null;
  onEdit: (supplier: Supplier) => void;
  onDelete: (supplier: Supplier) => void;
}

export const SupplierDetailsModal: React.FC<SupplierDetailsModalProps> = ({
  isOpen,
  onClose,
  supplier,
  onEdit,
  onDelete,
}) => {
  if (!supplier) return null;

  const reliability = supplier.reliability_score ?? supplier.reliabilityScore ?? 85;
  const spend = supplier.spend_annual_usd ?? supplier.spendAnnualUsd ?? 0;
  const singleSource = supplier.single_source_risk ?? supplier.singleSourceRisk ?? false;
  const health = (supplier.health_status || supplier.healthStatus || 'optimal') as HealthStatus;
  const supplierCode = supplier.supplier_code || supplier.supplierCode || supplier.id.slice(0, 8);
  const activeShipments = supplier.active_shipments_count ?? supplier.activeShipmentsCount ?? 0;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-blue-500/20 text-blue-400 border border-blue-500/30">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white font-display">{supplier.name}</h3>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-xs font-mono-telemetry text-blue-300 font-semibold">
                {supplierCode}
              </span>
              <span className="text-slate-600">•</span>
              <span className="text-xs text-slate-400">{supplier.category}</span>
            </div>
          </div>
        </div>
      }
      subtitle="Partner Profile & Multi-Tier Resilience Metrics"
      maxWidth="4xl"
      footer={
        <div className="flex items-center justify-between w-full">
          <Button
            variant="danger"
            size="sm"
            onClick={() => {
              soundFX.playClick();
              onDelete(supplier);
            }}
            className="flex items-center gap-1.5"
          >
            <Trash2 className="w-4 h-4" />
            Delete Supplier
          </Button>

          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={onClose}>
              Close
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                soundFX.playClick();
                onEdit(supplier);
              }}
              className="flex items-center gap-1.5"
            >
              <Edit className="w-4 h-4" />
              Edit Supplier
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Top Badges & Status Banner */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-xl bg-slate-900/60 border border-white/10">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`px-2.5 py-1 rounded-lg text-xs font-mono-telemetry font-bold ${
                supplier.tier === 'Tier-1'
                  ? 'bg-blue-500/20 text-blue-300 border border-blue-400/30'
                  : 'bg-purple-500/20 text-purple-300 border border-purple-400/30'
              }`}
            >
              {supplier.tier}
            </span>

            <NeonBadge variant={health} size="sm">
              {health.toUpperCase()} RISK
            </NeonBadge>

            {singleSource ? (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-400 bg-rose-500/10 border border-rose-500/30 px-2 py-0.5 rounded-full">
                <AlertTriangle className="w-3 h-3" /> SINGLE SOURCE VULNERABILITY
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-400 bg-slate-800/60 border border-white/5 px-2 py-0.5 rounded-full">
                <ShieldCheck className="w-3 h-3 text-emerald-400" /> MULTI-SOURCED
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <span
              className={`w-2 h-2 rounded-full ${
                supplier.is_active ?? supplier.isActive ?? true ? 'bg-emerald-400' : 'bg-slate-500'
              }`}
            />
            <span className="text-xs font-mono-telemetry text-slate-300">
              {supplier.is_active ?? supplier.isActive ?? true ? 'Active Partner' : 'Inactive Partner'}
            </span>
          </div>
        </div>

        {/* Operational Metrics Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3.5 rounded-xl bg-slate-900/80 border border-white/10 space-y-1">
            <span className="text-[10px] uppercase tracking-wider text-slate-400 font-mono-telemetry flex items-center justify-between">
              Reliability Score
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            </span>
            <p className="text-2xl font-bold font-mono-telemetry text-emerald-400">
              {reliability}%
            </p>
            <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
              <div
                className="h-full rounded-full bg-emerald-400"
                style={{ width: `${Math.min(100, Math.max(0, reliability))}%` }}
              />
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-900/80 border border-white/10 space-y-1">
            <span className="text-[10px] uppercase tracking-wider text-slate-400 font-mono-telemetry flex items-center justify-between">
              Annual Spend
              <DollarSign className="w-3.5 h-3.5 text-blue-400" />
            </span>
            <p className="text-2xl font-bold font-mono-telemetry text-white">
              ${(spend / 1000000).toFixed(2)}M
            </p>
            <span className="text-[10px] text-slate-500 font-mono-telemetry">
              ${spend.toLocaleString()} USD
            </span>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-900/80 border border-white/10 space-y-1">
            <span className="text-[10px] uppercase tracking-wider text-slate-400 font-mono-telemetry flex items-center justify-between">
              Lead Time
              <Clock className="w-3.5 h-3.5 text-purple-400" />
            </span>
            <p className="text-2xl font-bold font-mono-telemetry text-purple-300">
              {supplier.lead_time_days ?? supplier.leadTimeDays ?? '—'} <span className="text-xs font-normal text-slate-400">days</span>
            </p>
            <span className="text-[10px] text-slate-500 font-mono-telemetry">
              Standard order cycle
            </span>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-900/80 border border-white/10 space-y-1">
            <span className="text-[10px] uppercase tracking-wider text-slate-400 font-mono-telemetry flex items-center justify-between">
              Active Shipments
              <Truck className="w-3.5 h-3.5 text-cyan-400" />
            </span>
            <p className="text-2xl font-bold font-mono-telemetry text-cyan-300">
              {activeShipments}
            </p>
            <span className="text-[10px] text-slate-500 font-mono-telemetry">
              In-transit freight units
            </span>
          </div>
        </div>

        {/* Detailed Grid: Location & Contact vs Risk & Dependencies */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Card 1: Facility & Communication */}
          <div className="p-4 rounded-xl bg-slate-900/60 border border-white/10 space-y-3">
            <h4 className="text-xs font-semibold text-white uppercase tracking-wider font-mono-telemetry flex items-center gap-2">
              <MapPin className="w-4 h-4 text-blue-400" />
              Geography & Operations
            </h4>

            <div className="space-y-2 text-xs">
              <div className="flex items-start justify-between py-1 border-b border-white/5">
                <span className="text-slate-400">Location / Facility</span>
                <span className="font-semibold text-slate-200 text-right">
                  {supplier.location || '—'}
                </span>
              </div>

              <div className="flex items-center justify-between py-1 border-b border-white/5">
                <span className="text-slate-400">Country / Jurisdiction</span>
                <span className="font-semibold text-slate-200">{supplier.country}</span>
              </div>

              <div className="flex items-center justify-between py-1 border-b border-white/5">
                <span className="text-slate-400">Contact Officer</span>
                <span className="font-semibold text-slate-200">
                  {supplier.contact_person || supplier.contactPerson || 'Not Listed'}
                </span>
              </div>

              <div className="flex items-center justify-between py-1 border-b border-white/5">
                <span className="text-slate-400">Direct Email</span>
                {supplier.email ? (
                  <a
                    href={`mailto:${supplier.email}`}
                    className="font-mono-telemetry text-blue-400 hover:text-blue-300 flex items-center gap-1"
                  >
                    <Mail className="w-3 h-3" /> {supplier.email}
                  </a>
                ) : (
                  <span className="text-slate-500">—</span>
                )}
              </div>

              <div className="flex items-center justify-between py-1">
                <span className="text-slate-400">Direct Phone</span>
                {supplier.phone ? (
                  <a
                    href={`tel:${supplier.phone}`}
                    className="font-mono-telemetry text-blue-400 hover:text-blue-300 flex items-center gap-1"
                  >
                    <Phone className="w-3 h-3" /> {supplier.phone}
                  </a>
                ) : (
                  <span className="text-slate-500">—</span>
                )}
              </div>
            </div>
          </div>

          {/* Card 2: Risk Profile & Operational Capacity */}
          <div className="p-4 rounded-xl bg-slate-900/60 border border-white/10 space-y-3">
            <h4 className="text-xs font-semibold text-white uppercase tracking-wider font-mono-telemetry flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-blue-400" />
              Risk Analysis & Capacity
            </h4>

            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between py-1 border-b border-white/5">
                <span className="text-slate-400">Quality Rating</span>
                <span className="font-mono-telemetry font-bold text-emerald-400">
                  {supplier.quality_rating ?? supplier.qualityRating ?? '—'}/100
                </span>
              </div>

              <div className="flex items-center justify-between py-1 border-b border-white/5">
                <span className="text-slate-400">Monthly Capacity</span>
                <span className="font-mono-telemetry font-semibold text-slate-200">
                  {supplier.capacity ? `${supplier.capacity.toLocaleString()} units` : 'Unspecified'}
                </span>
              </div>

              <div className="flex items-start justify-between py-1 border-b border-white/5">
                <span className="text-slate-400">Single Source Status</span>
                {singleSource ? (
                  <div className="text-right">
                    <span className="text-rose-400 font-bold">Critical Bottleneck</span>
                    <p className="text-[10px] text-slate-500 max-w-xs mt-0.5">
                      No verified secondary supplier currently mapped in digital twin.
                    </p>
                  </div>
                ) : (
                  <span className="text-emerald-400 font-semibold">Diversified</span>
                )}
              </div>

              <div className="flex items-center justify-between py-1">
                <span className="text-slate-400">Registry System UUID</span>
                <span className="font-mono-telemetry text-[10px] text-slate-500">
                  {supplier.id}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
};
