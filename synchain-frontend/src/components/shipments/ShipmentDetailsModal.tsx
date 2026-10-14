import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { NeonBadge } from '../common/NeonBadge';
import { Shipment, ShipmentRiskData } from '../../types';
import { apiService } from '../../services/api';
import { soundFX } from '../../services/audioService';
import {
  Ship,
  Plane,
  Truck,
  Train,
  MapPin,
  Calendar,
  Clock,
  Building2,
  Package,
  RefreshCw,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  Layers,
  ArrowRight,
  ExternalLink,
} from 'lucide-react';

interface ShipmentDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  shipment: Shipment | null;
  onShipmentUpdated: (updated: Shipment) => void;
}

export const ShipmentDetailsModal: React.FC<ShipmentDetailsModalProps> = ({
  isOpen,
  onClose,
  shipment,
  onShipmentUpdated,
}) => {
  const [isRecalculating, setIsRecalculating] = useState(false);
  const [riskData, setRiskData] = useState<ShipmentRiskData | null>(null);

  if (!shipment) return null;

  const mode = (shipment.transport_mode || shipment.mode || 'ocean').toLowerCase();
  const ModeIcon = mode === 'air' ? Plane : mode === 'rail' ? Train : mode === 'ocean' ? Ship : Truck;

  const riskScore = riskData ? riskData.risk_score : (shipment.risk_score ?? 0);
  const riskLevel = riskData ? riskData.risk_level : (shipment.risk_level ?? 'LOW');
  const riskFactors = riskData ? riskData.risk_factors : (shipment.risk_factors ?? []);
  const dataCompleteness = riskData ? riskData.data_completeness : (shipment.data_completeness ?? 'PARTIAL');

  const getRiskBadgeVariant = (level: string) => {
    switch (level.toUpperCase()) {
      case 'CRITICAL':
        return 'critical';
      case 'HIGH':
        return 'high';
      case 'MEDIUM':
        return 'medium';
      case 'LOW':
      default:
        return 'optimal';
    }
  };

  const getRiskTextColor = (level: string) => {
    switch (level.toUpperCase()) {
      case 'CRITICAL':
        return 'text-rose-400';
      case 'HIGH':
        return 'text-orange-400';
      case 'MEDIUM':
        return 'text-amber-400';
      case 'LOW':
      default:
        return 'text-emerald-400';
    }
  };

  const handleRecalculateRisk = async () => {
    const targetId = shipment.shipment_id || shipment.id;
    try {
      setIsRecalculating(true);
      soundFX.playClick();
      const updatedRisk = await apiService.recalculateShipmentRisk(targetId);
      setRiskData(updatedRisk);

      // Also refresh the parent shipment object
      const refreshedShipment = await apiService.getShipmentById(targetId);
      onShipmentUpdated(refreshedShipment);
    } catch (err) {
      console.error('Failed to recalculate shipment risk:', err);
    } finally {
      setIsRecalculating(false);
    }
  };

  const formatDateTime = (val?: string) => {
    if (!val) return '—';
    try {
      const d = new Date(val);
      if (isNaN(d.getTime())) return val;
      return d.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZoneName: 'short',
      });
    } catch {
      return val;
    }
  };

  const trackingHistory = shipment.tracking_history || [];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-blue-600/20 border border-blue-500/30 text-blue-400">
            <ModeIcon className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono-telemetry font-bold text-blue-400">
                {shipment.shipment_id || shipment.id}
              </span>
              <NeonBadge
                variant={
                  shipment.status === 'delayed'
                    ? 'warning'
                    : shipment.status === 'delivered'
                    ? 'optimal'
                    : shipment.status === 'cancelled'
                    ? 'critical'
                    : 'blue'
                }
                size="sm"
              >
                {shipment.status.toUpperCase()}
              </NeonBadge>
            </div>
            <p className="text-sm font-semibold text-white font-display">
              {shipment.shipment_name || shipment.vesselName || 'Fleet Consignment'}
            </p>
          </div>
        </div>
      }
      subtitle="Comprehensive transit telemetry, supplier association, and neural risk breakdown"
      maxWidth="4xl"
    >
      <div className="space-y-6 text-xs">
        {/* Core Transit Corridor Bar */}
        <div className="p-4 rounded-2xl glass-panel border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex flex-col items-center">
              <div className="w-3 h-3 rounded-full bg-blue-400 ring-4 ring-blue-500/20" />
              <div className="w-0.5 h-8 bg-gradient-to-b from-blue-400 to-cyan-400" />
              <div className="w-3 h-3 rounded-full bg-cyan-400 ring-4 ring-cyan-500/20" />
            </div>
            <div className="space-y-2">
              <div>
                <span className="text-[10px] text-slate-400 font-mono-telemetry uppercase tracking-wider">Origin</span>
                <p className="text-sm font-bold text-white">{shipment.origin}</p>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-mono-telemetry uppercase tracking-wider">Destination</span>
                <p className="text-sm font-bold text-white">{shipment.destination}</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 border-t sm:border-t-0 sm:border-l border-white/10 pt-3 sm:pt-0 sm:pl-6">
            <div>
              <span className="text-slate-400">Carrier:</span>
              <p className="text-white font-semibold mt-0.5">{shipment.carrier_name || shipment.carrier}</p>
            </div>
            <div>
              <span className="text-slate-400">Tracking Number:</span>
              <p className="font-mono-telemetry text-cyan-300 mt-0.5">
                {shipment.tracking_number || 'TRK-STANDBY-UNASSIGNED'}
              </p>
            </div>
            <div>
              <span className="text-slate-400">Payload Volume:</span>
              <p className="font-semibold text-white mt-0.5">
                {(shipment.quantity || 1).toLocaleString()} Units
              </p>
            </div>
          </div>
        </div>

        {/* Two-Column Grid: Left Specifications, Right AI Risk Assessment */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Left Column: Shipment Specifications */}
          <div className="p-5 rounded-2xl glass-panel border border-white/10 space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <Package className="w-4 h-4 text-blue-400" />
                Consignment Details
              </h4>
              <span className="text-slate-400 font-mono-telemetry text-[11px] uppercase">
                Mode: {shipment.transport_mode || shipment.mode}
              </span>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between py-1 border-b border-white/5">
                <span className="text-slate-400">Cargo Description:</span>
                <span className="font-semibold text-white text-right max-w-[220px]">
                  {shipment.cargo_description || shipment.cargoDescription}
                </span>
              </div>

              <div className="flex justify-between py-1 border-b border-white/5">
                <span className="text-slate-400">Supplier:</span>
                <span className="font-semibold text-cyan-300">
                  {shipment.supplier_name || 'Direct / Internal Hub'}
                </span>
              </div>

              <div className="flex justify-between py-1 border-b border-white/5">
                <span className="text-slate-400">Departure Timestamp:</span>
                <span className="font-mono-telemetry text-slate-300">
                  {formatDateTime(shipment.departure_date)}
                </span>
              </div>

              <div className="flex justify-between py-1 border-b border-white/5">
                <span className="text-slate-400">Expected Delivery / ETA:</span>
                <span className="font-mono-telemetry text-amber-300 font-semibold">
                  {formatDateTime(shipment.expected_delivery_date) || shipment.eta}
                </span>
              </div>

              {shipment.actual_delivery_date && (
                <div className="flex justify-between py-1 border-b border-white/5">
                  <span className="text-slate-400">Actual Delivery Date:</span>
                  <span className="font-mono-telemetry text-emerald-400">
                    {formatDateTime(shipment.actual_delivery_date)}
                  </span>
                </div>
              )}

              <div className="flex justify-between py-1 border-b border-white/5">
                <span className="text-slate-400">Record Created:</span>
                <span className="font-mono-telemetry text-slate-400">
                  {formatDateTime(shipment.created_at)}
                </span>
              </div>

              <div className="flex justify-between py-1">
                <span className="text-slate-400">Last Telemetry Update:</span>
                <span className="font-mono-telemetry text-slate-400">
                  {formatDateTime(shipment.updated_at)}
                </span>
              </div>
            </div>
          </div>

          {/* Right Column: AI Risk Scoring & Factor Breakdown */}
          <div className="p-5 rounded-2xl glass-panel border border-white/10 space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-purple-400" />
                Backend Risk Assessment
              </h4>
              <button
                onClick={handleRecalculateRisk}
                disabled={isRecalculating}
                className="px-2.5 py-1 rounded-lg bg-purple-500/20 border border-purple-500/40 text-purple-300 hover:text-white hover:bg-purple-500/30 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3 h-3 ${isRecalculating ? 'animate-spin' : ''}`} />
                <span>Recalculate</span>
              </button>
            </div>

            {/* Score Visual Meter */}
            <div className="p-4 rounded-xl bg-slate-900/60 border border-white/10 flex items-center justify-between">
              <div>
                <span className="text-[11px] text-slate-400 uppercase tracking-wider font-mono-telemetry">
                  Composite Risk Rating
                </span>
                <div className="flex items-baseline gap-2 mt-0.5">
                  <span className={`text-3xl font-extrabold font-display ${getRiskTextColor(riskLevel)}`}>
                    {riskScore}
                  </span>
                  <span className="text-slate-500 font-mono-telemetry">/ 100</span>
                </div>
              </div>

              <div className="text-right space-y-1">
                <NeonBadge variant={getRiskBadgeVariant(riskLevel)} size="md">
                  {riskLevel} RISK
                </NeonBadge>
                <div>
                  <span className="inline-block px-2 py-0.5 rounded text-[10px] font-mono-telemetry bg-slate-800 text-slate-400 border border-white/5">
                    Data: {dataCompleteness}
                  </span>
                </div>
              </div>
            </div>

            {/* Factors List */}
            <div className="space-y-2">
              <span className="text-[11px] font-semibold text-slate-300 block">
                Normalized Risk Factor Components
              </span>
              {riskFactors.length === 0 ? (
                <p className="text-slate-400 italic">No factor breakdowns logged yet.</p>
              ) : (
                <div className="space-y-2">
                  {riskFactors.map((factor, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 rounded-xl bg-slate-900/40 border border-white/5 flex flex-col gap-1"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-white capitalize">{factor.factor}</span>
                          <span
                            className={`px-1.5 py-0.2 rounded text-[9px] font-mono-telemetry ${
                              factor.available
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                                : 'bg-slate-800 text-slate-400 border border-white/10'
                            }`}
                          >
                            {factor.available ? 'AVAILABLE' : 'UNAVAILABLE'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 font-mono-telemetry text-slate-300">
                          <span>Score: {factor.score}</span>
                          <span className="text-slate-500">|</span>
                          <span className="text-cyan-400">Weight: {(factor.weight * 100).toFixed(0)}%</span>
                        </div>
                      </div>
                      {factor.description && (
                        <p className="text-[11px] text-slate-400 leading-relaxed font-mono-telemetry">
                          {factor.description}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Chronological Milestone Tracking History */}
        <div className="p-5 rounded-2xl glass-panel border border-white/10 space-y-4">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <h4 className="text-sm font-bold text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-cyan-400" />
              Chronological Tracking History
            </h4>
            <span className="text-slate-400 font-mono-telemetry text-[11px]">
              {trackingHistory.length} Milestones Recorded
            </span>
          </div>

          {trackingHistory.length === 0 ? (
            <div className="p-8 rounded-xl bg-slate-900/40 border border-dashed border-white/10 text-center space-y-2">
              <Clock className="w-8 h-8 text-slate-500 mx-auto" />
              <p className="font-semibold text-slate-300">No historical tracking telemetries recorded</p>
              <p className="text-[11px] text-slate-400 max-w-md mx-auto">
                No tracking checkpoints or carrier milestones have been ingested yet for this consignment.
              </p>
            </div>
          ) : (
            <div className="relative pl-6 space-y-4 before:content-[''] before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-white/10">
              {trackingHistory.map((item, idx) => (
                <div key={idx} className="relative">
                  <div className="absolute -left-6 top-1 w-2.5 h-2.5 rounded-full bg-blue-500 ring-4 ring-slate-900 border border-cyan-400" />
                  <div className="p-3 rounded-xl bg-slate-900/60 border border-white/10 space-y-1">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                      <span className="font-semibold text-white">
                        {item.event || item.status || 'Milestone Checkpoint'}
                      </span>
                      <span className="font-mono-telemetry text-slate-400 text-[11px]">
                        {formatDateTime(item.timestamp)}
                      </span>
                    </div>
                    {item.location && (
                      <div className="flex items-center gap-1.5 text-slate-300">
                        <MapPin className="w-3.5 h-3.5 text-blue-400" />
                        <span>{item.location}</span>
                      </div>
                    )}
                    {item.description && (
                      <p className="text-slate-400 font-mono-telemetry mt-0.5">{item.description}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};
