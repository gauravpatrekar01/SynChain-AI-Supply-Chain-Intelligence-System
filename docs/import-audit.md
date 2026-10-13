# Import audit and dependency map

## Observed root causes

- `backend/app/ingestion/csv_parser.py`: BOM detection order is wrong; duplicate headers overwrite cells; malformed rows are padded/truncated and their errors never reach validation; unlimited row counts.
- `excel_parser.py`: pandas header mangling, NA inference and numeric formatting can change identifiers; invalid sheet selection silently selects another sheet; unbounded workbook expansion.
- `normalizer.py` / `validator.py`: fuzzy mapping/date parsing, ambiguous mappings and dataset-independent validation; missing quantities accepted; non-finite/fractional quantities accepted; duplicate warnings do not prevent writes.
- `service.py`: full upload read before size check; partial invalid imports; swallowed inventory exceptions; invented supplier reliability and warehouse capacity; order business ID discarded; repeat execution creates records again; dataset selection does not constrain persistence.
- `DataIngestionView.tsx`: always selects `multi`; validation stays valid after mappings change; no query invalidation or module entry points.
- `SupplyChainContext.tsx`, `InventoryBufferView.tsx`, `api.ts`: mock state/fallbacks hide real data and API failures. Dashboard analytics also synthesizes forecasts, valuations, risks and recommendations and can read MongoDB while imports write PostgreSQL.
- Existing integration tests use the configured application database and can create permanent records. New integration tests must use an isolated PostgreSQL schema and roll it back/drop only that schema.

## Implementation direction

Bounded strict parsing, explicit schema discovery/templates, full-file validation, owned preview sessions with confirmation fingerprints, PostgreSQL locks and atomic persistence, stable business keys, shared page import UI, authoritative read APIs, measured buffer calculations and prediction invalidation. Unsupported replacement and ambiguous legacy matches are rejected rather than guessed. Existing user/admin roles may import; read-only/unknown roles may not.

## Dependencies

| Input | Authoritative entity / key | Dependent reads and calculations |
|---|---|---|
| Products | Product / SKU | Inventory valuation, reports, topology |
| Warehouses | Warehouse / exact name (legacy integration key) | Inventory, topology, fleet locations |
| Suppliers | Supplier / exact name (legacy integration key) | Registry, supplier indicators, route references |
| Inventory | Inventory / product + warehouse | Available stock, buffers, dashboard, risks, recommendations, scenario baselines |
| Demand | Daily demand / product + warehouse + date | Daily statistics, buffers, forecast eligibility; invalidate affected product forecasts |
| Lead times | Lead-time observation / receipt ID | Supplier/product/warehouse lead-time distribution, buffers, delay observations |
| Buffer policy | Inventory / product + warehouse | Supplier route, cycle service probability, review period, safety stock/reorder quantity |
| Orders | Order / external ID, OrderItem / order + product | Shipment dates, order counts; never add ordered stock implicitly |

Demand is warehouse-specific daily observed demand, not sales revenue or forecasts. Missing days are unknown, not zero. Lead-time variance needs at least two observations. The independent variable-demand/variable-lead-time model uses `Z * sqrt(mean(L)*var(D) + mean(D)^2*var(L))`, with both periods in days. Inventory position is on-hand minus reserved plus outstanding incoming (which includes in-transit); no order quantity is counted a second time. Replenishment targets the configured review period plus lead time. Insufficient inputs invalidate calculated thresholds.
