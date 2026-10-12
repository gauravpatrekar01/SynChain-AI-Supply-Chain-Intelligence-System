import React from 'react';
import ReactECharts from 'echarts-for-react';
import { PieChart, BarChart2 } from 'lucide-react';
import { DashboardTrendsData } from '../../types';

interface DynamicChartsSectionProps {
  trends: DashboardTrendsData | null;
}

export const DynamicChartsSection: React.FC<DynamicChartsSectionProps> = ({ trends }) => {
  if (!trends) return null;

  // 1. Risk Severity Distribution Donut Chart Option
  const severityDist = trends.riskSeverityDistribution || { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 };
  const pieData = [
    { value: severityDist.LOW || 0, name: 'Low Risk', itemStyle: { color: '#10b981' } },
    { value: severityDist.MEDIUM || 0, name: 'Medium Risk', itemStyle: { color: '#f59e0b' } },
    { value: severityDist.HIGH || 0, name: 'High Risk', itemStyle: { color: '#f97316' } },
    { value: severityDist.CRITICAL || 0, name: 'Critical Risk', itemStyle: { color: '#f43f5e' } },
  ];

  const totalRisks = pieData.reduce((acc, curr) => acc + curr.value, 0);

  const pieOption = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'item',
      backgroundColor: 'rgba(15, 23, 42, 0.95)',
      borderColor: 'rgba(59, 130, 246, 0.4)',
      borderWidth: 1,
      textStyle: { color: '#f8fafc', fontSize: 12 },
      formatter: '{b}: <span style="font-weight:bold;color:#60a5fa">{c} nodes</span> ({d}%)',
    },
    legend: {
      bottom: '5%',
      left: 'center',
      textStyle: { color: '#94a3b8', fontSize: 11 },
      itemWidth: 12,
      itemHeight: 12,
      itemGap: 16,
    },
    series: [
      {
        name: 'Risk Severity',
        type: 'pie',
        radius: ['52%', '72%'],
        center: ['50%', '45%'],
        avoidLabelOverlap: false,
        itemStyle: {
          borderRadius: 8,
          borderColor: '#0f172a',
          borderWidth: 3,
        },
        label: {
          show: false,
          position: 'center',
        },
        emphasis: {
          label: {
            show: true,
            fontSize: 14,
            fontWeight: 'bold',
            color: '#ffffff',
            formatter: '{b}\n{c} ({d}%)',
          },
          itemStyle: {
            shadowBlur: 10,
            shadowOffsetX: 0,
            shadowColor: 'rgba(0, 0, 0, 0.5)',
          },
        },
        data: pieData,
      },
    ],
  };

  // 2. Ingestion Trends Over Time Area Chart Option
  const dates = (trends.ingestionTrend || []).map((t) => t.date);
  const counts = (trends.ingestionTrend || []).map((t) => t.recordsIngested);

  const areaOption = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(15, 23, 42, 0.95)',
      borderColor: 'rgba(99, 102, 241, 0.4)',
      borderWidth: 1,
      textStyle: { color: '#f8fafc', fontSize: 12 },
      formatter: (params: any) => {
        if (!params || !params[0]) return '';
        const item = params[0];
        return `<div class="font-bold text-white mb-1">${item.name}</div>
          <div class="flex items-center justify-between gap-4 text-xs">
            <span style="color:#818cf8">● Records Ingested:</span>
            <span class="font-mono font-semibold text-white">${Number(item.value).toLocaleString()} records</span>
          </div>`;
      },
    },
    grid: {
      top: '15%',
      left: '3%',
      right: '4%',
      bottom: '10%',
      containLabel: true,
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: dates,
      axisLine: { lineStyle: { color: '#334155' } },
      axisLabel: { color: '#94a3b8', fontSize: 10 },
      splitLine: { show: false },
    },
    yAxis: {
      type: 'value',
      axisLine: { show: false },
      axisLabel: { color: '#94a3b8', fontSize: 10 },
      splitLine: { lineStyle: { color: '#1e293b', type: 'dashed' } },
    },
    series: [
      {
        name: 'Records Ingested',
        type: 'line',
        smooth: true,
        symbol: 'circle',
        symbolSize: 6,
        itemStyle: { color: '#6366f1' },
        lineStyle: { width: 3, color: '#6366f1' },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(99, 102, 241, 0.35)' },
              { offset: 1, color: 'rgba(99, 102, 241, 0.0)' },
            ],
          },
        },
        data: counts,
      },
    ],
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Risk Severity Donut Chart */}
      <div className="p-6 rounded-2xl bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 shadow-2xl flex flex-col justify-between">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400">
              <PieChart className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-100 text-sm tracking-tight">Risk Severity Distribution</h3>
              <p className="text-xs text-slate-400">Classification across suppliers &amp; SKU inventory</p>
            </div>
          </div>
          <span className="text-xs font-mono px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300 border border-slate-700">
            {totalRisks} Monitored
          </span>
        </div>

        <div className="relative py-2">
          <ReactECharts option={pieOption} style={{ height: '260px', width: '100%' }} />
        </div>

        <div className="pt-3 border-t border-slate-800/60 text-[11px] text-slate-400 flex items-center justify-between">
          <span>Inference: XGBoost Risk Classifier</span>
          <span className="text-slate-300 font-mono">Live Ingested Entities</span>
        </div>
      </div>

      {/* Ingestion Velocity Chart */}
      <div className="p-6 rounded-2xl bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 shadow-2xl flex flex-col justify-between">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
              <BarChart2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-100 text-sm tracking-tight">Canonical Ingestion Velocity</h3>
              <p className="text-xs text-slate-400">Daily normalized records synchronized to PostgreSQL</p>
            </div>
          </div>
          <span className="text-xs font-mono px-2.5 py-1 rounded-lg bg-slate-800 text-indigo-300 border border-indigo-500/20">
            Time-Series
          </span>
        </div>

        <div className="relative py-2">
          <ReactECharts option={areaOption} style={{ height: '260px', width: '100%' }} />
        </div>

        <div className="pt-3 border-t border-slate-800/60 text-[11px] text-slate-400 flex items-center justify-between">
          <span>Source: DataImports &amp; ImportedRecords</span>
          <span className="text-indigo-400 font-mono">Validated</span>
        </div>
      </div>
    </div>
  );
};
