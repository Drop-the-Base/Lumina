import type { LngLat } from './geo';
import { translateManeuver, type RouteFeature, type RouteStep } from './routeTypes';

// Valhalla names unnamed ways after their kind ("chodnik", "ścieżka"), which reads
// badly in instructions like "Skręć w lewo w chodnik".
const GENERIC_NAMES = /^(chodnik|ścieżka|ścieżka rowerowa|przejście dla pieszych|deptak|schody|droga)$/i;
// Stairs, elevators, escalators, buildings: Valhalla's own wording is the useful one
const KEEP_VALHALLA_TEXT = new Set([39, 40, 41, 42]);

// FOSSGIS public Valhalla: real pedestrian costing, `use_lit` (prefer lit
// streets), `exclude_locations` (avoid specific spots) and Polish instructions.
const VALHALLA_URL = process.env.VALHALLA_URL || 'https://valhalla1.openstreetmap.de/route';
const TIMEOUT_MS = 7000;

export interface ValhallaOptions {
  /** 0 = ignore lighting, 1 = strongly prefer lit streets */
  useLit?: number;
  exclude?: LngLat[];
  alternates?: number;
}

/** Decodes Valhalla's polyline6 encoding into [lng, lat] pairs. */
function decodePolyline6(encoded: string): LngLat[] {
  const coords: LngLat[] = [];
  let index = 0, lat = 0, lng = 0;
  while (index < encoded.length) {
    for (const axis of [0, 1]) {
      let result = 0, shift = 0, byte: number;
      do {
        byte = encoded.charCodeAt(index++) - 63;
        result |= (byte & 0x1f) << shift;
        shift += 5;
      } while (byte >= 0x20);
      const delta = result & 1 ? ~(result >> 1) : result >> 1;
      if (axis === 0) lat += delta;
      else lng += delta;
    }
    coords.push([lng / 1e6, lat / 1e6]);
  }
  return coords;
}

// Valhalla maneuver type ids → the OSRM-like type/modifier the UI understands
function maneuverKind(type: number): { type: string; modifier: string } {
  switch (type) {
    case 1: case 2: case 3: return { type: 'depart', modifier: '' };
    case 4: return { type: 'arrive', modifier: '' };
    case 5: return { type: 'arrive', modifier: 'right' };
    case 6: return { type: 'arrive', modifier: 'left' };
    case 9: case 19: case 23: return { type: 'turn', modifier: 'slight right' };
    case 10: case 18: return { type: 'turn', modifier: 'right' };
    case 11: return { type: 'turn', modifier: 'sharp right' };
    case 12: case 13: return { type: 'turn', modifier: 'uturn' };
    case 14: return { type: 'turn', modifier: 'sharp left' };
    case 15: case 21: return { type: 'turn', modifier: 'left' };
    case 16: case 20: case 24: return { type: 'turn', modifier: 'slight left' };
    case 26: case 27: return { type: 'roundabout', modifier: '' };
    default: return { type: 'continue', modifier: '' };
  }
}

function toFeature(trip: any): RouteFeature {
  const coordinates: LngLat[] = [];
  const steps: RouteStep[] = [];
  const legs: any[] = trip.legs || [];

  legs.forEach((leg, li) => {
    const shape = decodePolyline6(leg.shape);
    const offset = coordinates.length;
    coordinates.push(...shape);
    for (const m of leg.maneuvers || []) {
      const kind = maneuverKind(m.type);
      if (kind.type === 'depart' && li > 0) continue;
      if (kind.type === 'arrive' && li < legs.length - 1) continue;
      const street = ((m.street_names || []) as string[]).find((n) => !GENERIC_NAMES.test(n)) || '';
      steps.push({
        instruction: KEEP_VALHALLA_TEXT.has(m.type)
          ? m.instruction
          : translateManeuver(kind.type, kind.modifier, street),
        street,
        distance_meters: Math.round((m.length || 0) * 1000),
        duration_seconds: Math.round(m.time || 0),
        type: kind.type,
        modifier: kind.modifier,
        location: coordinates[offset + (m.begin_shape_index ?? 0)] ?? shape[0],
      });
    }
  });

  return {
    type: 'Feature',
    geometry: { type: 'LineString', coordinates },
    properties: {
      distance_meters: Math.round((trip.summary?.length || 0) * 1000),
      duration_seconds: Math.round(trip.summary?.time || 0),
      steps,
    },
  };
}

export async function fetchValhalla(from: LngLat, to: LngLat, opts: ValhallaOptions = {}): Promise<RouteFeature[]> {
  const body = {
    locations: [
      { lat: from[1], lon: from[0] },
      { lat: to[1], lon: to[0] },
    ],
    costing: 'pedestrian',
    costing_options: { pedestrian: { use_lit: opts.useLit ?? 0 } },
    exclude_locations: (opts.exclude || []).map(([lon, lat]) => ({ lat, lon })),
    directions_options: { language: 'pl-PL', units: 'kilometers' },
    alternates: opts.alternates ?? 0,
  };

  try {
    const res = await fetch(VALHALLA_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'User-Agent': 'Lumina-HackYeah-prototype/1.0' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) {
      // 400 is expected when exclusions make the destination unreachable
      if (res.status !== 400) console.warn('[route] Valhalla HTTP', res.status);
      return [];
    }
    const data = await res.json();
    const trips = [data.trip, ...(data.alternates || []).map((a: any) => a.trip)].filter(Boolean);
    return trips.map(toFeature);
  } catch (err) {
    console.warn('[route] Valhalla request failed:', err);
    return [];
  }
}
