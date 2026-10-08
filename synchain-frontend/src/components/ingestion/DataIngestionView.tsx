import React, { useState, useEffect, useRef } from 'react';
import {
  UploadCloud,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RefreshCw,
  ArrowRight,
  Database,
  Table,
  Sliders,
  ShieldCheck,
  Package,
  Layers,
  FileText,
  Clock,
  Sparkles,
  Info
} from 'lucide-react';
import { apiService } from '../../services/api';
import { Button } from '../common/Button';
import { NeonBadge } from '../common/NeonBadge';
import { soundFX } from '../../services/audioService';
import {
  IngestionUploadResponse,
  IngestionPreviewResponse,
  IngestionValidationResponse,
  IngestionExecuteResponse,
  ImportHistoryItem,
  CanonicalFieldMeta
} from '../../types';

interface DataIngestionViewProps {
  onNavigate?: (pageId: string) => void;
}

export const DataIngestionView: React.FC<DataIngestionViewProps> = ({ onNavigate }) => {
  // Step state
  const [activeStep, setActiveStep] = useState<'upload' | 'inspect' | 'validated' | 'completed'>('upload');
  const [inspectTab, setInspectTab] = useState<'preview' | 'mapping' | 'validation'>('preview');

  // Upload & File state
  const [isDragging, setIsDragging] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'validating' | 'importing' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Staged import session data
  const [stagedData, setStagedData] = useState<IngestionUploadResponse | null>(null);
  const [selectedSheet, setSelectedSheet] = useState<string>('');
  const [columnMapping, setColumnMapping] = useState<Record<string, string | null>>({});
  const [canonicalSchema, setCanonicalSchema] = useState<Record<string, CanonicalFieldMeta>>({});
  
  // Validation and execution results
  const [validationResult, setValidationResult] = useState<IngestionValidationResponse | null>(null);
  const [importResult, setImportResult] = useState<IngestionExecuteResponse | null>(null);

  // Import History
  const [history, setHistory] = useState<ImportHistoryItem[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchHistory();
    fetchSchema();
  }, []);

  const fetchSchema = async () => {
    try {
      const res = await apiService.getCanonicalSchema();
      if (res && res.fields) {
        setCanonicalSchema(res.fields);
      }
    } catch {
      // fallback if offline
    }
  };

  const fetchHistory = async () => {
    setIsLoadingHistory(true);
    try {
      const data = await apiService.getIngestionHistory();
      setHistory(data);
    } catch (err) {
      console.error('Failed to load history', err);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const handleFileSelect = async (file: File) => {
    setErrorMessage(null);

    // Validate extension
    const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
    if (!['.csv', '.xlsx', '.xls'].includes(ext)) {
      soundFX.playError();
      setErrorMessage("Unsupported file type. Please upload a .csv, .xlsx, or .xls file.");
      return;
    }

    // Validate size (max 25MB)
    if (file.size > 25 * 1024 * 1024) {
      soundFX.playError();
      setErrorMessage(`File is too large (${(file.size / (1024 * 1024)).toFixed(1)}MB). Maximum allowed size is 25MB.`);
      return;
    }

    setUploadStatus('uploading');
    soundFX.playScanPulse();

    try {
      const res = await apiService.uploadIngestionFile(file);
      setStagedData(res);
      setSelectedSheet(res.selected_sheet || (res.sheets && res.sheets[0]) || '');
      setColumnMapping(res.auto_mapping || {});
      if (res.canonical_schema) {
        setCanonicalSchema(res.canonical_schema);
      }
      setActiveStep('inspect');
      setInspectTab('preview');
      setUploadStatus('idle');
      soundFX.playSuccess();
    } catch (err: any) {
      soundFX.playError();
      setUploadStatus('error');
      const detail = err.response?.data?.detail;
      setErrorMessage(detail || "The file could not be read. Please verify that the file is not corrupted or empty.");
    }
  };

  const handleSheetChange = async (sheet: string) => {
    if (!stagedData || sheet === selectedSheet) return;
    soundFX.playClick();
    setSelectedSheet(sheet);
    setUploadStatus('uploading');
    try {
      const res = await apiService.getIngestionPreview(stagedData.import_id, sheet);
      setStagedData(prev => prev ? {
        ...prev,
        selected_sheet: sheet,
        columns_detected: res.columns_detected,
        auto_mapping: res.auto_mapping,
        rows_detected: res.rows_detected,
        preview_rows: res.preview_rows,
      } : null);
      setColumnMapping(res.auto_mapping || {});
      setValidationResult(null);
    } catch (err: any) {
      soundFX.playError();
      setErrorMessage(err.response?.data?.detail || "Failed to switch sheet.");
    } finally {
      setUploadStatus('idle');
    }
  };

  const handleMappingChange = (uploadedCol: string, canonicalField: string) => {
    setColumnMapping(prev => ({
      ...prev,
      [uploadedCol]: canonicalField === 'none' ? null : canonicalField
    }));
  };

  const handleValidate = async () => {
    if (!stagedData) return;
    soundFX.playClick();
    setUploadStatus('validating');
    setErrorMessage(null);

    try {
      const res = await apiService.validateIngestion(stagedData.import_id, {
        sheet_name: selectedSheet,
        column_mapping: columnMapping,
        entity_type: 'multi',
      });
      setValidationResult(res);
      setInspectTab('validation');
      setActiveStep('validated');
      soundFX.playSuccess();
    } catch (err: any) {
      soundFX.playError();
      setErrorMessage(err.response?.data?.detail || "Validation failed.");
    } finally {
      setUploadStatus('idle');
    }
  };

  const handleExecuteImport = async () => {
    if (!stagedData) return;
    soundFX.playClick();
    setUploadStatus('importing');
    setErrorMessage(null);

    try {
      const res = await apiService.executeIngestion(stagedData.import_id, {
        sheet_name: selectedSheet,
        column_mapping: columnMapping,
        entity_type: 'multi',
      });
      setImportResult(res);
      setActiveStep('completed');
      soundFX.playSuccess();
      fetchHistory();
    } catch (err: any) {
      soundFX.playError();
      setUploadStatus('error');
      setErrorMessage(err.response?.data?.detail || "Import failed during database insertion.");
    } finally {
      setUploadStatus('idle');
    }
  };

  const handleReset = () => {
    soundFX.playClick();
    setActiveStep('upload');
    setStagedData(null);
    setSelectedSheet('');
    setColumnMapping({});
    setValidationResult(null);
    setImportResult(null);
    setErrorMessage(null);
    setUploadStatus('idle');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl sm:text-2xl font-bold text-white font-display tracking-tight flex items-center gap-2">
              <UploadCloud className="w-6 h-6 text-cyan-400" />
              <span>Multi-Source Data Ingestion Hub</span>
            </h2>
            <NeonBadge variant="blue" size="sm">
              CSV • XLSX • XLS
            </NeonBadge>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Ingest spreadsheets and flat files with automated schema normalization, anomaly validation, and database synchronization.
          </p>
        </div>

        {activeStep !== 'upload' && (
          <Button variant="secondary" size="sm" onClick={handleReset} leftIcon={<RefreshCw className="w-3.5 h-3.5" />}>
            Upload Another File
          </Button>
        )}
      </div>

      {/* Error Banner */}
      {errorMessage && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-start gap-3 text-rose-300 text-sm">
          <XCircle className="w-5 h-5 shrink-0 mt-0.5 text-rose-400" />
          <div className="flex-1">
            <p className="font-semibold text-rose-200">Ingestion Error</p>
            <p className="text-xs text-rose-300/90 mt-0.5">{errorMessage}</p>
          </div>
          <button onClick={() => setErrorMessage(null)} className="text-rose-400 hover:text-white">✕</button>
        </div>
      )}

      {/* STEP 1: Upload Dropzone */}
      {activeStep === 'upload' && (
        <div className="rounded-2xl glass-panel border border-white/10 p-8 space-y-6">
          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                handleFileSelect(e.dataTransfer.files[0]);
              }
            }}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-10 flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
              isDragging
                ? 'border-cyan-400 bg-cyan-500/10 shadow-[0_0_30px_rgba(6,182,212,0.2)]'
                : 'border-white/15 hover:border-cyan-400/50 hover:bg-white/[0.02]'
            }`}
          >
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  handleFileSelect(e.target.files[0]);
                }
              }}
            />

            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-cyan-600/30 to-blue-600/30 border border-cyan-400/30 flex items-center justify-center text-cyan-300 mb-4 shadow-lg shadow-cyan-500/10">
              {uploadStatus === 'uploading' ? (
                <RefreshCw className="w-8 h-8 animate-spin text-cyan-400" />
              ) : (
                <FileSpreadsheet className="w-8 h-8" />
              )}
            </div>

            <h3 className="text-lg font-bold text-white font-display mb-1">
              {uploadStatus === 'uploading' ? 'Parsing & Inspecting Worksheets...' : 'Upload Supply Chain Data'}
            </h3>
            <p className="text-xs sm:text-sm text-slate-400 max-w-md mb-4">
              Drag and drop your spreadsheet here, or click to browse.
              Supports CSV, Excel workbooks, and legacy XLS files up to 25MB.
            </p>

            <div className="flex flex-wrap items-center justify-center gap-2">
              <span className="px-2.5 py-1 rounded-lg bg-slate-800/80 border border-white/10 text-[11px] font-mono text-cyan-300">
                .CSV (Comma / Semicolon)
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-slate-800/80 border border-white/10 text-[11px] font-mono text-blue-300">
                .XLSX (Multi-Sheet Excel)
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-slate-800/80 border border-white/10 text-[11px] font-mono text-indigo-300">
                .XLS (Excel 97-2003)
              </span>
            </div>
          </div>

          {/* Canonical Schema Preview Card */}
          <div className="p-4 rounded-xl bg-slate-900/60 border border-white/5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Sparkles className="w-5 h-5 text-purple-400 shrink-0" />
              <div>
                <p className="text-xs font-semibold text-white">SynChain AI Canonical Schema</p>
                <p className="text-[11px] text-slate-400">
                  Automatically maps standard aliases (SKU, Item Code, Vendor, Qty, Warehouse, etc.) to unified telemetry entities.
                </p>
              </div>
            </div>
            <div className="flex gap-2 text-[11px] text-slate-300">
              <span className="px-2 py-1 rounded bg-white/5 border border-white/10">14 Core Canonical Fields</span>
              <span className="px-2 py-1 rounded bg-white/5 border border-white/10">Auto-Deduplication</span>
            </div>
          </div>
        </div>
      )}

      {/* STEP 2 & 3: Inspection, Preview, Mapping, and Validation */}
      {(activeStep === 'inspect' || activeStep === 'validated') && stagedData && (
        <div className="space-y-6">
          {/* File summary pill & Sheet selector */}
          <div className="p-5 rounded-2xl glass-panel border border-white/10 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-400/20 text-cyan-400">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-white font-display">{stagedData.filename}</h3>
                  <NeonBadge variant="optimal" size="sm">
                    {stagedData.file_type.toUpperCase()}
                  </NeonBadge>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 mt-0.5">
                  <span className="text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> File Uploaded
                  </span>
                  <span>•</span>
                  <span>{stagedData.rows_detected.toLocaleString()} rows detected</span>
                  <span>•</span>
                  <span>{stagedData.columns_detected.length} columns detected</span>
                </div>
              </div>
            </div>

            {/* If Excel has multiple sheets, show selector */}
            {stagedData.sheets && stagedData.sheets.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400 font-medium">Worksheet:</span>
                <div className="flex gap-1.5 p-1 rounded-xl bg-slate-900/90 border border-white/10">
                  {stagedData.sheets.map(sheet => (
                    <button
                      key={sheet}
                      onClick={() => handleSheetChange(sheet)}
                      className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                        selectedSheet === sheet
                          ? 'bg-cyan-500 text-slate-950 shadow-md'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      {sheet}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Action Tabs: [Preview Data] [Map Columns] [Validate & Import] */}
          <div className="rounded-2xl glass-panel border border-white/10 overflow-hidden">
            <div className="flex border-b border-white/10 bg-slate-900/50 px-4 pt-3 gap-2">
              <button
                onClick={() => setInspectTab('preview')}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-t-xl text-xs font-semibold transition-colors cursor-pointer border-b-2 ${
                  inspectTab === 'preview'
                    ? 'border-cyan-400 text-white bg-slate-800/80'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <Table className="w-4 h-4 text-cyan-400" />
                <span>Data Preview ({Math.min(15, stagedData.preview_rows.length)} of {stagedData.rows_detected.toLocaleString()})</span>
              </button>

              <button
                onClick={() => setInspectTab('mapping')}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-t-xl text-xs font-semibold transition-colors cursor-pointer border-b-2 ${
                  inspectTab === 'mapping'
                    ? 'border-blue-400 text-white bg-slate-800/80'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <Sliders className="w-4 h-4 text-blue-400" />
                <span>Column Mapping ({Object.values(columnMapping).filter(Boolean).length}/{stagedData.columns_detected.length} Mapped)</span>
              </button>

              <button
                onClick={() => setInspectTab('validation')}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-t-xl text-xs font-semibold transition-colors cursor-pointer border-b-2 ${
                  inspectTab === 'validation'
                    ? 'border-purple-400 text-white bg-slate-800/80'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <ShieldCheck className="w-4 h-4 text-purple-400" />
                <span>Validation & Anomaly Scan</span>
                {validationResult && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${validationResult.validation.is_valid ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'}`}>
                    {validationResult.validation.invalid_rows} Issues
                  </span>
                )}
              </button>
            </div>

            {/* TAB CONTENT: Preview */}
            {inspectTab === 'preview' && (
              <div className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-slate-400">
                    Showing top {Math.min(15, stagedData.preview_rows.length)} parsed rows. Verify headers and sample data before committing.
                  </p>
                  <Button variant="secondary" size="sm" onClick={() => setInspectTab('mapping')} rightIcon={<ArrowRight className="w-3.5 h-3.5" />}>
                    Proceed to Column Mapping
                  </Button>
                </div>

                <div className="overflow-x-auto rounded-xl border border-white/5 bg-slate-900/60 max-h-96">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-800/80 text-slate-300 sticky top-0 border-b border-white/10 uppercase tracking-wider font-mono">
                      <tr>
                        <th className="py-2.5 px-3 text-slate-500 w-12">#</th>
                        {stagedData.columns_detected.map(col => {
                          const mappedField = columnMapping[col];
                          return (
                            <th key={col} className="py-2.5 px-3">
                              <div className="font-semibold text-white">{col}</div>
                              {mappedField ? (
                                <span className="inline-block mt-0.5 text-[10px] font-mono text-cyan-400 bg-cyan-500/10 px-1.5 py-0.2 rounded border border-cyan-400/20">
                                  → {mappedField}
                                </span>
                              ) : (
                                <span className="inline-block mt-0.5 text-[10px] font-mono text-slate-500">
                                  unmapped
                                </span>
                              )}
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 text-slate-300 font-mono">
                      {stagedData.preview_rows.map((row, rIdx) => (
                        <tr key={rIdx} className="hover:bg-white/[0.02]">
                          <td className="py-2 px-3 text-slate-500">{rIdx + 1}</td>
                          {stagedData.columns_detected.map(col => (
                            <td key={col} className="py-2 px-3 truncate max-w-xs">
                              {row[col] !== null && row[col] !== undefined ? String(row[col]) : <span className="text-slate-600 italic">null</span>}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB CONTENT: Column Mapping */}
            {inspectTab === 'mapping' && (
              <div className="p-6 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h4 className="text-sm font-bold text-white">Schema Normalization Mapping</h4>
                    <p className="text-xs text-slate-400">
                      Map columns from your company's spreadsheet to SynChain's canonical supply-chain attributes.
                    </p>
                  </div>
                  <Button variant="primary" size="sm" onClick={handleValidate} isLoading={uploadStatus === 'validating'} rightIcon={<ArrowRight className="w-3.5 h-3.5" />}>
                    Run Validation
                  </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {stagedData.columns_detected.map(col => {
                    const currentMapping = columnMapping[col] || '';
                    const sampleVal = stagedData.preview_rows[0]?.[col];

                    return (
                      <div key={col} className="p-3.5 rounded-xl bg-slate-900/80 border border-white/5 flex flex-col gap-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-white font-mono">{col}</span>
                          {currentMapping ? (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-400/30">
                              Mapped
                            </span>
                          ) : (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400">
                              Unmapped
                            </span>
                          )}
                        </div>

                        {sampleVal !== undefined && (
                          <p className="text-[11px] text-slate-400 font-mono truncate">
                            Sample: <span className="text-slate-200 font-semibold">{String(sampleVal)}</span>
                          </p>
                        )}

                        <div className="pt-1">
                          <select
                            value={currentMapping || 'none'}
                            onChange={(e) => handleMappingChange(col, e.target.value)}
                            className="w-full px-3 py-1.5 rounded-lg bg-slate-800 border border-white/10 text-xs text-white focus:outline-none focus:border-cyan-400"
                          >
                            <option value="none">-- Leave Unmapped --</option>
                            {Object.entries(canonicalSchema).map(([fieldKey, meta]) => (
                              <option key={fieldKey} value={fieldKey}>
                                {meta.label} ({fieldKey})
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* TAB CONTENT: Validation & Anomaly Scan */}
            {inspectTab === 'validation' && (
              <div className="p-6 space-y-6">
                {!validationResult ? (
                  <div className="text-center py-10 space-y-4">
                    <ShieldCheck className="w-12 h-12 text-slate-500 mx-auto" />
                    <div>
                      <p className="text-sm font-semibold text-white">Validation Pending</p>
                      <p className="text-xs text-slate-400">Run validation to check data types, missing records, invalid dates, and negative quantities.</p>
                    </div>
                    <Button variant="primary" size="md" onClick={handleValidate} isLoading={uploadStatus === 'validating'}>
                      Validate Data Now
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Validation Metrics Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      <div className="p-4 rounded-xl bg-slate-900/80 border border-white/5">
                        <p className="text-xs text-slate-400">Total Rows</p>
                        <p className="text-xl font-bold text-white font-mono mt-1">{validationResult.validation.total_rows.toLocaleString()}</p>
                      </div>
                      <div className="p-4 rounded-xl bg-slate-900/80 border border-emerald-500/20">
                        <p className="text-xs text-emerald-400">Valid Rows</p>
                        <p className="text-xl font-bold text-emerald-300 font-mono mt-1">{validationResult.validation.valid_rows.toLocaleString()}</p>
                      </div>
                      <div className="p-4 rounded-xl bg-slate-900/80 border border-rose-500/20">
                        <p className="text-xs text-rose-400">Invalid Rows</p>
                        <p className="text-xl font-bold text-rose-300 font-mono mt-1">{validationResult.validation.invalid_rows.toLocaleString()}</p>
                      </div>
                      <div className="p-4 rounded-xl bg-slate-900/80 border border-amber-500/20">
                        <p className="text-xs text-amber-400">Duplicates Detected</p>
                        <p className="text-xl font-bold text-amber-300 font-mono mt-1">{validationResult.validation.duplicates_count.toLocaleString()}</p>
                      </div>
                    </div>

                    {/* Anomalies List */}
                    {validationResult.validation.errors.length > 0 && (
                      <div className="space-y-3">
                        <h4 className="text-xs font-bold text-rose-400 uppercase tracking-wider font-mono flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4" />
                          <span>Detected Validation Issues ({validationResult.validation.errors.length})</span>
                        </h4>
                        <div className="max-h-60 overflow-y-auto space-y-2 rounded-xl bg-slate-900/60 p-3 border border-white/5">
                          {validationResult.validation.errors.map((err, eIdx) => (
                            <div key={eIdx} className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-xs flex items-start gap-2.5">
                              <span className="font-mono text-rose-300 shrink-0 font-bold">Row {err.row}:</span>
                              <span className="text-slate-200">{err.message}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Import Confirmation CTA */}
                    <div className="pt-4 border-t border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <p className="text-xs font-semibold text-white">
                          Ready to synchronize {validationResult.validation.valid_rows.toLocaleString()} valid records with SynChain database.
                        </p>
                        <p className="text-[11px] text-slate-400">
                          Invalid rows ({validationResult.validation.invalid_rows}) will be flagged for auditing without blocking the import.
                        </p>
                      </div>

                      <Button
                        variant="glow"
                        size="md"
                        onClick={handleExecuteImport}
                        isLoading={uploadStatus === 'importing'}
                        leftIcon={<Database className="w-4 h-4" />}
                      >
                        Import Into SynChain Database
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* STEP 4: Completed Import Summary */}
      {activeStep === 'completed' && importResult && (
        <div className="rounded-2xl glass-panel border border-emerald-500/30 p-8 space-y-6 text-center">
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-400 mx-auto shadow-lg shadow-emerald-500/20">
            <CheckCircle2 className="w-8 h-8" />
          </div>

          <div>
            <h3 className="text-2xl font-bold text-white font-display">Ingestion Synchronized Successfully</h3>
            <p className="text-sm text-slate-400 max-w-lg mx-auto mt-1">
              {importResult.message}
            </p>
          </div>

          {/* Database Entities Created / Updated Summary */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 max-w-2xl mx-auto">
            <div className="p-3 rounded-xl bg-slate-900/80 border border-white/5">
              <p className="text-[10px] text-slate-400 uppercase font-mono">Products</p>
              <p className="text-lg font-bold text-white font-mono mt-1">+{importResult.entities_created.products}</p>
            </div>
            <div className="p-3 rounded-xl bg-slate-900/80 border border-white/5">
              <p className="text-[10px] text-slate-400 uppercase font-mono">Suppliers</p>
              <p className="text-lg font-bold text-white font-mono mt-1">+{importResult.entities_created.suppliers}</p>
            </div>
            <div className="p-3 rounded-xl bg-slate-900/80 border border-white/5">
              <p className="text-[10px] text-slate-400 uppercase font-mono">Warehouses</p>
              <p className="text-lg font-bold text-white font-mono mt-1">+{importResult.entities_created.warehouses}</p>
            </div>
            <div className="p-3 rounded-xl bg-slate-900/80 border border-white/5">
              <p className="text-[10px] text-slate-400 uppercase font-mono">Inventory</p>
              <p className="text-lg font-bold text-white font-mono mt-1">+{importResult.entities_created.inventory}</p>
            </div>
            <div className="p-3 rounded-xl bg-slate-900/80 border border-white/5">
              <p className="text-[10px] text-slate-400 uppercase font-mono">Orders</p>
              <p className="text-lg font-bold text-white font-mono mt-1">+{importResult.entities_created.orders}</p>
            </div>
          </div>

          {/* Traceability Pill */}
          <div className="p-3 rounded-xl bg-slate-900/90 border border-white/10 max-w-md mx-auto text-xs font-mono text-slate-400 flex items-center justify-between">
            <span>Source File: <span className="text-white">{importResult.filename}</span></span>
            <span>Source Type: <span className="text-cyan-400">{importResult.source_type}</span></span>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-4">
            <Button variant="secondary" size="sm" onClick={handleReset}>
              Upload Another File
            </Button>
            {onNavigate && (
              <>
                <Button variant="primary" size="sm" onClick={() => onNavigate('inventory')} leftIcon={<Package className="w-4 h-4" />}>
                  View Inventory Buffer
                </Button>
                <Button variant="outline" size="sm" onClick={() => onNavigate('digital-twin')} leftIcon={<Layers className="w-4 h-4" />}>
                  View Digital Twin
                </Button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Import History Table */}
      <div className="rounded-2xl glass-panel border border-white/10 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-cyan-400" />
            <h3 className="text-base font-bold text-white font-display">Data Import History</h3>
          </div>
          <Button variant="ghost" size="sm" onClick={fetchHistory} isLoading={isLoadingHistory} leftIcon={<RefreshCw className="w-3.5 h-3.5" />}>
            Refresh
          </Button>
        </div>

        <div className="overflow-x-auto rounded-xl border border-white/5 bg-slate-900/60">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-800/80 text-slate-400 border-b border-white/10 font-mono uppercase tracking-wider">
              <tr>
                <th className="py-2.5 px-4">File Name</th>
                <th className="py-2.5 px-4">Type</th>
                <th className="py-2.5 px-4">Total Rows</th>
                <th className="py-2.5 px-4">Processed</th>
                <th className="py-2.5 px-4">Status</th>
                <th className="py-2.5 px-4">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-slate-300 font-mono">
              {history.map(item => (
                <tr key={item.id} className="hover:bg-white/[0.02]">
                  <td className="py-3 px-4 font-semibold text-white flex items-center gap-2">
                    <FileText className="w-3.5 h-3.5 text-slate-400" />
                    <span>{item.filename}</span>
                  </td>
                  <td className="py-3 px-4 uppercase text-slate-400">{item.file_type}</td>
                  <td className="py-3 px-4">{item.rows_total.toLocaleString()}</td>
                  <td className="py-3 px-4 text-emerald-400">{item.rows_processed.toLocaleString()}</td>
                  <td className="py-3 px-4">
                    <NeonBadge
                      variant={item.status === 'completed' ? 'optimal' : item.status === 'partial' ? 'warning' : 'critical'}
                      size="sm"
                    >
                      {item.status}
                    </NeonBadge>
                  </td>
                  <td className="py-3 px-4 text-slate-400 text-[11px]">
                    {item.created_at ? new Date(item.created_at).toLocaleString() : 'N/A'}
                  </td>
                </tr>
              ))}
              {history.length === 0 && !isLoadingHistory && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500">
                    No data imports recorded yet. Upload a CSV or Excel file above to begin.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
