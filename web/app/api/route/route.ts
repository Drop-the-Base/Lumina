import { NextRequest } from 'next/server';
import { getReports, ReportRecord } from '@/lib/db';
import { json, errorResponse, isValidCoord } from '@/lib/apiHelpers';
import {
  LngLat, bearing, distanceInMeters, distanceToPolyline, eraseLoops, offsetPoint, polylineLength,
} from '@/lib/geo';
import { lightingStats, LightingStats } from '@/lib/lighting';
import { fetchValhalla } from '@/lib/valhalla';
import { translateManeuver, type RouteFeature } from '@/lib/routeTypes';

export const dynamic = 'force-dynamic';

// Engines, in order: Valhalla (pedestrian costing, lit preference, native
// exclusions) → FOSSGIS OSRM foot profile with via-point detours → straight line.
// Never use router.project-osrm.org: it only has a car profile and silently
// ignores `/foot`, which produced 19 km/h "walking" routes.
const OSRM_FOOT = process.env.OSRM_FOOT_URL || 'https://routing.openstreetmap.de/routed-foot/route/v1/foot';
const OSRM_TIMEOUT_MS = 7000;
const DETOUR_CONCURRENCY = 4; // the public server throttles bursts

// Cost model: seconds of walking the user would trade to avoid something.
const DANGER_COST_S = 300; // one fully weighted danger on the route ≈ 5 min detour
const UNLIT_COST_S_PER_M = 1; // 100 m of unlit street ≈ 100 s detour
const MAX_DETOUR_RATIO = 1.7;

const CATEGORY_WEIGHT: Record<string, number> = {
  'Suspicious Activity': 1.5,
  'Lighting Issue': 1,
  Obstacle: 0.6,
};

/** Reports within this distance are listed as "on the route". */
const ON_ROUTE_M = 60;

async function fetchOsrm(points: LngLat[], alternatives: boolean, retries = 1): Promise<RouteFeature[]> {
  const coords = points.map((p) => `${p[0].toFixed(6)},${p[1].toFixed(6)}`).join(';');
  const url = `${OSRM_FOOT}/${coords}?overview=full&geometries=geojson&steps=true${alternatives ? '&alternatives=3' : ''}`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(OSRM_TIMEOUT_MS) });
    if (!res.ok) throw new Error(`OSRM HTTP ${res.status}`);
    const data = await res.json();
    if (data.code !== 'Ok') return [];
    return (data.routes || []).map(toFeature);
  } catch (err) {
    if (retries > 0) {
      await new Promise((r) => setTimeout(r, 250));
      return fetchOsrm(points, alternatives, retries - 1);
    }
    console.warn('[route] OSRM request failed:', err);
    return [];
  }
}

async function mapLimited<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]);
    }
  });
  await Promise.all(workers);
  return results;
}

/** Cut out-and-back spurs from a via-point route and fix up its length, time and steps. */
function removeSpurs(feature: RouteFeature): RouteFeature {
  const original = feature.geometry.coordinates;
  const { line, junctions } = eraseLoops(original);
  if (junctions.length === 0) return feature;

  const ratio = polylineLength(line) / Math.max(1, polylineLength(original));
  const nearJunction = (loc: LngLat) => junctions.some((j) => distanceInMeters(loc[1], loc[0], j[1], j[0]) < 4);
  const steps = feature.properties.steps.filter((step, i, all) => {
    if (i === 0 || i === all.length - 1) return true;
    // Maneuvers into/out of the spur happen at the junction or inside the erased part
    return !nearJunction(step.location) && distanceToPolyline(step.location, line).distance < 4;
  });

  return {
    ...feature,
    geometry: { type: 'LineString', coordinates: line },
    properties: {
      distance_meters: Math.round(feature.properties.distance_meters * ratio),
      duration_seconds: Math.round(feature.properties.duration_seconds * ratio),
      steps,
    },
  };
}

function toFeature(r: any): RouteFeature {
  const legs: any[] = r.legs || [];
  // Multi-leg (via point) routes: keep only the first depart and the last arrive.
  const rawSteps = legs.flatMap((leg, li) =>
    (leg.steps || []).filter((s: any) => {
      const t = s.maneuver?.type;
      if (t === 'depart' && li > 0) return false;
      if (t === 'arrive' && li < legs.length - 1) return false;
      return true;
    })
  );

  return {
    type: 'Feature',
    geometry: r.geometry,
    properties: {
      distance_meters: Math.round(r.distance),
      duration_seconds: Math.round(r.duration),
      steps: rawSteps.map((s: any) => ({
        instruction: translateManeuver(s.maneuver?.type, s.maneuver?.modifier, s.name),
        street: s.name || '',
        distance_meters: Math.round(s.distance || 0),
        duration_seconds: Math.round(s.duration || 0),
        type: s.maneuver?.type || 'turn',
        modifier: s.maneuver?.modifier || '',
        location: s.maneuver?.location || [0, 0],
      })),
    },
  };
}

