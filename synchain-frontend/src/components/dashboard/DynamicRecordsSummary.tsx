import React from 'react';
import { Database, Package, Truck, Warehouse, Boxes, ShoppingCart, ArrowRight } from 'lucide-react';
import { DashboardOverviewData } from '../../types';

interface DynamicRecordsSummaryProps {
  overview: DashboardOverviewData | null;
  onNavigate: (pageId: string) => void;
}

export const DynamicRecordsSummary: React.FC<DynamicRecordsSummaryProps> = ({ overview, onNavigate }) => {
  if (!overview) return null;

  return (
    <div className="p-6 rounded-2xl bg-gradient-to-br from-slate-900/90 via-slate-900/70 to-indigo-950/30 backdrop-blur-xl border border-slate-800/80 shadow-2xl relative overflow-hidden">
      {/* Decorative Glow */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />

      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
              Canonical Data Ingestion Pipeline
            </span>
            <span className="text-xs text-slate-400 font-mono">
              Last validated: {new Date(overview.lastUpdated).toLocaleTimeString()}
            </span>
          </div>

          <h2 className="text-2xl font-bold text-white tracking-tight mt-2 flex items-baseline gap-3">
            <span>{overview.totalRecordsIngested.toLocaleString()}</span>
            <span className="text-sm font-normal text-slate-400">Total Canonical Records Ingested</span>
          </h2>
          <p className="text-xs text-slate-400 max-w-2xl mt-1 leading-relaxed">
            Normalized across multi-source CSV files, Excel spreadsheets, ERPNext operational databases, and API feeds
            into SynChain AI canonical schema.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => onNavigate('ingestion')}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700/80 shadow-md transition-all cursor-pointer hover:text-white hover:border-slate-600 active:scale-95"
          >
            <Database className="w-4 h-4 text-blue-400" />
            Upload SCM Data File
            <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
          </button>
        </div>
      </div>

      {/* Grid of 5 Canonical Entities */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5 mt-6 pt-6 border-t border-slate-800/80 relative z-10">
        <div className="p-3.5 rounded-xl bg-slate-950/40 border border-slate-800/60 hover:border-blue-500/40 transition-colors">
          <div className="flex items-center gap-2 text-xs text-slate-400 font-medium">
            <Package className="w-4 h-4 text-blue-400" />
            Products (SKUs)
          </div>
          <div className="text-lg font-bold text-slate-100 font-mono mt-1.5">
            {overview.productsCount.toLocaleString()}
          </div>
          <span className="text-[10px] text-slate-400">Catalog SKUs</span>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-950/40 border border-slate-800/60 hover:border-indigo-500/40 transition-colors">
          <div className="flex items-center gap-2 text-xs text-slate-400 font-medium">
            <Truck className="w-4 h-4 text-indigo-400" />
            Active Suppliers
          </div>
          <div className="text-lg font-bold text-slate-100 font-mono mt-1.5">
            {overview.suppliersCount.toLocaleString()}
          </div>
          <span className="text-[10px] text-slate-400">Tier-1 &amp; Tier-2</span>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-950/40 border border-slate-800/60 hover:border-cyan-500/40 transition-colors">
          <div className="flex items-center gap-2 text-xs text-slate-400 font-medium">
            <Warehouse className="w-4 h-4 text-cyan-400" />
            Warehouses
          </div>
          <div className="text-lg font-bold text-slate-100 font-mono mt-1.5">
            {overview.warehousesCount.toLocaleString()}
          </div>
          <span className="text-[10px] text-slate-400">Global Hubs</span>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-950/40 border border-slate-800/60 hover:border-emerald-500/40 transition-colors">
          <div className="flex items-center gap-2 text-xs text-slate-400 font-medium">
            <Boxes className="w-4 h-4 text-emerald-400" />
            Inventory Units
          </div>
          <div className="text-lg font-bold text-slate-100 font-mono mt-1.5">
            {overview.inventoryUnitsTotal.toLocaleString()}
          </div>
          <span className="text-[10px] text-slate-400">${(overview.totalInventoryValueUsd / 1000).toFixed(1)}k Value</span>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-950/40 border border-slate-800/60 hover:border-purple-500/40 transition-colors">
          <div className="flex items-center gap-2 text-xs text-slate-400 font-medium">
            <ShoppingCart className="w-4 h-4 text-purple-400" />
            Customer Orders
          </div>
          <div className="text-lg font-bold text-slate-100 font-mono mt-1.5">
            {overview.ordersCount.toLocaleString()}
          </div>
          <span className="text-[10px] text-slate-400">{overview.onTimeDeliveryRate}% On-Time</span>
        </div>
      </div>
    </div>
  );
};
