import { useQuery } from '@tanstack/react-query';
import { apiClient } from './api';
import { useAuth } from '../context/AuthContext';
import { Supplier, DemandForecastPoint, DigitalTwinNode, DigitalTwinEdge } from '../types';
export interface InventoryRecord {
  id: string; sku: string; name: string; category: string; facility: string; onHandUnits: number;
  reservedUnits: number | null; incomingUnits: number | null; unitPrice: number;
  status: 'ready' | 'insufficient_data'; reason: string; available_quantity: number | null;
  inventory_position: number | null; average_daily_demand: number | null; demand_stddev: number | null;
  lead_time_days: number | null; lead_time_stddev: number | null; safety_stock: number | null;
  reorder_point: number | null; replenishment_quantity: number | null; stockout_risk: number | null;
  days_of_supply: number | null; max_stock: number | null; service_level: number | null;
}
export interface OperationsSnapshot {
  digitalTwinNodes: DigitalTwinNode[]; digitalTwinEdges: DigitalTwinEdge[];
  inventory: InventoryRecord[]; suppliers: Supplier[]; demandForecast: DemandForecastPoint[];
  demandHistory: { sku: string; warehouse: string; date: string; quantity: number }[];
  orders: { id: string; external_id: string | null; status: string; order_date: string; shipping_date: string | null; shipping_mode: string | null }[];
  products: { id: string; sku: string; name: string; price: number }[];
  warehouses: { id: string; name: string; country: string; latitude: number | null; longitude: number | null }[];
  forecast_status: string; updated_at: string;
}
export function useOperations() {
  const { isAuthenticated, user } = useAuth();
  return useQuery({ queryKey: ['operations', user?.id], enabled: isAuthenticated, queryFn: async ({ signal }) => (await apiClient.get<OperationsSnapshot>('/operations/snapshot', { signal })).data, staleTime: 0 });
}
export const display = (value: number | null | undefined, digits = 0) => value == null ? 'Insufficient data' : value.toLocaleString(undefined, { maximumFractionDigits: digits });
