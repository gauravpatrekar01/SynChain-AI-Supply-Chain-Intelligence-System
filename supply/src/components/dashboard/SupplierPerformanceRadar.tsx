import React from 'react';
import ReactECharts from 'echarts-for-react';
import { GlassCard } from '../common/GlassCard';
import { ShieldCheck } from 'lucide-react';

export const SupplierPerformanceRadar: React.FC = () => {
  const option = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'item',
      backgroundColor: 'rgba(15, 23, 42, 0.95)',
      borderColor: 'rgba(139, 92, 246, 0.4)',
      borderWidth: 1,
      textStyle: { color: '#f8fafc', fontSize: 12 },
    },
    legend: {
      data: ['Tier-1 Assemblers', 'Tier-2 Wafer Fabs', 'Global Benchmark'],
      textStyle: { color: '#94a3b8', fontSize: 11 },
      top: 0,
      right: 10,
      icon: 'circle',
    },
    radar: {
      indicator: [
        { name: 'On-Time SLA', max: 100 },
        { name: 'Yield Quality', max: 100 },
        { name: 'ESG & Clean Energy', max: 100 },
        { name: 'Cost Efficiency', max: 100 },
        { name: 'Lead Time Agility', max: 100 },
        { name: 'Disruption Resilience', max: 100 },
      ],
      shape: 'polygon',
      splitNumber: 4,
      axisName: {
        color: '#cbd5e1',
        fontSize: 11,
        fontWeight: '500',
      },
      splitLine: {
        lineStyle: {
          color: ['rgba(255, 255, 255, 0.05)', 'rgba(255, 255, 255, 0.08)', 'rgba(255, 255, 255, 0.12)', 'rgba(59, 130, 246, 0.25)'],
        },
      },
      splitArea: {
        show: true,
        areaStyle: {
          color: ['rgba(15, 23, 42, 0.3)', 'rgba(15, 23, 42, 0.5)'],
        },
      },
      axisLine: {
        lineStyle: {
          color: 'rgba(255, 255, 255, 0.1)',
        },
      },
    },
    series: [
      {
        name: 'Supplier Performance',
        type: 'radar',
        data: [
          {
            value: [94, 98, 88, 86, 92, 95],
            name: 'Tier-1 Assemblers',
            symbol: 'circle',
            symbolSize: 4,
            itemStyle: { color: '#3B82F6' },
            lineStyle: { width: 2.5, color: '#3B82F6' },
            areaStyle: { color: 'rgba(59, 130, 246, 0.25)' },
          },
          {
            value: [88, 96, 82, 79, 74, 68],
            name: 'Tier-2 Wafer Fabs',
            symbol: 'circle',
            symbolSize: 4,
            itemStyle: { color: '#8B5CF6' },
            lineStyle: { width: 2.5, color: '#8B5CF6' },
            areaStyle: { color: 'rgba(139, 92, 246, 0.25)' },
          },
          {
            value: [78, 82, 70, 75, 70, 72],
            name: 'Global Benchmark',
            symbol: 'none',
            itemStyle: { color: '#64748b' },
            lineStyle: { width: 1.5, type: 'dashed', color: '#64748b' },
          },
        ],
      },
    ],
  };

  return (
    <GlassCard
      title="Multi-Tier Supplier Performance & Resilience Radar"
      subtitle="Comprehensive 6-dimensional health evaluation across 248 partners"
      badge={
        <div className="flex items-center gap-1.5 text-xs text-blue-300 bg-blue-500/10 border border-blue-400/30 px-2.5 py-0.5 rounded-full">
          <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
          <span>Composite Score: 92.4</span>
        </div>
      }
    >
      <div className="h-72 w-full">
        <ReactECharts option={option} style={{ height: '100%', width: '100%' }} notMerge={true} lazyUpdate={true} />
      </div>
    </GlassCard>
  );
};
