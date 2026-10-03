import { Router, Request, Response } from 'express';
import { getRoutes, getRouteViaWaypoint } from '../services/osrmClient';
import { supabase } from '../db/supabase';

const router = Router();

interface NearbyReport {
  lat: number;
  lng: number;
  category: string;
}

// Returns reports whose coordinates fall within `threshold` degrees of any route point
function reportsNearRoute(route: any, reports: NearbyReport[], threshold = 0.0006): NearbyReport[] {
  const coords = route.geometry.coordinates as [number, number][];
  return reports.filter(report =>
    coords.some(pt => {
      const dx = pt[0] - report.lng;
      const dy = pt[1] - report.lat;
      return Math.sqrt(dx * dx + dy * dy) < threshold;
    })
  );
}

// Computes a waypoint offset perpendicular to the A→B vector, away from the danger centroid.
// This forces OSRM to route around the danger cluster.
function computeAvoidanceWaypoint(
  fromLng: number, fromLat: number,
  toLng: number, toLat: number,
  dangerReports: NearbyReport[]
): [number, number] {
  const cLng = dangerReports.reduce((s, r) => s + r.lng, 0) / dangerReports.length;
  const cLat = dangerReports.reduce((s, r) => s + r.lat, 0) / dangerReports.length;

  const midLng = (fromLng + toLng) / 2;
  const midLat = (fromLat + toLat) / 2;

  const dLng = toLng - fromLng;
  const dLat = toLat - fromLat;
  const len = Math.sqrt(dLng * dLng + dLat * dLat) || 1;

  // One perpendicular unit vector
  const perpLng = -dLat / len;
  const perpLat = dLng / len;

  // If dot product of (centroid - midpoint) with perp is positive,
  // the danger cluster is in the perp direction — flip to go the other way
  const dot = (cLng - midLng) * perpLng + (cLat - midLat) * perpLat;
  const sign = dot > 0 ? -1 : 1;

  // Offset: proportional to route length, clamped between 0.004° (~400m) and 0.012°
  const OFFSET = Math.max(0.004, Math.min(0.012, len * 0.5));

  return [
    midLng + sign * perpLng * OFFSET,
    midLat + sign * perpLat * OFFSET,
  ];
}

// POST /api/route
// Body: { from_lat, from_lng, to_lat, to_lng }
router.post('/', async (req: Request, res: Response) => {
  try {
    const { from_lat, from_lng, to_lat, to_lng } = req.body;

    if (!from_lat || !from_lng || !to_lat || !to_lng) {
      return res.status(400).json({ error: 'from_lat, from_lng, to_lat, to_lng are required' });
    }

    // 1. Fastest route from OSRM
    const routes = await getRoutes(from_lng, from_lat, to_lng, to_lat);
    const fastest = routes[0];

    // 2. Fetch active danger reports in the bounding box (with margin)
    const margin = 0.015;
    const { data: nearbyReports } = await supabase
      .from('reports_with_coords')
      .select('lat, lng, category')
      .eq('status', 'Active')
      .gte('lat', Math.min(from_lat, to_lat) - margin)
      .lte('lat', Math.max(from_lat, to_lat) + margin)
      .gte('lng', Math.min(from_lng, to_lng) - margin)
      .lte('lng', Math.max(from_lng, to_lng) + margin);

    const allReports: NearbyReport[] = nearbyReports || [];
    const fastestDangerReports = reportsNearRoute(fastest, allReports);

    let safest = fastest;
    let safestDangerReports = fastestDangerReports;

    // 3. If fast route passes through danger, build an avoidance route via a detour waypoint
    if (fastestDangerReports.length > 0) {
      const [waypointLng, waypointLat] = computeAvoidanceWaypoint(
        from_lng, from_lat, to_lng, to_lat, fastestDangerReports
      );

      try {
        safest = await getRouteViaWaypoint(
          from_lng, from_lat,
          waypointLng, waypointLat,
          to_lng, to_lat
        );
        safestDangerReports = reportsNearRoute(safest, allReports);
      } catch {
        // OSRM waypoint call failed — fall back to fastest
        safest = fastest;
        safestDangerReports = fastestDangerReports;
      }
    }

    // 4. Build avoided-categories list (what the safe route skips vs the fast route)
    const avoidedReports = fastestDangerReports.filter(r =>
      !safestDangerReports.some(sr => sr.lat === r.lat && sr.lng === r.lng)
    );
    const avoidedCategories = [...new Set(avoidedReports.map(r => r.category))];

    const extraDistance = safest.properties.distance_meters - fastest.properties.distance_meters;
    const extraDuration = safest.properties.duration_seconds - fastest.properties.duration_seconds;

    res.json({
      fastest,
      safest,
      danger_reports_on_fastest: fastestDangerReports.length,
      danger_reports_on_safest: safestDangerReports.length,
      extra_distance_meters: extraDistance,
      extra_duration_seconds: extraDuration,
      avoided_categories: avoidedCategories,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
