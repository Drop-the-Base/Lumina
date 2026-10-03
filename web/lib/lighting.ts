import litData from '@/data/lit_ways.json';
import { LngLat, distanceToSegment, samplePolyline } from './geo';

// Street lighting from OpenStreetMap (`lit=*` on highways), pre-extracted for
// central Kraków into data/lit_ways.json. Each way is [lit 1|0, flat lng/lat list].
// Querying Overpass live takes 10s+ and is rate limited, so it is not usable per request.

interface Segment {
  a: LngLat;
  b: LngLat;
  lit: boolean;
}

const CELL = 0.001; // ~70 m x 110 m grid cells
const MATCH_RADIUS_M = 18;
const SAMPLE_STEP_M = 15;

let grid: Map<string, Segment[]> | null = null;

const cellKey = (lng: number, lat: number) => `${Math.floor(lng / CELL)}:${Math.floor(lat / CELL)}`;

function buildGrid() {
  grid = new Map();
  for (const [litFlag, flat] of (litData as unknown as { ways: [number, number[]][] }).ways) {
    for (let i = 0; i + 3 < flat.length; i += 2) {
      const seg: Segment = { a: [flat[i], flat[i + 1]], b: [flat[i + 2], flat[i + 3]], lit: litFlag === 1 };
      const keys = new Set([cellKey(seg.a[0], seg.a[1]), cellKey(seg.b[0], seg.b[1])]);
      for (const k of keys) {
        const bucket = grid.get(k);
        if (bucket) bucket.push(seg);
        else grid.set(k, [seg]);
      }
    }
  }
  return grid;
}

function nearestSegment(p: LngLat): Segment | null {
  const g = grid ?? buildGrid();
  const cx = Math.floor(p[0] / CELL);
  const cy = Math.floor(p[1] / CELL);
  let best: Segment | null = null;
  let bestD = MATCH_RADIUS_M;
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      for (const seg of g.get(`${cx + dx}:${cy + dy}`) ?? []) {
        const d = distanceToSegment(p, seg.a, seg.b);
        if (d < bestD) {
          bestD = d;
          best = seg;
        }
      }
    }
  }
  return best;
}

export interface LightingStats {
  litMeters: number;
  unlitMeters: number;
  unknownMeters: number;
  /** Share of the route known to be lit (0–1). */
  litRatio: number;
}

export function lightingStats(line: LngLat[]): LightingStats {
  const samples = samplePolyline(line, SAMPLE_STEP_M);
  let lit = 0, unlit = 0, unknown = 0;
  for (const p of samples) {
    const seg = nearestSegment(p);
    if (!seg) unknown++;
    else if (seg.lit) lit++;
    else unlit++;
  }
  const total = Math.max(1, samples.length);
  return {
    litMeters: lit * SAMPLE_STEP_M,
    unlitMeters: unlit * SAMPLE_STEP_M,
    unknownMeters: unknown * SAMPLE_STEP_M,
    litRatio: lit / total,
  };
}
