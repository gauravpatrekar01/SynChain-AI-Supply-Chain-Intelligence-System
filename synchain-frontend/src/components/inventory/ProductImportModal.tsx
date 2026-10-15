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
  Layers,
} from 'lucide-react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { NeonBadge } from '../common/NeonBadge';
import { apiService } from '../../services/api';
import { soundFX } from '../../services/audioService';
import { InventoryImportPreview, InventoryImportResult } from '../../types';
import { formatApiError } from '../../utils/errorFormatter';

interface ProductImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const ProductImportModal: React.FC<ProductImportModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [previewData, setPreviewData] = useState<InventoryImportPreview | null>(null);
  const [duplicateMode, setDuplicateMode] = useState<'skip_duplicates' | 'fail_on_duplicates'>('skip_duplicates');
  const [importResult, setImportResult] = useState<InventoryImportResult | null>(null);
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
      const blob = await apiService.downloadInventoryTemplate();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'synchain_inventory_template.csv');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      setErrorMessage('Failed to download CSV template. Please try again.');
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
      setErrorMessage('Only .csv files are supported for inventory ingestion.');
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
      soundFX.playClick();
      const preview = await apiService.previewInventoryCsv(selectedFile);
      setPreviewData(preview);
      soundFX.playSuccess();
    } catch (err: any) {
      soundFX.playError();
      const serverMsg = formatApiError(err, 'Failed to parse and validate CSV file.');
      setErrorMessage(serverMsg);
    } finally {
      setIsPreviewing(false);
    }
  };

  // Confirm import and commit to PostgreSQL
  const handleConfirmImport = async () => {
    if (!previewData?.preview_token) return;
    setIsConfirming(true);
    setErrorMessage(null);

    try {
      soundFX.playClick();
      const result = await apiService.confirmInventoryCsv(previewData.preview_token, duplicateMode);
      setImportResult(result);
      soundFX.playSuccess();
      onSuccess();
    } catch (err: any) {
      soundFX.playError();
      const serverMsg = formatApiError(err, 'Failed to commit CSV records to database.');
      setErrorMessage(serverMsg);
    } finally {
      setIsConfirming(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Bulk Product & Inventory CSV Import"
      size="2xl"
    >
      <div className="space-y-6">
        {/* Step Indicators */}
        <div className="flex items-center justify-between p-3 rounded-xl bg-slate-900/60 border border-white/5 text-xs font-mono-telemetry">
          <div className="flex items-center gap-2">
            <span
              className={`w-5 h-5 rounded-full flex items-center justify-center font-bold ${
                !previewData ? 'bg-cyan-500 text-slate-950' : 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40'
              }`}
            >
              1
            </span>
            <span className={!previewData ? 'text-white font-semibold' : 'text-slate-400'}>Upload CSV</span>
          </div>
          <ArrowRight className="w-3.5 h-3.5 text-slate-600" />
          <div className="flex items-center gap-2">
            <span
              className={`w-5 h-5 rounded-full flex items-center justify-center font-bold ${
                previewData && !importResult ? 'bg-cyan-500 text-slate-950' : 'bg-slate-800 text-slate-400'
              }`}
            >
              2
            </span>
            <span className={previewData && !importResult ? 'text-white font-semibold' : 'text-slate-400'}>
              Review & Validate
            </span>
          </div>
          <ArrowRight className="w-3.5 h-3.5 text-slate-600" />
          <div className="flex items-center gap-2">
            <span
              className={`w-5 h-5 rounded-full flex items-center justify-center font-bold ${
                importResult ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-slate-400'
              }`}
            >
              3
            </span>
            <span className={importResult ? 'text-emerald-400 font-semibold' : 'text-slate-400'}>
              PostgreSQL Persist
            </span>
          </div>
        </div>

        {/* Global Error Banner */}
        {errorMessage && (
          <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-start gap-3 text-rose-300 text-xs sm:text-sm animate-fade-in">
            <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-rose-200">Import Blocked</p>
              <p className="mt-0.5">{errorMessage}</p>
            </div>
          </div>
        )}

        {/* STEP 1: Upload & Download Template */}
        {!previewData && !importResult && (
          <div className="space-y-4">
            {/* Download Template Bar */}
            <div className="p-4 rounded-xl glass-panel border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">Download Standard CSV Template</h4>
                  <p className="text-xs text-slate-400 font-mono-telemetry mt-0.5">
                    Pre-formatted with canonical columns (SKU, Name, Category, Warehouse, On-Hand, Safety Floor, Demand, Lead Time)
                  </p>
                </div>
              </div>
              <Button
                variant="glow"
                size="sm"
                onClick={handleDownloadTemplate}
                leftIcon={<Download className="w-3.5 h-3.5" />}
              >
                Download Template
              </Button>
            </div>

            {/* Drag & Drop Upload Zone */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleFileDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`p-8 rounded-2xl border-2 border-dashed transition-all flex flex-col items-center justify-center text-center cursor-pointer ${
                isDragging
                  ? 'border-cyan-400 bg-cyan-500/10'
                  : selectedFile
                  ? 'border-emerald-500/60 bg-emerald-500/5'
                  : 'border-white/15 hover:border-cyan-500/40 bg-slate-900/50 hover:bg-slate-900/80'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleFileSelected(e.target.files[0]);
                  }
                }}
                className="hidden"
              />

              {selectedFile ? (
                <div className="space-y-2">
                  <div className="w-12 h-12 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 mx-auto flex items-center justify-center">
                    <FileCheck className="w-6 h-6" />
                  </div>
                  <p className="text-sm font-bold text-white font-mono-telemetry">{selectedFile.name}</p>
                  <p className="text-xs text-slate-400 font-mono-telemetry">
                    {(selectedFile.size / 1024).toFixed(1)} KB • Ready for validation
                  </p>
                  <p className="text-[11px] text-cyan-400 underline pt-1">Click to select a different file</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="w-12 h-12 rounded-full bg-slate-800 text-slate-400 mx-auto flex items-center justify-center">
                    <Upload className="w-6 h-6" />
                  </div>
                  <p className="text-sm font-semibold text-white">
                    Drag and drop your inventory CSV here, or <span className="text-cyan-400 underline">browse files</span>
                  </p>
                  <p className="text-xs text-slate-400 font-mono-telemetry">
                    Max file size 5MB • UTF-8 or UTF-8 BOM encoding
                  </p>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button variant="ghost" size="sm" onClick={handleClose}>
                Cancel
              </Button>
              <Button
                variant="glow"
                size="sm"
                disabled={!selectedFile}
                isLoading={isPreviewing}
                onClick={handlePreviewUpload}
                leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
              >
                Validate & Preview Records
              </Button>
            </div>
          </div>
        )}

        {/* STEP 2: Preview & Validation Table */}
        {previewData && !importResult && (
          <div className="space-y-4">
            {/* KPI Counts Ribbon */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 rounded-xl bg-slate-900/80 border border-white/5 font-mono-telemetry">
                <span className="text-slate-400 text-[10px] uppercase block">Total Scanned</span>
                <span className="text-lg font-bold text-white">{previewData.total_rows}</span>
              </div>
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 font-mono-telemetry">
                <span className="text-emerald-400 text-[10px] uppercase block">Valid Records</span>
                <span className="text-lg font-bold text-emerald-300">{previewData.valid_rows}</span>
              </div>
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 font-mono-telemetry">
                <span className="text-amber-400 text-[10px] uppercase block">Duplicates Detected</span>
                <span className="text-lg font-bold text-amber-300">{previewData.duplicate_rows}</span>
              </div>
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 font-mono-telemetry">
                <span className="text-rose-400 text-[10px] uppercase block">Invalid Rows</span>
                <span className="text-lg font-bold text-rose-300">{previewData.invalid_rows}</span>
              </div>
            </div>

            {/* Duplicate Handling Policy */}
            <div className="p-3.5 rounded-xl bg-slate-900/90 border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-mono-telemetry">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-cyan-400" />
                <span className="text-slate-300">Duplicate Handling Strategy:</span>
              </div>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="dupMode"
                    value="skip_duplicates"
                    checked={duplicateMode === 'skip_duplicates'}
                    onChange={() => setDuplicateMode('skip_duplicates')}
                    className="text-cyan-500 focus:ring-cyan-500/30"
                  />
                  <span className="text-slate-300">Skip Duplicates (Recommended)</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="dupMode"
                    value="fail_on_duplicates"
                    checked={duplicateMode === 'fail_on_duplicates'}
                    onChange={() => setDuplicateMode('fail_on_duplicates')}
                    className="text-cyan-500 focus:ring-cyan-500/30"
                  />
                  <span className="text-slate-300">Abort on Any Duplicate</span>
                </label>
              </div>
            </div>

            {/* Validation Errors List if any */}
            {previewData.errors.length > 0 && (
              <div className="p-4 rounded-xl bg-rose-500/5 border border-rose-500/20 space-y-2">
                <h5 className="text-xs font-bold text-rose-300 uppercase font-mono-telemetry flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                  Validation Issues ({previewData.errors.length})
                </h5>
                <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1 font-mono-telemetry text-xs">
                  {previewData.errors.slice(0, 20).map((err, i) => (
                    <div key={i} className="flex items-start gap-2 text-rose-300/90">
                      <span className="text-rose-400 font-bold shrink-0">Row {err.row}:</span>
                      <span>{err.message}</span>
                    </div>
                  ))}
                  {previewData.errors.length > 20 && (
                    <p className="text-[10px] text-slate-500 pt-1">
                      ...and {previewData.errors.length - 20} additional errors.
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Preview Records Table */}
            {previewData.preview_records.length > 0 && (
              <div className="space-y-2">
                <h5 className="text-xs font-bold text-slate-300 uppercase font-mono-telemetry">
                  Valid Records Preview (First {previewData.preview_records.length})
                </h5>
                <div className="max-h-60 overflow-x-auto overflow-y-auto rounded-xl border border-white/10 bg-slate-900/60">
                  <table className="w-full text-left text-xs font-mono-telemetry">
                    <thead className="bg-slate-900/90 text-slate-400 uppercase text-[10px] sticky top-0 border-b border-white/10">
                      <tr>
                        <th className="px-3 py-2">Row</th>
                        <th className="px-3 py-2">SKU</th>
                        <th className="px-3 py-2">Product Name</th>
                        <th className="px-3 py-2">Category</th>
                        <th className="px-3 py-2">Facility</th>
                        <th className="px-3 py-2 text-right">On Hand</th>
                        <th className="px-3 py-2 text-right">Safety Floor</th>
                        <th className="px-3 py-2 text-right">Reorder Pt</th>
                        <th className="px-3 py-2 text-right">Avg Demand</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 text-slate-300">
                      {previewData.preview_records.map((r, i) => (
                        <tr key={i} className="hover:bg-white/5 transition-colors">
                          <td className="px-3 py-2 text-slate-500">{r.row_num}</td>
                          <td className="px-3 py-2 font-bold text-white">{r.sku}</td>
                          <td className="px-3 py-2 max-w-[160px] truncate text-slate-200">{r.name}</td>
                          <td className="px-3 py-2 text-cyan-400">{r.category}</td>
                          <td className="px-3 py-2 text-slate-400">{r.warehouse_name}</td>
                          <td className="px-3 py-2 text-right font-bold text-white">
                            {r.on_hand_quantity.toLocaleString()}
                          </td>
                          <td className="px-3 py-2 text-right text-slate-400">
                            {r.safety_stock.toLocaleString()}
                          </td>
                          <td className="px-3 py-2 text-right text-slate-400">
                            {r.reorder_point.toLocaleString()}
                          </td>
                          <td className="px-3 py-2 text-right text-slate-400">
                            {r.average_daily_demand ? r.average_daily_demand.toLocaleString() : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Preview Action Buttons */}
            <div className="flex items-center justify-between pt-3 border-t border-white/10">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  soundFX.playClick();
                  setPreviewData(null);
                }}
              >
                Choose Different File
              </Button>
              <div className="flex items-center gap-3">
                <Button variant="ghost" size="sm" onClick={handleClose}>
                  Cancel
                </Button>
                <Button
                  variant="glow"
                  size="sm"
                  disabled={previewData.valid_rows === 0}
                  isLoading={isConfirming}
                  onClick={handleConfirmImport}
                  leftIcon={<CheckCircle2 className="w-4 h-4" />}
                >
                  Confirm & Commit {previewData.valid_rows} Record(s)
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: Final Import Summary */}
        {importResult && (
          <div className="space-y-6 text-center py-4">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 mx-auto flex items-center justify-center animate-bounce-subtle">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div>
              <h4 className="text-lg font-bold text-white font-display">
                PostgreSQL Ingestion Completed
              </h4>
              <p className="text-xs text-slate-400 font-mono-telemetry mt-1">
                Inventory records and safety buffer parameters have been committed.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-3 max-w-md mx-auto font-mono-telemetry text-xs">
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                <span className="text-emerald-400 text-[10px] uppercase block">Saved</span>
                <span className="text-xl font-bold text-emerald-300">{importResult.imported_count}</span>
              </div>
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
                <span className="text-amber-400 text-[10px] uppercase block">Skipped</span>
                <span className="text-xl font-bold text-amber-300">{importResult.skipped_count}</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-900 border border-white/10">
                <span className="text-slate-400 text-[10px] uppercase block">Errors</span>
                <span className="text-xl font-bold text-slate-300">{importResult.invalid_count}</span>
              </div>
            </div>

            <div className="pt-4 border-t border-white/10 flex justify-center">
              <Button
                variant="glow"
                size="sm"
                onClick={handleClose}
              >
                Close & View Inventory Buffer
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
