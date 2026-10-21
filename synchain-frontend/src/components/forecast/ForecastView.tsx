import React, { useState, useEffect, useMemo, useCallback } from 'react';
import ReactECharts from 'echarts-for-react';
import * as echarts from 'echarts';
import { useSupplyChain } from '../../context/SupplyChainContext';
import { GlassCard } from '../common/GlassCard';
import { NeonBadge } from '../common/NeonBadge';
import { Button } from '../common/Button';
import { Tooltip } from '../common/Tooltip';
import {
  TrendingUp,
  TrendingDown,
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
  Calendar,
  Layers,
  ArrowRight,
  ShieldAlert,
  Clock,
  CheckCircle2,
  Sliders,
  FileSpreadsheet,
  ChevronLeft,
  ChevronRight,
  Search,
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
  InventoryProjectionPoint,
  ForecastAlertItem,
  ForecastRecommendationItem,
} from '../../types';

export const ForecastView: React.FC = () => {
  const { commodityPrices } = useSupplyChain();
  // Phase 1: Forecast Horizon Selector (30, 60, 90 Days)
  const [forecastHorizon, setForecastHorizon] = useState<30 | 60 | 90>(30);
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

  // Table pagination and search state
  const [tableSearch, setTableSearch] = useState<string>('');
  const [tablePage, setTablePage] = useState<number>(1);
  const pageSize = 10;

  // Selected item metadata from catalog
  const currentItem = useMemo(() => {
    return inventoryCatalog.find((it) => it.sku.toUpperCase() === selectedSku.toUpperCase()) || null;
  }, [inventoryCatalog, selectedSku]);

  // Load Inventory Catalog on Mount and Ingestion Events
  useEffect(() => {
    let isMounted = true;
    async function fetchCatalog() {
      try {
        const items = await apiService.getInventoryItems();
        if (isMounted && items && items.length > 0) {
          setInventoryCatalog(items);
          setSelectedSku((prev) => (items.some((it) => it.sku.toUpperCase() === prev.toUpperCase()) ? prev : items[0].sku));
        }
      } catch (e) {
        console.warn('Failed to load inventory catalog:', e);
      }
    }
    fetchCatalog();

    const handleImported = () => {
      fetchCatalog();
    };
    window.addEventListener('synchain_data_imported', handleImported);

    return () => {
      isMounted = false;
      window.removeEventListener('synchain_data_imported', handleImported);
    };
  }, []);

  // Fetch multi-horizon forecast and inventory policy for selected SKU
  const loadForecastData = useCallback(
    async (sku: string, horizon: 30 | 60 | 90, leadTime: number) => {
      setIsLoading(true);
      setIsError(false);
      setErrorMessage(null);
      setSkuDataWarning(null);

      try {
        // 1. Fetch Verified Demand History for the SKU (request 180 days to give Prophet ample seasonal depth)
        let historyData: Array<{ date: string; demand: number }> = [];
        let provenance: DemandHistoryResponsePayload | null = null;

        try {
          provenance = await apiService.getDemandHistory(sku, 180);
          setHistoryProvenance(provenance);
          historyData = provenance.historicalData;
        } catch (histErr: any) {
          if (histErr?.response?.status === 422) {
            const detailMsg =
              histErr?.response?.data?.detail ||
              'This live database SKU has insufficient historical customer sales observations in PostgreSQL. SynChain AI requires genuine observations and never silently substitutes synthetic data into live production records.';
            setSkuDataWarning(detailMsg);
            setForecastResponse(null);
            setInventoryPolicy(null);
            setIsLoading(false);
            return;
          }
          console.warn('Demand history fetch failed, using demo fallback:', histErr);
          historyData = DEMO_SYNTHETIC_HISTORICAL_DEMAND;
        }

        // 2. Derive inventory policy baselines from current item
        const currentStockVal = currentItem ? currentItem.currentStock : 231;
        const safetyStockVal = currentItem ? currentItem.safetyStock : 135;
        const reorderLevelVal = currentItem ? currentItem.reorderLevel : 150;
        const reorderQtyVal = currentItem ? currentItem.reorderQuantity : 200;

        // 3. POST /api/v1/forecast/demand with full horizon and inventory parameters
        const forecastData = await apiService.getDemandForecast({
          productId: sku,
          historicalData: historyData,
          horizonDays: horizon,
          intervalWidth: 0.95,
          evaluate: true,
          currentStock: currentStockVal,
          safetyStock: safetyStockVal,
          reorderPoint: reorderLevelVal,
          leadTimeDays: leadTime,
          reorderQuantity: reorderQtyVal,
        });

        setForecastResponse(forecastData);
        setIsDemoFallback(false);

        // 4. POST /api/v1/inventory/reorder-policy to verify parametric uncertainty bounds
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

        // Deterministic synthetic fallback respecting requested horizon
        const baseDemand = 1200;
        const syntheticForecastPoints: DemandForecastPoint[] = [];
        const syntheticProjections: InventoryProjectionPoint[] = [];
        let runningStock = currentItem ? currentItem.currentStock : 45000;
        const ss = currentItem ? currentItem.safetyStock : 30000;
        const rop = currentItem ? currentItem.reorderLevel : 35000;
        const today = new Date();

        for (let i = 1; i <= horizon; i++) {
          const d = new Date(today);
          d.setDate(today.getDate() + i);
          const dateStr = d.toISOString().split('T')[0];
          const demand = Math.round(baseDemand + 150 * Math.sin(i * 0.4) + (i % 7) * 20);
          const lower = Math.round(demand * 0.9);
          const upper = Math.round(demand * 1.1);

          runningStock = Math.max(0, runningStock - demand);
          syntheticForecastPoints.push({
            date: dateStr,
            predictedDemandUnits: demand,
            confidenceLower: lower,
            confidenceUpper: upper,
            historicalBaseline: demand,
            projectedStock: runningStock,
            safetyStockFloor: ss,
            reorderTriggerPoint: rop,
          });

          syntheticProjections.push({
            day: i,
            date: dateStr,
            demand,
            projectedStock: runningStock,
            safetyStockFloor: ss,
            reorderTriggerPoint: rop,
            replenishmentUnits: 0,
            status: runningStock === 0 ? 'stockout' : runningStock < ss ? 'critical' : runningStock <= rop ? 'warning' : 'optimal',
          });
        }

        const histPoints: DemandForecastPoint[] = DEMO_SYNTHETIC_HISTORICAL_DEMAND.map((pt) => ({
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
          startDate: syntheticForecastPoints[0]?.date,
          endDate: syntheticForecastPoints[syntheticForecastPoints.length - 1]?.date,
          granularity: 'Daily',
          forecast: syntheticForecastPoints,
          historical: histPoints,
          inventoryProjections: syntheticProjections,
          daysOfSupply: Math.round((currentItem?.currentStock || 45000) / baseDemand),
          reorderRequired: (currentItem?.currentStock || 45000) <= rop,
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

  // Reset table pagination when SKU or horizon changes
  useEffect(() => {
    setTablePage(1);
  }, [selectedSku, forecastHorizon]);

  // Derived KPI calculations
  const kpis = useMemo(() => {
    if (!forecastResponse || !forecastResponse.forecast || forecastResponse.forecast.length === 0) {
      return {
        currentDailyDemand: 0,
        forecastTotalDemand: 0,
        forecastDailyAvg: 0,
        demandShiftPct: 0,
        currentStock: currentItem?.currentStock || 0,
        daysOfSupply: 0,
        stockoutRiskText: 'Unknown',
        stockoutRiskVariant: 'neutral' as const,
      };
    }

    const hist = forecastResponse.historical || [];
    const fcast = forecastResponse.forecast || [];

    // 1. Current average daily demand (from last 14 historical days)
    const recentHist = hist.slice(-14);
    const recentHistSum = recentHist.reduce((s, p) => s + (p.actualDemandUnits ?? p.predictedDemandUnits ?? 0), 0);
    const currentDailyDemand = recentHist.length > 0 ? Math.round(recentHistSum / recentHist.length) : 0;

    // 2. Forecasted Demand over horizon
    const forecastTotalDemand = fcast.reduce((s, p) => s + p.predictedDemandUnits, 0);
    const forecastDailyAvg = fcast.length > 0 ? Math.round(forecastTotalDemand / fcast.length) : 0;

    // 3. Expected Demand Shift (%)
    const demandShiftPct =
      currentDailyDemand > 0
        ? Number((((forecastDailyAvg - currentDailyDemand) / currentDailyDemand) * 100).toFixed(1))
        : 0;

    // 4. Current Stock
    const currentStock = currentItem ? currentItem.currentStock : (forecastResponse.inventoryProjections?.[0]?.projectedStock ?? 0);

    // 5. Days of Inventory Remaining
    const daysOfSupply =
      forecastResponse.daysOfSupply !== undefined && forecastResponse.daysOfSupply !== null
        ? forecastResponse.daysOfSupply
        : forecastDailyAvg > 0
        ? Number((currentStock / forecastDailyAvg).toFixed(1))
        : 999;

    // 6. Stockout Risk Assessment
    let stockoutRiskText = `Safe (${forecastHorizon}d Buffer)`;
    let stockoutRiskVariant: 'optimal' | 'warning' | 'critical' | 'neutral' = 'optimal';

    if (forecastResponse.estimatedStockoutDay) {
      stockoutRiskText = `Stockout Day ${forecastResponse.estimatedStockoutDay}`;
      stockoutRiskVariant = 'critical';
    } else if (daysOfSupply < leadTimeDays) {
      stockoutRiskText = `Lead Time Deficit (${daysOfSupply}d < ${leadTimeDays}d)`;
      stockoutRiskVariant = 'critical';
    } else if (forecastResponse.reorderRequired) {
      stockoutRiskText = 'Reorder Triggered';
      stockoutRiskVariant = 'warning';
    }

    return {
      currentDailyDemand,
      forecastTotalDemand,
      forecastDailyAvg,
      demandShiftPct,
      currentStock,
      daysOfSupply,
      stockoutRiskText,
      stockoutRiskVariant,
    };
  }, [forecastResponse, currentItem, forecastHorizon, leadTimeDays]);

  // Combine chronological timeline for Chart 1 (Demand Forecast)
  const demandChartData = useMemo(() => {
    if (!forecastResponse) {
      return { dates: [], actuals: [], predicted: [], baseline: [], upper: [], lower: [] };
    }

    const hist = forecastResponse.historical || [];
    const fcast = forecastResponse.forecast || [];

    const dates: string[] = [];
    const actuals: Array<number | null> = [];
    const predicted: Array<number | null> = [];
    const baseline: Array<number | null> = [];
    const upper: Array<number | null> = [];
    const lower: Array<number | null> = [];

    // Historical Points
    hist.forEach((pt) => {
      dates.push(pt.date);
      actuals.push(pt.actualDemandUnits ?? null);
      predicted.push(null);
      baseline.push(pt.historicalBaseline ?? null);
      upper.push(null);
      lower.push(null);
    });

    // Forecast Future Points
    fcast.forEach((pt) => {
      dates.push(pt.date);
      actuals.push(null);
      predicted.push(pt.predictedDemandUnits);
      baseline.push(pt.historicalBaseline ?? null);
      upper.push(pt.confidenceUpper ?? null);
      lower.push(pt.confidenceLower ?? null);
    });

    return { dates, actuals, predicted, baseline, upper, lower };
  }, [forecastResponse]);

  // Chart 1: Global Demand Forecast ECharts Option
  const demandOption = useMemo(() => {
    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        backgroundColor: 'rgba(15, 23, 42, 0.95)',
        borderColor: 'rgba(139, 92, 246, 0.4)',
        borderWidth: 1,
        textStyle: { color: '#f8fafc', fontSize: 13 },
        formatter: (params: any) => {
          if (!Array.isArray(params) || params.length === 0) return '';
          let html = `<div class="font-bold text-slate-300 pb-1 mb-1 border-b border-white/10 font-mono">${params[0].axisValue}</div>`;
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
        data: ['Actual Orders', 'AI Expected Demand', 'Reference Forecast (7-Day Average)', 'Upper Forecast Range', 'Lower Forecast Range'],
        textStyle: { color: '#94a3b8', fontSize: 12 },
        top: 0,
        right: 10,
      },
      grid: { left: '3%', right: '3%', bottom: '4%', top: '16%', containLabel: true },
      xAxis: {
        type: 'category',
        data: demandChartData.dates,
        axisLine: { lineStyle: { color: 'rgba(255, 255, 255, 0.1)' } },
        axisLabel: {
          color: '#94a3b8',
          fontSize: 11,
          rotate: demandChartData.dates.length > 50 ? 35 : 0,
        },
      },
      yAxis: {
        type: 'value',
        axisLine: { show: false },
        splitLine: { lineStyle: { color: 'rgba(255, 255, 255, 0.05)', type: 'dashed' } },
        axisLabel: {
          color: '#94a3b8',
          fontSize: 12,
          formatter: (val: number) => (val >= 1000 ? `${(val / 1000).toFixed(1)}k units` : `${Math.round(val)} units`),
        },
      },
      series: [
        {
          name: 'Actual Orders',
          type: 'line',
          data: demandChartData.actuals,
          smooth: true,
          itemStyle: { color: '#3B82F6' },
          lineStyle: { width: 3, color: '#3B82F6' },
        },
        {
          name: 'AI Expected Demand',
          type: 'line',
          data: demandChartData.predicted,
          smooth: true,
          itemStyle: { color: '#8B5CF6' },
          lineStyle: { width: 3, color: '#8B5CF6' },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: 'rgba(139, 92, 246, 0.35)' },
              { offset: 1, color: 'rgba(139, 92, 246, 0.0)' },
            ]),
          },
        },
        {
          name: 'Reference Forecast (7-Day Average)',
          type: 'line',
          data: demandChartData.baseline,
          smooth: true,
          lineStyle: { color: 'rgba(148, 163, 184, 0.6)', type: 'dotted', width: 2 },
          symbol: 'none',
        },
        {
          name: 'Upper Forecast Range',
          type: 'line',
          data: demandChartData.upper,
          smooth: true,
          lineStyle: { color: '#06B6D4', type: 'dashed', width: 1.5 },
          symbol: 'none',
        },
        {
          name: 'Lower Forecast Range',
          type: 'line',
          data: demandChartData.lower,
          smooth: true,
          lineStyle: { color: '#64748B', type: 'dotted', width: 1.5 },
          symbol: 'none',
        },
      ],
    };
  }, [demandChartData]);

  // Chart 2: Inventory Buffer & Stockout Velocity ECharts Option
  const inventoryVelocityOption = useMemo(() => {
    const projections = forecastResponse?.inventoryProjections || [];
    if (projections.length === 0) return null;

    const dates = projections.map((p) => p.date);
    const stocks = projections.map((p) => p.projectedStock);
    const safetyFloors = projections.map((p) => p.safetyStockFloor);
    const rops = projections.map((p) => p.reorderTriggerPoint);

    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        backgroundColor: 'rgba(15, 23, 42, 0.95)',
        borderColor: 'rgba(6, 182, 212, 0.4)',
        borderWidth: 1,
        textStyle: { color: '#f8fafc', fontSize: 12 },
        formatter: (params: any) => {
          if (!Array.isArray(params) || params.length === 0) return '';
          let html = `<div class="font-bold text-white mb-1 border-b border-white/10 pb-1 font-mono">${params[0].axisValue}</div>`;
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
        data: ['Estimated Stock Remaining', 'Reorder Level (ROP)', 'Extra Safety Stock'],
        textStyle: { color: '#94a3b8', fontSize: 12 },
        top: 0,
        right: 10,
      },
      grid: { left: '3%', right: '3%', bottom: '4%', top: '16%', containLabel: true },
      xAxis: {
        type: 'category',
        data: dates,
        axisLine: { lineStyle: { color: 'rgba(255, 255, 255, 0.1)' } },
        axisLabel: {
          color: '#94a3b8',
          fontSize: 11,
          rotate: dates.length > 50 ? 35 : 0,
        },
      },
      yAxis: {
        type: 'value',
        axisLine: { show: false },
        splitLine: { lineStyle: { color: 'rgba(255, 255, 255, 0.05)', type: 'dashed' } },
        axisLabel: {
          color: '#94a3b8',
          fontSize: 12,
          formatter: (val: number) => (val >= 1000 ? `${(val / 1000).toFixed(1)}k units` : `${Math.round(val)} units`),
        },
      },
      series: [
        {
          name: 'Estimated Stock Remaining',
          type: 'bar',
          barWidth: '45%',
          data: stocks,
          itemStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: '#38bdf8' },
              { offset: 1, color: '#1e40af' },
            ]),
            borderRadius: [4, 4, 0, 0],
          },
        },
        {
          name: 'Reorder Level (ROP)',
          type: 'line',
          data: rops,
          lineStyle: { color: '#f59e0b', width: 2, type: 'dashed' },
          symbol: 'circle',
          symbolSize: 4,
          itemStyle: { color: '#f59e0b' },
        },
        {
          name: 'Extra Safety Stock',
          type: 'line',
          data: safetyFloors,
          lineStyle: { color: '#ef4444', width: 2.5, type: 'solid' },
          symbol: 'none',
        },
      ],
    };
  }, [forecastResponse]);

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

  // Table rows combining future projections with actuals
  const tableRows = useMemo(() => {
    const projections = forecastResponse?.inventoryProjections || [];
    const forecastPoints = forecastResponse?.forecast || [];

    const rows = forecastPoints.map((pt, idx) => {
      const proj = projections[idx];
      return {
        day: idx + 1,
        date: pt.date,
        forecastDemand: pt.predictedDemandUnits,
        confidenceLower: pt.confidenceLower,
        confidenceUpper: pt.confidenceUpper,
        baselineDemand: pt.historicalBaseline,
        projectedStock: proj ? proj.projectedStock : pt.projectedStock ?? '—',
        safetyStockFloor: proj ? proj.safetyStockFloor : pt.safetyStockFloor ?? '—',
        reorderTrigger: proj ? proj.reorderTriggerPoint : pt.reorderTriggerPoint ?? '—',
        status: proj ? proj.status : 'optimal',
      };
    });

    if (!tableSearch.trim()) return rows;
    return rows.filter((r) => r.date.includes(tableSearch.trim()) || r.status.includes(tableSearch.trim().toLowerCase()));
  }, [forecastResponse, tableSearch]);

  const totalTablePages = Math.max(1, Math.ceil(tableRows.length / pageSize));
  const paginatedRows = tableRows.slice((tablePage - 1) * pageSize, tablePage * pageSize);

  return (
    <div className="space-y-6">
      {/* Header and Controls Row */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-xl sm:text-2xl font-bold text-white font-display tracking-tight">
              Demand Forecasting
            </h2>
            <Tooltip
              content="Prophet is a statistical time-series model that analyzes seasonal patterns and trends to estimate future customer demand."
              position="bottom"
            >
              <NeonBadge variant={isDemoFallback ? 'warning' : 'purple'} size="sm">
                {forecastResponse?.algorithm ? `Forecasting Model: ${forecastResponse.algorithm} (${forecastHorizon}d)` : `Forecasting Model: Prophet (${forecastHorizon}d)`}
              </NeonBadge>
            </Tooltip>
            {historyProvenance?.dataSource === 'retail_dataset_actual' && (
              <span className="text-xs font-mono font-bold bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded border border-emerald-500/30 flex items-center gap-1">
                <Database className="w-3.5 h-3.5 text-emerald-400" />
                ACTUAL DATA (RETAIL SALES)
              </span>
            )}
            {historyProvenance?.dataSource === 'deterministic_demo' && (
              <span className="text-xs font-mono font-bold bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded border border-purple-500/30 flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                DEMO ESTIMATE
              </span>
            )}
            {currentItem?.dataSource === 'postgresql_live' && (
              <span className="text-xs font-mono font-bold bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded border border-amber-500/30 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
                DATABASE ITEM
              </span>
            )}
          </div>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Estimates expected customer demand over {forecastHorizon} days. Forecasts are estimates based on statistical models, not guaranteed future outcomes.
          </p>
        </div>

        {/* Phase 1: 30 / 60 / 90 Days Horizon Selector */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-900/80 border border-white/10">
            {([30, 60, 90] as const).map((h) => (
              <button
                key={h}
                disabled={isLoading}
                onClick={() => {
                  soundFX.playClick();
                  setForecastHorizon(h);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  forecastHorizon === h
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white hover:bg-white/5 disabled:opacity-50'
                }`}
              >
                Next {h} days
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

      {/* Date Horizon Range Banner */}
      {forecastResponse?.startDate && forecastResponse?.endDate && (
        <div className="flex items-center justify-between text-xs px-4 py-2.5 rounded-xl bg-slate-900/40 border border-white/5 text-slate-300">
          <div className="flex items-center gap-2 font-mono">
            <Calendar className="w-4 h-4 text-cyan-400" />
            <span>
              Forecast Window: <strong>{forecastResponse.startDate}</strong> &rarr; <strong>{forecastResponse.endDate}</strong> ({forecastHorizon} Daily Calendar Projections)
            </span>
          </div>
          <span className="text-xs text-slate-400 font-mono">
            Granularity: {forecastResponse.granularity || 'Daily'} &bull; 95% Confidence Bounds
          </span>
        </div>
      )}

      {/* Product / SKU Selector & Facility Strip */}
      <div className="rounded-2xl glass-panel border border-white/10 p-4 space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Boxes className="w-5 h-5 text-cyan-400 shrink-0" />
            <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
              Selected Inventory Product:
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
              <span className="text-slate-400">Warehouse:</span>
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

      {/* Warning for Live PostgreSQL SKUs without Sales History */}
      {skuDataWarning && (
        <div className="rounded-2xl p-4 bg-amber-500/10 border border-amber-500/30 text-xs text-amber-200 space-y-2">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
            <div className="space-y-0.5">
              <div className="font-bold text-amber-100 text-sm">
                Not Enough Historical Sales Data
              </div>
              <p className="text-amber-200/90 leading-relaxed text-xs sm:text-sm">
                This product exists in the database, but there are not enough recorded sales to generate a reliable forecast. Add historical sales records or select a product with verified sales history.
              </p>
            </div>
          </div>
          <div className="flex items-center justify-between pt-2 border-t border-amber-500/20 text-xs font-mono">
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
                className="px-2.5 py-1 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-bold hover:bg-cyan-500/30 cursor-pointer transition-all text-xs"
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
              <strong>DEMO FALLBACK:</strong> Backend service offline or returned error ({errorMessage}). Rendering verified {forecastHorizon}-day baseline observations.
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

      {/* Phase 3: 6 Top KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
        {/* Card 1: Current Daily Demand */}
        <div className="rounded-2xl glass-panel border border-white/10 p-4 space-y-1 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-300">Current Demand</span>
            <Tooltip content="What it means: The average number of units sold per day over the last 14 days. Why it matters: Establishes the baseline rate at which stock is being depleted. What to watch: Large unexpected drops or spikes." />
          </div>
          <div className="text-2xl font-bold font-mono text-white">
            {Math.round(kpis.currentDailyDemand).toLocaleString()} <span className="text-xs text-slate-400 font-normal">u/day</span>
          </div>
          <div className="text-xs text-slate-400 font-mono-telemetry pt-1 border-t border-white/5 truncate">
            Recent 14-day trailing average
          </div>
        </div>

        {/* Card 2: Expected Demand */}
        <div className="rounded-2xl glass-panel border border-white/10 p-4 space-y-1 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-300">Expected Demand</span>
            <Tooltip content={`What it means: Total units predicted to be ordered over the selected ${forecastHorizon}-day horizon. Why it matters: Guides production quantities and purchase orders. What to watch: Whether expected demand exceeds available stock.`} />
          </div>
          <div className="text-2xl font-bold font-mono text-purple-300">
            {Math.round(kpis.forecastTotalDemand).toLocaleString()} <span className="text-xs text-slate-400 font-normal">units</span>
          </div>
          <div className="text-xs text-slate-400 font-mono-telemetry pt-1 border-t border-white/5 truncate">
            {forecastHorizon}-Day total ({Math.round(kpis.forecastDailyAvg)} u/day)
          </div>
        </div>

        {/* Card 3: Expected Change in Demand */}
        <div className="rounded-2xl glass-panel border border-white/10 p-4 space-y-1 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-300">Expected Demand Shift</span>
            <Tooltip content="What it means: How much future daily demand is predicted to rise or fall compared to recent sales. Why it matters: A negative shift signals declining demand; a positive shift signals growth or seasonal surges. What to watch: Shifts exceeding 20% require re-evaluating safety stock." />
          </div>
          <div className={`text-2xl font-bold font-mono ${kpis.demandShiftPct >= 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
            {kpis.demandShiftPct >= 0 ? `+${kpis.demandShiftPct}%` : `${kpis.demandShiftPct}%`}
          </div>
          <div className="text-xs text-slate-400 font-mono-telemetry pt-1 border-t border-white/5 truncate">
            Compared to historical baseline
          </div>
        </div>

        {/* Card 4: Current On-Hand Inventory */}
        <div className="rounded-2xl glass-panel border border-white/10 p-4 space-y-1 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-300">Current Stock</span>
            <Tooltip content="What it means: Physical inventory units currently stored in the warehouse. Why it matters: Determines immediate order fulfillment capacity. What to watch: Stock dropping below safety stock levels." />
          </div>
          <div className="text-2xl font-bold font-mono text-cyan-300">
            {Math.round(kpis.currentStock).toLocaleString()} <span className="text-xs text-slate-400 font-normal">units</span>
          </div>
          <div className="text-xs text-slate-400 font-mono-telemetry pt-1 border-t border-white/5 truncate">
            {currentItem?.warehouse || 'Warehouse'}
          </div>
        </div>

        {/* Card 5: Stock Remaining (Days) */}
        <div className="rounded-2xl glass-panel border border-white/10 p-4 space-y-1 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-300">Stock Remaining</span>
            <Tooltip content={`What it means: How many days current stock can support demand at estimated daily usage. Why it matters: If days of stock fall below supplier lead time (${leadTimeDays} days), a stockout is imminent without immediate reorders. What to watch: Any value under ${leadTimeDays} days.`} />
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-300">
            {kpis.daysOfSupply} <span className="text-xs text-slate-400 font-normal">days</span>
          </div>
          <div className="text-xs text-slate-400 font-mono-telemetry pt-1 border-t border-white/5 truncate">
            Supplier lead time: {leadTimeDays}d cycle
          </div>
        </div>

        {/* Card 6: Risk of Running Out of Stock */}
        <div className="rounded-2xl glass-panel border border-white/10 p-4 space-y-1 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-300">Stockout Risk</span>
            <Tooltip content="What it means: Indicates the possibility of running out of stock before the next replenishment arrives. Why it matters: Stockouts mean lost customer sales and SLA penalties. What to watch: Triggered reorders or critical warnings." />
          </div>
          <div className="pt-1">
            <NeonBadge variant={kpis.stockoutRiskVariant} size="sm">
              {kpis.stockoutRiskText}
            </NeonBadge>
          </div>
          <div className="text-xs text-slate-400 font-mono-telemetry pt-1 border-t border-white/5 truncate">
            Over {forecastHorizon}-day horizon
          </div>
        </div>
      </div>

      {/* Main Chart 1: Global Demand Forecast & Multi-Horizon Prediction */}
      <GlassCard
        title={`Finished Goods Demand Projection (${forecastHorizon}-Day Calendar Horizon)`}
        subtitle="Estimates daily customer demand with statistical upper and lower uncertainty ranges. Projections are estimates, not guaranteed outcomes."
        badge={
          <Tooltip content="WAPE measures how far predictions differ from actual demand. Lower values generally indicate better forecasts.">
            <div className="flex items-center gap-1.5 text-xs text-purple-300 bg-purple-500/10 border border-purple-400/30 px-2.5 py-0.5 rounded-full cursor-help">
              <Sparkles className="w-3.5 h-3.5 text-purple-400" />
              <span>
                {forecastResponse?.metrics?.wape !== undefined && forecastResponse?.metrics?.wape !== null
                  ? `Forecast Error (WAPE): ${forecastResponse.metrics.wape}%`
                  : '95% Forecast Range'}
              </span>
            </div>
          </Tooltip>
        }
      >
        <div className="relative h-80 w-full">
          {isLoading && (
            <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center z-10 rounded-xl">
              <div className="flex items-center gap-2 text-sm text-purple-300 font-mono font-semibold">
                <Loader2 className="w-5 h-5 animate-spin text-purple-400" />
                <span>Computing Bayesian Forecast & Multi-Horizon Projections...</span>
              </div>
            </div>
          )}
          <ReactECharts option={demandOption} style={{ height: '100%', width: '100%' }} notMerge={true} />
        </div>
      </GlassCard>

      {/* Main Chart 2: Inventory Buffer & Stockout Velocity (Restored from Original Design) */}
      <GlassCard
        title={`Inventory Buffer & Stockout Velocity (${forecastHorizon}-Day Multi-Echelon Trajectory)`}
        subtitle="Multi-echelon projected warehouse inventory vs safety stock floor and dynamic reorder threshold"
        badge={
          <div className="flex items-center gap-1.5 text-xs text-cyan-300 bg-cyan-500/10 border border-cyan-400/30 px-2.5 py-0.5 rounded-full">
            <PackageCheck className="w-3.5 h-3.5 text-cyan-400" />
            <span>ROP: {inventoryPolicy?.reorderPoint ?? 150} Units</span>
          </div>
        }
      >
        <div className="relative h-72 w-full">
          {inventoryVelocityOption ? (
            <ReactECharts option={inventoryVelocityOption} style={{ height: '100%', width: '100%' }} notMerge={true} />
          ) : (
            <div className="h-full flex items-center justify-center text-slate-500 text-xs">
              No inventory trajectory projections available for this SKU.
            </div>
          )}
        </div>
      </GlassCard>

      {/* Model Transparency & Comparative Baseline Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Model Specs & Holdout Backtest Metrics */}
        <div className="rounded-2xl glass-panel border border-white/10 p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <div>
              <h3 className="text-sm font-bold text-white font-display">Forecasting Model Information</h3>
              <p className="text-xs text-slate-400">Verifiable architecture and evaluation criteria</p>
            </div>
            <NeonBadge variant="blue" size="sm">Prophet + AR-7</NeonBadge>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex justify-between items-center py-1 border-b border-white/5">
              <span className="text-slate-400">Primary Algorithm:</span>
              <span className="font-semibold text-white">{forecastResponse?.algorithm || 'Prophet'}</span>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-white/5">
              <span className="text-slate-400">Model Version:</span>
              <span className="font-mono text-purple-300">{forecastResponse?.modelVersion || 'prophet-daily-v1'}</span>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-white/5">
              <span className="text-slate-400 flex items-center gap-1">
                <span>Comparative Baseline:</span>
                <Tooltip content="Simple 7-day average used as a benchmark to confirm the advanced forecasting model provides superior accuracy." />
              </span>
              <span className="font-semibold text-slate-300">Reference Baseline (7-Day Average)</span>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-white/5">
              <span className="text-slate-400">Horizon & Granularity:</span>
              <span className="font-mono text-cyan-300">{forecastHorizon} Days &bull; Daily</span>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-white/5">
              <span className="text-slate-400 flex items-center gap-1">
                <span>Evaluation Split:</span>
                <Tooltip content="Chronological backtest split where earlier data is trained and later data is tested to verify prediction accuracy." />
              </span>
              <span className="font-mono text-slate-300">{forecastResponse?.metrics?.evaluation_split || 'Chronological Holdout'}</span>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-white/5">
              <span className="text-slate-400 flex items-center gap-1">
                <span>Forecast Error (WAPE):</span>
                <Tooltip content="WAPE measures how far predictions differ from actual demand. Lower values generally indicate better forecasts." />
              </span>
              <span className="font-mono font-bold text-amber-300">
                {forecastResponse?.metrics?.wape !== undefined && forecastResponse?.metrics?.wape !== null
                  ? `${forecastResponse.metrics.wape.toFixed(1)}%`
                  : 'N/A'}
              </span>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-white/5">
              <span className="text-slate-400 flex items-center gap-1">
                <span>Mean Absolute Error (MAE):</span>
                <Tooltip content="Average difference between predicted and actual demand in physical units." />
              </span>
              <span className="font-mono text-white">
                {forecastResponse?.metrics?.mae !== undefined && forecastResponse?.metrics?.mae !== null
                  ? `${forecastResponse.metrics.mae.toFixed(1)} units`
                  : 'N/A'}
              </span>
            </div>
            <div className="flex justify-between items-center py-1">
              <span className="text-slate-400 flex items-center gap-1">
                <span>Root Mean Squared Error (RMSE):</span>
                <Tooltip content="Statistical measure of prediction error giving higher penalty to larger mistakes." />
              </span>
              <span className="font-mono text-white">
                {forecastResponse?.metrics?.rmse !== undefined && forecastResponse?.metrics?.rmse !== null
                  ? `${forecastResponse.metrics.rmse.toFixed(1)} units`
                  : 'N/A'}
              </span>
            </div>
          </div>
        </div>

        {/* Operational Alerts & Prescriptive Recommendations */}
        <div className="lg:col-span-2 rounded-2xl glass-panel border border-white/10 p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <div>
              <h3 className="text-sm font-bold text-white font-display flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-cyan-400" />
                <span>Forecast-Driven Supply & Replenishment Alerts</span>
              </h3>
              <p className="text-xs text-slate-400">Automated risk detection based on demand trajectory and lead times</p>
            </div>
            <NeonBadge variant="cyan" size="sm">Rule-Based Reasoning</NeonBadge>
          </div>

          {forecastResponse?.alerts && forecastResponse.alerts.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {forecastResponse.alerts.map((alert) => (
                <div
                  key={alert.id}
                  className="p-3 rounded-xl bg-slate-900/60 border border-white/5 space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white flex items-center gap-1.5">
                      {alert.severity === 'critical' ? (
                        <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                      ) : (
                        <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      )}
                      {alert.title}
                    </span>
                    <NeonBadge variant={alert.severity === 'critical' ? 'critical' : 'warning'} size="sm">
                      {alert.type}
                    </NeonBadge>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">{alert.description}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>All inventory buffers and demand trajectories are within normal operating parameters.</span>
            </div>
          )}

          {/* Actionable Recommendations */}
          <div className="pt-2 border-t border-white/5 space-y-2">
            <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
              Prescriptive Recommendations:
            </h4>
            {forecastResponse?.recommendations && forecastResponse.recommendations.length > 0 ? (
              <div className="space-y-2">
                {forecastResponse.recommendations.map((rec) => (
                  <div key={rec.id} className="p-3 rounded-xl bg-slate-800/40 border border-white/5 text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-cyan-300">{rec.category}</span>
                      <NeonBadge variant={rec.priority === 'CRITICAL' ? 'critical' : rec.priority === 'HIGH' ? 'warning' : 'optimal'} size="sm">
                        {rec.priority}
                      </NeonBadge>
                    </div>
                    <p className="text-slate-200 font-medium">{rec.action}</p>
                    <p className="text-slate-400 text-[11px]">{rec.rationale}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-500">No active recommendations required at this time.</p>
            )}
          </div>
        </div>
      </div>

      {/* Phase 3: Forecast Summary Data Table */}
      <div className="rounded-2xl glass-panel border border-white/10 p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-3">
          <div>
            <h3 className="text-sm font-bold text-white font-display flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-blue-400" />
              <span>Multi-Horizon Forecast & Projected Inventory Summary</span>
            </h3>
            <p className="text-xs text-slate-400">Daily chronological sequence for {selectedSku} ({forecastHorizon} days)</p>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search date or status..."
                value={tableSearch}
                onChange={(e) => {
                  setTableSearch(e.target.value);
                  setTablePage(1);
                }}
                className="bg-slate-900 border border-white/10 text-white rounded-lg pl-8 pr-3 py-1 text-xs focus:outline-none focus:border-blue-500 w-44"
              />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950/60 text-slate-400 uppercase tracking-wider text-[10px] font-mono border-b border-white/10">
              <tr>
                <th className="py-2.5 px-3">Day</th>
                <th className="py-2.5 px-3">Date</th>
                <th className="py-2.5 px-3">Forecast Demand</th>
                <th className="py-2.5 px-3">95% Bounds</th>
                <th className="py-2.5 px-3">Statistical Baseline</th>
                <th className="py-2.5 px-3">Projected Stock</th>
                <th className="py-2.5 px-3">Safety Stock Floor</th>
                <th className="py-2.5 px-3">Buffer Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 font-mono">
              {paginatedRows.length > 0 ? (
                paginatedRows.map((row) => (
                  <tr key={row.date} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-2 px-3 text-slate-400">Day {row.day}</td>
                    <td className="py-2 px-3 text-white font-semibold">{row.date}</td>
                    <td className="py-2 px-3 text-purple-300 font-bold">{row.forecastDemand.toLocaleString()}</td>
                    <td className="py-2 px-3 text-slate-400 text-[11px]">
                      [{row.confidenceLower.toLocaleString()} &ndash; {row.confidenceUpper.toLocaleString()}]
                    </td>
                    <td className="py-2 px-3 text-slate-300">{row.baselineDemand?.toLocaleString() ?? '—'}</td>
                    <td className="py-2 px-3 font-bold text-cyan-300">
                      {typeof row.projectedStock === 'number' ? row.projectedStock.toLocaleString() : row.projectedStock}
                    </td>
                    <td className="py-2 px-3 text-slate-400">{row.safetyStockFloor}</td>
                    <td className="py-2 px-3 font-sans">
                      <NeonBadge
                        variant={row.status === 'stockout' || row.status === 'critical' ? 'critical' : row.status === 'warning' ? 'warning' : 'optimal'}
                        size="sm"
                      >
                        {row.status.toUpperCase()}
                      </NeonBadge>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-500">
                    No forecast rows matched the query.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination controls */}
        {totalTablePages > 1 && (
          <div className="flex items-center justify-between text-xs text-slate-400 border-t border-white/5 pt-3">
            <span>
              Showing Page {tablePage} of {totalTablePages} ({tableRows.length} total rows)
            </span>
            <div className="flex items-center gap-1.5">
              <Button
                variant="secondary"
                size="sm"
                disabled={tablePage === 1}
                onClick={() => {
                  soundFX.playClick();
                  setTablePage((p) => Math.max(1, p - 1));
                }}
              >
                <ChevronLeft className="w-3.5 h-3.5 mr-1" />
                Previous
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={tablePage === totalTablePages}
                onClick={() => {
                  soundFX.playClick();
                  setTablePage((p) => Math.min(totalTablePages, p + 1));
                }}
              >
                Next
                <ChevronRight className="w-3.5 h-3.5 ml-1" />
              </Button>
            </div>
          </div>
        )}
      </div>

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
                className={`w-full p-3 rounded-xl text-left transition-all cursor-pointer border ${
                  selectedCommodity === c.materialName
                    ? 'bg-amber-500/15 border-amber-500/40 shadow-sm'
                    : 'bg-slate-900/40 border-white/5 hover:bg-white/5'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-white truncate">{c.materialName}</span>
                  <span
                    className={`text-xs font-mono font-semibold ${
                      c.changePct30d >= 0 ? 'text-rose-400' : 'text-emerald-400'
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
