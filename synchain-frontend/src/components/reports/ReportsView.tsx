import { useEffect, useRef, useState } from 'react';
import { Download, FileSpreadsheet, FileText, Loader2, Printer, RefreshCw, Sparkles } from 'lucide-react';
import { apiService } from '../../services/api';
import type { AIReport, ReportFocus } from '../../types/ai';
import { aiRequestError, retryDelaySeconds } from '../../utils/aiError';
import './reports.css';

const FOCUS_LABELS: Record<ReportFocus, string> = {
  overview: 'Executive overview', inventory: 'Inventory coverage',
  suppliers: 'Supplier reliability', shipments: 'Shipment performance',
};

const METRIC_LABELS: Record<string, string> = {
  products_count: 'Products', warehouses_count: 'Warehouses',
  inventory_routes_count: 'Inventory routes', inventory_units_total: 'Recorded stock units',
  inventory_routes_with_reorder_inputs: 'Routes with reorder inputs',
  inventory_routes_missing_reorder_inputs: 'Routes missing reorder inputs',
  inventory_routes_at_reorder_point: 'Routes at reorder point',
  inventory_routes_below_safety_stock: 'Routes below safety stock',
  active_suppliers_count: 'Active suppliers', single_source_suppliers_count: 'Single-source suppliers',
  suppliers_below_70_reliability_count: 'Suppliers below 70 reliability',
  average_supplier_reliability: 'Average supplier reliability',
  suppliers_with_valid_reliability_count: 'Suppliers with valid reliability',
  shipments_count: 'Recorded shipments', active_shipments_count: 'Active shipments',
  overdue_shipments_count: 'Overdue shipments',
  completed_shipments_with_delivery_dates_count: 'Completed shipments with delivery dates',
  on_time_completed_shipments_count: 'On-time completed shipments', on_time_delivery_pct: 'On-time delivery (%)',
};

function metricLabel(key: string) {
  return METRIC_LABELS[key] || key.replaceAll('_', ' ');
}

