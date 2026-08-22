import React from 'react';
import ReactECharts from 'echarts-for-react';
import * as echarts from 'echarts';
import { GlassCard } from '../common/GlassCard';
import { InventoryForecastPoint } from '../../types';
import { PackageCheck } from 'lucide-react';

interface InventoryVelocityChartProps {
  data: InventoryForecastPoint[];
}

export const InventoryVelocityChart: React.FC<InventoryVelocityChartProps> = ({ data }) => {
  const weeks = data.map((d) => d.date);
  const stockLevels = data.map((d) => d.projectedStock);
  const safetyStocks = data.map((d) => d.safetyStockLimit);
  const reorders = data.map((d) => d.reorderTriggerPoint);

  const option = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(15, 23, 42, 0.95)',
      borderColor: 'rgba(34, 197, 94, 0.4)',
      borderWidth: 1,
      textStyle: { color: '#f8fafc', fontSize: 12 },
    },
    legend: {
      data: ['Projected Inventory', 'Safety Stock Floor', 'Dynamic Reorder Point'],
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
      data: weeks,
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
        name: 'Projected Inventory',
        type: 'bar',
        barWidth: '38%',
        data: stockLevels,
        itemStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: '#38bdf8' },
            { offset: 1, color: '#1e40af' },
          ]),
          borderRadius: [6, 6, 0, 0],
        },
      },
      {
        name: 'Dynamic Reorder Point',
        type: 'line',
        data: reorders,
        lineStyle: { color: '#f59e0b', width: 2, type: 'dashed' },
        symbol: 'circle',
        symbolSize: 5,
        itemStyle: { color: '#f59e0b' },
      },
      {
        name: 'Safety Stock Floor',
        type: 'line',
        data: safetyStocks,
        lineStyle: { color: '#ef4444', width: 2.5, type: 'solid' },
        symbol: 'none',
      },
    ],
  };

  return (
    <GlassCard
      title="Inventory Buffer & Stockout Velocity"
      subtitle="Multi-echelon safety stock vs reorder automation thresholds"
      badge={
        <div className="flex items-center gap-1.5 text-xs text-cyan-300 bg-cyan-500/10 border border-cyan-400/30 px-2.5 py-0.5 rounded-full">
          <PackageCheck className="w-3.5 h-3.5 text-cyan-400" />
          <span>Buffer Health: 88.4%</span>
        </div>
      }
    >
      <div className="h-72 w-full">
        <ReactECharts option={option} style={{ height: '100%', width: '100%' }} notMerge={true} lazyUpdate={true} />
      </div>
    </GlassCard>
  );
};
