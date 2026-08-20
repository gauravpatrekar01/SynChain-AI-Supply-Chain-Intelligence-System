import React, { useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import L from 'leaflet';
import { useSupplyChain } from '../../context/SupplyChainContext';
import { Shipment, PortNode } from '../../types';
import {
  Globe2,
  Ship,
  Plane,
  AlertTriangle,
} from 'lucide-react';
import { NeonBadge } from '../common/NeonBadge';
import { soundFX } from '../../services/audioService';

// Custom Leaflet Icons using SVG Data URIs
const createCustomIcon = (color: string, iconType: 'ship' | 'plane' | 'port') => {
  const iconSvg =
    iconType === 'ship'
      ? `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="${color}" stroke="#ffffff" stroke-width="1.5"><circle cx="12" cy="12" r="10" fill="${color}" fill-opacity="0.3"/><path d="M2 21a8 8 0 0 1 13.8-5.3L18 18l3.6-3.6a8 8 0 0 1-5.4 6.6z"/></svg>`
      : iconType === 'plane'
      ? `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="${color}" stroke="#ffffff" stroke-width="1.5"><path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"/></svg>`
      : `<svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="${color}" stroke="#ffffff" stroke-width="1.5"><circle cx="12" cy="12" r="9" fill="${color}" fill-opacity="0.4"/><circle cx="12" cy="5" r="3"/><line x1="12" y1="8" x2="12" y2="21"/><path d="M5 12H2a10 10 0 0 0 20 0h-3"/></svg>`;

  return L.divIcon({
    className: 'custom-leaflet-marker',
    html: `<div style="transform: translate(-14px, -14px);">${iconSvg}</div>`,
    iconSize: [28, 28],
  });
};

const shipIconNormal = createCustomIcon('#3B82F6', 'ship');
const shipIconWarning = createCustomIcon('#F59E0B', 'ship');
const planeIcon = createCustomIcon('#8B5CF6', 'plane');
const portIcon = createCustomIcon('#06B6D4', 'port');

// Mock shipment coordinates lookup
const routeCoordinates: Record<string, { current: [number, number]; waypoints: [number, number][] }> = {
  'SHP-9842': {
    current: [29.8, -160.4],
    waypoints: [[31.23, 121.47], [30.5, 140.2], [29.8, -160.4], [33.74, -118.26]],
  },
  'SHP-7729': {
    current: [46.2, 55.4],
    waypoints: [[25.07, 121.23], [35.2, 85.1], [46.2, 55.4], [50.03, 8.57]],
  },
  'SHP-4109': {
    current: [18.5, 116.2],
    waypoints: [[29.86, 121.54], [18.5, 116.2], [1.32, 103.65], [12.58, 43.33], [51.95, 4.02]],
  },
  'SHP-3310': {
    current: [58.4, -142.1],
    waypoints: [[37.46, 126.44], [54.2, 170.5], [58.4, -142.1], [41.97, -87.9]],
  },
};

interface GeoFleetMapProps {
  onNavigate: (pageId: string) => void;
}

export const GeoFleetMap: React.FC<GeoFleetMapProps> = ({ onNavigate }) => {
  const { shipments, ports } = useSupplyChain();
  const [activeFilter, setActiveFilter] = useState<'all' | 'ocean' | 'air' | 'warning'>('all');
  const [, setSelectedShipment] = useState<Shipment | null>(null);

  const filteredShipments = shipments.filter((s) => {
    if (activeFilter === 'ocean') return s.mode === 'ocean';
    if (activeFilter === 'air') return s.mode === 'air';
    if (activeFilter === 'warning') return s.status === 'delayed' || s.status === 'rerouted';
    return true;
  });

  const filterOptions = [
    { id: 'all' as const, label: 'All Fleet (1,280)', icon: Globe2 },
    { id: 'ocean' as const, label: 'Ocean Freight', icon: Ship },
    { id: 'air' as const, label: 'Air Express', icon: Plane },
    { id: 'warning' as const, label: 'Disrupted / Rerouted', icon: AlertTriangle },
  ];

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl sm:text-2xl font-bold text-white font-display tracking-tight">
              Global Fleet & Geo Logistics Map
            </h2>
            <NeonBadge variant="cyan" size="sm">
              AIS SATELLITE LIVE
            </NeonBadge>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Real-time tracking of maritime container vessels, air cargo routes, port congestion, and meteorological choke points.
          </p>
        </div>

        {/* Filter Controls */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-900/80 border border-white/10 overflow-x-auto">
          {filterOptions.map((filter) => {
            const Icon = filter.icon;
            return (
              <button
                key={filter.id}
                onClick={() => {
                  soundFX.playClick();
                  setActiveFilter(filter.id);
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all shrink-0 cursor-pointer ${
                  activeFilter === filter.id
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{filter.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Map Container */}
      <div className="relative rounded-2xl glass-panel border border-white/10 overflow-hidden h-[620px]">
        <MapContainer
          center={[22.0, 110.0]}
          zoom={3}
          minZoom={2}
          maxZoom={12}
          scrollWheelZoom={true}
          style={{ height: '100%', width: '100%', backgroundColor: '#050816' }}
        >
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            attribution='&copy; <a href="https://carto.com/">CARTO</a>'
          />

          {/* Port Hub Markers */}
          {ports.map((port) => (
            <Marker key={port.id} position={port.coordinates} icon={portIcon}>
              <Popup className="custom-leaflet-popup">
                <div className="p-2 space-y-1.5 text-slate-100">
                  <div className="flex items-center justify-between gap-2 border-b border-white/10 pb-1">
                    <span className="font-bold text-xs text-cyan-400">{port.name}</span>
                    <NeonBadge variant={port.status} size="sm">
                      {port.status}
                    </NeonBadge>
                  </div>
                  <p className="text-[11px] text-slate-300">
                    Country: <span className="text-white">{port.country}</span>
                  </p>
                  <p className="text-[11px] text-slate-300">
                    Berth Waiting Time: <span className="font-mono font-semibold text-amber-300">{port.waitTimeDays} days</span>
                  </p>
                  <p className="text-[11px] text-slate-300">
                    Congestion Index: <span className="font-mono text-white">{port.congestionIndex}%</span>
                  </p>
                </div>
              </Popup>
            </Marker>
          ))}

          {/* Shipment Waypoint Polylines & Markers */}
          {filteredShipments.map((shipment) => {
            const route = routeCoordinates[shipment.id] || {
              current: [30.0, 120.0] as [number, number],
              waypoints: [[30.0, 120.0] as [number, number], [32.0, 130.0] as [number, number]],
            };

            return (
              <React.Fragment key={`route-${shipment.id}`}>
                <Polyline
                  positions={route.waypoints}
                  pathOptions={{
                    color: shipment.status === 'delayed' || shipment.status === 'rerouted' ? '#F59E0B' : '#3B82F6',
                    weight: 2.5,
                    dashArray: shipment.status === 'rerouted' ? '6, 6' : undefined,
                    opacity: 0.7,
                  }}
                />

                <Marker
                  position={route.current}
                  icon={
                    shipment.mode === 'air'
                      ? planeIcon
                      : shipment.status === 'delayed'
                      ? shipIconWarning
                      : shipIconNormal
                  }
                  eventHandlers={{
                    click: () => {
                      soundFX.playClick();
                      setSelectedShipment(shipment);
                    },
                  }}
                >
                  <Popup className="custom-leaflet-popup">
                    <div className="p-2.5 space-y-2 text-slate-100 min-w-[240px]">
                      <div className="flex items-center justify-between border-b border-white/10 pb-1.5">
                        <div>
                          <h4 className="font-bold text-xs text-white">{shipment.carrier}</h4>
                          <p className="text-[10px] text-slate-400 font-mono-telemetry">{shipment.vesselName || shipment.id}</p>
                        </div>
                        <NeonBadge variant={shipment.status === 'delayed' ? 'warning' : 'optimal'} size="sm">
                          {shipment.status.toUpperCase()}
                        </NeonBadge>
                      </div>

                      <div className="space-y-1 text-[11px] font-mono-telemetry text-slate-300">
                        <div className="flex justify-between">
                          <span className="text-slate-400">Origin &rarr; Dest:</span>
                          <span className="font-semibold text-white truncate max-w-[140px]">
                            {shipment.origin} &rarr; {shipment.destination}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Cargo Payload:</span>
                          <span className="text-cyan-300 truncate max-w-[140px]">{shipment.cargoDescription}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Speed / ETA:</span>
                          <span className="text-emerald-400">{shipment.speedKnots || 20} kn | {shipment.eta}</span>
                        </div>
                      </div>

                      {shipment.rerouteRecommendation && (
                        <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-[10px] text-amber-200">
                          ⚠️ {shipment.rerouteRecommendation}
                        </div>
                      )}
                    </div>
                  </Popup>
                </Marker>
              </React.Fragment>
            );
          })}
        </MapContainer>

        {/* Live Weather Warning Overlay */}
        <div className="absolute top-4 right-4 z-[400] max-w-sm rounded-xl glass-dropdown border border-rose-500/40 p-3.5 shadow-2xl space-y-2">
          <div className="flex items-center gap-2 text-rose-400 text-xs font-semibold">
            <AlertTriangle className="w-4 h-4 animate-bounce" />
            <span>METEOROLOGICAL CHOKE POINT ALERT</span>
          </div>
          <p className="text-[11px] text-slate-300 leading-relaxed">
            Super Typhoon Gaemi (Category 4) in Taiwan Strait / East China Sea. 14 container vessels rerouted via Luzon Strait.
          </p>
          <div className="flex items-center justify-between pt-1 text-[10px]">
            <span className="text-slate-400">Avg Maritime Delay: +3.8 Days</span>
            <button
              onClick={() => {
                soundFX.playClick();
                onNavigate('recommendations');
              }}
              className="text-cyan-400 hover:text-cyan-300 font-semibold underline cursor-pointer"
            >
              Optimize Logistics &rarr;
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
