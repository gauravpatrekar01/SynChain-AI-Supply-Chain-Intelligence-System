import { Fragment, useEffect, useMemo, useState } from 'react';
import { CircleMarker, GeoJSON, MapContainer, Marker, Pane, Polyline, Popup, ScaleControl, TileLayer, Tooltip, useMap, ZoomControl } from 'react-leaflet';
import type { GeoJsonObject } from 'geojson';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { AlertTriangle, ArrowRight, Globe2, Layers, LocateFixed, MapPin, Plane, Search, Ship, TrainFront, Truck, X } from 'lucide-react';
import { useSupplyChain } from '../../context/SupplyChainContext';
import type { Shipment } from '../../types';
import { getShipmentRoute, needsAttention, routeColor, statusLabel, validCoordinate } from './routeGeometry';
import type { Coordinate, ShipmentRoute } from './routeGeometry';
import './geoFleetMap.css';

type FleetFilter = 'all' | 'ocean' | 'air' | 'land' | 'attention';
const modeIcons = { ocean: Ship, air: Plane, ground: Truck, rail: TrainFront };
const modeNames = { ocean: 'Ocean', air: 'Air', ground: 'Ground', rail: 'Rail' };
const formatEta = (eta: string) => {
  if (!eta) return 'Not available';
  const date = new Date(eta);
  return Number.isNaN(date.getTime()) ? eta : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
};

function WorldOutline({ light }: { light: boolean }) {
  const [land, setLand] = useState<GeoJsonObject | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    fetch(`${import.meta.env.BASE_URL}world-land.geojson`, { signal: controller.signal })
      .then((response) => response.ok ? response.json() : null)
      .then(setLand).catch(() => { /* Online tiles remain available if the local outline fails. */ });
    return () => controller.abort();
  }, []);
  return <Pane name="world-outline" style={{ zIndex: 150, pointerEvents: 'none' }}>
    {land && [-360, 0, 360].map((shift) => <GeoJSON key={shift} data={land} interactive={false}
      coordsToLatLng={([lng, lat]) => L.latLng(lat, lng + shift)}
      style={{ color: light ? '#94a3b8' : '#334a62', fillColor: light ? '#cbd5e1' : '#182b40', fillOpacity: 1, weight: .8 }}
      attribution='World outline: <a href="https://www.naturalearthdata.com/">Natural Earth</a>' />)}
  </Pane>;
}

