import React from 'react';
import ReactECharts from 'echarts-for-react';
import { GlassCard } from '../common/GlassCard';
import { Activity } from 'lucide-react';

export const MaterialSankeyChart: React.FC = () => {
  const option = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'item',
      triggerOn: 'mousemove',
      backgroundColor: 'rgba(15, 23, 42, 0.95)',
      borderColor: 'rgba(6, 182, 212, 0.4)',
      borderWidth: 1,
      textStyle: { color: '#f8fafc', fontSize: 12 },
    },
    series: [
      {
        type: 'sankey',
        layout: 'none',
        emphasis: { focus: 'adjacency' },
        lineStyle: {
          color: 'gradient',
          curveness: 0.5,
          opacity: 0.4,
        },
        itemStyle: {
          borderWidth: 1,
          borderColor: 'rgba(255, 255, 255, 0.2)',
        },
        label: {
          color: '#cbd5e1',
          fontSize: 11,
          fontFamily: 'Inter',
        },
        data: [
          // Tier-2 Raw Materials
          { name: 'TSMC Fabs (Wafer)', itemStyle: { color: '#8B5CF6' } },
          { name: 'SK Hynix (Memory)', itemStyle: { color: '#3B82F6' } },
          { name: 'BASF (Polymers)', itemStyle: { color: '#06B6D4' } },

          // Tier-1 Assembly
          { name: 'Foxconn SZX', itemStyle: { color: '#3B82F6' } },
          { name: 'Bosch Stuttgart', itemStyle: { color: '#10B981' } },
          { name: 'Denso Nagoya', itemStyle: { color: '#06B6D4' } },

          // Factories
          { name: 'Giga Austin Plant', itemStyle: { color: '#22C55E' } },
          { name: 'Munich Mega Assembly', itemStyle: { color: '#10B981' } },
          { name: 'Shanghai Factory 3', itemStyle: { color: '#F59E0B' } },

          // Warehouses & Customers
          { name: 'Memphis SuperHub', itemStyle: { color: '#3B82F6' } },
          { name: 'Rotterdam EuroHub', itemStyle: { color: '#10B981' } },
          { name: 'Enterprise Clients US', itemStyle: { color: '#22C55E' } },
          { name: 'Enterprise Clients EU', itemStyle: { color: '#06B6D4' } },
        ],
        links: [
          { source: 'TSMC Fabs (Wafer)', target: 'Foxconn SZX', value: 45 },
          { source: 'TSMC Fabs (Wafer)', target: 'Bosch Stuttgart', value: 20 },
          { source: 'SK Hynix (Memory)', target: 'Foxconn SZX', value: 50 },
          { source: 'SK Hynix (Memory)', target: 'Denso Nagoya', value: 30 },
          { source: 'BASF (Polymers)', target: 'Bosch Stuttgart', value: 15 },

          { source: 'Foxconn SZX', target: 'Giga Austin Plant', value: 65 },
          { source: 'Foxconn SZX', target: 'Shanghai Factory 3', value: 30 },
          { source: 'Bosch Stuttgart', target: 'Munich Mega Assembly', value: 35 },
          { source: 'Denso Nagoya', target: 'Giga Austin Plant', value: 30 },

          { source: 'Giga Austin Plant', target: 'Memphis SuperHub', value: 95 },
          { source: 'Munich Mega Assembly', target: 'Rotterdam EuroHub', value: 35 },
          { source: 'Shanghai Factory 3', target: 'Memphis SuperHub', value: 30 },

          { source: 'Memphis SuperHub', target: 'Enterprise Clients US', value: 125 },
          { source: 'Rotterdam EuroHub', target: 'Enterprise Clients EU', value: 35 },
        ],
      },
    ],
  };

  return (
    <GlassCard
      title="End-to-End Component & Material Flow Sankey"
      subtitle="Visualizing volume distribution across Tier-2, Tier-1, Gigafactories, and Hubs"
      badge={
        <div className="flex items-center gap-1.5 text-xs text-emerald-300 bg-emerald-500/10 border border-emerald-400/30 px-2.5 py-0.5 rounded-full">
          <Activity className="w-3.5 h-3.5 text-emerald-400" />
          <span>Real-time Throughput: 160k units/wk</span>
        </div>
      }
    >
      <div className="h-72 w-full">
        <ReactECharts option={option} style={{ height: '100%', width: '100%' }} notMerge={true} lazyUpdate={true} />
      </div>
    </GlassCard>
  );
};
