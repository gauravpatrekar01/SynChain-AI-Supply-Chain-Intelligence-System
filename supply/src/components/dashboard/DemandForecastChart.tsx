import React from 'react';
import ReactECharts from 'echarts-for-react';
import * as echarts from 'echarts';
import { GlassCard } from '../common/GlassCard';
import { DemandForecastPoint } from '../../types';
import { Sparkles, TrendingUp } from 'lucide-react';

interface DemandForecastChartProps {
  data: DemandForecastPoint[];
}

export const DemandForecastChart: React.FC<DemandForecastChartProps> = ({ data }) => {
  const dates = data.map((d) => d.date);
  const actuals = data.map((d) => d.actualDemandUnits ?? null);
  const predicted = data.map((d) => d.predictedDemandUnits);
  const lowerBounds = data.map((d) => d.confidenceLower);
  const upperBounds = data.map((d) => d.confidenceUpper);
  const baselines = data.map((d) => d.historicalBaseline);

  const option = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(15, 23, 42, 0.95)',
      borderColor: 'rgba(59, 130, 246, 0.4)',
      borderWidth: 1,
      textStyle: { color: '#f8fafc', fontSize: 12 },
      formatter: (params: any) => {
        let result = `<div class="font-bold text-white mb-1">${params[0].name}</div>`;
        params.forEach((item: any) => {
          if (item.value !== null && item.value !== undefined && item.seriesName !== 'Confidence Band (Lower)') {
            result += `<div class="flex items-center justify-between gap-4 text-xs py-0.5">
              <span style="color:${item.color}">● ${item.seriesName}:</span>
              <span class="font-mono font-semibold text-white">${Number(item.value).toLocaleString()} Units</span>
            </div>`;
          }
        });
        return result;
      },
    },
    legend: {
      data: ['Actual Orders', 'AI Transformer Forecast', 'Historical Baseline', '95% Confidence Upper Band'],
      textStyle: { color: '#94a3b8', fontSize: 11 },
      top: 0,
      right: 10,
      icon: 'roundRect',
    },
    grid: {
      left: '3%',
      right: '3%',
      bottom: '4%',
      top: '16%',
      containLabel: true,
    },
    xAxis: {
      type: 'category',
      data: dates,
      axisLine: { lineStyle: { color: 'rgba(255, 255, 255, 0.1)' } },
      axisLabel: { color: '#94a3b8', fontSize: 11 },
    },
    yAxis: {
      type: 'value',
      axisLine: { show: false },
      splitLine: { lineStyle: { color: 'rgba(255, 255, 255, 0.05)', type: 'dashed' } },
      axisLabel: {
        color: '#94a3b8',
        fontSize: 11,
        formatter: (val: number) => `${(val / 1000).toFixed(0)}k`,
      },
    },
    series: [
      {
        name: 'Historical Baseline',
        type: 'line',
        data: baselines,
        lineStyle: { color: 'rgba(148, 163, 184, 0.4)', type: 'dotted', width: 2 },
        symbol: 'none',
      },
      {
        name: 'Actual Orders',
        type: 'line',
        data: actuals,
        smooth: true,
        symbol: 'circle',
        symbolSize: 6,
        itemStyle: { color: '#3B82F6', borderColor: '#ffffff', borderWidth: 1.5 },
        lineStyle: { color: '#3B82F6', width: 3 },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(59, 130, 246, 0.35)' },
            { offset: 1, color: 'rgba(59, 130, 246, 0.0)' },
          ]),
        },
      },
      {
        name: 'AI Transformer Forecast',
        type: 'line',
        data: predicted,
        smooth: true,
        symbol: 'circle',
        symbolSize: 7,
        itemStyle: { color: '#8B5CF6', borderColor: '#ffffff', borderWidth: 2 },
        lineStyle: {
          color: '#8B5CF6',
          width: 3,
          type: 'solid',
          shadowColor: 'rgba(139, 92, 246, 0.5)',
          shadowBlur: 10,
        },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(139, 92, 246, 0.35)' },
            { offset: 1, color: 'rgba(139, 92, 246, 0.0)' },
          ]),
        },
      },
      {
        name: '95% Confidence Upper Band',
        type: 'line',
        data: upperBounds,
        smooth: true,
        symbol: 'none',
        lineStyle: { color: 'rgba(6, 182, 212, 0.4)', type: 'dashed', width: 1.5 },
      },
    ],
  };

  return (
    <GlassCard
      title="Global Demand Forecast & AI Prediction (ARIMA + Transformer)"
      subtitle="180-day forecast projection across all production product lines"
      badge={
        <div className="flex items-center gap-1.5 text-xs text-purple-300 bg-purple-500/15 border border-purple-400/30 px-2.5 py-0.5 rounded-full">
          <Sparkles className="w-3.5 h-3.5 text-purple-400" />
          <span>98.4% Confidence Model</span>
        </div>
      }
      headerAction={
        <div className="flex items-center gap-2 text-xs text-slate-400 font-mono-telemetry">
          <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
          <span>Demand Velocity: +14.2% Q4</span>
        </div>
      }
    >
      <div className="h-72 w-full">
        <ReactECharts option={option} style={{ height: '100%', width: '100%' }} notMerge={true} lazyUpdate={true} />
      </div>
    </GlassCard>
  );
};
