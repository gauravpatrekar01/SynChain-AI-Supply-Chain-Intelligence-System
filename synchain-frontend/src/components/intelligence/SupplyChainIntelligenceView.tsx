import React, { ChangeEvent, useEffect, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, FileText, Loader2, ShieldAlert, UploadCloud } from 'lucide-react';
import { apiService } from '../../services/api';
import type {
  IntelligenceAnalysisResult,
  IntelligenceDatasetType,
  IntelligenceModelResult,
  IntelligenceRiskFinding,
} from '../../services/api';
import { Button } from '../common/Button';

type DatasetKey = IntelligenceDatasetType;
type UploadStatus = 'idle' | 'uploading' | 'success' | 'error';

interface DatasetConfig {
  title: string;
  description: string;
  accent: string;
}

const DATASET_CONFIG: Record<DatasetKey, DatasetConfig> = {
  erp: {
    title: 'ERP CSV',
    description: 'Supplier, order, procurement, and lead-time data used to assess upstream fulfillment risk.',
    accent: 'from-cyan-500/25 to-blue-500/15 border-cyan-400/30',
  },
  wms: {
    title: 'WMS CSV',
    description: 'Inventory, warehouse, stock, and replenishment data used to check coverage and safety stock adequacy.',
    accent: 'from-emerald-500/25 to-teal-500/15 border-emerald-400/30',
  },
  csr: {
    title: 'CRM CSV',
    description: 'Supplier compliance and emissions data used to assess sustainability and audit-related exposure.',
    accent: 'from-violet-500/25 to-fuchsia-500/15 border-violet-400/30',
  },
};

const MODEL_LABELS: Record<string, string> = {
  shipment_delay: 'Shipment-delay classifier',
  text_risk: 'DistilBERT text-risk classification',
  demand_forecast: 'Chronos demand forecast',
  supplier_recommendations: 'Supplier recommendations',
  simulation: 'Scenario simulation',
};

const emptyUploadState = (): {
  status: UploadStatus;
  fileName: string;
  pendingFileName: string;
  error: string;
  uploadedAt: string;
} => ({
  status: 'idle',
  fileName: '',
  pendingFileName: '',
  error: '',
  uploadedAt: '',
});