function straightLine(from: LngLat, to: LngLat): RouteFeature {
  const dist = Math.round(distanceInMeters(from[1], from[0], to[1], to[0]));
  const dur = Math.round(dist / 1.3);
  return {
    type: 'Feature',
    geometry: { type: 'LineString', coordinates: [from, to] },
    properties: {
      distance_meters: dist,
      duration_seconds: dur,
      steps: [
        { instruction: 'Idź prosto w stronę celu', street: '', distance_meters: dist, duration_seconds: dur, type: 'depart', modifier: '', location: from },
        { instruction: 'Dotarłaś do celu!', street: '', distance_meters: 0, duration_seconds: 0, type: 'arrive', modifier: '', location: to },
      ],
    },
  };
}

interface DangerHit {
  report: ReportRecord;
  distance: number;
  segmentIndex: number;
  weight: number;
}

interface Analysis {
  feature: RouteFeature;
  hits: DangerHit[];
  onRoute: ReportRecord[];
  dangerScore: number;
  lighting: LightingStats;
  cost: number;
}

/** 1 within 40 m of the route, fading to 0 at 90 m. */
const proximity = (d: number) => (d <= 40 ? 1 : d >= 90 ? 0 : (90 - d) / 50);

/** More independent confirmations → more weight, capped so one report can't dominate. */
const confidence = (validations: number) => Math.min(2, 0.6 + 0.2 * Math.max(1, validations));

function analyse(feature: RouteFeature, reports: ReportRecord[]): Analysis {
  const line = feature.geometry.coordinates;
  const hits: DangerHit[] = [];
  for (const report of reports) {
    const { distance, index } = distanceToPolyline([report.lng, report.lat], line);
    const prox = proximity(distance);
    if (prox > 0) {
      hits.push({
        report,
        distance,
        segmentIndex: index,
        weight: (CATEGORY_WEIGHT[report.category] ?? 1) * confidence(report.validation_count) * prox,
      });
    }
  }
  const dangerScore = hits.reduce((s, h) => s + h.weight, 0);
  const lighting = lightingStats(line);
  return {
    feature,
    hits,
    onRoute: hits.filter((h) => h.distance < ON_ROUTE_M).map((h) => h.report),
    dangerScore,
    lighting,
    cost: feature.properties.duration_seconds + dangerScore * DANGER_COST_S + lighting.unlitMeters * UNLIT_COST_S_PER_M,
  };
}

/** A via-point snapped onto a dead end makes OSRM walk there and back — reject such routes. */
function hasBacktrack(line: LngLat[]): boolean {
  const seen = new Set<string>();
  let repeats = 0;
  for (const [lng, lat] of line) {
    const k = `${lng.toFixed(5)},${lat.toFixed(5)}`;
    if (seen.has(k)) repeats++;
    seen.add(k);
  }
  return repeats > 2;
}

/** Via-points pushed sideways from the worst dangers, to force OSRM around them. */
function detourCandidates(base: Analysis): LngLat[] {
  const line = base.feature.geometry.coordinates;
  const worst = [...base.hits].sort((a, b) => b.weight - a.weight).slice(0, 2);
  const vias: LngLat[] = [];
  for (const hit of worst) {
    const i = Math.min(hit.segmentIndex, line.length - 2);
    const heading = bearing(line[i], line[i + 1]);
    const anchor: LngLat = [hit.report.lng, hit.report.lat];
    for (const side of [90, -90]) {
      for (const meters of [180, 320]) {
        vias.push(offsetPoint(anchor, heading + side, meters));
      }
    }
  }
  return vias.slice(0, 8);
}

