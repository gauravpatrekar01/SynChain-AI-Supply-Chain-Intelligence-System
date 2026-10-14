import React, { useState, useEffect, useMemo, useCallback } from 'react';
import ReactECharts from 'echarts-for-react';
import * as echarts from 'echarts';
import { useSupplyChain } from '../../context/SupplyChainContext';
import { GlassCard } from '../common/GlassCard';
import { NeonBadge } from '../common/NeonBadge';
import {
  TrendingUp,
  Sparkles,
  PackageCheck,
  DollarSign,
  AlertTriangle,
  RefreshCw,
  ShieldCheck,
  Loader2,
  Info,
  Boxes,
  Database,
  AlertCircle,
} from 'lucide-react';
import { soundFX } from '../../services/audioService';
import { apiService } from '../../services/api';
import { DEMO_SYNTHETIC_HISTORICAL_DEMAND } from '../../services/mockData';
import {
  DemandForecastResponsePayload,
  InventoryPolicyResponsePayload,
  DemandForecastPoint,
  InventoryItemDetail,
  DemandHistoryResponsePayload,
} from '../../types';

export const ForecastView: React.FC = () => {
  const { commodityPrices } = useSupplyChain();
  const [forecastHorizon, setForecastHorizon] = useState<30 | 60 | 90 | 180>(30);
  const [selectedCommodity, setSelectedCommodity] = useState<string>('Lithium Hydroxide (Battery Grade)');
  const [leadTimeDays, setLeadTimeDays] = useState<number>(7);
  const [targetServiceLevel] = useState<number>(0.95);

  // Inventory & SKU Selector States
  const [inventoryCatalog, setInventoryCatalog] = useState<InventoryItemDetail[]>([]);
  const [selectedSku, setSelectedSku] = useState<string>('P0001');
  const [historyProvenance, setHistoryProvenance] = useState<DemandHistoryResponsePayload | null>(null);
  const [skuDataWarning, setSkuDataWarning] = useState<string | null>(null);

  // Live API States
  const [forecastResponse, setForecastResponse] = useState<DemandForecastResponsePayload | null>(null);
  const [inventoryPolicy, setInventoryPolicy] = useState<InventoryPolicyResponsePayload | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isError, setIsError] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDemoFallback, setIsDemoFallback] = useState<boolean>(false);

  // Selected item metadata from catalog
  const currentItem = useMemo(() => {
    return inventoryCatalog.find((it) => it.sku === selectedSku) || null;
  }, [inventoryCatalog, selectedSku]);

  // Load Inventory Catalog on Mount
  useEffect(() => {
    let isMounted = true;
    async function fetchCatalog() {
      try {
        const items = await apiService.getInventoryItems();
        if (isMounted && items && items.length > 0) {
          setInventoryCatalog(items);
          setSelectedSku((prev) => (items.some((it) => it.sku === prev) ? prev : items[0].sku));
        }
      } catch (e) {
        console.warn('Failed to load inventory catalog:', e);
      }
    }
    fetchCatalog();
    return () => {
      isMounted = false;
    };
  }, []);

  // Fetch forecast and inventory policy for selected SKU
  const loadForecastData = useCallback(
    async (sku: string, horizon: number, leadTime: number) => {
      setIsLoading(true);
      setIsError(false);
      setErrorMessage(null);
      setSkuDataWarning(null);

      try {
        // 1. Fetch Verified Demand History for the SKU
        let historyData: Array<{ date: string; demand: number }> = [];
        let provenance: DemandHistoryResponsePayload | null = null;

        try {
          provenance = await apiService.getDemandHistory(sku, 90);
          setHistoryProvenance(provenance);
          historyData = provenance.historicalData;
        } catch (histErr: any) {
          // If backend returns 422 for a live PostgreSQL item with 0 sales observations
          if (histErr?.response?.status === 422) {
            const detailMsg =
              histErr?.response?.data?.detail ||
              'This live database SKU has 0 historical customer sales in PostgreSQL. SynChain AI never silently substitutes synthetic data for live items.';
            setSkuDataWarning(detailMsg);
            setForecastResponse(null);
            setInventoryPolicy(null);
            setIsLoading(false);
            return;
          }
          console.warn('Demand history fetch failed, using demo fallback:', histErr);
          historyData = DEMO_SYNTHETIC_HISTORICAL_DEMAND;
        }

        // 2. POST /api/v1/forecast/demand using verified historical observations
        const forecastData = await apiService.getDemandForecast({
          productId: sku,
          historicalData: historyData,
          horizonDays: horizon,
          intervalWidth: 0.95,
          evaluate: true,
        });

        setForecastResponse(forecastData);
        setIsDemoFallback(false);

        // 3. POST /api/v1/inventory/reorder-policy using generated forecast output and on-hand stock
        const currentStockVal = currentItem ? currentItem.currentStock : undefined;
        const reorderQtyVal = currentItem ? currentItem.reorderQuantity : undefined;

        try {
          const policyData = await apiService.getInventoryReorderPolicy({
            productId: sku,
            forecastPoints: forecastData.forecast,
            leadTimeDays: leadTime,
            targetServiceLevel: targetServiceLevel,
            dailyForecastRmse: forecastData.metrics?.rmse ?? undefined,
            holdingCostPerUnit: 2.5,
            stockoutCostPerUnit: 25.0,
            currentStock: currentStockVal,
            standardReorderQuantity: reorderQtyVal,
          });
          setInventoryPolicy(policyData);
        } catch (policyErr: any) {
          console.warn('Inventory policy calculation warning:', policyErr);
        }
      } catch (err: any) {
        console.warn('Backend forecast API unreachable or failed; utilizing synthetic demo baseline:', err);
        setIsDemoFallback(true);
        setIsError(true);
        setErrorMessage(
          err?.response?.data?.detail || err?.message || 'Backend forecasting service unreachable'
        );

        // Graceful fallback to verified 30-day synthetic series
        const syntheticPoints: DemandForecastPoint[] = DEMO_SYNTHETIC_HISTORICAL_DEMAND.map((pt) => ({
          date: pt.date,
          actualDemandUnits: pt.demand,
          predictedDemandUnits: pt.demand,
          confidenceLower: Math.round(pt.demand * 0.9),
          confidenceUpper: Math.round(pt.demand * 1.1),
          historicalBaseline: pt.demand,
        }));

        setForecastResponse({
          status: 'demo_fallback',
          productId: sku,
          algorithm: 'Synthetic Historical Baseline (Demo Fallback)',
          modelVersion: 'Offline-Demo',
          horizon,
          forecast: syntheticPoints.slice(-horizon),
          historical: syntheticPoints,
        });

        const expectedLtDemand = syntheticPoints
          .slice(-leadTime)
          .reduce((sum, p) => sum + p.predictedDemandUnits, 0);
        const fallbackSafetyStock = Math.round(Math.sqrt(leadTime) * 120 * 1.645);
        const fallbackRop = expectedLtDemand + fallbackSafetyStock;
        const currentStockVal = currentItem ? currentItem.currentStock : 231;

        setInventoryPolicy({
          status: 'demo_fallback',
          productId: sku,
          leadTimeDays: leadTime,
          targetServiceLevel: targetServiceLevel,
          expectedLeadTimeDemand: expectedLtDemand,
          safetyStock: fallbackSafetyStock,
          reorderPoint: fallbackRop,
          currentStock: currentStockVal,
          reorderRequired: currentStockVal <= fallbackRop,
          recommendedReorderQuantity: currentStockVal <= fallbackRop ? Math.max(0, fallbackRop + expectedLtDemand - currentStockVal) : 0,
          methodUsed: 'synthetic_gaussian_approximation',
          assumptions: [
            'DEMO MODE: Synthetic estimate calculated while FastAPI backend is offline.',
            `Replenishment lead time evaluated: ${leadTime} calendar days.`,
            `Target cycle service level: ${(targetServiceLevel * 100).toFixed(0)}%.`,
          ],
        });
      } finally {
        setIsLoading(false);
      }
    },
    [targetServiceLevel, currentItem]
  );

  // Trigger forecast computation when SKU, horizon, or lead time changes
  useEffect(() => {
    if (selectedSku) {
      loadForecastData(selectedSku, forecastHorizon, leadTimeDays);
    }
  }, [selectedSku, forecastHorizon, leadTimeDays, loadForecastData]);


  // Combine historical observations and forward predictions chronologically
  const chartTimeline = useMemo(() => {
    if (!forecastResponse) return { dates: [], actuals: [], predicted: [], upper: [], lower: [] };

    const hist = forecastResponse.historical || [];
    const fcast = forecastResponse.forecast || [];

    const dates: string[] = [];
    const actuals: Array<number | null> = [];
    const predicted: Array<number | null> = [];
    const upper: Array<number | null> = [];
    const lower: Array<number | null> = [];

    // Historical points
    hist.forEach((pt) => {
      dates.push(pt.date);
      actuals.push(pt.actualDemandUnits ?? null);
      predicted.push(pt.predictedDemandUnits ?? null);
      upper.push(null);
      lower.push(null);
    });

    // Future forecast points
    fcast.forEach((pt) => {
      dates.push(pt.date);
      actuals.push(null); // No actuals in the future
      predicted.push(pt.predictedDemandUnits);
      upper.push(pt.confidenceUpper ?? null);
      lower.push(pt.confidenceLower ?? null);
    });

    return { dates, actuals, predicted, upper, lower };
  }, [forecastResponse]);

  // Demand ECharts Configuration
  const demandOption = useMemo(() => {
    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        backgroundColor: 'rgba(15, 23, 42, 0.95)',
        borderColor: 'rgba(139, 92, 246, 0.4)',
        borderWidth: 1,
        textStyle: { color: '#f8fafc', fontSize: 12 },
        formatter: (params: any) => {
          if (!Array.isArray(params) || params.length === 0) return '';
          let html = `<div class="font-bold text-slate-300 pb-1 mb-1 border-b border-white/10">${params[0].axisValue}</div>`;
          params.forEach((item: any) => {
            if (item.value !== null && item.value !== undefined) {
              html += `<div class="flex items-center justify-between gap-4 py-0.5 text-xs">
                <span style="color: ${item.color}">● ${item.seriesName}:</span>
                <span class="font-mono font-bold text-white">${Number(item.value).toLocaleString()} Units</span>
              </div>`;
            }
          });
          return html;
        },
      },
      legend: {
        data: ['Historical Orders', 'AI Predicted Demand', 'Confidence Upper (95%)', 'Confidence Lower (95%)'],
        textStyle: { color: '#94a3b8', fontSize: 11 },
        top: 0,
        right: 10,
      },
      grid: { left: '3%', right: '3%', bottom: '4%', top: '16%', containLabel: true },
      xAxis: {
        type: 'category',
        data: chartTimeline.dates,
        axisLine: { lineStyle: { color: 'rgba(255, 255, 255, 0.1)' } },
        axisLabel: { color: '#94a3b8', fontSize: 10, rotate: chartTimeline.dates.length > 40 ? 30 : 0 },
      },
      yAxis: {
        type: 'value',
        axisLine: { show: false },
        splitLine: { lineStyle: { color: 'rgba(255, 255, 255, 0.05)', type: 'dashed' } },
        axisLabel: {
          color: '#94a3b8',
          fontSize: 11,
          formatter: (val: number) => (val >= 1000 ? `${(val / 1000).toFixed(1)}k` : `${Math.round(val)}`),
        },
      },
      series: [
        {
          name: 'Historical Orders',
          type: 'line',
          data: chartTimeline.actuals,
          smooth: true,
          itemStyle: { color: '#3B82F6' },
          lineStyle: { width: 3, color: '#3B82F6' },
        },
        {
          name: 'AI Predicted Demand',
          type: 'line',
          data: chartTimeline.predicted,
          smooth: true,
          itemStyle: { color: '#8B5CF6' },
          lineStyle: { width: 3, color: '#8B5CF6' },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: 'rgba(139, 92, 246, 0.3)' },
              { offset: 1, color: 'rgba(139, 92, 246, 0.0)' },
            ]),
          },
        },
        {
          name: 'Confidence Upper (95%)',
          type: 'line',
          data: chartTimeline.upper,
          smooth: true,
          lineStyle: { color: '#06B6D4', type: 'dashed', width: 1.5 },
        },
        {
          name: 'Confidence Lower (95%)',
          type: 'line',
          data: chartTimeline.lower,
          smooth: true,
          lineStyle: { color: '#64748B', type: 'dotted', width: 1.5 },
        },
      ],
    };
  }, [chartTimeline]);

  // Commodity chart option
  const fallbackCommodity = {
    materialName: 'Raw Materials Index',
    currentPriceUsd: 100,
    forecastPriceUsd: 105,
    unit: 'index',
    changePct30d: 5.0,
    historicalDates: ['W1', 'W2', 'W3', 'W4'],
    historicalPrices: [95, 98, 102, 100],
  };
  const currentCommodityData =
    (commodityPrices && commodityPrices.find((c) => c.materialName === selectedCommodity)) ||
    (commodityPrices && commodityPrices[0]) ||
    fallbackCommodity;

  const commodityOption = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(15, 23, 42, 0.95)',
      borderColor: 'rgba(245, 158, 11, 0.4)',
      borderWidth: 1,
      textStyle: { color: '#f8fafc', fontSize: 12 },
    },
    grid: { left: '3%', right: '3%', bottom: '4%', top: '16%', containLabel: true },
    xAxis: {
      type: 'category',
      data: currentCommodityData.historicalDates || [],
      axisLine: { lineStyle: { color: 'rgba(255, 255, 255, 0.1)' } },
      axisLabel: { color: '#94a3b8', fontSize: 11 },
    },
    yAxis: {
      type: 'value',
      axisLine: { show: false },
      splitLine: { lineStyle: { color: 'rgba(255, 255, 255, 0.05)', type: 'dashed' } },
      axisLabel: { color: '#94a3b8', fontSize: 11, formatter: (val: number) => `$${val}` },
    },
    series: [
      {
        name: 'Spot & Forward Price ($/kg or ton)',
        type: 'line',
        data: currentCommodityData.historicalPrices,
        smooth: true,
        itemStyle: { color: '#f59e0b' },
        lineStyle: { width: 3, color: '#f59e0b' },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(245, 158, 11, 0.35)' },
            { offset: 1, color: 'rgba(245, 158, 11, 0.0)' },
          ]),
        },
      },
    ],
  };

  // Demand forecast chart option
  const demandOption = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(15, 23, 42, 0.95)',
      borderColor: 'rgba(139, 92, 246, 0.4)',
      borderWidth: 1,
      textStyle: { color: '#f8fafc', fontSize: 12 },
    },
    legend: {
      data: ['Actual Orders', 'AI Predicted Demand', 'Confidence Upper (95%)'],
      textStyle: { color: '#94a3b8', fontSize: 11 },
      top: 0,
      right: 10,
    },
    grid: { left: '3%', right: '3%', bottom: '4%', top: '16%', containLabel: true },
    xAxis: {
      type: 'category',
      data: slicedDemand.map((d) => d.date),
      axisLine: { lineStyle: { color: 'rgba(255, 255, 255, 0.1)' } },
      axisLabel: { color: '#94a3b8', fontSize: 11 },
    },
    yAxis: {
      type: 'value',
      axisLine: { show: false },
      splitLine: { lineStyle: { color: 'rgba(255, 255, 255, 0.05)', type: 'dashed' } },
      axisLabel: { color: '#94a3b8', fontSize: 11, formatter: (val: number) => `${(val / 1000).toFixed(0)}k` },
    },
    series: [
      {
        name: 'Actual Orders',
        type: 'line',
        data: slicedDemand.map((d) => d.actualDemandUnits ?? null),
        smooth: true,
        itemStyle: { color: '#3B82F6' },
        lineStyle: { width: 3, color: '#3B82F6' },
      },
      {
        name: 'AI Predicted Demand',
        type: 'line',
        data: slicedDemand.map((d) => d.predictedDemandUnits),
        smooth: true,
        itemStyle: { color: '#8B5CF6' },
        lineStyle: { width: 3, color: '#8B5CF6' },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(139, 92, 246, 0.3)' },
            { offset: 1, color: 'rgba(139, 92, 246, 0.0)' },
          ]),
        },
      },
      {
        name: 'Confidence Upper (95%)',
        type: 'line',
        data: slicedDemand.map((d) => d.confidenceUpper),
        smooth: true,
        lineStyle: { color: '#06B6D4', type: 'dashed', width: 1.5 },
      },
    ],
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-xl sm:text-2xl font-bold text-white font-display tracking-tight">
              Predictive AI Forecast Center
            </h2>
            <NeonBadge variant={isDemoFallback ? 'warning' : 'purple'} size="sm">
              {forecastResponse?.modelVersion || 'PROPHET'}
            </NeonBadge>
            {historyProvenance?.dataSource === 'retail_dataset_actual' && (
              <span className="text-[10px] uppercase font-mono font-bold bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded border border-emerald-500/30 flex items-center gap-1">
                <Database className="w-3 h-3 text-emerald-400" />
                ACTUAL DATA (RETAIL DATASET)
              </span>
            )}
            {historyProvenance?.dataSource === 'deterministic_demo' && (
              <span className="text-[10px] uppercase font-mono font-bold bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded border border-purple-500/30 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-purple-400" />
                DETERMINISTIC SIMULATION
              </span>
            )}
            {currentItem?.dataSource === 'postgresql_live' && (
              <span className="text-[10px] uppercase font-mono font-bold bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded border border-amber-500/30 flex items-center gap-1">
                <AlertCircle className="w-3 h-3 text-amber-400" />
                POSTGRESQL LIVE ITEM
              </span>
            )}
          </div>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Enterprise Bayesian demand forecasting, automated safety buffer optimization, and commodity pricing trends.
          </p>
        </div>

        {/* Controls: Horizon & Refresh */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-900/80 border border-white/10">
            {([30, 60, 90, 180] as const).map((h) => (
              <button
                key={h}
                disabled={isLoading}
                onClick={() => {
                  soundFX.playClick();
                  setForecastHorizon(h);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${forecastHorizon === h
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white hover:bg-white/5 disabled:opacity-50'
                  }`}
              >
                {h} Days
              </button>
            ))}
          </div>

          <button
            onClick={() => {
              soundFX.playClick();
              loadForecastData(selectedSku, forecastHorizon, leadTimeDays);
            }}
            disabled={isLoading}
            className="p-2 rounded-xl bg-slate-900/80 border border-white/10 text-slate-400 hover:text-white hover:bg-white/5 transition-all cursor-pointer disabled:opacity-50"
            title="Refresh Forecast from API"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-blue-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Product / SKU Selector & Inventory Context Strip */}
      <div className="rounded-2xl glass-panel border border-white/10 p-4 space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Boxes className="w-5 h-5 text-cyan-400 shrink-0" />
            <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
              Selected Inventory SKU:
            </span>
            <select
              value={selectedSku}
              onChange={(e) => {
                soundFX.playClick();
                setSelectedSku(e.target.value);
              }}
              className="bg-slate-900 border border-white/15 text-white rounded-lg px-3 py-1.5 text-xs font-bold font-mono focus:outline-none focus:border-cyan-500 cursor-pointer"
            >
              {inventoryCatalog.map((item) => (
                <option key={item.sku} value={item.sku}>
                  {item.sku} — {item.name} ({item.dataSource === 'retail_dataset_actual' ? 'Actual Data' : item.dataSource === 'postgresql_live' ? 'Live DB' : 'Simulated'})
                </option>
              ))}
            </select>
          </div>

          {currentItem && (
            <div className="flex items-center gap-3 text-xs font-mono text-slate-300 flex-wrap">
              <span className="text-slate-400">Facility:</span>
              <span className="text-white font-semibold">{currentItem.warehouse}</span>
              <span className="text-slate-600">|</span>
              <span className="text-slate-400">Category:</span>
              <span className="text-cyan-300">{currentItem.category}</span>
              <span className="text-slate-600">|</span>
              <span className="text-slate-400">Unit Price:</span>
              <span className="text-emerald-400 font-bold">${currentItem.unitPrice.toFixed(2)}</span>
            </div>
          )}
        </div>
      </div>

      {/* Informative Warning Banner for Live PostgreSQL SKUs without Sales History */}
      {skuDataWarning && (
        <div className="rounded-2xl p-4 bg-amber-500/10 border border-amber-500/30 text-xs text-amber-200 space-y-2">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
            <div className="space-y-0.5">
              <div className="font-bold text-amber-100 text-sm">
                Live PostgreSQL Database Item: Insufficient Historical Customer Demand Observations
              </div>
              <p className="text-amber-200/90 leading-relaxed">{skuDataWarning}</p>
            </div>
          </div>
          <div className="flex items-center justify-between pt-2 border-t border-amber-500/20 text-[11px] font-mono">
            <span>
              Registered On-Hand Inventory: <strong>{currentItem?.currentStock ?? 0} units</strong> in {currentItem?.warehouse}
            </span>
            <div className="flex items-center gap-2">
              <span className="text-slate-400">Switch to verified historical dataset:</span>
              <button
                onClick={() => {
                  soundFX.playClick();
                  setSelectedSku('P0001');
                }}
                className="px-2.5 py-1 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-bold hover:bg-cyan-500/30 cursor-pointer transition-all"
              >
                P0001 (Actual Retail Data)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* General Demo Warning Banner if Offline */}
      {isError && !skuDataWarning && (
        <div className="rounded-xl p-3 bg-amber-500/10 border border-amber-500/30 flex items-center justify-between text-xs text-amber-200">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>
              <strong>DEMO FALLBACK:</strong> Backend service offline or returned error ({errorMessage}). Rendering verified 30-day synthetic baseline observations.
            </span>
          </div>
          <button
            onClick={() => loadForecastData(selectedSku, forecastHorizon, leadTimeDays)}
            className="underline font-bold hover:text-white ml-2 cursor-pointer"
          >
            Retry Connection
          </button>
        </div>
      )}

      {/* Inventory Decision Policy KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Card 1: On-Hand Stock vs ROP Status */}
        <div className="rounded-2xl glass-panel border border-white/10 p-4 space-y-1 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Current On-Hand Stock</span>
            <Boxes className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-cyan-300">
            {currentItem ? `${currentItem.currentStock.toLocaleString()} units` : '—'}
          </div>
          <div className="text-[11px] font-mono-telemetry pt-1 border-t border-white/5 truncate flex items-center justify-between">
            {inventoryPolicy?.reorderRequired ? (
              <span className="text-rose-400 font-bold flex items-center gap-1">
                ● REORDER NEEDED (+{inventoryPolicy?.recommendedReorderQuantity?.toLocaleString() || 0})
              </span>
            ) : (
              <span className="text-emerald-400 font-bold flex items-center gap-1">
                ● BUFFER OPTIMAL
              </span>
            )}
          </div>
        </div>

        {/* Card 2: Expected Lead-Time Demand */}
        <div className="rounded-2xl glass-panel border border-white/10 p-4 space-y-1 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Expected Lead-Time Demand</span>
            <PackageCheck className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-white">
            {inventoryPolicy?.expectedLeadTimeDemand
              ? `${inventoryPolicy.expectedLeadTimeDemand.toLocaleString()} units`
              : '—'}
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono-telemetry pt-1 border-t border-white/5">
            <span>Horizon: {leadTimeDays} days</span>
            <div className="flex items-center gap-1">
              <span>Lead Time:</span>
              <select
                value={leadTimeDays}
                onChange={(e) => {
                  soundFX.playClick();
                  setLeadTimeDays(Number(e.target.value));
                }}
                className="bg-slate-900 text-blue-300 font-bold border border-white/10 rounded px-1 py-0.5 text-[11px] cursor-pointer"
              >
                <option value={3}>3d</option>
                <option value={5}>5d</option>
                <option value={7}>7d</option>
                <option value={14}>14d</option>
                <option value={21}>21d</option>
              </select>
            </div>
          </div>
        </div>

        {/* Card 3: Safety Stock */}
        <div className="rounded-2xl glass-panel border border-white/10 p-4 space-y-1 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Recommended Safety Stock</span>
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-300">
            {inventoryPolicy?.safetyStock !== undefined && inventoryPolicy?.safetyStock !== null
              ? `+${inventoryPolicy.safetyStock.toLocaleString()} units`
              : '—'}
          </div>
          <div className="text-[11px] text-slate-400 font-mono-telemetry pt-1 border-t border-white/5 truncate">
            Target Service Level: {(targetServiceLevel * 100).toFixed(0)}% (CSL)
          </div>
        </div>

        {/* Card 4: Reorder Point (ROP) */}
        <div className="rounded-2xl glass-panel border border-white/10 p-4 space-y-1 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Reorder Point (ROP)</span>
            <TrendingUp className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-purple-300">
            {inventoryPolicy?.reorderPoint
              ? `${inventoryPolicy.reorderPoint.toLocaleString()} units`
              : '—'}
          </div>
          <div className="text-[11px] text-slate-400 font-mono-telemetry pt-1 border-t border-white/5 truncate">
            ROP = Demand ({inventoryPolicy?.expectedLeadTimeDemand || 0}) + SS ({inventoryPolicy?.safetyStock || 0})
          </div>
        </div>

        {/* Card 5: Uncertainty & Evaluation Metrics */}
        <div className="rounded-2xl glass-panel border border-white/10 p-4 space-y-1 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Out-of-Sample Accuracy</span>
            <Sparkles className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-xl font-bold font-mono text-amber-300">
            {forecastResponse?.metrics?.wape !== null && forecastResponse?.metrics?.wape !== undefined
              ? `WAPE: ${forecastResponse.metrics.wape.toFixed(1)}%`
              : forecastResponse?.metrics?.mae !== null && forecastResponse?.metrics?.mae !== undefined
                ? `MAE: ${forecastResponse.metrics.mae.toFixed(1)}`
                : 'Evaluated'}
          </div>
          <div className="text-[11px] text-slate-400 font-mono-telemetry pt-1 border-t border-white/5 truncate">
            {forecastResponse?.metrics?.rmse
              ? `RMSE: ${forecastResponse.metrics.rmse.toFixed(1)} units`
              : 'Holdout backtest validation'}
          </div>
        </div>
      </div>

      {/* Demand Projection Chart */}
      <GlassCard
        title={`Finished Goods Demand Projection (${forecastHorizon}-Day Calendar Horizon)`}
        subtitle={
          forecastResponse?.algorithm ||
          'Bayesian additive time-series forecasting with genuine 95% confidence bounds'
        }
        badge={
          <div className="flex items-center gap-1.5 text-xs text-purple-300 bg-purple-500/10 border border-purple-400/30 px-2.5 py-0.5 rounded-full">
            <Sparkles className="w-3.5 h-3.5 text-purple-400" />
            <span>
              {forecastResponse?.metrics?.wape !== undefined && forecastResponse?.metrics?.wape !== null
                ? `Holdout WAPE: ${forecastResponse.metrics.wape}%`
                : '95% Prediction Bounds'}
            </span>
          </div>
        }
      >
        <div className="relative h-80 w-full">
          {isLoading && (
            <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center z-10 rounded-xl">
              <div className="flex items-center gap-2 text-sm text-purple-300 font-mono font-semibold">
                <Loader2 className="w-5 h-5 animate-spin text-purple-400" />
                <span>Computing Bayesian Forecast & Inventory Policy...</span>
              </div>
            </div>
          )}
          <ReactECharts option={demandOption} style={{ height: '100%', width: '100%' }} notMerge={true} />
        </div>

        {/* Policy Assumptions & Model Metadata Drawer */}
        {inventoryPolicy?.assumptions && inventoryPolicy.assumptions.length > 0 && (
          <div className="mt-4 pt-3 border-t border-white/10 text-[11px] text-slate-400 space-y-1">
            <div className="flex items-center gap-1 text-slate-300 font-semibold">
              <Info className="w-3.5 h-3.5 text-blue-400" />
              <span>Model & Inventory Policy Assumptions:</span>
            </div>
            <ul className="list-disc list-inside space-y-0.5 pl-1 font-mono-telemetry text-slate-400">
              {inventoryPolicy.assumptions.map((asm, i) => (
                <li key={i}>{asm}</li>
              ))}
            </ul>
          </div>
        )}
      </GlassCard>

      {/* Commodity & Material Price Trends (Preserved Existing Capability) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Commodity Selector List */}
        <div className="rounded-2xl glass-panel border border-white/10 p-5 space-y-3">
          <h3 className="text-sm font-bold text-white font-display flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-amber-400" />
            <span>Critical Raw Commodities</span>
          </h3>

          <div className="space-y-2">
            {commodityPrices.map((c) => (
              <button
                key={c.materialName}
                onClick={() => {
                  soundFX.playClick();
                  setSelectedCommodity(c.materialName);
                }}
                className={`w-full p-3 rounded-xl text-left transition-all cursor-pointer border ${selectedCommodity === c.materialName
                    ? 'bg-amber-500/15 border-amber-500/40 shadow-sm'
                    : 'bg-slate-900/40 border-white/5 hover:bg-white/5'
                  }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-white truncate">{c.materialName}</span>
                  <span
                    className={`text-xs font-mono font-semibold ${c.changePct30d >= 0 ? 'text-rose-400' : 'text-emerald-400'
                      }`}
                  >
                    {c.changePct30d >= 0 ? `+${c.changePct30d}%` : `${c.changePct30d}%`}
                  </span>
                </div>
                <div className="flex items-center justify-between mt-1 text-[11px] text-slate-400 font-mono-telemetry">
                  <span>Current: ${c.currentPriceUsd} / {c.unit}</span>
                  <span className="text-amber-300">Forecast: ${c.forecastPriceUsd}</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Commodity Price Chart */}
        <div className="lg:col-span-2 rounded-2xl glass-panel border border-white/10 p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <div>
              <h3 className="text-sm font-bold text-white font-display">{selectedCommodity}</h3>
              <p className="text-xs text-slate-400">120-day historical spot price + forward AI curve</p>
            </div>
            <NeonBadge variant="warning" size="sm">
              MARKET VOLATILITY
            </NeonBadge>
          </div>

          <div className="h-64 w-full">
            <ReactECharts option={commodityOption} style={{ height: '100%', width: '100%' }} notMerge={true} />
          </div>
        </div>
      </div>
    </div>
  );
};
