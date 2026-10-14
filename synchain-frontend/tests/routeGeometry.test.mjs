import test from 'node:test';
import assert from 'node:assert/strict';
import { connectionArc, getShipmentRoute, needsAttention, resolveLocation, unwrapRoute } from '../src/components/geomap/routeGeometry.ts';

const shipment = { id: 'test', mode: 'ocean', origin: 'Shanghai', destination: 'Los Angeles', status: 'optimal' };

test('Pacific connections cross the date line without crossing Europe', () => {
  const route = getShipmentRoute(shipment, []);
  assert.ok(route.schematic);
  assert.equal(route.current, null);
  assert.deepEqual(route.points[0], [31.23, 121.47]);
  assert.equal(route.points.at(-1)[0], 33.74);
  assert.ok(Math.abs(route.points.at(-1)[1] - 241.74) < .001);
  for (let i = 1; i < route.points.length; i++) {
    assert.ok(Math.abs(route.points[i][1] - route.points[i - 1][1]) < 10);
  }
});

test('reverse date-line crossings remain continuous', () => {
  const points = unwrapRoute([[35, -120], [40, -175], [38, 179], [30, 121]]);
  for (let i = 1; i < points.length; i++) assert.ok(Math.abs(points[i][1] - points[i - 1][1]) < 180);
});

test('unknown or country-only locations never receive invented coordinates', () => {
  assert.equal(getShipmentRoute({ ...shipment, origin: 'Unknown Warehouse' }, []), null);
  assert.equal(resolveLocation('China', []), null);
  assert.equal(resolveLocation('New Yorkshire', []), null);
  assert.deepEqual(resolveLocation('Port of Shanghai, China', []), [31.23, 121.47]);
});

test('supplied geometry and tracking coordinates are retained across the date line', () => {
  const route = getShipmentRoute({ ...shipment, origin: 'Depot A', destination: 'Depot B',
    routeWaypoints: [[30, 120], [40, 179], [35, -120]], currentCoords: { lat: 40, lng: -179 } }, []);
  assert.equal(route.schematic, false);
  assert.deepEqual(route.current, [40, 181]);
  assert.ok(route.points.some(([lat, lng]) => lat === 40 && lng === 179));
});

test('explicit endpoint coordinates work without known city names', () => {
  const route = getShipmentRoute({ ...shipment, origin: 'Depot A', destination: 'Depot B',
    originCoords: { lat: 0, lng: 0 }, destCoords: { lat: 12, lng: 20 } }, []);
  assert.deepEqual(route.points[0], [0, 0]);
  assert.deepEqual(route.points.at(-1), [12, 20]);
});

test('invalid geometry falls back safely and invalid tracking is omitted', () => {
  const route = getShipmentRoute({ ...shipment, routeWaypoints: [[NaN, 120], [20, 200]], currentCoords: { lat: 100, lng: 2 } }, []);
  assert.equal(route.schematic, true);
  assert.equal(route.current, null);
  assert.ok(route.points.every((point) => point.every(Number.isFinite)));
});

test('coincident and antipodal endpoints do not produce NaN', () => {
  for (const end of [[0, 0], [0, 180]]) assert.ok(connectionArc([0, 0], end).flat().every(Number.isFinite));
});

test('port coordinates take priority and critical shipments need attention', () => {
  assert.deepEqual(resolveLocation('Custom Terminal', [{ name: 'Custom Terminal', coordinates: [15, 30] }]), [15, 30]);
  assert.equal(needsAttention({ ...shipment, status: 'critical' }), true);
});
