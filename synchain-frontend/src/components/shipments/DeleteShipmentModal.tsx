import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { Shipment } from '../../types';
import { apiService } from '../../services/api';
import { soundFX } from '../../services/audioService';
import { Trash2, AlertTriangle, Loader2 } from 'lucide-react';

interface DeleteShipmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  shipment: Shipment | null;
  onDeleted: (shipmentId: string) => void;
}

export const DeleteShipmentModal: React.FC<DeleteShipmentModalProps> = ({
  isOpen,
  onClose,
  shipment,
  onDeleted,
}) => {
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!shipment) return null;

  const targetId = shipment.shipment_id || shipment.id;

  const handleDelete = async () => {
    setIsDeleting(true);
    setErrorMsg(null);
    soundFX.playClick();

    try {
      await apiService.deleteShipment(targetId);
      onDeleted(targetId);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.detail || err.message || 'Failed to delete shipment.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2 text-rose-400">
          <Trash2 className="w-5 h-5 text-rose-500" />
          <span>Confirm Shipment Deletion</span>
        </div>
      }
      subtitle="Safely remove consignment record from PostgreSQL database ledger"
      maxWidth="md"
    >
      <div className="space-y-4 text-xs">
        {errorMsg && (
          <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-300">
            {errorMsg}
          </div>
        )}

        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-white">This action cannot be undone.</p>
            <p className="text-slate-400 mt-1">
              You are about to permanently delete shipment record{' '}
              <strong className="text-white font-mono-telemetry">{targetId}</strong> (
              <span className="text-cyan-300">
                {shipment.shipment_name || shipment.vesselName || 'Fleet Consignment'}
              </span>
              ). Associated milestone telemetries and risk assessments will also be deleted.
            </p>
          </div>
        </div>

        <div className="p-3 rounded-xl bg-slate-900/60 border border-white/10 space-y-1.5 font-mono-telemetry text-slate-300">
          <div className="flex justify-between">
            <span className="text-slate-400">Carrier:</span>
            <span>{shipment.carrier_name || shipment.carrier}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Corridor:</span>
            <span>
              {shipment.origin} &rarr; {shipment.destination}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Status:</span>
            <span className="uppercase text-amber-400 font-bold">{shipment.status}</span>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={isDeleting}
            className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold flex items-center gap-2 shadow-lg shadow-rose-600/30 transition-all cursor-pointer disabled:opacity-50"
          >
            {isDeleting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Deleting...</span>
              </>
            ) : (
              <>
                <Trash2 className="w-4 h-4" />
                <span>Delete Shipment</span>
              </>
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
};
