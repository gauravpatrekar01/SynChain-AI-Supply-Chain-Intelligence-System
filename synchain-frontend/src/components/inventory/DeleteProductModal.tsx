import React, { useState } from 'react';
import { AlertTriangle, Trash2 } from 'lucide-react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { apiService } from '../../services/api';
import { soundFX } from '../../services/audioService';
import { InventoryItem } from '../../types';
import { formatApiError } from '../../utils/errorFormatter';

interface DeleteProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: InventoryItem | null;
  onSuccess: (deletedId: string) => void;
}

export const DeleteProductModal: React.FC<DeleteProductModalProps> = ({
  isOpen,
  onClose,
  product,
  onSuccess,
}) => {
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!product) return null;

  const handleDelete = async () => {
    setIsDeleting(true);
    setErrorMessage(null);
    try {
      soundFX.playClick();
      await apiService.deleteInventoryItem(product.id);
      soundFX.playSuccess();
      onSuccess(product.id);
      onClose();
    } catch (err: any) {
      soundFX.playError();
      const serverMsg = formatApiError(err, 'Failed to safely delete product.');
      setErrorMessage(serverMsg);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Confirm Inventory Deletion"
      size="md"
    >
      <div className="space-y-4">
        {errorMessage && (
          <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-start gap-3 text-rose-300 text-xs sm:text-sm animate-fade-in">
            <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-rose-200">Deletion Blocked</p>
              <p className="mt-0.5">{errorMessage}</p>
            </div>
          </div>
        )}

        <div className="flex items-start gap-4 p-4 rounded-xl bg-rose-500/5 border border-rose-500/20">
          <div className="w-10 h-10 rounded-full bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-rose-400 shrink-0">
            <Trash2 className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-white">Permanently Remove Product Record?</h4>
            <p className="text-xs text-slate-300 font-mono-telemetry mt-1">
              You are about to delete <strong className="text-white">{product.name}</strong> (SKU: <strong className="text-cyan-400">{product.sku}</strong>) at <strong className="text-white">{product.facility}</strong>.
            </p>
            <p className="text-[11px] text-slate-400 mt-2">
              The system will verify that this product has no active customer order items or purchase records before deletion.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              soundFX.playClick();
              setErrorMessage(null);
              onClose();
            }}
            disabled={isDeleting}
          >
            Cancel
          </Button>
          <Button
            variant="danger"
            size="sm"
            isLoading={isDeleting}
            onClick={handleDelete}
            leftIcon={<Trash2 className="w-4 h-4" />}
          >
            Confirm Delete
          </Button>
        </div>
      </div>
    </Modal>
  );
};
