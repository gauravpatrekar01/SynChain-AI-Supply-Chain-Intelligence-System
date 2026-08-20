import React, { useState } from 'react';
import ReactECharts from 'echarts-for-react';
import * as echarts from 'echarts';
import { useSupplyChain } from '../../context/SupplyChainContext';
import { GlassCard } from '../common/GlassCard';
import { NeonBadge } from '../common/NeonBadge';
import { TrendingUp, Sparkles, Sliders, Calendar, PackageCheck, DollarSign } from 'lucide-react';
import { soundFX } from '../../services/audioService';

export const ForecastView: React.FC = () => {
  const { demandForecast, inventoryForecast, commodityPrices } = useSupplyChain();
  const [forecastHorizon, setForecastHorizon] = useState<30 | 60 | 90 | 180>(90);
  const [selectedCommodity, setSelectedCommodity] = useState<string>('Lithium Hydroxide (Battery Grade)');

  // Filter demand by horizon
  const slicedDemand = demandForecast.slice(0, forecastHorizon === 30 ? 4 : forecastHorizon === 60 ? 8 : forecastHorizon === 90 ? 12 : demandForecast.length);

  // Commodity chart option
  const currentCommodityData = commodityPrices.find((c) => c.materialName === selectedCommodity) || commodityPrices[0];
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
      data: currentCommodityData.historicalDates,
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
          <div className="flex items-center gap-2">
            <h2 className="text-xl sm:text-2xl font-bold text-white font-display tracking-tight">
              Predictive AI Forecast Center
            </h2>
            <NeonBadge variant="purple" size="sm">
              ARIMA + TRANSFORMER
            </NeonBadge>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Multi-horizon demand forecasting, safety stock buffer projection, and global commodity price trends.
          </p>
        </div>

        {/* Horizon Selector */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-900/80 border border-white/10">
          {([30, 60, 90, 180] as const).map((h) => (
            <button
              key={h}
              onClick={() => {
                soundFX.playClick();
                setForecastHorizon(h);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                forecastHorizon === h
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              {h} Days
            </button>
          ))}
        </div>
      </div>

      {/* Demand Chart */}
      <GlassCard
        title={`Global Finished Goods Demand Projection (${forecastHorizon}-Day Horizon)`}
        subtitle="Transformer neural model cross-referenced with seasonal ordering trends"
        badge={
          <div className="flex items-center gap-1.5 text-xs text-purple-300 bg-purple-500/10 border border-purple-400/30 px-2.5 py-0.5 rounded-full">
            <Sparkles className="w-3.5 h-3.5 text-purple-400" />
            <span>Mean Absolute Error: 2.1%</span>
          </div>
        }
      >
        <div className="h-80 w-full">
          <ReactECharts option={demandOption} style={{ height: '100%', width: '100%' }} notMerge={true} />
        </div>
      </GlassCard>

      {/* Commodity & Material Price Trends */}
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