export const SupplyChainIntelligenceView: React.FC = () => {
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const [uploads, setUploads] = useState<Record<DatasetKey, ReturnType<typeof emptyUploadState>>>({
    erp: emptyUploadState(),
    wms: emptyUploadState(),
    csr: emptyUploadState(),
  });
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<IntelligenceAnalysisResult | null>(null);
  const [statusMessage, setStatusMessage] = useState('');

  useEffect(() => {
    let isMounted = true;
    const restoreResults = async () => {
      try {
        const result = await apiService.getIntelligenceResults();
        if (!isMounted) return;

        setAnalysisResult(result);
        setUploads((previous) => {
          const restored = { ...previous };
          for (const datasetKey of ['erp', 'wms', 'csr'] as const) {
            const dataset = result.dataset_status?.[datasetKey];
            if (dataset?.status === 'ready' && dataset.filename) {
              restored[datasetKey] = {
                ...restored[datasetKey],
                status: 'success',
                fileName: dataset.filename,
                pendingFileName: '',
                error: '',
              };
            }
          }
          return restored;
        });
      } catch (error: any) {
        if (isMounted) {
          setStatusMessage(
            error?.response?.data?.detail || 'Could not restore previously uploaded dataset status.'
          );
        }
      }
    };
    void restoreResults();
    return () => {
      isMounted = false;
    };
  }, []);

  const updateUploadState = (datasetKey: DatasetKey, next: Partial<ReturnType<typeof emptyUploadState>>) => {
    setUploads((previous) => ({
      ...previous,
      [datasetKey]: {
        ...previous[datasetKey],
        ...next,
      },
    }));
  };

  const handleUpload = async (datasetKey: DatasetKey, event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    updateUploadState(datasetKey, {
      status: 'idle',
      pendingFileName: file.name,
      error: '',
    });

    if (!file.name.toLowerCase().endsWith('.csv')) {
      updateUploadState(datasetKey, {
        status: 'error',
        pendingFileName: '',
        error: 'Only .csv uploads are supported for this intelligence workflow.',
      });
      event.target.value = '';
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      updateUploadState(datasetKey, {
        status: 'error',
        pendingFileName: '',
        error: 'File exceeds the 2MB size limit for supply-chain intelligence uploads.',
      });
      event.target.value = '';
      return;
    }

    try {
      updateUploadState(datasetKey, { status: 'uploading', error: '' });
      setStatusMessage(`Uploading ${DATASET_CONFIG[datasetKey].title}...`);
      const response = await apiService.uploadIntelligenceDataset(datasetKey, file);
      setStatusMessage(response.message || `${DATASET_CONFIG[datasetKey].title} uploaded.`);
      updateUploadState(datasetKey, {
        status: 'success',
        fileName: response.file_name || file.name,
        pendingFileName: '',
        uploadedAt: new Date().toISOString(),
        error: '',
      });
      setAnalysisResult(null);
    } catch (error: any) {
      const detail = error?.response?.data?.detail || 'The dataset could not be uploaded.';
      updateUploadState(datasetKey, {
        status: 'error',
        pendingFileName: '',
        error: detail,
      });
      setStatusMessage(detail);
    } finally {
      event.target.value = '';
    }
  };

  const resetDataset = (datasetKey: DatasetKey) => {
    updateUploadState(datasetKey, {
      ...emptyUploadState(),
      fileName: '',
      pendingFileName: '',
      error: '',
    });
    setStatusMessage('');
    setAnalysisResult(null);
  };

  const handleAnalyze = async () => {
    const availableDatasets = Object.entries(uploads)
      .filter(([, value]) => Boolean(value.fileName))
      .map(([key]) => key as DatasetKey);

    if (availableDatasets.length === 0) {
      setStatusMessage('Upload at least one ERP, WMS, or CSR CSV file before running analysis.');
      return;
    }

    if (Object.values(uploads).some((value) => value.status === 'uploading')) {
      setStatusMessage('Wait for all uploads to finish before running analysis.');
      return;
    }

    setAnalysisLoading(true);
    setStatusMessage('Running analysis across the uploaded supply-chain datasets...');

    try {
      const result = await apiService.analyzeIntelligence();
      setAnalysisResult(result);
      setStatusMessage(result.message || 'Analysis completed.');
    } catch (error: any) {
      const detail =
        error?.response?.data?.detail ||
        'Analysis could not be completed. Please retry after checking the uploaded data and backend status.';
      setStatusMessage(detail);
      setAnalysisResult(null);
    } finally {
      setAnalysisLoading(false);
    }
  };

  const uploadedKeys = Object.entries(uploads)
    .filter(([, value]) => Boolean(value.fileName))
    .map(([key]) => key as DatasetKey);
  const isUploadInProgress = Object.values(uploads).some((value) => value.status === 'uploading');

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-400">Supply Chain Intelligence</p>
          <h2 className="mt-2 text-2xl font-bold text-white sm:text-3xl">Supply Chain Intelligence</h2>
          <p className="mt-2 max-w-2xl text-sm text-slate-300">
            Upload ERP, WMS, and CSR datasets to surface explainable risks, mitigation recommendations, and missing-data gaps in your operational network.
          </p>
        </div>

        <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm ${uploadedKeys.length > 0 ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-300' : 'border-slate-600 bg-slate-900/60 text-slate-300'}`}>
          {uploadedKeys.length > 0 ? <CheckCircle2 className="h-4 w-4" /> : <ShieldAlert className="h-4 w-4" />}
          {uploadedKeys.length > 0 ? `${uploadedKeys.length} dataset(s) ready` : 'No dataset uploaded'}
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        {(Object.keys(DATASET_CONFIG) as DatasetKey[]).map((datasetKey) => {
          const config = DATASET_CONFIG[datasetKey];
          const uploadInfo = uploads[datasetKey];
          return (
            <div key={datasetKey} className={`rounded-2xl border bg-slate-950/40 p-4 shadow-lg shadow-slate-900/25 ${config.accent}`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-300">{config.title}</p>
                  <p className="mt-2 text-sm text-slate-300">{config.description}</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-slate-900/50 p-2 text-cyan-300">
                  <UploadCloud className="h-5 w-5" />
                </div>
              </div>

              <div className="mt-4 rounded-xl border border-dashed border-slate-600 bg-slate-900/60 p-3">
                <input
                  ref={(node) => {
                    inputRefs.current[datasetKey] = node;
                  }}
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={(event) => void handleUpload(datasetKey, event)}
                />

                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-400">Selected file</p>
                    <p className="mt-1 truncate text-sm text-slate-200">
                      {uploadInfo.pendingFileName || uploadInfo.fileName || 'No file selected'}
                    </p>
                  </div>

                  <Button
                    variant="secondary"
                    size="sm"
                    isLoading={uploadInfo.status === 'uploading'}
                    disabled={analysisLoading || uploadInfo.status === 'uploading'}
                    onClick={() => inputRefs.current[datasetKey]?.click()}
                    className="shrink-0"
                  >
                    {uploadInfo.fileName ? 'Replace CSV' : 'Select CSV'}
                  </Button>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between gap-2 text-xs">
                <span className="text-slate-400">
                  {uploadInfo.status === 'uploading'
                    ? 'Uploading…'
                    : uploadInfo.status === 'success'
                      ? 'Upload complete'
                      : uploadInfo.status === 'error'
                        ? uploadInfo.fileName
                          ? 'Replacement failed; existing upload remains available'
                          : 'Upload issue'
                        : 'Awaiting upload'}
                </span>
                {(uploadInfo.fileName || uploadInfo.pendingFileName) && (
                  <button className="text-slate-300 hover:text-white" onClick={() => resetDataset(datasetKey)}>
                    Clear
                  </button>
                )}
              </div>

              {uploadInfo.error && (
                <div className="mt-3 flex items-start gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 p-2 text-xs text-rose-200">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{uploadInfo.error}</span>
                </div>
              )}

              {uploadInfo.status === 'success' && !uploadInfo.error && (
                <div className="mt-3 flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-2 text-xs text-emerald-200">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  Validated and stored for analysis.
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Analysis controls</p>
            <p className="mt-1 text-sm text-slate-300">
              {uploadedKeys.length > 0
                ? `Ready to analyze ${uploadedKeys.length} uploaded dataset(s).`
                : 'Upload at least one dataset to enable explainable analysis.'}
            </p>
          </div>

          <Button
            variant="glow"
            size="md"
            isLoading={analysisLoading}
            disabled={uploadedKeys.length === 0 || analysisLoading || isUploadInProgress}
            onClick={() => void handleAnalyze()}
            leftIcon={<FileText className="h-4 w-4" />}
          >
            Analyze available datasets
          </Button>
        </div>

        {statusMessage && (
          <div className="mt-4 rounded-xl border border-blue-500/25 bg-blue-500/10 px-3 py-2 text-sm text-blue-200">
            {statusMessage}
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-5 w-5 text-amber-300" />
          <h3 className="text-lg font-semibold text-white">Rule-based results</h3>
        </div>

        {!analysisResult && (
          <div className="mt-4 rounded-xl border border-dashed border-slate-700 bg-slate-900/40 p-4 text-sm text-slate-300">
            No analysis result yet. Upload datasets and run the analysis to review risk findings.
          </div>
        )}

        {analysisResult && (
          <div className="mt-4 space-y-5">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-white/10 bg-slate-900/60 p-3">
                <p className="text-xs uppercase tracking-[0.15em] text-slate-400">Available datasets</p>
                <p className="mt-2 text-2xl font-bold text-white">{analysisResult.available_datasets?.length || 0}</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-slate-900/60 p-3">
                <p className="text-xs uppercase tracking-[0.15em] text-slate-400">Risk count</p>
                <p className="mt-2 text-2xl font-bold text-white">{analysisResult.summary?.total_risks || 0}</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-slate-900/60 p-3">
                <p className="text-xs uppercase tracking-[0.15em] text-slate-400">Dataset quality</p>
                <p className="mt-2 text-lg font-semibold capitalize text-white">{analysisResult.summary?.dataset_quality || 'not_ready'}</p>
              </div>
            </div>

            {analysisResult.limitations.length > 0 && (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-100">
                <p className="font-semibold">Limitations and missing information</p>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  {analysisResult.limitations.map((item, index) => (
                    <li key={`${item}-${index}`}>{item}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="space-y-4">
              {analysisResult.risks?.length ? (
                analysisResult.risks.map((risk: IntelligenceRiskFinding) => (
                  <div key={risk.id} className="rounded-xl border border-white/10 bg-slate-900/60 p-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <h4 className="text-base font-semibold text-white">{risk.title}</h4>
                      <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${risk.severity === 'high'
                          ? 'border-rose-500/40 bg-rose-500/10 text-rose-200'
                          : risk.severity === 'medium'
                            ? 'border-amber-500/40 bg-amber-500/10 text-amber-200'
                            : 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200'
                        }`}>
                        {risk.severity}</span>
                    </div>

                    <div className="mt-3 space-y-2 text-sm text-slate-200">
                      {risk.evidence?.map((note: string, index: number) => (
                        <p key={`${risk.id}-evidence-${index}`}>• {note}</p>
                      ))}
                    </div>

                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      <div className="rounded-xl border border-white/10 bg-slate-950/60 p-3">
                        <p className="text-xs uppercase tracking-[0.14em] text-slate-400">Recommended mitigation</p>
                        <p className="mt-2 text-sm text-slate-200">{risk.recommendation}</p>
                      </div>
                      <div className="rounded-xl border border-white/10 bg-slate-950/60 p-3">
                        <p className="text-xs uppercase tracking-[0.14em] text-slate-400">Operational impact</p>
                        <p className="mt-2 text-sm text-slate-200">{risk.operational_impact}</p>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-xl border border-dashed border-slate-700 bg-slate-900/40 p-4 text-sm text-slate-300">
                  No risk findings were generated from the currently uploaded data. Review the available datasets and try again once more complete records are available.
                </div>
              )}
            </div>

            {analysisResult.recommendations?.length > 0 && (
              <div className="rounded-xl border border-white/10 bg-slate-900/60 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Mitigation actions</p>
                <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-200">
                  {analysisResult.recommendations.map((item: string, index: number) => (
                    <li key={`${item}-${index}`}>{item}</li>
                  ))}
                </ul>
              </div>
            )}

            {analysisResult.ml_analysis && (
              <section className="space-y-4 border-t border-white/10 pt-5">
                <div>
                  <h3 className="text-lg font-semibold text-white">Model results</h3>
                  <p className="mt-1 text-sm text-slate-300">
                    Model outputs are separate from the rule-based findings above. A skipped, unavailable, or failed model does not remove successful results from other components.
                  </p>
                </div>

                {Object.entries(analysisResult.ml_analysis).map(([key, modelResult]) => (
                  <ModelResultCard
                    key={key}
                    name={MODEL_LABELS[key] || key.replaceAll('_', ' ')}
                    result={modelResult}
                  />
                ))}
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

const ModelResultCard: React.FC<{ name: string; result: IntelligenceModelResult }> = ({
  name,
  result,
}) => {
  const statusColor = result.status === 'completed'
    ? 'text-emerald-300 border-emerald-500/30 bg-emerald-500/10'
    : result.status === 'failed' || result.status === 'unavailable'
      ? 'text-rose-300 border-rose-500/30 bg-rose-500/10'
      : 'text-amber-200 border-amber-500/30 bg-amber-500/10';

  return (
    <article className="rounded-xl border border-white/10 bg-slate-900/50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="font-semibold capitalize text-white">{name}</h4>
        <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${statusColor}`}>
          {result.status.replaceAll('_', ' ')}
        </span>
      </div>
      <p className="mt-2 text-sm text-slate-300">{result.message}</p>

      {result.missing_features && result.missing_features.length > 0 && (
        <p className="mt-3 text-xs text-amber-200">
          Missing explicit shipment features: {result.missing_features.join(', ')}
        </p>
      )}
      {result.missing_fields && result.missing_fields.length > 0 && (
        <p className="mt-3 text-xs text-amber-200">
          Missing scenario/profile fields: {result.missing_fields.join(', ')}
        </p>
      )}
      {result.skipped_series && result.skipped_series.length > 0 && (
        <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-amber-200">
          {result.skipped_series.map((reason, index) => <li key={`${reason}-${index}`}>{reason}</li>)}
        </ul>
      )}

      {result.predictions && result.predictions.length > 0 && (
        <ul className="mt-3 space-y-2">
          {result.predictions.map((prediction, index) => {
            const label = prediction.predicted_label;
            const delayPercent = prediction.delay_probability_percent;
            const title = typeof label === 'string'
              ? `${label}${typeof prediction.model_score === 'number' ? ` · model score ${(prediction.model_score * 100).toFixed(1)}% (not calibrated)` : ''}`
              : typeof delayPercent === 'number'
                ? `${delayPercent.toFixed(1)}% estimated delay probability · ${String(prediction.risk_level || 'unclassified')}`
                : 'Prediction available';
            return (
              <li key={`${String(prediction.record_number || prediction.dataset || 'record')}-${index}`} className="rounded-lg bg-slate-950/50 p-3 text-sm text-slate-200">
                {prediction.dataset && <span className="mr-2 text-slate-400">{String(prediction.dataset).toUpperCase()}</span>}
                {prediction.record_number && <span className="mr-2 text-slate-400">Record {prediction.record_number}:</span>}
                {title}
              </li>
            );
          })}
        </ul>
      )}

      {result.forecasts?.map((series) => (
        <div key={`${series.warehouse_id}-${series.product_id}`} className="mt-3 rounded-lg bg-slate-950/50 p-3">
          <p className="text-sm font-medium text-slate-100">
            Warehouse {series.warehouse_id} · Product {series.product_id} · {series.history_observations} daily observations
          </p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {series.forecast.map((point) => (
              <div key={point.date} className="rounded-md border border-white/5 bg-slate-900/70 p-2 text-xs text-slate-300">
                <p className="font-medium text-white">{point.date}</p>
                <p>Median {point.median.toFixed(2)}</p>
                <p>80% interval {point.lower_80.toFixed(2)}–{point.upper_80.toFixed(2)}</p>
              </div>
            ))}
          </div>
        </div>
      ))}

      {result.recommendations && result.recommendations.length > 0 && (
        <ul className="mt-3 space-y-2">
          {result.recommendations.map((recommendation, index) => (
            <li key={`${String(recommendation.supplier_id || 'supplier')}-${index}`} className="rounded-lg bg-slate-950/50 p-3 text-sm text-slate-200">
              <span className="font-medium text-white">{String(recommendation.supplier_name || recommendation.supplier_id || 'Supplier')}</span>
              {typeof recommendation.recommendation_score === 'number' && (
                <span className="ml-2 text-slate-400">Score {recommendation.recommendation_score.toFixed(4)}</span>
              )}
              {recommendation.supplier_source === 'synthetic_demo_data' && (
                <span className="ml-2 text-amber-200">Synthetic demo supplier — not your supplier</span>
              )}
            </li>
          ))}
        </ul>
      )}

      {result.scenarios && (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {Object.entries(result.scenarios).map(([scenarioName, scenario]) => (
            <div key={scenarioName} className="rounded-lg bg-slate-950/50 p-3 text-sm">
              <p className="font-medium capitalize text-white">{scenarioName.replaceAll('_', ' ')}</p>
              {scenario.summary && (
                <p className="mt-1 text-slate-300">
                  Ending stock {scenario.summary.ending_inventory ?? '—'} · Unmet demand {scenario.summary.total_unmet_demand ?? '—'} · Stockout days {scenario.summary.days_with_stockout ?? '—'}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {result.provenance && (
        <div className="mt-3 space-y-1 text-xs text-slate-400">
          {Object.entries(result.provenance).map(([field, value]) => (
            <p key={field}>
              <span className="capitalize">{field.replaceAll('_', ' ')}:</span>{' '}
              {Array.isArray(value) ? value.join(', ') : String(value)}
            </p>
          ))}
        </div>
      )}
      {result.limitations && result.limitations.length > 0 && (
        <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-amber-200">
          {result.limitations.map((limitation, index) => <li key={`${limitation}-${index}`}>{limitation}</li>)}
        </ul>
      )}
    </article>
  );
};
