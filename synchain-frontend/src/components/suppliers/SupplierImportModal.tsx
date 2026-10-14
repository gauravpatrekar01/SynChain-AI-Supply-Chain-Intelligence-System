import React, { useState, useRef } from 'react';
import {
  Upload,
  Download,
  FileSpreadsheet,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  FileCheck,
  RefreshCw,
  Info,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { NeonBadge } from '../common/NeonBadge';
import { apiService } from '../../services/api';
import { soundFX } from '../../services/audioService';
import { SupplierImportPreview, SupplierImportResult } from '../../types';

interface SupplierImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const SupplierImportModal: React.FC<SupplierImportModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [previewData, setPreviewData] = useState<SupplierImportPreview | null>(null);
  const [duplicateMode, setDuplicateMode] = useState<'skip_duplicates' | 'fail_on_duplicates'>('skip_duplicates');
  const [importResult, setImportResult] = useState<SupplierImportResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetState = () => {
    setSelectedFile(null);
    setIsDragging(false);
    setIsPreviewing(false);
    setIsConfirming(false);
    setPreviewData(null);
    setImportResult(null);
    setErrorMessage(null);
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  // Download template CSV
  const handleDownloadTemplate = async () => {
    try {
      soundFX.playClick();
      const blob = await apiService.downloadSupplierTemplate();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'synchain_suppliers_template.csv');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      setErrorMessage('Failed to download template. Please try again.');
    }
  };

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelected(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelected = (file: File) => {
    if (!file.name.toLowerCase().endsWith('.csv')) {
      setErrorMessage('Only .csv files are supported for supplier ingestion.');
      return;
    }
    soundFX.playClick();
    setSelectedFile(file);
    setErrorMessage(null);
    setPreviewData(null);
    setImportResult(null);
  };

  // Upload and generate preview
  const handlePreviewUpload = async () => {
    if (!selectedFile) return;
    setIsPreviewing(true);
    setErrorMessage(null);
    try {
      const data = await apiService.previewSupplierCsv(selectedFile);
      setPreviewData(data);
      soundFX.playClick();
    } catch (err: any) {
      const msg = err.response?.data?.detail || err.message || 'Failed to parse CSV file.';
      setErrorMessage(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setIsPreviewing(false);
    }
  };

  // Confirm import into PostgreSQL
  const handleConfirmImport = async () => {
    if (!previewData?.preview_token) return;
    setIsConfirming(true);
    setErrorMessage(null);
    try {
      const result = await apiService.confirmSupplierCsv(previewData.preview_token, duplicateMode);
      setImportResult(result);
      soundFX.playSuccess();
      onSuccess();
    } catch (err: any) {
      const msg = err.response?.data?.detail || err.message || 'Failed to commit supplier records.';
      setErrorMessage(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setIsConfirming(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-blue-500/20 text-blue-400 border border-blue-500/30">
            <FileSpreadsheet className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white font-display">Bulk Import Suppliers</h3>
          </div>
        </div>
      }
      subtitle="Standardized CSV ingestion engine with format sanitization, schema validation, and duplicate mitigation"
      maxWidth="4xl"
    >
      <div className="space-y-6">
        {/* Error notification banner */}
        {errorMessage && (
          <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <div className="flex-1 font-mono-telemetry">{errorMessage}</div>
          </div>
        )}

        {/* Phase 3: Import Results Screen */}
        {importResult ? (
          <div className="py-6 space-y-6 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 shadow-[0_0_30px_rgba(16,185,129,0.2)]">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div>
              <h4 className="text-lg font-bold text-white font-display">Supplier Ingestion Successful</h4>
              <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                Records have been validated and atomically committed to the PostgreSQL registry.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-4 max-w-lg mx-auto">
              <div className="p-4 rounded-xl bg-slate-900/60 border border-emerald-500/20 text-center">
                <p className="text-2xl font-bold font-mono-telemetry text-emerald-400">
                  {importResult.imported_count}
                </p>
                <p className="text-[11px] text-slate-400 uppercase tracking-wider font-mono-telemetry mt-1">
                  Imported
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-900/60 border border-amber-500/20 text-center">
                <p className="text-2xl font-bold font-mono-telemetry text-amber-400">
                  {importResult.skipped_count}
                </p>
                <p className="text-[11px] text-slate-400 uppercase tracking-wider font-mono-telemetry mt-1">
                  Skipped Duplicates
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-900/60 border border-rose-500/20 text-center">
                <p className="text-2xl font-bold font-mono-telemetry text-rose-400">
                  {importResult.invalid_count}
                </p>
                <p className="text-[11px] text-slate-400 uppercase tracking-wider font-mono-telemetry mt-1">
                  Invalid Rows
                </p>
              </div>
            </div>

            <div className="pt-4 flex justify-center">
              <Button variant="primary" onClick={handleClose}>
                Done & Return to Registry
              </Button>
            </div>
          </div>
        ) : previewData ? (
          /* Phase 2: Preview & Validation Breakdown */
          <div className="space-y-5">
            {/* Summary stat cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 rounded-xl bg-slate-900/80 border border-white/10">
                <span className="text-[10px] uppercase tracking-wider text-slate-400 font-mono-telemetry">
                  Total Rows
                </span>
                <p className="text-xl font-bold text-white font-mono-telemetry mt-0.5">
                  {previewData.total_rows}
                </p>
              </div>

              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
                <span className="text-[10px] uppercase tracking-wider text-emerald-300 font-mono-telemetry flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" /> Valid
                </span>
                <p className="text-xl font-bold text-emerald-400 font-mono-telemetry mt-0.5">
                  {previewData.valid_rows}
                </p>
              </div>

              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30">
                <span className="text-[10px] uppercase tracking-wider text-amber-300 font-mono-telemetry flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3 text-amber-400" /> Duplicates
                </span>
                <p className="text-xl font-bold text-amber-400 font-mono-telemetry mt-0.5">
                  {previewData.duplicate_rows}
                </p>
              </div>

              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30">
                <span className="text-[10px] uppercase tracking-wider text-rose-300 font-mono-telemetry flex items-center gap-1">
                  <XCircle className="w-3 h-3 text-rose-400" /> Invalid
                </span>
                <p className="text-xl font-bold text-rose-400 font-mono-telemetry mt-0.5">
                  {previewData.invalid_rows}
                </p>
              </div>
            </div>

            {/* Duplicate policy selection */}
            <div className="p-4 rounded-xl bg-slate-900/60 border border-white/10 space-y-2">
              <label className="text-xs font-semibold text-white flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-blue-400" />
                Duplicate Handling Strategy
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <label
                  onClick={() => setDuplicateMode('skip_duplicates')}
                  className={`flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer transition-all ${
                    duplicateMode === 'skip_duplicates'
                      ? 'bg-blue-600/15 border-blue-500/50 text-white'
                      : 'bg-slate-950/40 border-white/5 text-slate-400 hover:border-white/15'
                  }`}
                >
                  <input
                    type="radio"
                    name="dup_mode"
                    checked={duplicateMode === 'skip_duplicates'}
                    onChange={() => setDuplicateMode('skip_duplicates')}
                    className="mt-0.5"
                  />
                  <div>
                    <span className="font-semibold text-white block">Skip Duplicates (Recommended)</span>
                    <span className="text-[11px] text-slate-400">
                      Import all valid new records and bypass records that already exist in DB.
                    </span>
                  </div>
                </label>

                <label
                  onClick={() => setDuplicateMode('fail_on_duplicates')}
                  className={`flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer transition-all ${
                    duplicateMode === 'fail_on_duplicates'
                      ? 'bg-blue-600/15 border-blue-500/50 text-white'
                      : 'bg-slate-950/40 border-white/5 text-slate-400 hover:border-white/15'
                  }`}
                >
                  <input
                    type="radio"
                    name="dup_mode"
                    checked={duplicateMode === 'fail_on_duplicates'}
                    onChange={() => setDuplicateMode('fail_on_duplicates')}
                    className="mt-0.5"
                  />
                  <div>
                    <span className="font-semibold text-white block">Abort on Duplicates</span>
                    <span className="text-[11px] text-slate-400">
                      Rollback transaction completely if any duplicate supplier code or name is detected.
                    </span>
                  </div>
                </label>
              </div>
            </div>

            {/* Error breakdown accordion if any errors exist */}
            {previewData.errors && previewData.errors.length > 0 && (
              <div className="p-4 rounded-xl bg-rose-500/5 border border-rose-500/20 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-rose-300 flex items-center gap-1.5 font-mono-telemetry">
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                    Validation & Duplicate Warnings ({previewData.errors.length})
                  </span>
                </div>
                <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1 font-mono-telemetry text-[11px]">
                  {previewData.errors.map((err, idx) => (
                    <div
                      key={idx}
                      className="p-2 rounded-lg bg-slate-950/60 border border-white/5 flex items-start justify-between gap-3 text-slate-300"
                    >
                      <div className="flex items-center gap-2">
                        <span className="px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 font-bold text-[10px]">
                          Row {err.row}
                        </span>
                        {err.field && (
                          <span className="text-slate-400">[{err.field}]</span>
                        )}
                        <span>{err.message}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Sample preview table */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-white">Parsed Records Preview</span>
                <span className="text-[11px] text-slate-400 font-mono-telemetry">
                  Showing first {Math.min(previewData.preview_records.length, 10)} valid rows
                </span>
              </div>

              <div className="rounded-xl border border-white/10 overflow-hidden bg-slate-950/60">
                <div className="overflow-x-auto max-h-56">
                  <table className="w-full text-left text-[11px] text-slate-300">
                    <thead className="bg-slate-900/90 text-slate-400 uppercase tracking-wider font-mono-telemetry text-[10px] sticky top-0 border-b border-white/10">
                      <tr>
                        <th className="py-2.5 px-3 font-semibold">Code</th>
                        <th className="py-2.5 px-3 font-semibold">Name</th>
                        <th className="py-2.5 px-3 font-semibold">Tier</th>
                        <th className="py-2.5 px-3 font-semibold">Category</th>
                        <th className="py-2.5 px-3 font-semibold">Location</th>
                        <th className="py-2.5 px-3 font-semibold">Reliability</th>
                        <th className="py-2.5 px-3 font-semibold">Spend</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {previewData.preview_records.map((r, i) => (
                        <tr key={i} className="hover:bg-white/5">
                          <td className="py-2 px-3 font-mono-telemetry text-blue-300">
                            {r.supplier_code || '—'}
                          </td>
                          <td className="py-2 px-3 font-semibold text-white">{r.name}</td>
                          <td className="py-2 px-3">
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono-telemetry bg-blue-500/20 text-blue-300">
                              {r.tier}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-slate-400">{r.category}</td>
                          <td className="py-2 px-3 text-slate-300">{r.location || r.country || 'Global'}</td>
                          <td className="py-2 px-3 font-mono-telemetry text-emerald-400">
                            {r.reliability_score !== undefined ? `${r.reliability_score}%` : '—'}
                          </td>
                          <td className="py-2 px-3 font-mono-telemetry text-slate-300">
                            {r.spend_annual_usd ? `$${(r.spend_annual_usd / 1000000).toFixed(1)}M` : '$0'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="flex items-center justify-between pt-3 border-t border-white/10">
              <Button
                variant="ghost"
                onClick={() => {
                  setPreviewData(null);
                  soundFX.playClick();
                }}
              >
                Choose Another File
              </Button>
              <Button
                variant="primary"
                onClick={handleConfirmImport}
                disabled={previewData.valid_rows === 0 || isConfirming}
              >
                {isConfirming ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                    Committing Records...
                  </>
                ) : (
                  <>
                    Commit {previewData.valid_rows} Records to Registry
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </>
                )}
              </Button>
            </div>
          </div>
        ) : (
          /* Phase 1: Upload & Download Template */
          <div className="space-y-6">
            {/* Step 1: Download Standard Template */}
            <div className="p-4 rounded-xl bg-slate-900/60 border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <span className="text-xs font-semibold text-white flex items-center gap-1.5">
                  <FileSpreadsheet className="w-4 h-4 text-blue-400" />
                  1. Download Standard CSV Template
                </span>
                <p className="text-xs text-slate-400">
                  Pre-formatted schema template with required columns, validation rules, and sample data.
                </p>
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleDownloadTemplate}
                className="shrink-0 flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                Download Template (.csv)
              </Button>
            </div>

            {/* Step 2: Upload Dropzone */}
            <div className="space-y-2">
              <span className="text-xs font-semibold text-white block">
                2. Upload Supplier CSV File
              </span>

              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleFileDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`p-8 rounded-2xl border-2 border-dashed transition-all cursor-pointer text-center space-y-3 ${
                  isDragging
                    ? 'border-blue-500 bg-blue-500/10'
                    : selectedFile
                    ? 'border-blue-500/40 bg-blue-500/5'
                    : 'border-white/10 hover:border-white/20 bg-slate-950/40'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleFileSelected(e.target.files[0]);
                    }
                  }}
                />

                <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
                  <Upload className="w-6 h-6" />
                </div>

                <div>
                  <p className="text-sm font-semibold text-white">
                    {selectedFile ? selectedFile.name : 'Click to browse or drag and drop CSV'}
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    {selectedFile
                      ? `${(selectedFile.size / 1024).toFixed(1)} KB — Ready to analyze`
                      : 'Accepts standard CSV with UTF-8 or BOM encoding'}
                  </p>
                </div>
              </div>
            </div>

            {/* Upload guidelines hint */}
            <div className="p-3.5 rounded-xl bg-blue-500/5 border border-blue-500/20 text-xs text-slate-400 flex items-start gap-2.5">
              <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <span className="font-semibold text-slate-300 block">Ingestion Integrity & Safety:</span>
                <p>
                  Uploaded rows are automatically scanned for CSV formula injections (<code className="text-blue-300">=, +, -, @</code>), validated against tier and email standards, and checked for intra-file and database duplicates.
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
              <Button variant="ghost" onClick={handleClose}>
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handlePreviewUpload}
                disabled={!selectedFile || isPreviewing}
              >
                {isPreviewing ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                    Validating CSV...
                  </>
                ) : (
                  <>
                    Validate & Preview Records
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