function MapViewport({ points, reset }: { points: Coordinate[]; reset: number }) {
  const map = useMap();
  useEffect(() => {
    const fit = () => {
      map.invalidateSize();
      if (points.length) map.fitBounds(L.latLngBounds(points), { padding: [Math.min(80, map.getSize().x * .14), 70], maxZoom: 7, animate: false });
      else map.setView([24, 35], 2, { animate: false });
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(map.getContainer());
    return () => observer.disconnect();
  }, [map, points, reset]);
  return null;
}

function ShipmentDetails({ shipment, schematic }: { shipment: Shipment; schematic: boolean }) {
  return <div className="fleet-popup">
    <strong>{shipment.id}</strong><span style={{ color: routeColor(shipment) }}>{statusLabel(shipment)}</span>
    <h3>{shipment.origin} → {shipment.destination}</h3>
    <dl><dt>Carrier</dt><dd>{shipment.carrier || 'Not available'}</dd>
      <dt>Transport</dt><dd>{modeNames[shipment.mode] || shipment.mode}</dd>
      <dt>Cargo</dt><dd>{shipment.cargoDescription || 'Not available'}</dd>
      <dt>ETA</dt><dd>{formatEta(shipment.eta)}</dd>
      {shipment.vesselName && <><dt>Vessel / flight</dt><dd>{shipment.vesselName}</dd></>}
      {shipment.speedKnots != null && <><dt>Reported speed</dt><dd>{shipment.speedKnots} kn</dd></>}
    </dl>
    <p>{schematic ? 'Schematic connection; actual travel path may differ.' : 'Route geometry supplied with this shipment.'}</p>
    {shipment.rerouteRecommendation && <p className="fleet-advisory">{shipment.rerouteRecommendation}</p>}
  </div>;
}

function RouteLayer({ route, selected, dimmed, labels, onSelect, shift = 0 }: {
  route: ShipmentRoute; selected: boolean; dimmed: boolean; labels: boolean; onSelect: () => void; shift?: number;
}) {
  const { shipment } = route;
  const color = routeColor(shipment);
  const points = useMemo(() => route.points.map(([lat, lng]): Coordinate => [lat, lng + shift]), [route.points, shift]);
  const middle = Math.floor(points.length / 2);
  const from = points[Math.max(0, middle - 1)];
  const to = points[Math.min(points.length - 1, middle + 1)];
  const angle = Math.atan2(-(to[0] - from[0]), (to[1] - from[1]) * Math.cos(from[0] * Math.PI / 180)) * 180 / Math.PI;
  const arrow = useMemo(() => L.divIcon({
    className: 'fleet-direction-marker', iconSize: [24, 24], iconAnchor: [12, 12],
    html: `<span style="color:${color};transform:rotate(${angle}deg)">➤</span>`,
  }), [color, angle]);
  const tooltip = <><strong>{shipment.id}</strong> · {shipment.origin} → {shipment.destination}<br />{statusLabel(shipment)} · Click to focus</>;
  return <>
    <Polyline positions={points} interactive={false} pathOptions={{ color: '#020617', weight: selected ? 10 : 7, opacity: dimmed ? .2 : .85 }} />
    <Polyline positions={points} pathOptions={{ color, weight: selected ? 4 : 3, opacity: dimmed ? .2 : .95, dashArray: shipment.status === 'rerouted' ? '10 9' : route.schematic ? '3 7' : undefined, lineCap: 'round' }} eventHandlers={{ click: onSelect }} />
    <Polyline positions={points} pathOptions={{ color, weight: 18, opacity: 0 }} eventHandlers={{ click: onSelect }}>
      <Tooltip sticky className="fleet-tooltip">{tooltip}</Tooltip>
    </Polyline>
    {[points[0], points[points.length - 1]].map((position, i) => <CircleMarker key={i} center={position} radius={selected ? 7 : 5} pathOptions={{ color, weight: 2, fillColor: i === 0 ? '#0f172a' : color, fillOpacity: dimmed ? .3 : 1, opacity: dimmed ? .3 : 1 }} eventHandlers={{ click: onSelect }}>
      {labels && (!dimmed || selected) && <Tooltip permanent direction="top" offset={[0, -8]} className="fleet-location-label">{i === 0 ? shipment.origin : shipment.destination}</Tooltip>}
      <Popup><ShipmentDetails shipment={shipment} schematic={route.schematic} /></Popup>
    </CircleMarker>)}
    {!dimmed && <Marker position={points[middle]} icon={arrow} title={`Focus ${shipment.id}: ${shipment.origin} to ${shipment.destination}`} eventHandlers={{ click: onSelect }}>
      <Tooltip className="fleet-tooltip">{tooltip}</Tooltip>
    </Marker>}
    {route.current && <CircleMarker center={[route.current[0], route.current[1] + shift]} radius={8} pathOptions={{ color: '#fff', weight: 2, fillColor: color, fillOpacity: 1 }} eventHandlers={{ click: onSelect }}>
      <Tooltip className="fleet-tooltip">{shipment.id} · Reported position</Tooltip>
      <Popup><ShipmentDetails shipment={shipment} schematic={route.schematic} /></Popup>
    </CircleMarker>}
  </>;
}

export function GeoFleetMap({ onNavigate }: { onNavigate: (pageId: string) => void }) {
  const { shipments, ports } = useSupplyChain();
  const [filter, setFilter] = useState<FleetFilter>('all');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [labels, setLabels] = useState(true);
  const [lightMap, setLightMap] = useState(false);
  const [reset, setReset] = useState(0);
  const [tileError, setTileError] = useState(false);
  const [tileAttempt, setTileAttempt] = useState(0);
  const [showDetailedMap, setShowDetailedMap] = useState(true);
  const mapped = useMemo(() => shipments.map((shipment) => ({ shipment, route: getShipmentRoute(shipment, ports) })), [shipments, ports]);
  const visible = useMemo(() => mapped.filter(({ shipment }) => {
    const matchesMode = filter === 'all' || (filter === 'attention' ? needsAttention(shipment) : filter === 'land' ? ['ground', 'rail'].includes(shipment.mode) : shipment.mode === filter);
    return matchesMode && `${shipment.id} ${shipment.origin} ${shipment.destination} ${shipment.carrier}`.toLowerCase().includes(search.trim().toLowerCase());
  }), [mapped, filter, search]);
  const routes = useMemo(() => visible.flatMap(({ route }) => route ? [route] : []), [visible]);
  const selected = visible.find(({ shipment }) => shipment.id === selectedId);
  const selectedRoute = selected?.route;
  const fitPoints = useMemo(() => selectedRoute ? selectedRoute.points : routes.flatMap((route) => route.points), [routes, selectedRoute]);
  const hubs = useMemo(() => new Set(routes.flatMap(({ points }) => [points[0], points[points.length - 1]]
    .map(([lat, lng]) => `${lat.toFixed(4)},${(((lng + 180) % 360 + 360) % 360 - 180).toFixed(4)}`))).size, [routes]);
  const attention = visible.filter(({ shipment }) => needsAttention(shipment)).length;
  const filters: { id: FleetFilter; label: string; icon: typeof Globe2 }[] = [
    { id: 'all', label: 'All fleet', icon: Globe2 }, { id: 'ocean', label: 'Ocean', icon: Ship },
    { id: 'air', label: 'Air', icon: Plane }, { id: 'land', label: 'Ground & rail', icon: Truck },
    { id: 'attention', label: 'Needs attention', icon: AlertTriangle },
  ];
  const clearFilters = () => { setFilter('all'); setSearch(''); setSelectedId(null); };
  return <section className="fleet-view" aria-label="Fleet and Geo Logistics">
    <header className="fleet-heading"><div><div className="fleet-eyebrow"><span /> GLOBAL OPERATIONS</div>
      <h2>Fleet & Geo Logistics</h2><p>Your shipment network, connected. Select a route to explore its journey.</p></div>
      <button className="fleet-button" onClick={() => onNavigate('shipments')}>Shipment ledger <ArrowRight size={15} /></button>
    </header>
    <div className="fleet-metrics">
      {[{ label: 'Visible shipments', value: visible.length, icon: Ship, color: '#38bdf8' }, { label: 'Mapped connections', value: routes.length, icon: Globe2, color: '#34d399' }, { label: 'Connected locations', value: hubs, icon: MapPin, color: '#c4b5fd' }, { label: 'Needs attention', value: attention, icon: AlertTriangle, color: '#fbbf24' }].map(({ label, value, icon: Icon, color }) =>
        <div className="fleet-metric" key={label}><span className="fleet-metric-icon" style={{ color }}><Icon size={19} /></span><div><span>{label}</span><strong>{value.toString().padStart(2, '0')}</strong></div></div>)}
    </div>
    <div className="fleet-workspace">
      <div className="fleet-toolbar"><div className="fleet-filters" aria-label="Filter shipments">{filters.map(({ id, label, icon: Icon }) =>
        <button key={id} aria-pressed={filter === id} onClick={() => { setFilter(id); setSelectedId(null); }}><Icon size={15} />{label}</button>)}</div>
        <label className="fleet-search"><Search size={16} /><input aria-label="Search shipment routes" placeholder="Search route, city or carrier…" value={search} onChange={(event) => { setSearch(event.target.value); setSelectedId(null); }} />{search && <button aria-label="Clear search" onClick={() => setSearch('')}><X size={14} /></button>}</label>
      </div>
      <div className="fleet-map-layout">
        <div className={`fleet-map-area ${lightMap ? 'fleet-map-light' : ''}`}>
          <div className="fleet-map-actions"><button className="fleet-button" onClick={() => { setSelectedId(null); setReset((value) => value + 1); }}><LocateFixed size={15} />Fit routes</button>
            <button className="fleet-button" aria-pressed={lightMap} onClick={() => setLightMap((value) => !value)}><Layers size={15} />{lightMap ? 'Dark map' : 'Light map'}</button>
            <button className="fleet-button" onClick={() => {
              if (tileError || !showDetailedMap) { setTileError(false); setShowDetailedMap(true); setTileAttempt((value) => value + 1); }
              else setShowDetailedMap(false);
            }}><Globe2 size={15} />{showDetailedMap && !tileError ? 'World outline' : 'Detailed map'}</button>
            <button className="fleet-button" aria-pressed={labels} onClick={() => setLabels((value) => !value)}><MapPin size={15} />Labels {labels ? 'on' : 'off'}</button>
          </div>
          <MapContainer center={[24, 35]} zoom={2} minZoom={0} maxZoom={16} zoomSnap={.25} zoomDelta={.5} zoomControl={false} scrollWheelZoom={false} worldCopyJump className="fleet-leaflet-map">
            <WorldOutline light={lightMap} />
            {showDetailedMap && !tileError && <TileLayer key={tileAttempt}
              className="fleet-basemap-tiles"
              url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              eventHandlers={{ tileerror: () => setTileError(true) }} />}
            <ZoomControl position="bottomright" /><ScaleControl position="bottomleft" imperial={false} />
            <MapViewport points={fitPoints} reset={reset} />
            {[-360, 0, 360].map((shift) => <Fragment key={shift}>
              {ports.filter((port) => validCoordinate(port.coordinates)).map((port) => <CircleMarker key={port.id} center={[port.coordinates[0], port.coordinates[1] + shift]} radius={4} pathOptions={{ color: '#94a3b8', fillColor: '#0f172a', fillOpacity: 1, weight: 2 }}>
                <Tooltip className="fleet-tooltip">{port.name} · Port hub</Tooltip><Popup><div className="fleet-popup"><strong>{port.name}</strong><h3>{port.country}</h3><dl><dt>Status</dt><dd>{port.status}</dd><dt>Berth wait</dt><dd>{port.waitTimeDays} days</dd><dt>Congestion</dt><dd>{port.congestionIndex}%</dd></dl></div></Popup>
              </CircleMarker>)}
              {[...routes].sort((a, b) => Number(a.shipment.id === selectedId) - Number(b.shipment.id === selectedId)).map((route) => <RouteLayer key={route.shipment.id} route={route} shift={shift} selected={route.shipment.id === selectedId} dimmed={!!selectedRoute && route.shipment.id !== selectedId} labels={labels} onSelect={() => setSelectedId(route.shipment.id)} />)}
            </Fragment>)}
          </MapContainer>
          {tileError && <div className="fleet-map-notice" role="status">Detailed tiles unavailable. Showing the bundled world outline. <button onClick={() => { setTileError(false); setTileAttempt((value) => value + 1); }}>Retry tiles</button></div>}
          {!routes.length && <div className="fleet-map-empty"><Globe2 size={30} /><strong>{visible.length ? 'Location details needed' : 'No matching routes'}</strong><p>{visible.length ? 'Add origin and destination coordinates or recognizable city names to map these shipments.' : 'Try another filter or search to explore your network.'}</p><button className="fleet-button" onClick={clearFilters}>Reset filters</button></div>}
        </div>
        <aside className="fleet-route-panel" aria-label="Shipment routes"><div className="fleet-panel-heading"><div><span className="fleet-eyebrow">ROUTE EXPLORER</span><h3>{selected ? 'Journey details' : 'Network connections'}</h3></div><span className="fleet-count">{visible.length}</span></div>
          {selected && <div className="fleet-selected"><button className="fleet-back" onClick={() => setSelectedId(null)}>← All connections</button><ShipmentDetails shipment={selected.shipment} schematic={selected.route?.schematic ?? true} />{!selected.route && <p className="fleet-advisory">Location not mapped. Supply city names or coordinates for both endpoints.</p>}</div>}
          <div className="fleet-route-list">{visible.map(({ shipment, route }) => {
            const Icon = modeIcons[shipment.mode] || Truck;
            return <button key={shipment.id} className={`fleet-route-card ${selectedId === shipment.id ? 'is-selected' : ''}`} aria-pressed={selectedId === shipment.id} onClick={() => setSelectedId(shipment.id)}>
              <div className="fleet-card-top"><span><Icon size={15} />{shipment.id}</span><span style={{ color: routeColor(shipment) }}>{statusLabel(shipment)}</span></div>
              <div className="fleet-journey"><span className="fleet-stop origin" /><span>{shipment.origin || 'Unknown origin'}</span><span className="fleet-journey-line" /><span className="fleet-stop destination" /><span>{shipment.destination || 'Unknown destination'}</span></div>
              <div className="fleet-card-bottom"><span>{modeNames[shipment.mode] || shipment.mode} · {shipment.carrier || 'Carrier unavailable'}</span><ArrowRight size={14} /></div>
              {!route && <span className="fleet-unmapped"><AlertTriangle size={12} />Location not mapped</span>}
            </button>;
          })}{!visible.length && <div className="fleet-list-empty">No shipments match your filters.<button className="fleet-back" onClick={clearFilters}>Clear filters</button></div>}</div>
          {attention > 0 && <button className="fleet-attention" onClick={() => onNavigate('recommendations')}><AlertTriangle size={16} /><span>{attention} shipment{attention === 1 ? '' : 's'} need attention<br /><strong>Explore recommendations →</strong></span></button>}
        </aside>
      </div>
      <footer className="fleet-legend"><div><span><i style={{ background: '#38bdf8' }} />Ocean</span><span><i style={{ background: '#c4b5fd' }} />Air</span><span><i style={{ background: '#34d399' }} />Ground / rail</span><span><i style={{ background: '#fbbf24' }} />Delayed / rerouted</span><span><i style={{ background: '#fb7185' }} />Critical</span></div><p>○ Origin → ● Destination · Dotted lines: schematic connections</p></footer>
    </div>
    <p className="fleet-footnote">Showing shipment records available in SynChain. Connections without supplied waypoints are schematic, not navigation paths. Position markers appear only when coordinates are supplied.{visible.length > routes.length && ` ${visible.length - routes.length} shipment(s) need location details before they can be mapped.`}</p>
  </section>;
}
