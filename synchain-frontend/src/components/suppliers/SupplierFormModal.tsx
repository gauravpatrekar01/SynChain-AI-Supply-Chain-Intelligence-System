import React, { useState, useEffect } from 'react';
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
  Layers,
  Save,
  RefreshCw,
  Sliders,
} from 'lucide-react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { apiService } from '../../services/api';
import { soundFX } from '../../services/audioService';
import { Supplier, SupplierFormData, HealthStatus } from '../../types';

interface SupplierFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (savedSupplier: Supplier) => void;
  supplierToEdit?: Supplier | null;
}

export const SupplierFormModal: React.FC<SupplierFormModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  supplierToEdit,
}) => {
  const isEditing = Boolean(supplierToEdit);

  const [formData, setFormData] = useState<SupplierFormData>({
    supplier_code: '',
    name: '',
    tier: 'Tier-1',
    category: 'Electronics',
    location: '',
    country: 'Global',
    contact_person: '',
    email: '',
    phone: '',
    reliability_score: 85,
    quality_rating: 90,
    spend_annual_usd: 1000000,
    health_status: 'optimal',
    single_source_risk: false,
    lead_time_days: 14,
    capacity: 25000,
    is_active: true,
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Populate form when modal opens or editing supplier changes
  useEffect(() => {
    if (supplierToEdit) {
      setFormData({
        supplier_code: supplierToEdit.supplier_code || supplierToEdit.supplierCode || '',
        name: supplierToEdit.name || '',
        tier: supplierToEdit.tier || 'Tier-1',
        category: supplierToEdit.category || 'Electronics',
        location: supplierToEdit.location || '',
        country: supplierToEdit.country || 'Global',
        contact_person: supplierToEdit.contact_person || supplierToEdit.contactPerson || '',
        email: supplierToEdit.email || '',
        phone: supplierToEdit.phone || '',
        reliability_score: supplierToEdit.reliability_score ?? supplierToEdit.reliabilityScore ?? 85,
        quality_rating: supplierToEdit.quality_rating ?? supplierToEdit.qualityRating ?? 90,
        spend_annual_usd: supplierToEdit.spend_annual_usd ?? supplierToEdit.spendAnnualUsd ?? 1000000,
        health_status: (supplierToEdit.health_status || supplierToEdit.healthStatus || 'optimal') as HealthStatus,
        single_source_risk: supplierToEdit.single_source_risk ?? supplierToEdit.singleSourceRisk ?? false,
        lead_time_days: supplierToEdit.lead_time_days ?? supplierToEdit.leadTimeDays ?? 14,
        capacity: supplierToEdit.capacity ?? 25000,
        is_active: supplierToEdit.is_active ?? supplierToEdit.isActive ?? true,
      });
    } else {
      setFormData({
        supplier_code: '',
        name: '',
        tier: 'Tier-1',
        category: 'Electronics',
        location: '',
        country: 'Global',
        contact_person: '',
        email: '',
        phone: '',
        reliability_score: 85,
        quality_rating: 90,
        spend_annual_usd: 1000000,
        health_status: 'optimal',
        single_source_risk: false,
        lead_time_days: 14,
        capacity: 25000,
        is_active: true,
      });
    }
    setErrorMessage(null);
  }, [supplierToEdit, isOpen]);

  const handleChange = (field: keyof SupplierFormData, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setErrorMessage('Supplier Name is required.');
      return;
    }

    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
      setErrorMessage('Please provide a valid email address.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      let saved: Supplier;
      if (isEditing && supplierToEdit) {
        saved = await apiService.updateSupplier(supplierToEdit.id, formData);
      } else {
        saved = await apiService.createSupplier(formData);
      }
      soundFX.playSuccess();
      onSuccess(saved);
      onClose();
    } catch (err: any) {
      const msg = err.response?.data?.detail || err.message || 'Failed to save supplier.';
      setErrorMessage(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setIsSubmitting(false);
    }
  };

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
            <h3 className="text-lg font-bold text-white font-display">
              {isEditing ? 'Edit Partner Profile' : 'Register New Partner'}
            </h3>
          </div>
        </div>
      }
      subtitle={
        isEditing
          ? `Modify partner metadata, contractual commitments, and operational tiering`
          : `Add a manual vendor record to the global supply chain graph and registry`
      }
      maxWidth="2xl"
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {errorMessage && (
          <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <div className="flex-1 font-mono-telemetry">{errorMessage}</div>
          </div>
        )}

        {/* Section 1: Identification & Classification */}
        <div className="space-y-4">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 font-mono-telemetry border-b border-white/5 pb-1.5 flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-blue-400" /> Identification & Classification
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-slate-300 block mb-1">
                Supplier Name <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => handleChange('name', e.target.value)}
                placeholder="e.g. Taiwan Advanced Silicon Corp"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900/80 border border-white/10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/50"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-slate-300 block mb-1">
                Supplier Code / Identifier
              </label>
              <input
                type="text"
                value={formData.supplier_code}
                onChange={(e) => handleChange('supplier_code', e.target.value)}
                placeholder="e.g. SUP-TSMC-001"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900/80 border border-white/10 text-xs text-white font-mono-telemetry placeholder-slate-500 focus:outline-none focus:border-blue-500/50"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-slate-300 block mb-1">
                Tier Level
              </label>
              <select
                value={formData.tier}
                onChange={(e) => handleChange('tier', e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900/80 border border-white/10 text-xs text-white focus:outline-none focus:border-blue-500/50"
              >
                <option value="Tier-1">Tier-1 (Direct Component / Sub-assembly)</option>
                <option value="Tier-2">Tier-2 (Raw Materials / Foundry / Chemical)</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-medium text-slate-300 block mb-1">
                Category / Domain
              </label>
              <input
                type="text"
                value={formData.category}
                onChange={(e) => handleChange('category', e.target.value)}
                placeholder="e.g. Semiconductor Fabrication, Optics, Polymers"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900/80 border border-white/10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/50"
              />
            </div>
          </div>
        </div>

        {/* Section 2: Location & Contact */}
        <div className="space-y-4">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 font-mono-telemetry border-b border-white/5 pb-1.5 flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-blue-400" /> Geography & Communications
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-slate-300 block mb-1">
                Facility Location / City
              </label>
              <input
                type="text"
                value={formData.location}
                onChange={(e) => handleChange('location', e.target.value)}
                placeholder="e.g. Hsinchu Science Park, Taiwan"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900/80 border border-white/10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/50"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-slate-300 block mb-1">
                Country
              </label>
              <input
                type="text"
                value={formData.country}
                onChange={(e) => handleChange('country', e.target.value)}
                placeholder="e.g. Taiwan, Germany, Japan, USA"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900/80 border border-white/10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/50"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-slate-300 block mb-1">
                Primary Contact Person
              </label>
              <input
                type="text"
                value={formData.contact_person}
                onChange={(e) => handleChange('contact_person', e.target.value)}
                placeholder="e.g. Dr. Morris Chen"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900/80 border border-white/10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/50"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-slate-300 block mb-1">
                Contact Email
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => handleChange('email', e.target.value)}
                placeholder="e.g. procurement@vendor.com"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900/80 border border-white/10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/50"
              />
            </div>
          </div>
        </div>

        {/* Section 3: Performance, Spend & Risk */}
        <div className="space-y-4">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 font-mono-telemetry border-b border-white/5 pb-1.5 flex items-center gap-1.5">
            <Sliders className="w-3.5 h-3.5 text-blue-400" /> Performance & Risk Profile
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-medium text-slate-300 block mb-1">
                Reliability Score (0–100%)
              </label>
              <input
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={formData.reliability_score}
                onChange={(e) => handleChange('reliability_score', parseFloat(e.target.value) || 0)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900/80 border border-white/10 text-xs text-white font-mono-telemetry focus:outline-none focus:border-blue-500/50"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-slate-300 block mb-1">
                Annual Spend (USD)
              </label>
              <input
                type="number"
                min="0"
                step="1000"
                value={formData.spend_annual_usd}
                onChange={(e) => handleChange('spend_annual_usd', parseFloat(e.target.value) || 0)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900/80 border border-white/10 text-xs text-white font-mono-telemetry focus:outline-none focus:border-blue-500/50"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-slate-300 block mb-1">
                Health / Risk Rating
              </label>
              <select
                value={formData.health_status}
                onChange={(e) => handleChange('health_status', e.target.value as HealthStatus)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900/80 border border-white/10 text-xs text-white focus:outline-none focus:border-blue-500/50"
              >
                <option value="optimal">Optimal (Healthy)</option>
                <option value="warning">Warning (Elevated Risk)</option>
                <option value="critical">Critical (Severe Risk)</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-medium text-slate-300 block mb-1">
                Lead Time (Days)
              </label>
              <input
                type="number"
                min="0"
                value={formData.lead_time_days || ''}
                onChange={(e) => handleChange('lead_time_days', parseInt(e.target.value) || 0)}
                placeholder="14"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900/80 border border-white/10 text-xs text-white font-mono-telemetry focus:outline-none focus:border-blue-500/50"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-slate-300 block mb-1">
                Monthly Capacity (Units)
              </label>
              <input
                type="number"
                min="0"
                value={formData.capacity || ''}
                onChange={(e) => handleChange('capacity', parseInt(e.target.value) || 0)}
                placeholder="50000"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900/80 border border-white/10 text-xs text-white font-mono-telemetry focus:outline-none focus:border-blue-500/50"
              />
            </div>

            <div className="flex flex-col justify-end space-y-2 pt-2">
              <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300">
                <input
                  type="checkbox"
                  checked={formData.single_source_risk}
                  onChange={(e) => handleChange('single_source_risk', e.target.checked)}
                  className="rounded bg-slate-800 border-white/20 text-rose-500 focus:ring-0"
                />
                <span className="flex items-center gap-1 text-rose-300 font-medium">
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                  Single Source Risk
                </span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300">
                <input
                  type="checkbox"
                  checked={formData.is_active}
                  onChange={(e) => handleChange('is_active', e.target.checked)}
                  className="rounded bg-slate-800 border-white/20 text-emerald-500 focus:ring-0"
                />
                <span className="text-emerald-300 font-medium">Active Partner</span>
              </label>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
          <Button variant="ghost" type="button" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                Saving Partner...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                {isEditing ? 'Save Changes' : 'Register Supplier'}
              </>
            )}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