function metricValue(value: number | null | undefined) {
  return value == null ? 'Unknown' : value.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function evidenceText(keys: string[], metrics: AIReport['source_metrics']) {
  return keys.map((key) => `${metricLabel(key)}: ${metricValue(metrics[key])}`).join(' · ');
}

function downloadReport(content: string, fileName: string, mimeType: string) {
  const url = URL.createObjectURL(new Blob([content], { type: mimeType }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function csvCell(value: string | number | null) {
  const text = String(value ?? 'Unknown');
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return `"${safe.replaceAll('"', '""')}"`;
}

const buttonClass = 'inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 bg-slate-800 px-3 py-2 text-sm text-slate-200 hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400';

export function ReportsView() {
  const [focus, setFocus] = useState<ReportFocus>('overview');
  const [report, setReport] = useState<AIReport | null>(null);
  const [loading, setLoading] = useState<'snapshot' | 'report' | null>('snapshot');
  const [error, setError] = useState('');
  const [retrySeconds, setRetrySeconds] = useState(0);
  const requestRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    requestRef.current = controller;
    apiService.getAIInsights('overview', controller.signal)
      .then((response) => { if (!controller.signal.aborted) setReport(response); })
      .catch((caught) => { if (!controller.signal.aborted) setError(aiRequestError(caught)); })
      .finally(() => {
        if (requestRef.current === controller && !controller.signal.aborted) {
          requestRef.current = null;
          setLoading(null);
        }
      });
    return () => requestRef.current?.abort();
  }, []);

  useEffect(() => {
    if (retrySeconds <= 0) return;
    const timer = window.setTimeout(() => setRetrySeconds((seconds) => Math.max(0, seconds - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [retrySeconds]);

  const loadReport = async (generate: boolean, targetFocus: ReportFocus = focus) => {
    if (requestRef.current || retrySeconds > 0) return;
    const controller = new AbortController();
    requestRef.current = controller;
    setLoading(generate ? 'report' : 'snapshot');
    setError('');
    try {
      const response = generate
        ? await apiService.generateAIReport(targetFocus, controller.signal)
        : await apiService.getAIInsights(targetFocus, controller.signal);
      if (!controller.signal.aborted) setReport(response);
    } catch (caught) {
      if (controller.signal.aborted) return;
      setError(aiRequestError(caught));
      setRetrySeconds(retryDelaySeconds(caught));
    } finally {
      if (requestRef.current === controller && !controller.signal.aborted) {
        requestRef.current = null;
        setLoading(null);
      }
    }
  };

  const handleFocusChange = (newFocus: ReportFocus) => {
    setFocus(newFocus);
    void loadReport(false, newFocus);
  };

  const exportFullReportCSV = () => {
    if (!report) return;
    const rows: Array<Array<string | number | null | undefined>> = [
      ['Section', 'Item', 'Detail / Value', 'Supporting Evidence / Reference', 'Severity / Priority'],
      ['Report Overview', FOCUS_LABELS[report.focus], report.summary, `Provider: ${report.provider}${report.model ? ` (${report.model})` : ''}`, report.fallback ? 'Fallback' : 'Standard'],
      ...report.findings.map((f) => ['Finding', f.title, f.detail, evidenceText(f.metric_keys, report.source_metrics), f.severity]),
      ...report.recommended_actions.map((a) => ['Recommended Action', a.action, a.reason, evidenceText(a.metric_keys, report.source_metrics), `${a.priority} priority`]),
      ...Object.entries(report.source_metrics).map(([k, v]) => ['Source Metric', metricLabel(k), metricValue(v), k, 'Recorded Data']),
      ...report.limitations.map((l) => ['Scope & Limitation', 'Limitation', l, 'Workspace Boundary', 'Advisory']),
    ];
    downloadReport(
      rows.map((row) => row.map(csvCell).join(',')).join('\r\n'),
      `SynChain_${report.focus}_Report_${report.generated_at.slice(0, 10)}.csv`,
      'text/csv;charset=utf-8',
    );
  };

  const exportMetrics = () => {
    if (!report) return;
    const rows: Array<Array<string | number | null>> = [
      ['Metric', 'Value', 'Snapshot at'],
      ...Object.entries(report.source_metrics).map(([key, value]) => [key, value, report.snapshot_at]),
    ];
    downloadReport(rows.map((row) => row.map(csvCell).join(',')).join('\r\n'), `SynChain_Metrics_${report.snapshot_at.slice(0, 10)}.csv`, 'text/csv;charset=utf-8');
  };

  return (
    <div className="space-y-6 pb-20">
      <div className="space-y-4 print:hidden">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-bold tracking-tight text-white sm:text-2xl"><FileText className="h-6 w-6 text-blue-400" aria-hidden="true" />Reports & AI insights</h2>
          <p className="mt-1 text-sm text-slate-400">Review recorded operations, inspect the evidence, and generate a focused briefing.</p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label htmlFor="report-focus" className="mb-1 block text-xs font-medium text-slate-300">Report focus</label>
            <select id="report-focus" value={focus} onChange={(event) => handleFocusChange(event.target.value as ReportFocus)} disabled={loading !== null} className="rounded-xl border border-white/15 bg-slate-900 px-3 py-2 text-sm text-white focus:border-blue-400 focus:outline-none">
              {Object.entries(FOCUS_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
            </select>
          </div>
          <button type="button" onClick={() => void loadReport(true)} disabled={loading !== null || retrySeconds > 0} className={`${buttonClass} border-blue-400/30 bg-blue-600 text-white hover:bg-blue-500`}>
            {loading === 'report' ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Sparkles className="h-4 w-4" aria-hidden="true" />}
            {loading === 'report' ? 'Generating briefing…' : 'Generate AI briefing'}
          </button>
          <button type="button" onClick={() => void loadReport(false)} disabled={loading !== null || retrySeconds > 0} className={buttonClass}>
            <RefreshCw className={`h-4 w-4 ${loading === 'snapshot' ? 'animate-spin' : ''}`} aria-hidden="true" /> Refresh snapshot
          </button>
        </div>
        {retrySeconds > 0 ? <p role="status" className="text-sm text-amber-300">Try again in {retrySeconds}s.</p> : null}
        {error ? <p role="alert" className="rounded-xl border border-rose-400/25 bg-rose-500/10 p-3 text-sm text-rose-200">{error}{report ? ' The previous report remains below with its original timestamp.' : ''}</p> : null}
        {loading ? <p role="status" className="text-sm text-blue-300">{loading === 'report' ? 'Preparing a briefing from the current database snapshot…' : 'Loading the current operations snapshot…'}</p> : null}
      </div>

      {report ? (
        <>
          <div className="flex flex-wrap gap-2 print:hidden">
            <button type="button" onClick={exportFullReportCSV} className={buttonClass}><FileSpreadsheet className="h-4 w-4 text-emerald-400" aria-hidden="true" /> Export report CSV</button>
            <button type="button" onClick={exportMetrics} className={buttonClass}><FileSpreadsheet className="h-4 w-4" aria-hidden="true" /> Export metrics CSV</button>
            <button type="button" onClick={() => downloadReport(JSON.stringify(report, null, 2), `SynChain_${report.focus}_${report.generated_at.slice(0, 10)}.json`, 'application/json')} className={buttonClass}><Download className="h-4 w-4" aria-hidden="true" /> Download report JSON</button>
            <button type="button" onClick={() => window.print()} className={buttonClass}><Printer className="h-4 w-4" aria-hidden="true" /> Print / save PDF</button>
          </div>
          <article className="synchain-report-document space-y-6 rounded-2xl border border-white/10 bg-slate-950/80 p-5 sm:p-8" aria-label={`${FOCUS_LABELS[report.focus]} report`}>
            <header className="flex flex-wrap items-start justify-between gap-4 border-b border-white/10 pb-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-blue-400">SynChain AI</p>
                <h3 className="mt-1 text-xl font-semibold text-white">{FOCUS_LABELS[report.focus]}</h3>
                <p className={`mt-2 text-xs ${report.fallback ? 'text-amber-300' : 'text-blue-300'}`}>
                  {report.fallback ? 'Local fallback · Recorded-data briefing' : report.provider === 'gemini' ? `Gemini briefing${report.model ? ` · ${report.model}` : ''}` : 'Recorded-data insights'}
                </p>
              </div>
              <div className="space-y-1 text-xs text-slate-400">
                <p>Generated: <time dateTime={report.generated_at}>{new Date(report.generated_at).toLocaleString()}</time></p>
                <p>Data snapshot: <time dateTime={report.snapshot_at}>{new Date(report.snapshot_at).toLocaleString()}</time></p>
              </div>
            </header>

            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {['active_suppliers_count', 'active_shipments_count', 'overdue_shipments_count', 'inventory_routes_at_reorder_point'].map((key) => (
                <div key={key} className="rounded-xl border border-white/10 bg-slate-900/70 p-4">
                  <p className="text-xs text-slate-400">{metricLabel(key)}</p>
                  <p className="mt-2 text-2xl font-semibold text-white">{metricValue(report.source_metrics[key])}</p>
                </div>
              ))}
            </div>

            <section>
              <h4 className="mb-2 text-sm font-semibold text-white">Summary</h4>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-300">{report.summary}</p>
            </section>

            <section className="space-y-3">
              <h4 className="text-sm font-semibold text-white">Findings & supporting evidence</h4>
              {report.findings.map((finding, index) => (
                <div key={`${finding.title}-${index}`} className="rounded-xl border border-white/10 p-4">
                  <div className="flex items-start justify-between gap-3"><h5 className="text-sm font-semibold text-slate-100">{finding.title}</h5><span className="rounded-md bg-slate-800 px-2 py-1 text-[10px] font-semibold uppercase text-slate-300">{finding.severity}</span></div>
                  <p className="mt-2 text-sm leading-relaxed text-slate-300">{finding.detail}</p>
                  <p className="mt-2 text-xs text-blue-300">Evidence: {evidenceText(finding.metric_keys, report.source_metrics)}</p>
                </div>
              ))}
            </section>

            <section className="space-y-3">
              <h4 className="text-sm font-semibold text-white">Recommended next steps</h4>
              <ol className="space-y-3">
                {report.recommended_actions.map((action, index) => (
                  <li key={`${action.action}-${index}`} className="rounded-xl border border-white/10 p-4">
                    <p className="text-sm font-semibold text-slate-100">{index + 1}. {action.action} <span className="ml-1 text-xs font-normal capitalize text-amber-300">({action.priority} priority)</span></p>
                    <p className="mt-2 text-sm leading-relaxed text-slate-300">{action.reason}</p>
                    <p className="mt-2 text-xs text-blue-300">Evidence: {evidenceText(action.metric_keys, report.source_metrics)}</p>
                  </li>
                ))}
              </ol>
            </section>

            <section className="space-y-3">
              <h4 className="text-sm font-semibold text-white">Source metrics</h4>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <caption className="sr-only">Recorded metrics used in this report; unknown indicates unavailable data.</caption>
                  <thead><tr className="border-b border-white/10 text-slate-400"><th scope="col" className="py-2 pr-4 font-medium">Metric</th><th scope="col" className="py-2 text-right font-medium">Value</th></tr></thead>
                  <tbody>{Object.entries(report.source_metrics).map(([key, value]) => <tr key={key} className="border-b border-white/5 text-slate-300"><th scope="row" className="py-2 pr-4 font-normal">{metricLabel(key)}</th><td className="py-2 text-right font-mono">{metricValue(value)}</td></tr>)}</tbody>
                </table>
              </div>
            </section>

            <section className="rounded-xl border border-amber-400/20 bg-amber-500/5 p-4">
              <h4 className="text-sm font-semibold text-amber-200">Scope & limitations</h4>
              <ul className="mt-2 list-disc space-y-1 pl-4 text-xs leading-relaxed text-slate-400">
                {report.limitations.map((limitation, index) => <li key={`${index}-${limitation}`}>{limitation}</li>)}
                <li>Review recommendations before making operational decisions.</li>
              </ul>
            </section>
          </article>
        </>
      ) : !loading ? (
        <div className="rounded-2xl border border-dashed border-white/15 p-8 text-center text-sm text-slate-400">A report will appear when the operations snapshot is available. Use Refresh snapshot to try again.</div>
      ) : null}
    </div>
  );
}
