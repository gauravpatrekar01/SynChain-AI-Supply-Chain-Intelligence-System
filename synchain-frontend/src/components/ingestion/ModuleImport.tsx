import React, { useRef, useState } from 'react';
import { UploadCloud, X } from 'lucide-react';
import { DataIngestionView, Dataset } from './DataIngestionView';
import { Button } from '../common/Button';

const CONFIG: Record<string, [string, Dataset]> = {
  dashboard: ['AI Command Center', 'inventory'], 'digital-twin': ['Digital Twin', 'warehouses'], geomap: ['Fleet & Geo Logistics', 'orders'],
  'scenario-builder': ['Scenario Builder', 'demand'], 'simulation-results': ['Simulation Results', 'demand'], recommendations: ['Recommendations', 'inventory'],
  forecast: ['Forecast Engine', 'demand'], risk: ['Risk Matrix', 'lead_times'], suppliers: ['Supplier Registry', 'suppliers'], inventory: ['Inventory Buffer', 'inventory'],
  shipments: ['Live Shipments', 'orders'], reports: ['Reports & Analytics', 'inventory'], intelligence: ['Supply Chain Intelligence', 'lead_times'], settings: ['ERP/WMS Integrations', 'products'],
};
export const ModuleImport: React.FC<{ page: string }> = ({ page }) => {
  const dialog = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const config = CONFIG[page];
  if (!config) return null;
  return <div className="flex justify-end mb-4">
    <Button onClick={() => { setOpen(true); dialog.current?.showModal(); }} leftIcon={<UploadCloud className="w-4 h-4" />}>Import Data</Button>
    <dialog ref={dialog} aria-label={`Import data for ${config[0]}`} onClose={() => setOpen(false)} className="m-auto w-[min(95vw,1100px)] max-h-[90vh] overflow-auto bg-slate-950 text-slate-100 rounded-2xl border border-cyan-500/30 p-6 backdrop:bg-black/80">
      <button autoFocus aria-label="Close import dialog" className="float-right p-2" onClick={() => dialog.current?.close()}><X /></button>
      {open && <DataIngestionView key={page} initialDataset={config[1]} moduleName={config[0]} />}
    </dialog>
  </div>;
};
