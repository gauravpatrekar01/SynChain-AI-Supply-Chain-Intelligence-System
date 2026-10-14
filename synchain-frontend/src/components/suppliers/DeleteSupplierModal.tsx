import React, { useState } from 'react';
import { AlertTriangle, Trash2, RefreshCw, XCircle } from 'lucide-react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { Supplier } from '../../types';
import { apiService } from '../../services/api';
import { soundFX } from '../../services/audioService';

interface DeleteSupplierModalProps {
  isOpen: boolean;
  onClose: () => void;
  supplier: Supplier | null;
  onDeleted: () => void;
}

export const DeleteSupplierModal: React.FC<DeleteSupplierModalProps> = ({
  isOpen,
  onClose,
  supplier,
  onDeleted,
}) => {
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!supplier) return null;

  const supplierCode = supplier.supplier_code || supplier.supplierCode || supplier.id.slice(0, 8);

  const handleDelete = async () => {
    setIsDeleting(true);
    setErrorMessage(null);
    try {
      await apiService.deleteSupplier(supplier.id);
      soundFX.playSuccess();
      onDeleted();
      onClose();
    } catch (err: any) {
      soundFX.playWarning();
      const msg = err.response?.data?.detail || err.message || 'Failed to delete supplier.';
      setErrorMessage(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2.5 text-rose-400">
          <div className="p-2 rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/30">
            <Trash2 className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white font-display">Delete Supplier</h3>
          </div>
        </div>
      }
      subtitle="Safe registry removal with foreign-key dependency integrity protection"
      maxWidth="md"
      footer={
        <div className="flex items-center justify-end gap-3 w-full">
          <Button variant="ghost" size="sm" onClick={onClose} disabled={isDeleting}>
            Cancel
          </Button>
          <Button
            variant="danger"
            size="sm"
            onClick={handleDelete}
            disabled={isDeleting}
            className="flex items-center gap-1.5"
          >
            {isDeleting ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin mr-1" />
                Deleting...
              </>
            ) : (
              <>
                <Trash2 className="w-4 h-4 mr-1" />
                Confirm Deletion
              </>
            )}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {errorMessage && (
          <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2.5">
            <XCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <div className="flex-1 font-mono-telemetry">{errorMessage}</div>
          </div>
        )}

        <div className="p-4 rounded-xl bg-rose-500/5 border border-rose-500/20 space-y-2">
          <p className="text-xs text-slate-300 leading-relaxed">
            Are you sure you want to permanently delete{' '}
            <strong className="text-white font-semibold">{supplier.name}</strong> (
            <span className="font-mono-telemetry text-blue-300 font-semibold">{supplierCode}</span>
            )?
          </p>
          <p className="text-[11px] text-slate-400">
            This action cannot be undone. SynChain AI will enforce referential integrity and prevent
            deletion if this partner is linked to active shipments, purchase orders, or historical
            lead time records.
          </p>
        </div>
      </div>
    </Modal>
  );
};
