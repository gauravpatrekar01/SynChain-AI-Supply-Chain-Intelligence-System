import React, { useState, useEffect } from 'react';
import {
  Package,
  Layers,
  MapPin,
  ShieldCheck,
  AlertTriangle,
  Clock,
  Activity,
  DollarSign,
  TrendingUp,
  Save,
  RefreshCw,
} from 'lucide-react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { apiService } from '../../services/api';
import { soundFX } from '../../services/audioService';
import { InventoryItem, InventoryFormData, WarehouseOption } from '../../types';
import { formatApiError, extractFieldErrors } from '../../utils/errorFormatter';

interface ProductFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (savedItem: InventoryItem) => void;
  productToEdit?: InventoryItem | null;
}

export const ProductFormModal: React.FC<ProductFormModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  productToEdit,
}) => {
  const isEditing = Boolean(productToEdit);

  const [formData, setFormData] = useState<InventoryFormData>({
    sku: '',
    name: '',
    category: 'Logic Silicon',
    warehouse_id: '',
    warehouse_name: '',
    on_hand_quantity: 10000,
    reserved_quantity: 0,
    safety_stock: 5000,
    reorder_point: 8000,
    reorder_quantity: 5000,
    average_daily_demand: 350,
    lead_time_days: 14,
    price: 150.0,
  });

  const [warehouses, setWarehouses] = useState<WarehouseOption[]>([]);
  const [warehouseError, setWarehouseError] = useState<string | null>(null);
  const [isLoadingWarehouses, setIsLoadingWarehouses] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Load available warehouses for selector
  useEffect(() => {
    if (isOpen) {
      setIsLoadingWarehouses(true);
      setWarehouseError(null);
      apiService
        .getInventoryWarehouses()
        .then((res) => {
          if (res && res.length > 0) {
            setWarehouses(res);
            // Set default warehouse if none selected
            if (!productToEdit && (!formData.warehouse_id || !formData.warehouse_name)) {
              setFormData((prev) => ({
                ...prev,
                warehouse_id: res[0].id,
                warehouse_name: res[0].name,
              }));
            }
          } else {
            setWarehouseError('No active warehouses found in PostgreSQL. You can specify a facility name below to provision one.');
          }
        })
        .catch((err) => {
          console.error('Failed to load warehouses', err);
          const friendly = formatApiError(err, 'Unable to load warehouse options.');
          setWarehouseError(friendly);
        })
        .finally(() => {
          setIsLoadingWarehouses(false);
        });
    }
  }, [isOpen]);

  // Populate form on open / edit
  useEffect(() => {
    if (productToEdit) {
      setFormData({
        sku: productToEdit.sku || '',
        name: productToEdit.name || '',
        category: productToEdit.category || 'General',
        warehouse_id: productToEdit.warehouse_id || '',
        warehouse_name: productToEdit.facility || '',
        on_hand_quantity: productToEdit.on_hand_units ?? productToEdit.onHandUnits ?? 0,
        reserved_quantity: productToEdit.reserved_units ?? productToEdit.reservedUnits ?? 0,
        safety_stock: productToEdit.safety_stock_units ?? productToEdit.safetyStockUnits ?? 0,
        reorder_point: productToEdit.reorder_trigger ?? productToEdit.reorderTrigger ?? 0,
        reorder_quantity: productToEdit.reorder_quantity ?? productToEdit.reorderQuantity ?? 0,
        average_daily_demand: productToEdit.average_daily_demand ?? productToEdit.averageDailyDemand ?? 0,
        lead_time_days: productToEdit.lead_time_days ?? productToEdit.leadTimeDays ?? 14,
        price: productToEdit.price ?? 100.0,
      });
    } else {
      setFormData({
        sku: '',
        name: '',
        category: 'Logic Silicon',
        warehouse_id: warehouses.length > 0 ? warehouses[0].id : '',
        warehouse_name: warehouses.length > 0 ? warehouses[0].name : '',
        on_hand_quantity: 10000,
        reserved_quantity: 0,
        safety_stock: 5000,
        reorder_point: 8000,
        reorder_quantity: 5000,
        average_daily_demand: 350,
        lead_time_days: 14,
        price: 150.0,
      });
    }
    setErrorMessage(null);
    setFieldErrors({});
  }, [productToEdit, isOpen]);

  const handleChange = (field: keyof InventoryFormData, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (fieldErrors[field]) {
      setFieldErrors((prev) => {
        const copy = { ...prev };
        delete copy[field];
        return copy;
      });
    }
  };

  const handleWarehouseChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedId = e.target.value;
    const selectedWh = warehouses.find((w) => w.id === selectedId);
    setFormData((prev) => ({
      ...prev,
      warehouse_id: selectedId,
      warehouse_name: selectedWh ? selectedWh.name : prev.warehouse_name,
    }));
  };

  const validate = (): boolean => {
    const errors: Record<string, string> = {};

    if (!formData.name.trim()) {
      errors.name = 'Product name is required.';
    }
    if (!formData.sku.trim()) {
      errors.sku = 'SKU / Product code is required.';
    }
    if (formData.on_hand_quantity < 0) {
      errors.on_hand_quantity = 'On-hand quantity cannot be negative.';
    }
    if (formData.reserved_quantity < 0) {
      errors.reserved_quantity = 'Reserved quantity cannot be negative.';
    }
    if (formData.reserved_quantity > formData.on_hand_quantity) {
      errors.reserved_quantity = `Reserved (${formData.reserved_quantity}) cannot exceed on-hand stock (${formData.on_hand_quantity}).`;
    }
    if (formData.safety_stock < 0) {
      errors.safety_stock = 'Safety stock floor cannot be negative.';
    }
    if (formData.reorder_point < 0) {
      errors.reorder_point = 'Reorder trigger point cannot be negative.';
    }
    if (formData.reorder_quantity < 0) {
      errors.reorder_quantity = 'Reorder quantity cannot be negative.';
    }
    if (formData.average_daily_demand !== undefined && formData.average_daily_demand !== null && formData.average_daily_demand < 0) {
      errors.average_daily_demand = 'Daily demand cannot be negative.';
    }
    if (formData.lead_time_days !== undefined && formData.lead_time_days !== null && formData.lead_time_days < 0) {
      errors.lead_time_days = 'Lead time cannot be negative.';
    }
    if (formData.price !== undefined && formData.price !== null && formData.price < 0) {
      errors.price = 'Unit price cannot be negative.';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) {
      soundFX.playError();
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      soundFX.playClick();
      let saved: InventoryItem;
      if (isEditing && productToEdit) {
        saved = await apiService.updateInventoryItem(productToEdit.id, formData);
      } else {
        saved = await apiService.createInventoryItem(formData);
      }

      soundFX.playSuccess();
      onSuccess(saved);
      onClose();
    } catch (err: any) {
      soundFX.playError();
      const serverMsg = formatApiError(err, 'Failed to save product record.');
      setErrorMessage(serverMsg);
      const extracted = extractFieldErrors(err);
      if (Object.keys(extracted).length > 0) {
        setFieldErrors(prev => ({ ...prev, ...extracted }));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? `Edit Inventory: ${productToEdit?.sku}` : 'Add New Inventory Product'}
      size="xl"
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {errorMessage && (
          <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-start gap-3 text-rose-300 text-xs sm:text-sm animate-fade-in">
            <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-rose-200">Validation Error</p>
              <p className="mt-0.5">{errorMessage}</p>
            </div>
          </div>
        )}

        {/* Section 1: Identification & Location */}
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-cyan-400 font-mono-telemetry mb-3 flex items-center gap-1.5">
            <Package className="w-3.5 h-3.5" />
            1. Product Identification & Location
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-mono-telemetry text-slate-300 mb-1.5">
                Product Name <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => handleChange('name', e.target.value)}
                placeholder="e.g. 3nm Ultra AI Neural Processor"
                className={`w-full px-3 py-2 rounded-xl bg-slate-900/90 border ${
                  fieldErrors.name ? 'border-rose-500/80 focus:ring-rose-500/40' : 'border-white/10 focus:border-cyan-500/60 focus:ring-cyan-500/20'
                } text-white placeholder-slate-500 text-xs sm:text-sm focus:outline-none focus:ring-2 transition-all`}
              />
              {fieldErrors.name && <p className="text-[11px] text-rose-400 mt-1 font-mono-telemetry">{fieldErrors.name}</p>}
            </div>

            <div>
              <label className="block text-xs font-mono-telemetry text-slate-300 mb-1.5">
                SKU / Product Code <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                value={formData.sku}
                onChange={(e) => handleChange('sku', e.target.value)}
                placeholder="e.g. IC-3NM-A18"
                className={`w-full px-3 py-2 rounded-xl bg-slate-900/90 border font-mono-telemetry ${
                  fieldErrors.sku ? 'border-rose-500/80 focus:ring-rose-500/40' : 'border-white/10 focus:border-cyan-500/60 focus:ring-cyan-500/20'
                } text-white placeholder-slate-500 text-xs sm:text-sm focus:outline-none focus:ring-2 transition-all`}
              />
              {fieldErrors.sku && <p className="text-[11px] text-rose-400 mt-1 font-mono-telemetry">{fieldErrors.sku}</p>}
            </div>

            <div>
              <label className="block text-xs font-mono-telemetry text-slate-300 mb-1.5">
                Category
              </label>
              <input
                type="text"
                value={formData.category}
                onChange={(e) => handleChange('category', e.target.value)}
                placeholder="e.g. Logic Silicon, Memory IC"
                className="w-full px-3 py-2 rounded-xl bg-slate-900/90 border border-white/10 text-white placeholder-slate-500 text-xs sm:text-sm focus:border-cyan-500/60 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 transition-all"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <div>
              <label className="block text-xs font-mono-telemetry text-slate-300 mb-1.5">
                Warehouse / Logistics Facility <span className="text-rose-400">*</span>
              </label>
              {warehouses.length > 0 ? (
                <select
                  value={formData.warehouse_id}
                  onChange={handleWarehouseChange}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900/90 border border-white/10 text-white text-xs sm:text-sm focus:border-cyan-500/60 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 transition-all"
                >
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name} ({w.location}, {w.country})
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  value={formData.warehouse_name}
                  onChange={(e) => handleChange('warehouse_name', e.target.value)}
                  placeholder="e.g. Austin Hub or Giga Austin Warehouse"
                  className="w-full px-3 py-2 rounded-xl bg-slate-900/90 border border-white/10 text-white placeholder-slate-500 text-xs sm:text-sm focus:border-cyan-500/60 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 transition-all"
                />
              )}
            </div>

            <div>
              <label className="block text-xs font-mono-telemetry text-slate-300 mb-1.5">
                Unit Valuation (USD)
              </label>
              <div className="relative">
                <DollarSign className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.price ?? 100}
                  onChange={(e) => handleChange('price', parseFloat(e.target.value) || 0)}
                  className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-900/90 border border-white/10 text-white font-mono-telemetry text-xs sm:text-sm focus:border-cyan-500/60 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 transition-all"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Section 2: Stock Quantities & Buffer Floors */}
        <div className="pt-2 border-t border-white/10">
          <h4 className="text-xs font-bold uppercase tracking-wider text-blue-400 font-mono-telemetry mb-3 flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5" />
            2. Stock Levels & Thresholds
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-mono-telemetry text-slate-300 mb-1.5">
                On-Hand Units <span className="text-rose-400">*</span>
              </label>
              <input
                type="number"
                min="0"
                value={formData.on_hand_quantity}
                onChange={(e) => handleChange('on_hand_quantity', parseInt(e.target.value) || 0)}
                className={`w-full px-3 py-2 rounded-xl bg-slate-900/90 border font-mono-telemetry ${
                  fieldErrors.on_hand_quantity ? 'border-rose-500/80' : 'border-white/10'
                } text-white text-xs sm:text-sm focus:border-blue-500/60 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all`}
              />
              {fieldErrors.on_hand_quantity && <p className="text-[10px] text-rose-400 mt-1">{fieldErrors.on_hand_quantity}</p>}
            </div>

            <div>
              <label className="block text-xs font-mono-telemetry text-slate-300 mb-1.5">
                Reserved Units
              </label>
              <input
                type="number"
                min="0"
                value={formData.reserved_quantity}
                onChange={(e) => handleChange('reserved_quantity', parseInt(e.target.value) || 0)}
                className={`w-full px-3 py-2 rounded-xl bg-slate-900/90 border font-mono-telemetry ${
                  fieldErrors.reserved_quantity ? 'border-rose-500/80' : 'border-white/10'
                } text-white text-xs sm:text-sm focus:border-blue-500/60 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all`}
              />
              {fieldErrors.reserved_quantity && <p className="text-[10px] text-rose-400 mt-1">{fieldErrors.reserved_quantity}</p>}
            </div>

            <div>
              <label className="block text-xs font-mono-telemetry text-slate-300 mb-1.5">
                Safety Stock Floor <span className="text-rose-400">*</span>
              </label>
              <input
                type="number"
                min="0"
                value={formData.safety_stock}
                onChange={(e) => handleChange('safety_stock', parseInt(e.target.value) || 0)}
                className={`w-full px-3 py-2 rounded-xl bg-slate-900/90 border font-mono-telemetry ${
                  fieldErrors.safety_stock ? 'border-rose-500/80' : 'border-white/10'
                } text-white text-xs sm:text-sm focus:border-blue-500/60 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all`}
              />
              {fieldErrors.safety_stock && <p className="text-[10px] text-rose-400 mt-1">{fieldErrors.safety_stock}</p>}
            </div>

            <div>
              <label className="block text-xs font-mono-telemetry text-slate-300 mb-1.5">
                Reorder Trigger Point
              </label>
              <input
                type="number"
                min="0"
                value={formData.reorder_point}
                onChange={(e) => handleChange('reorder_point', parseInt(e.target.value) || 0)}
                className={`w-full px-3 py-2 rounded-xl bg-slate-900/90 border font-mono-telemetry ${
                  fieldErrors.reorder_point ? 'border-rose-500/80' : 'border-white/10'
                } text-white text-xs sm:text-sm focus:border-blue-500/60 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all`}
              />
              {fieldErrors.reorder_point && <p className="text-[10px] text-rose-400 mt-1">{fieldErrors.reorder_point}</p>}
            </div>
          </div>

          <div className="mt-3 p-3 rounded-xl bg-slate-900/60 border border-white/5 flex flex-wrap items-center justify-between gap-3 text-xs font-mono-telemetry">
            <span className="text-slate-400">
              Calculated Available Inventory:
              <strong className="text-white ml-1.5 text-sm">
                {Math.max(0, formData.on_hand_quantity - formData.reserved_quantity).toLocaleString()} units
              </strong>
            </span>
            <span className="text-slate-400">
              Projected Buffer Health:
              <strong
                className={`ml-1.5 text-sm ${
                  formData.safety_stock > 0 && (formData.on_hand_quantity - formData.reserved_quantity) / formData.safety_stock < 1
                    ? 'text-rose-400'
                    : 'text-emerald-400'
                }`}
              >
                {formData.safety_stock > 0
                  ? Math.round(((formData.on_hand_quantity - formData.reserved_quantity) / formData.safety_stock) * 100)
                  : 100}
                %
              </strong>
            </span>
          </div>
        </div>

        {/* Section 3: Forecasting Velocity & Replenishment Policy */}
        <div className="pt-2 border-t border-white/10">
          <h4 className="text-xs font-bold uppercase tracking-wider text-purple-400 font-mono-telemetry mb-3 flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5" />
            3. Demand Velocity & Multi-Echelon Lead Time
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-mono-telemetry text-slate-300 mb-1.5">
                Avg Daily Demand (Units/Day)
              </label>
              <input
                type="number"
                min="0"
                step="0.1"
                value={formData.average_daily_demand ?? ''}
                onChange={(e) => handleChange('average_daily_demand', parseFloat(e.target.value) || 0)}
                placeholder="e.g. 350"
                className="w-full px-3 py-2 rounded-xl bg-slate-900/90 border border-white/10 font-mono-telemetry text-white text-xs sm:text-sm focus:border-purple-500/60 focus:outline-none focus:ring-2 focus:ring-purple-500/20 transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-mono-telemetry text-slate-300 mb-1.5">
                Lead Time in Days
              </label>
              <input
                type="number"
                min="0"
                value={formData.lead_time_days ?? 14}
                onChange={(e) => handleChange('lead_time_days', parseInt(e.target.value) || 0)}
                placeholder="e.g. 14"
                className="w-full px-3 py-2 rounded-xl bg-slate-900/90 border border-white/10 font-mono-telemetry text-white text-xs sm:text-sm focus:border-purple-500/60 focus:outline-none focus:ring-2 focus:ring-purple-500/20 transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-mono-telemetry text-slate-300 mb-1.5">
                Batch Reorder Quantity
              </label>
              <input
                type="number"
                min="0"
                value={formData.reorder_quantity}
                onChange={(e) => handleChange('reorder_quantity', parseInt(e.target.value) || 0)}
                placeholder="e.g. 5000"
                className="w-full px-3 py-2 rounded-xl bg-slate-900/90 border border-white/10 font-mono-telemetry text-white text-xs sm:text-sm focus:border-purple-500/60 focus:outline-none focus:ring-2 focus:ring-purple-500/20 transition-all"
              />
            </div>
          </div>
        </div>

        {/* Modal Actions */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              soundFX.playClick();
              onClose();
            }}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="glow"
            size="sm"
            isLoading={isSubmitting}
            leftIcon={<Save className="w-4 h-4" />}
          >
            {isEditing ? 'Save Product Changes' : 'Create Inventory Product'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