export async function POST(req: NextRequest) {
  try {
    const { from_lat, from_lng, to_lat, to_lng } = await req.json();
    if (!isValidCoord(from_lat, from_lng) || !isValidCoord(to_lat, to_lng)) {
      return json({ error: 'from_lat, from_lng, to_lat, to_lng are required' }, 400);
    }

    const from: LngLat = [Number(from_lng), Number(from_lat)];
    const to: LngLat = [Number(to_lng), Number(to_lat)];

    const [valhallaRoutes, reports] = await Promise.all([fetchValhalla(from, to, { alternates: 2 }), getReports()]);

    let engine: 'valhalla' | 'osrm' | 'straight' = 'valhalla';
    let direct = valhallaRoutes;
    if (direct.length === 0) {
      engine = 'osrm';
      direct = await fetchOsrm([from, to], true);
    }
    if (direct.length === 0) {
      engine = 'straight';
      direct = [straightLine(from, to)];
    }

    let analysed = direct.map((f) => analyse(f, reports));
    const fastest = analysed.reduce(
      (best, a) => (a.feature.properties.duration_seconds < best.feature.properties.duration_seconds ? a : best),
      analysed[0]
    );
    const detourStats = { requested: 0, returned: 0, too_long: 0, backtrack: 0 };
    const maxDistance = fastest.feature.properties.distance_meters * MAX_DETOUR_RATIO + 200;
    const withinDetourBudget = (f: RouteFeature) => f.properties.distance_meters <= maxDistance;

    if (engine === 'valhalla') {
      // Ask for routes that avoid every reported danger near the candidates (except
      // ones at the start/end, which can't be avoided), with and without the lit preference.
      const nearEndpoint = (r: ReportRecord) =>
        distanceInMeters(r.lat, r.lng, from[1], from[0]) < 80 || distanceInMeters(r.lat, r.lng, to[1], to[0]) < 80;
      const avoid = new Map<string, ReportRecord>();
      analysed.forEach((a) => a.hits.forEach((h) => !nearEndpoint(h.report) && avoid.set(h.report.report_id, h.report)));
      const exclude: LngLat[] = [...avoid.values()].slice(0, 15).map((r) => [r.lng, r.lat]);

      const requests = [fetchValhalla(from, to, { useLit: 1, exclude })];
      if (exclude.length > 0) requests.push(fetchValhalla(from, to, { exclude }));
      const safer = (await Promise.all(requests)).flat().filter(withinDetourBudget);
      analysed = analysed.concat(safer.map((f) => analyse(f, reports)));
    } else if (engine === 'osrm' && analysed.every((a) => a.dangerScore > 0)) {
      // Fallback engine has no exclusions: force detours through sideways via-points.
      const vias = detourCandidates(fastest);
      const detours = (await mapLimited(vias, DETOUR_CONCURRENCY, (via) => fetchOsrm([from, via, to], false)))
        .flat()
        .map(removeSpurs);
      detourStats.requested = vias.length;
      detourStats.returned = detours.length;
      const usable = detours.filter((f) => {
        if (!withinDetourBudget(f)) return ++detourStats.too_long && false;
        if (hasBacktrack(f.geometry.coordinates)) return ++detourStats.backtrack && false;
        return true;
      });
      analysed = analysed.concat(usable.map((f) => analyse(f, reports)));
    }

    const safest = analysed.reduce((best, a) => (a.cost < best.cost ? a : best), analysed[0]);

    const safestIds = new Set(safest.onRoute.map((r) => r.report_id));
    const avoided = fastest.onRoute.filter((r) => !safestIds.has(r.report_id));
    const isSafe = safest.onRoute.length === 0;

    return json({
      fastest: fastest.feature,
      safest: safest.feature,
      is_safe: isSafe,
      safety_status: isSafe ? 'safe' : 'unsafe',
      danger_reports_on_fastest: fastest.onRoute.length,
      danger_reports_on_safest: safest.onRoute.length,
      dangers_on_route: safest.onRoute.map((d) => ({
        report_id: d.report_id,
        category: d.category,
        description: d.description,
        lat: d.lat,
        lng: d.lng,
      })),
      extra_distance_meters: Math.max(0, safest.feature.properties.distance_meters - fastest.feature.properties.distance_meters),
      extra_duration_seconds: Math.max(0, safest.feature.properties.duration_seconds - fastest.feature.properties.duration_seconds),
      avoided_categories: [...new Set(avoided.map((r) => r.category))],
      avoided_count: avoided.length,
      lighting: {
        safest_lit_ratio: safest.lighting.litRatio,
        safest_unlit_meters: safest.lighting.unlitMeters,
        fastest_lit_ratio: fastest.lighting.litRatio,
        fastest_unlit_meters: fastest.lighting.unlitMeters,
      },
      candidates_evaluated: analysed.length,
      detours: detourStats,
      routing_engine: engine,
      fallback: engine === 'straight',
      steps: safest.feature.properties.steps,
    });
  } catch (err) {
    return errorResponse(err);
  }
}
