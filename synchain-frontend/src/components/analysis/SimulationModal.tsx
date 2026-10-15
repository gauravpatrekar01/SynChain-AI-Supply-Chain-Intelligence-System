import React, { useState, useEffect } from 'react';
import ReactECharts from 'echarts-for-react';
import {
  Play,
  RotateCcw,
  Sparkles,
  AlertTriangle,
  Clock,
  TrendingDown,
  DollarSign,
  Package,
  Layers,
  ArrowRight,
} from 'lucide-react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { NeonBadge } from '../common/NeonBadge';
import { apiService } from '../../services/api';
import { soundFX } from '../../services/audioService';
import { formatApiError } from '../../utils/errorFormatter';
import {
  AnalysisSimulationRequest,
  AnalysisSimulationResponse,
} from '../../types/analysis';

interface SimulationModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultSku?: string;
  defaultInventory?: number;
  defaultDailyDemand?: number;
}

export const SimulationModal: React.FC<SimulationModalProps> = ({
  isOpen,
  onClose,
  defaultSku,
  defaultInventory = 500,
  defaultDailyDemand = 100,
}) => {
  const [form, setForm] = useState<AnalysisSimulationRequest>({
    current_inventory: defaultInventory,
    daily_demand: defaultDailyDemand,
    shipment_delay_days: 8,
    original_lead_time_days: 5,
    replenishment_quantity: 800,
    alternative_supplier_lead_time_days: 4,
    alternative_procurement_cost_premium_pct: 15,
    expedite_transit_reduction_days: 4,
    expedite_cost_usd: 1500,
    unit_stockout_penalty_usd: 60,
    unit_cost_usd: 30,
    product_sku: defaultSku || 'SKU-INV-ALPHA',
  });

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisSimulationResponse | null>(null);

  const runSimulation = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      soundFX.playClick();
      const res = await apiService.runAnalysisSimulation(form);
      setResult(res);
      soundFX.playSuccess();
    } catch (err: any) {
      soundFX.playError();
      setErrorMessage(formatApiError(err, 'Failed to execute disruption scenario simulation.'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      runSimulation();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Chart configuration
  const trajectoryOption = result
    ? {
        backgroundColor: 'transparent',
        tooltip: {
          trigger: 'axis',
          backgroundColor: '#0f172a',
          borderColor: '#334155',
          textStyle: { color: '#f8fafc', fontSize: 12 },
        },
        legend: {
          data: ['Scenario A (Wait)', 'Scenario B (Alternative)', 'Scenario C (Expedite)'],
          textStyle: { color: '#94a3b8' },
          top: 0,
        },
        grid: {
          top: 40,
          left: 45,
          right: 20,
          bottom: 30,
        },
        xAxis: {
          type: 'category',
          data: result.trajectories.map((t) => `Day ${t.day}`),
          axisLine: { lineStyle: { color: '#334155' } },
          axisLabel: { color: '#94a3b8', fontSize: 11 },
        },
        yAxis: {
          type: 'value',
          name: 'Inventory Units',
          nameTextStyle: { color: '#64748b', fontSize: 10 },
          splitLine: { lineStyle: { color: '#1e293b' } },
          axisLabel: { color: '#94a3b8', fontSize: 11 },
        },
        series: [
          {
            name: 'Scenario A (Wait)',
            type: 'line',
            data: result.trajectories.map((t) => t.scenario_a_wait_stock),
            color: '#f43f5e',
            smooth: true,
            lineStyle: { width: 2.5 },
          },
          {
            name: 'Scenario B (Alternative)',
            type: 'line',
            data: result.trajectories.map((t) => t.scenario_b_alt_stock),
            color: '#06b6d4',
            smooth: true,
            lineStyle: { width: 2.5 },
          },
          {
            name: 'Scenario C (Expedite)',
            type: 'line',
            data: result.trajectories.map((t) => t.scenario_c_expedite_stock),
            color: '#a855f7',
            smooth: true,
            lineStyle: { width: 2.5 },
          },
        ],
      }
    : null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Disruption Scenario Simulation (Wait vs Alternative vs Expedite)"
      size="2xl"
    >
      <div className="space-y-6 text-sm">
        {errorMessage && (
          <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Input Parameter Form */}
        <div className="p-4 rounded-xl bg-slate-900/60 border border-white/10 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-xs uppercase font-mono tracking-wider text-slate-300 font-semibold flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-blue-400" />
              Disruption Simulation Parameters
            </h4>
            <span className="text-xs text-slate-400 font-mono">Target: {form.product_sku}</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="text-[11px] text-slate-400 block mb-1">Current Inventory</label>
              <input
                type="number"
                min="0"
                value={form.current_inventory}
                onChange={(e) => setForm({ ...form, current_inventory: Number(e.target.value) })}
                className="w-full px-2.5 py-1.5 rounded-lg bg-slate-800/80 border border-white/10 text-white font-mono text-xs focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="text-[11px] text-slate-400 block mb-1">Daily Demand</label>
              <input
                type="number"
                min="1"
                value={form.daily_demand}
                onChange={(e) => setForm({ ...form, daily_demand: Number(e.target.value) })}
                className="w-full px-2.5 py-1.5 rounded-lg bg-slate-800/80 border border-white/10 text-white font-mono text-xs focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="text-[11px] text-slate-400 block mb-1">Shipment Delay (Days)</label>
              <input
                type="number"
                min="0"
                value={form.shipment_delay_days}
                onChange={(e) => setForm({ ...form, shipment_delay_days: Number(e.target.value) })}
                className="w-full px-2.5 py-1.5 rounded-lg bg-slate-800/80 border border-white/10 text-white font-mono text-xs focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="text-[11px] text-slate-400 block mb-1">Replenishment Qty</label>
              <input
                type="number"
                min="1"
                value={form.replenishment_quantity}
                onChange={(e) => setForm({ ...form, replenishment_quantity: Number(e.target.value) })}
                className="w-full px-2.5 py-1.5 rounded-lg bg-slate-800/80 border border-white/10 text-white font-mono text-xs focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="text-[11px] text-slate-400 block mb-1">Alt Supplier Lead (Days)</label>
              <input
                type="number"
                min="1"
                value={form.alternative_supplier_lead_time_days}
                onChange={(e) => setForm({ ...form, alternative_supplier_lead_time_days: Number(e.target.value) })}
                className="w-full px-2.5 py-1.5 rounded-lg bg-slate-800/80 border border-white/10 text-white font-mono text-xs focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="text-[11px] text-slate-400 block mb-1">Alt Price Premium (%)</label>
              <input
                type="number"
                min="0"
                value={form.alternative_procurement_cost_premium_pct}
                onChange={(e) => setForm({ ...form, alternative_procurement_cost_premium_pct: Number(e.target.value) })}
                className="w-full px-2.5 py-1.5 rounded-lg bg-slate-800/80 border border-white/10 text-white font-mono text-xs focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="text-[11px] text-slate-400 block mb-1">Expedite Fee ($)</label>
              <input
                type="number"
                min="0"
                value={form.expedite_cost_usd}
                onChange={(e) => setForm({ ...form, expedite_cost_usd: Number(e.target.value) })}
                className="w-full px-2.5 py-1.5 rounded-lg bg-slate-800/80 border border-white/10 text-white font-mono text-xs focus:outline-none focus:border-blue-500"
              />
            </div>
            <div className="flex items-end">
              <Button
                variant="primary"
                onClick={runSimulation}
                isLoading={isLoading}
                className="w-full text-xs h-[34px]"
              >
                <Play className="w-3.5 h-3.5 mr-1" />
                Simulate
              </Button>
            </div>
          </div>
        </div>

        {/* Advisory Recommendation Banner */}
        {result && (
          <div className="p-4 rounded-xl bg-gradient-to-r from-blue-900/40 via-purple-900/30 to-slate-900/50 border border-blue-500/30 flex items-start gap-3">
            <Sparkles className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5 animate-pulse" />
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-cyan-300 font-mono">
                Prescriptive Decision Analysis
              </p>
              <p className="text-sm text-slate-100 font-medium mt-0.5">
                {result.advisory_recommendation}
              </p>
            </div>
          </div>
        )}

        {/* 30-Day Trajectory Chart */}
        {trajectoryOption && (
          <div className="p-4 rounded-xl bg-slate-900/50 border border-white/10">
            <h4 className="text-xs uppercase font-mono tracking-wider text-slate-300 font-semibold mb-3">
              30-Day Projected Daily Inventory Trajectories
            </h4>
            <div className="h-64 w-full">
              <ReactECharts option={trajectoryOption} style={{ height: '100%', width: '100%' }} notMerge={true} />
            </div>
          </div>
        )}

        {/* Side-by-Side Comparison Cards */}
        {result && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Scenario A */}
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-rose-300">Scenario A: Wait</span>
                <NeonBadge variant="critical" size="sm">Delayed</NeonBadge>
              </div>
              <p className="text-[11px] text-slate-400">Arrives on Day {result.scenario_a_wait.replenishment_day}</p>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between text-slate-300">
                  <span>Stockout Day:</span>
                  <span className="font-mono text-rose-400 font-semibold">
                    {result.scenario_a_wait.stockout_day ? `Day ${result.scenario_a_wait.stockout_day}` : 'None'}
                  </span>
                </div>
                <div className="flex justify-between text-slate-300">
                  <span>Unmet Demand:</span>
                  <span className="font-mono text-rose-400">{result.scenario_a_wait.total_unmet_demand} units</span>
                </div>
                <div className="flex justify-between text-slate-300 border-t border-white/5 pt-1 font-semibold">
                  <span>Total Financial Impact:</span>
                  <span className="font-mono text-white">${result.scenario_a_wait.total_financial_impact_usd.toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* Scenario B */}
            <div className="p-3.5 rounded-xl bg-cyan-500/10 border border-cyan-500/20 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-cyan-300">Scenario B: Alternative</span>
                <NeonBadge variant="cyan" size="sm">Alt Supplier</NeonBadge>
              </div>
              <p className="text-[11px] text-slate-400">Arrives on Day {result.scenario_b_alternative.replenishment_day}</p>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between text-slate-300">
                  <span>Stockout Day:</span>
                  <span className="font-mono text-cyan-400 font-semibold">
                    {result.scenario_b_alternative.stockout_day ? `Day ${result.scenario_b_alternative.stockout_day}` : 'None'}
                  </span>
                </div>
                <div className="flex justify-between text-slate-300">
                  <span>Unmet Demand:</span>
                  <span className="font-mono text-cyan-400">{result.scenario_b_alternative.total_unmet_demand} units</span>
                </div>
                <div className="flex justify-between text-slate-300 border-t border-white/5 pt-1 font-semibold">
                  <span>Total Financial Impact:</span>
                  <span className="font-mono text-white">${result.scenario_b_alternative.total_financial_impact_usd.toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* Scenario C */}
            <div className="p-3.5 rounded-xl bg-purple-500/10 border border-purple-500/20 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-purple-300">Scenario C: Expedite</span>
                <NeonBadge variant="purple" size="sm">Fast Freight</NeonBadge>
              </div>
              <p className="text-[11px] text-slate-400">Arrives on Day {result.scenario_c_expedite.replenishment_day}</p>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between text-slate-300">
                  <span>Stockout Day:</span>
                  <span className="font-mono text-purple-400 font-semibold">
                    {result.scenario_c_expedite.stockout_day ? `Day ${result.scenario_c_expedite.stockout_day}` : 'None'}
                  </span>
                </div>
                <div className="flex justify-between text-slate-300">
                  <span>Unmet Demand:</span>
                  <span className="font-mono text-purple-400">{result.scenario_c_expedite.total_unmet_demand} units</span>
                </div>
                <div className="flex justify-between text-slate-300 border-t border-white/5 pt-1 font-semibold">
                  <span>Total Financial Impact:</span>
                  <span className="font-mono text-white">${result.scenario_c_expedite.total_financial_impact_usd.toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Footer Action */}
        <div className="flex justify-end pt-2">
          <Button variant="secondary" onClick={onClose}>
            Close Simulation
          </Button>
        </div>
      </div>
    </Modal>
  );
};
