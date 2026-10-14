import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { Shipment, ShipmentFormData, Supplier } from '../../types';
import { apiService } from '../../services/api';
import { soundFX } from '../../services/audioService';
import { Ship, Plane, Truck, Train, AlertCircle, Loader2, Save, Plus } from 'lucide-react';

interface ShipmentFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: (shipment: Shipment) => void;
  shipmentToEdit?: Shipment | null;
}

export const ShipmentFormModal: React.FC<ShipmentFormModalProps> = ({
  isOpen,
  onClose,
  onSaved,
  shipmentToEdit,
}) => {
  const isEditing = !!shipmentToEdit;
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loadingSuppliers, setLoadingSuppliers] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Form State
  const [shipmentId, setShipmentId] = useState('');
  const [shipmentName, setShipmentName] = useState('');
  const [supplierId, setSupplierId] = useState<string>('');
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [cargoDescription, setCargoDescription] = useState('');
  const [quantity, setQuantity] = useState<number>(100);
  const [transportMode, setTransportMode] = useState<'Ocean' | 'Air' | 'Ground' | 'Rail'>('Ocean');
  const [departureDate, setDepartureDate] = useState('');
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState('');
  const [carrierName, setCarrierName] = useState('');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [status, setStatus] = useState<'in_transit' | 'delivered' | 'delayed' | 'pending' | 'cancelled'>('in_transit');
  const [initialRiskScore, setInitialRiskScore] = useState<number | undefined>(undefined);

  // Helper to format ISO to datetime-local string
  const toLocalDatetime = (isoStr?: string) => {
    if (!isoStr) return '';
    const date = new Date(isoStr);
    if (isNaN(date.getTime())) return '';
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  };

  // Reset or populate fields
  useEffect(() => {
    if (!isOpen) return;

    setErrorMsg(null);
    if (shipmentToEdit) {
      setShipmentId(shipmentToEdit.shipment_id || shipmentToEdit.id || '');
      setShipmentName(shipmentToEdit.shipment_name || shipmentToEdit.vesselName || '');
      setSupplierId(shipmentToEdit.supplier_id || '');
      setOrigin(shipmentToEdit.origin || '');
      setDestination(shipmentToEdit.destination || '');
      setCargoDescription(shipmentToEdit.cargo_description || shipmentToEdit.cargoDescription || '');
      setQuantity(shipmentToEdit.quantity || 100);
      
      const modeNorm = (shipmentToEdit.transport_mode || shipmentToEdit.mode || 'Ocean').toLowerCase();
      if (modeNorm === 'air') setTransportMode('Air');
      else if (modeNorm === 'rail') setTransportMode('Rail');
      else if (modeNorm in ['ground', 'road']) setTransportMode('Ground');
      else setTransportMode('Ocean');

      setDepartureDate(toLocalDatetime(shipmentToEdit.departure_date));
      setExpectedDeliveryDate(toLocalDatetime(shipmentToEdit.expected_delivery_date));
      setCarrierName(shipmentToEdit.carrier_name || shipmentToEdit.carrier || '');
      setTrackingNumber(shipmentToEdit.tracking_number || '');
      
      const st = shipmentToEdit.status?.toLowerCase();
      if (st === 'delivered' || st === 'delayed' || st === 'pending' || st === 'cancelled') {
        setStatus(st);
      } else {
        setStatus('in_transit');
      }

      setInitialRiskScore(shipmentToEdit.initial_risk_score ?? shipmentToEdit.risk_score);
    } else {
      // Default new shipment values
      const now = new Date();
      const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      
      setShipmentId('');
      setShipmentName('');
      setSupplierId('');
      setOrigin('');
      setDestination('');
      setCargoDescription('');
      setQuantity(500);
      setTransportMode('Ocean');
      setDepartureDate(toLocalDatetime(now.toISOString()));
      setExpectedDeliveryDate(toLocalDatetime(nextWeek.toISOString()));
      setCarrierName('');
      setTrackingNumber('');
      setStatus('in_transit');
      setInitialRiskScore(undefined);
    }
  }, [isOpen, shipmentToEdit]);

  // Load suppliers for dropdown
  useEffect(() => {
    if (!isOpen) return;
    const loadSuppliers = async () => {
      try {
        setLoadingSuppliers(true);
        const list = await apiService.getSuppliers();
        setSuppliers(list);
      } catch (err) {
        console.warn('Failed to load suppliers list:', err);
      } finally {
        setLoadingSuppliers(false);
      }
    };
    loadSuppliers();
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    // Validation
    if (!shipmentName.trim()) {
      setErrorMsg('Shipment name is required.');
      return;
    }
    if (!origin.trim() || !destination.trim()) {
      setErrorMsg('Origin and Destination are required.');
      return;
    }
    if (!cargoDescription.trim()) {
      setErrorMsg('Cargo / Product description is required.');
      return;
    }
    if (!carrierName.trim()) {
      setErrorMsg('Carrier name is required.');
      return;
    }
    if (quantity <= 0) {
      setErrorMsg('Quantity must be greater than zero.');
      return;
    }
    if (!departureDate || !expectedDeliveryDate) {
      setErrorMsg('Both Departure Date and Expected Delivery Date (ETA) are required.');
      return;
    }

    const depTime = new Date(departureDate).getTime();
    const etaTime = new Date(expectedDeliveryDate).getTime();
    if (etaTime < depTime) {
      setErrorMsg('Expected Delivery Date (ETA) cannot be earlier than Departure Date.');
      return;
    }

    const payload: ShipmentFormData = {
      shipment_name: shipmentName.trim(),
      supplier_id: supplierId ? supplierId : null,
      origin: origin.trim(),
      destination: destination.trim(),
      cargo_description: cargoDescription.trim(),
      quantity: Number(quantity),
      transport_mode: transportMode,
      departure_date: new Date(departureDate).toISOString(),
      expected_delivery_date: new Date(expectedDeliveryDate).toISOString(),
      carrier_name: carrierName.trim(),
      tracking_number: trackingNumber.trim() || undefined,
      status: status,
      initial_risk_score: initialRiskScore !== undefined ? Number(initialRiskScore) : undefined,
    };

    if (shipmentId.trim()) {
      payload.shipment_id = shipmentId.trim();
    }

    setIsSubmitting(true);
    soundFX.playClick();

    try {
      let savedShipment: Shipment;
      if (isEditing && shipmentToEdit) {
        const targetId = shipmentToEdit.shipment_id || shipmentToEdit.id;
        savedShipment = await apiService.updateShipment(targetId, payload);
      } else {
        savedShipment = await apiService.createShipment(payload);
      }
      onSaved(savedShipment);
      onClose();
    } catch (err: any) {
      const detail = err.response?.data?.detail;
      if (Array.isArray(detail)) {
        setErrorMsg(detail.map((d: any) => d.msg || `${d.loc?.join('.')}: invalid`).join(', '));
      } else if (typeof detail === 'string') {
        setErrorMsg(detail);
      } else {
        setErrorMsg(err.message || 'Failed to save shipment.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const modeIcons = [
    { mode: 'Ocean' as const, icon: Ship, label: 'Ocean Freight' },
    { mode: 'Air' as const, icon: Plane, label: 'Air Cargo' },
    { mode: 'Ground' as const, icon: Truck, label: 'Ground Logistics' },
    { mode: 'Rail' as const, icon: Train, label: 'Rail Corridor' },
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'Edit Transit Consignment' : 'Register New Fleet Shipment'}
      subtitle={
        isEditing
          ? `Update parameters & recalculate risk for ${shipmentToEdit?.shipment_id || 'shipment'}`
          : 'Create real database shipment record with authoritative backend risk calculation'
      }
      maxWidth="2xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        {errorMsg && (
          <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-300 flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <div className="font-mono-telemetry">{errorMsg}</div>
          </div>
        )}

        {/* Transport Mode Selector */}
        <div>
          <label className="block text-slate-400 font-medium mb-1.5">Transport Mode</label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {modeIcons.map(({ mode, icon: Icon, label }) => (
              <button
                key={mode}
                type="button"
                onClick={() => {
                  soundFX.playClick();
                  setTransportMode(mode);
                }}
                className={`p-2.5 rounded-xl border flex items-center gap-2 transition-all cursor-pointer ${
                  transportMode === mode
                    ? 'bg-blue-600/30 border-blue-500 text-white shadow-[0_0_15px_rgba(59,130,246,0.25)]'
                    : 'bg-slate-900/60 border-white/10 text-slate-400 hover:text-white hover:border-white/20'
                }`}
              >
                <Icon className="w-4 h-4 text-blue-400" />
                <span className="font-semibold">{label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Basic Identification */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-slate-400 font-medium mb-1">
              Shipment ID <span className="text-slate-500 font-normal">(Auto-generated if empty)</span>
            </label>
            <input
              type="text"
              value={shipmentId}
              onChange={(e) => setShipmentId(e.target.value)}
              placeholder="e.g. SHP-2601-A48"
              disabled={isEditing}
              className="w-full px-3 py-2 rounded-xl bg-slate-900/80 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/60 font-mono-telemetry disabled:opacity-50"
            />
          </div>

          <div>
            <label className="block text-slate-400 font-medium mb-1">
              Shipment Name <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              value={shipmentName}
              onChange={(e) => setShipmentName(e.target.value)}
              placeholder="e.g. Trans-Pacific Silicon Batch 4"
              required
              className="w-full px-3 py-2 rounded-xl bg-slate-900/80 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/60"
            />
          </div>
        </div>

        {/* Supplier & Cargo */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-slate-400 font-medium mb-1">Supplier Association</label>
            <select
              value={supplierId}
              onChange={(e) => setSupplierId(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-900/80 border border-white/10 text-white focus:outline-none focus:border-blue-500/60"
            >
              <option value="">No Supplier (Direct / Hub Transfer)</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.country || 'Global'})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-slate-400 font-medium mb-1">
              Product / Cargo Description <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              value={cargoDescription}
              onChange={(e) => setCargoDescription(e.target.value)}
              placeholder="e.g. 3nm Microcontrollers"
              required
              className="w-full px-3 py-2 rounded-xl bg-slate-900/80 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/60"
            />
          </div>

          <div>
            <label className="block text-slate-400 font-medium mb-1">
              Quantity (Units) <span className="text-rose-400">*</span>
            </label>
            <input
              type="number"
              min="1"
              value={quantity}
              onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
              required
              className="w-full px-3 py-2 rounded-xl bg-slate-900/80 border border-white/10 text-white focus:outline-none focus:border-blue-500/60 font-mono-telemetry"
            />
          </div>
        </div>

        {/* Origin & Destination */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-slate-400 font-medium mb-1">
              Origin Port / Facility <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              value={origin}
              onChange={(e) => setOrigin(e.target.value)}
              placeholder="e.g. Taipei Port, Taiwan"
              required
              className="w-full px-3 py-2 rounded-xl bg-slate-900/80 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/60"
            />
          </div>

          <div>
            <label className="block text-slate-400 font-medium mb-1">
              Destination Hub / SuperCenter <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              placeholder="e.g. Austin Gigafactory, TX"
              required
              className="w-full px-3 py-2 rounded-xl bg-slate-900/80 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/60"
            />
          </div>
        </div>

        {/* Carrier & Tracking */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-slate-400 font-medium mb-1">
              Carrier Name <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              value={carrierName}
              onChange={(e) => setCarrierName(e.target.value)}
              placeholder="e.g. Maersk / FedEx / DHL"
              required
              className="w-full px-3 py-2 rounded-xl bg-slate-900/80 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/60"
            />
          </div>

          <div>
            <label className="block text-slate-400 font-medium mb-1">Tracking Number</label>
            <input
              type="text"
              value={trackingNumber}
              onChange={(e) => setTrackingNumber(e.target.value)}
              placeholder="e.g. TRK-8890-41"
              className="w-full px-3 py-2 rounded-xl bg-slate-900/80 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/60 font-mono-telemetry"
            />
          </div>

          <div>
            <label className="block text-slate-400 font-medium mb-1">Current Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as any)}
              className="w-full px-3 py-2 rounded-xl bg-slate-900/80 border border-white/10 text-white focus:outline-none focus:border-blue-500/60 font-medium"
            >
              <option value="in_transit">In Transit</option>
              <option value="delivered">Delivered</option>
              <option value="delayed">Delayed</option>
              <option value="pending">Pending</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        </div>

        {/* Chronology / Dates */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-slate-400 font-medium mb-1">
              Departure Date & Time <span className="text-rose-400">*</span>
            </label>
            <input
              type="datetime-local"
              value={departureDate}
              onChange={(e) => setDepartureDate(e.target.value)}
              required
              className="w-full px-3 py-2 rounded-xl bg-slate-900/80 border border-white/10 text-white focus:outline-none focus:border-blue-500/60 font-mono-telemetry"
            />
          </div>

          <div>
            <label className="block text-slate-400 font-medium mb-1">
              Expected Delivery / ETA <span className="text-rose-400">*</span>
            </label>
            <input
              type="datetime-local"
              value={expectedDeliveryDate}
              onChange={(e) => setExpectedDeliveryDate(e.target.value)}
              required
              className="w-full px-3 py-2 rounded-xl bg-slate-900/80 border border-white/10 text-white focus:outline-none focus:border-blue-500/60 font-mono-telemetry"
            />
          </div>
        </div>

        {/* Initial Baseline Risk Score (Optional Manual Override) */}
        <div className="p-3 rounded-xl bg-slate-900/50 border border-white/10">
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-slate-300 font-medium">Initial Risk Score Override (0-100)</label>
            <span className="font-mono-telemetry font-bold text-blue-400">
              {initialRiskScore !== undefined ? `${initialRiskScore}/100` : 'Backend Auto-Calculated'}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min="0"
              max="100"
              value={initialRiskScore ?? 25}
              onChange={(e) => setInitialRiskScore(parseInt(e.target.value))}
              className="w-full accent-blue-500"
            />
            {initialRiskScore !== undefined && (
              <button
                type="button"
                onClick={() => setInitialRiskScore(undefined)}
                className="text-[11px] text-slate-400 hover:text-white underline cursor-pointer shrink-0"
              >
                Reset to Auto
              </button>
            )}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            The neural risk engine will compute authoritative risk score using delay buffer, supplier health, corridor chokepoints, and mode factors.
          </p>
        </div>

        {/* Actions Footer */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-5 py-2 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-500 text-white font-semibold flex items-center gap-2 shadow-lg shadow-blue-500/30 hover:opacity-95 transition-opacity cursor-pointer disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Saving to PostgreSQL...</span>
              </>
            ) : isEditing ? (
              <>
                <Save className="w-4 h-4" />
                <span>Save Changes</span>
              </>
            ) : (
              <>
                <Plus className="w-4 h-4" />
                <span>Create Shipment</span>
              </>
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
};
