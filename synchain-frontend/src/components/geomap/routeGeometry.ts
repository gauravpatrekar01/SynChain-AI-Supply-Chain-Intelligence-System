import type { GeoCoordinate, PortNode, Shipment } from '../../types';

export type Coordinate = [number, number];
export interface ShipmentRoute {
  shipment: Shipment;
  points: Coordinate[];
  current: Coordinate | null;
  schematic: boolean;
}

// City coordinates describe schematic connections, never vessel telemetry.
const cities: Record<string, Coordinate> = {
  shanghai: [31.23, 121.47], ningbo: [29.86, 121.54], shenzhen: [22.54, 114.06],
  'hong kong': [22.32, 114.17], singapore: [1.29, 103.85], taipei: [25.03, 121.56],
  kaohsiung: [22.63, 120.3], busan: [35.1, 129.04], seoul: [37.57, 126.98],
  incheon: [37.46, 126.44], tokyo: [35.68, 139.69], yokohama: [35.44, 139.64],
  'los angeles': [33.74, -118.26], 'long beach': [33.77, -118.19],
  'new york': [40.71, -74.01], chicago: [41.88, -87.63], memphis: [35.15, -90.05],
  austin: [30.27, -97.74], houston: [29.76, -95.37], seattle: [47.61, -122.33],
  savannah: [32.08, -81.09], vancouver: [49.28, -123.12], toronto: [43.65, -79.38],
  rotterdam: [51.95, 4.14], hamburg: [53.55, 9.99], frankfurt: [50.03, 8.57],
  london: [51.51, -0.13], antwerp: [51.22, 4.4], paris: [48.86, 2.35],
  mumbai: [19.08, 72.88], delhi: [28.61, 77.21], chennai: [13.08, 80.27],
  bangalore: [12.97, 77.59], bengaluru: [12.97, 77.59], kolkata: [22.57, 88.36],
  dubai: [25.2, 55.27], 'jebel ali': [24.99, 55.06], colombo: [6.93, 79.86],
  sydney: [-33.87, 151.21], melbourne: [-37.81, 144.96], durban: [-29.86, 31.02],
  'cape town': [-33.92, 18.42], santos: [-23.96, -46.33], 'sao paulo': [-23.55, -46.63],
};

export const validCoordinate = (value: unknown): value is Coordinate =>
  Array.isArray(value) && value.length === 2 &&
  value.every((n) => typeof n === 'number' && Number.isFinite(n)) &&
  Math.abs(value[0]) <= 90 && Math.abs(value[1]) <= 180;

const fromGeo = (value?: GeoCoordinate): Coordinate | null =>
  value && validCoordinate([value.lat, value.lng]) ? [value.lat, value.lng] : null;

const normalizeName = (name: string) => (name || '').toLowerCase().normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

export function resolveLocation(name: string, ports: PortNode[]): Coordinate | null {
  const normalized = normalizeName(name);
  if (!normalized) return null;
  const port = ports.find((item) => normalizeName(item.name) === normalized && validCoordinate(item.coordinates));
  if (port) return port.coordinates;
  return Object.entries(cities).find(([city]) => ` ${normalized} `.includes(` ${city} `))?.[1] ?? null;
}

// Keep consecutive points in one world copy across the international date line.
export function unwrapRoute(points: Coordinate[], reference = 110): Coordinate[] {
  if (!points.length) return [];
  const result: Coordinate[] = [points[0].slice() as Coordinate];
  for (const [lat, longitude] of points.slice(1)) {
    const previous = result[result.length - 1][1];
    result.push([lat, longitude + 360 * Math.round((previous - longitude) / 360)]);
  }
  const center = (Math.min(...result.map((p) => p[1])) + Math.max(...result.map((p) => p[1]))) / 2;
  const offset = 360 * Math.round((reference - center) / 360);
  return result.map(([lat, lng]) => [lat, lng + offset]);
}

export function connectionArc(start: Coordinate, end: Coordinate): Coordinate[] {
  const rad = Math.PI / 180;
  const vector = ([lat, lng]: Coordinate) => [Math.cos(lat * rad) * Math.cos(lng * rad), Math.cos(lat * rad) * Math.sin(lng * rad), Math.sin(lat * rad)];
  const a = vector(start);
  const b = vector(end);
  const angle = Math.acos(Math.max(-1, Math.min(1, a.reduce((sum, n, i) => sum + n * b[i], 0))));
  if (Math.abs(Math.sin(angle)) < 1e-6) return unwrapRoute([start, end]);
  const points: Coordinate[] = Array.from({ length: 65 }, (_, i) => {
    const t = i / 64;
    const left = Math.sin((1 - t) * angle) / Math.sin(angle);
    const right = Math.sin(t * angle) / Math.sin(angle);
    const [x, y, z] = a.map((n, index) => left * n + right * b[index]);
    return [Math.atan2(z, Math.hypot(x, y)) / rad, Math.atan2(y, x) / rad];
  });
  points[0] = start;
  points[points.length - 1] = end;
  return unwrapRoute(points);
}

export function getShipmentRoute(shipment: Shipment, ports: PortNode[]): ShipmentRoute | null {
  const supplied = shipment.routeWaypoints;
  const hasGeometry = !!supplied && supplied.length >= 2 && supplied.every(validCoordinate);
  const start = fromGeo(shipment.originCoords) ?? (hasGeometry ? supplied[0] : resolveLocation(shipment.origin, ports));
  const end = fromGeo(shipment.destCoords) ?? (hasGeometry ? supplied[supplied.length - 1] : resolveLocation(shipment.destination, ports));
  if (!start || !end) return null;
  const points = hasGeometry ? unwrapRoute([start, ...supplied, end]) : connectionArc(start, end);
  const position = fromGeo(shipment.currentCoords);
  const center = points[Math.floor(points.length / 2)][1];
  const current: Coordinate | null = position ? [position[0], position[1] + 360 * Math.round((center - position[1]) / 360)] : null;
  return { shipment, points, current, schematic: !hasGeometry };
}

export const needsAttention = (shipment: Shipment) => ['delayed', 'rerouted', 'critical'].includes(shipment.status);
export const routeColor = (shipment: Shipment) => shipment.status === 'critical' ? '#fb7185'
  : needsAttention(shipment) ? '#fbbf24' : shipment.mode === 'air' ? '#c4b5fd'
  : shipment.mode === 'ground' || shipment.mode === 'rail' ? '#34d399' : '#38bdf8';
export const statusLabel = (shipment: Shipment) => ({ optimal: 'On schedule', delayed: 'Delayed', rerouted: 'Rerouted', critical: 'Critical' })[shipment.status] ?? shipment.status;
