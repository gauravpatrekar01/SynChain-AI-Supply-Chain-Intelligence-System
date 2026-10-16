import React, { useState, useRef } from 'react';
import {
  UploadCloud,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  X,
  FileText,
  Download,
  Loader2,
  RefreshCw,
  Table,
} from 'lucide-react';
import { Button } from '../common/Button';
import { NeonBadge } from '../common/NeonBadge';
import { apiService } from '../../services/api';
import { soundFX } from '../../services/audioService';
import {
  SalesUploadPreviewResponse,
  SalesImportSummaryResponse,
} from '../../types/sales';

interface SalesImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const SalesImportModal: React.FC<SalesImportModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<SalesUploadPreviewResponse | null>(null);
  const [importSummary, setImportSummary] = useState<SalesImportSummaryResponse | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleDownloadTemplate = () => {
    soundFX.playClick();
    const headers = [
      'transaction_id',
      'transaction_date',
      'product_id',
      'product_name',
      'product_category',
      'quantity_sold',
      'unit_selling_price',
      'discount_amount',
      'return_quantity',
      'tax_amount',
      'region',
      'customer_id',
      'order_id',
      'currency',
    ];
    const rows = [
      'TX-2026-001,2026-01-10,IC-3NM-A18,Neural Processor 3nm,Logic Silicon,25,150.00,50.00,0,15.00,North America,CUST-001,ORD-1001,USD',
      'TX-2026-002,2026-01-18,HBM3E-24G,High Bandwidth Memory 24GB,Memory IC,40,80.00,0.00,1,0.00,Asia Pacific,CUST-002,ORD-1002,USD',
      'TX-2026-003,2026-02-05,IC-3NM-A18,Neural Processor 3nm,Logic Silicon,30,150.00,100.00,0,20.00,Europe,CUST-003,ORD-1003,USD',
      'TX-2026-004,2026-02-20,HBM3E-24G,High Bandwidth Memory 24GB,Memory IC,35,80.00,20.00,0,5.00,North America,CUST-004,ORD-1004,USD',
      'TX-2026-005,2026-03-04,IC-3NM-A18,Neural Processor 3nm,Logic Silicon,45,150.00,0.00,0,0.00,Asia Pacific,CUST-005,ORD-1005,USD',
      'TX-2026-006,2026-03-19,HBM3E-24G,High Bandwidth Memory 24GB,Memory IC,50,80.00,50.00,2,0.00,Europe,CUST-006,ORD-1006,USD',
    ];
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', 'synchain_sales_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFileChange = async (selectedFile: File) => {
    if (!selectedFile.name.toLowerCase().endsWith('.csv')) {
      setError('Please select a valid .csv file.');
      return;
    }
    setError(null);
    setFile(selectedFile);
    setIsUploading(true);
    try {
      soundFX.playScanPulse();
      const res = await apiService.uploadSalesPreview(selectedFile);
      setPreview(res);
    } catch (err: any) {
      setError(err?.response?.data?.detail || err.message || 'Failed to inspect CSV file.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleExecuteImport = async () => {
    if (!preview) return;
    setIsImporting(true);
    setError(null);
    try {
      soundFX.playClick();
      const res = await apiService.executeSalesImport({
        import_id: preview.import_id,
        skip_duplicates: true,
      });
      setImportSummary(res);
      soundFX.playSuccess();
      onSuccess();
    } catch (err: any) {
      setError(err?.response?.data?.detail || err.message || 'Failed to execute import.');
    } finally {
      setIsImporting(false);
    }
  };

  const resetState = () => {
    setFile(null);
    setPreview(null);
    setImportSummary(null);
    setError(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-4xl max-h-[90vh] overflow-hidden rounded-2xl border border-blue-500/30 bg-slate-900/95 shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400">
              <UploadCloud className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Import Sales Transactions</h2>
              <p className="text-xs text-slate-400">
                Upload historical sales records to feed revenue analytics & demand forecasting
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadTemplate}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition-colors"
            >
              <Download className="w-3.5 h-3.5 text-blue-400" />
              CSV Template
            </button>
            <button
              onClick={() => {
                resetState();
                onClose();
              }}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/10"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {error && (
            <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 shrink-0 text-rose-400" />
              <div className="flex-1">
                <p className="font-semibold">Validation Error</p>
                <p className="text-xs mt-0.5 text-rose-200">{error}</p>
              </div>
            </div>
          )}

          {/* Success summary view */}
          {importSummary ? (
            <div className="space-y-6 text-center py-6">
              <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">Sales Import Completed Successfully!</h3>
                <p className="text-sm text-slate-400 mt-1">
                  Imported records are now active in the database and integrated into forecasting models.
                </p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-2xl mx-auto">
                <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                  <p className="text-xs text-slate-400">Imported Rows</p>
                  <p className="text-2xl font-bold text-emerald-400 mt-1">{importSummary.imported_count}</p>
                </div>
                <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                  <p className="text-xs text-slate-400">Total Net Revenue</p>
                  <p className="text-2xl font-bold text-cyan-400 mt-1">
                    ${importSummary.total_net_revenue.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                  <p className="text-xs text-slate-400">Total Units Sold</p>
                  <p className="text-2xl font-bold text-blue-400 mt-1">
                    {importSummary.total_units_sold.toLocaleString()}
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                  <p className="text-xs text-slate-400">Duplicates Skipped</p>
                  <p className="text-2xl font-bold text-amber-400 mt-1">{importSummary.duplicate_count}</p>
                </div>
              </div>

              {importSummary.date_min && importSummary.date_max && (
                <p className="text-xs text-slate-400">
                  Date range recorded: <span className="text-white font-medium">{importSummary.date_min}</span> to{' '}
                  <span className="text-white font-medium">{importSummary.date_max}</span>
                </p>
              )}

              <div className="flex justify-center gap-3 pt-4">
                <Button
                  variant="primary"
                  onClick={() => {
                    resetState();
                    onClose();
                  }}
                >
                  View Sales Dashboard
                </Button>
                <Button
                  variant="secondary"
                  onClick={resetState}
                >
                  Import Another CSV
                </Button>
              </div>
            </div>
          ) : preview ? (
            /* Preview and validation review */
            <div className="space-y-6">
              {/* Summary Stats bar */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                  <p className="text-xs text-slate-400">Total Detected</p>
                  <p className="text-xl font-bold text-white mt-0.5">{preview.total_rows_detected} rows</p>
                </div>
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                  <p className="text-xs text-emerald-300">Valid to Import</p>
                  <p className="text-xl font-bold text-emerald-400 mt-0.5">{preview.valid_rows_count} rows</p>
                </div>
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
                  <p className="text-xs text-amber-300">Duplicates in File</p>
                  <p className="text-xl font-bold text-amber-400 mt-0.5">{preview.duplicate_in_file_count}</p>
                </div>
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20">
                  <p className="text-xs text-rose-300">Invalid / Errors</p>
                  <p className="text-xl font-bold text-rose-400 mt-0.5">{preview.invalid_rows_count}</p>
                </div>
              </div>

              {/* Missing required columns warning */}
              {preview.missing_required_columns.length > 0 && (
                <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30">
                  <p className="text-sm font-semibold text-rose-300 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-400" />
                    Missing Required Columns ({preview.missing_required_columns.length})
                  </p>
                  <p className="text-xs text-rose-200 mt-1">
                    The uploaded CSV must include: {preview.missing_required_columns.join(', ')}.
                  </p>
                </div>
              )}

              {/* Row validation errors (first 10) */}
              {preview.validation_errors.length > 0 && (
                <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 space-y-2">
                  <p className="text-xs font-semibold text-amber-300">
                    Row-Level Validation Notices ({preview.validation_errors.length})
                  </p>
                  <div className="max-h-32 overflow-y-auto space-y-1 text-xs text-slate-300 pr-2">
                    {preview.validation_errors.slice(0, 8).map((err, idx) => (
                      <div key={idx} className="flex items-start gap-2 text-xs">
                        <span className="text-amber-400 font-mono">Row {err.row_number}:</span>
                        <span>{err.message}</span>
                      </div>
                    ))}
                    {preview.validation_errors.length > 8 && (
                      <p className="text-xs text-slate-500 italic">
                        ...and {preview.validation_errors.length - 8} more row notices.
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Preview Table */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
                    <Table className="w-3.5 h-3.5 text-blue-400" />
                    Sample Preview (First {preview.preview_rows.length} rows)
                  </p>
                  <p className="text-xs text-slate-500 font-mono">
                    Net Rev = max(0, (qty - returns) * price - discount)
                  </p>
                </div>
                <div className="overflow-x-auto rounded-xl border border-white/10 max-h-56">
                  <table className="w-full text-left text-xs text-slate-300">
                    <thead className="bg-slate-950/80 text-slate-400 uppercase font-mono text-[10px] sticky top-0">
                      <tr>
                        <th className="p-2.5">TX ID</th>
                        <th className="p-2.5">Date</th>
                        <th className="p-2.5">Product SKU</th>
                        <th className="p-2.5">Product Name</th>
                        <th className="p-2.5 text-right">Qty</th>
                        <th className="p-2.5 text-right">Price</th>
                        <th className="p-2.5 text-right">Discount</th>
                        <th className="p-2.5 text-right">Net Revenue</th>
                        <th className="p-2.5">Region</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 bg-slate-900/40">
                      {preview.preview_rows.map((r: any, idx: number) => (
                        <tr key={idx} className="hover:bg-white/5">
                          <td className="p-2.5 font-mono text-cyan-400">{r.transaction_id}</td>
                          <td className="p-2.5">{r.transaction_date?.slice(0, 10)}</td>
                          <td className="p-2.5 font-medium text-white">{r.product_id}</td>
                          <td className="p-2.5 truncate max-w-[120px]">{r.product_name}</td>
                          <td className="p-2.5 text-right">{r.quantity_sold}</td>
                          <td className="p-2.5 text-right">${Number(r.unit_selling_price || 0).toFixed(2)}</td>
                          <td className="p-2.5 text-right text-slate-400">${Number(r.discount_amount || 0).toFixed(2)}</td>
                          <td className="p-2.5 text-right font-medium text-emerald-400">
                            ${Number(r.net_revenue || 0).toFixed(2)}
                          </td>
                          <td className="p-2.5">{r.region}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-4 border-t border-white/10">
                <Button variant="ghost" onClick={resetState}>
                  Upload Different File
                </Button>
                <Button
                  variant="primary"
                  onClick={handleExecuteImport}
                  disabled={!preview.is_importable || isImporting}
                  className="gap-2"
                >
                  {isImporting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Persisting to Database...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      Confirm & Import ({preview.valid_rows_count} Valid Records)
                    </>
                  )}
                </Button>
              </div>
            </div>
          ) : (
            /* Upload Dropzone View */
            <div className="space-y-4">
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  const dropped = e.dataTransfer.files[0];
                  if (dropped) handleFileChange(dropped);
                }}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all duration-300 ${
                  isDragging
                    ? 'border-blue-400 bg-blue-500/10'
                    : 'border-white/15 bg-slate-950/40 hover:border-blue-500/50 hover:bg-slate-950/70'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleFileChange(f);
                  }}
                />
                <div className="w-14 h-14 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center mx-auto mb-4">
                  {isUploading ? (
                    <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
                  ) : (
                    <FileSpreadsheet className="w-6 h-6 text-blue-400" />
                  )}
                </div>
                <p className="text-sm font-semibold text-white">
                  {isUploading ? 'Validating CSV structure...' : 'Click to upload or drag & drop sales CSV'}
                </p>
                <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                  Supports UTF-8 CSV exports with transaction ID, product SKU, sale date, units, and selling price.
                </p>
              </div>

              {/* Required Schema Checklist */}
              <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                <p className="text-xs font-semibold text-slate-300 mb-2 uppercase tracking-wider font-mono">
                  Minimum Required CSV Fields:
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                  <div className="flex items-center gap-1.5 text-slate-300">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="font-mono text-cyan-300">transaction_id</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-300">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="font-mono text-cyan-300">transaction_date</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-300">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="font-mono text-cyan-300">product_id</span> (SKU)
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-300">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="font-mono text-cyan-300">product_name</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-300">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="font-mono text-cyan-300">quantity_sold</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-300">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="font-mono text-cyan-300">unit_selling_price</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-300">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="font-mono text-cyan-300">discount_amount</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-300">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="font-mono text-cyan-300">product_category</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-300">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="font-mono text-cyan-300">region</span>
                  </div>
                </div>
                <p className="text-[11px] text-slate-400 mt-2 italic">
                  Optional fields: customer_id, order_id, return_quantity, tax_amount, currency.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
