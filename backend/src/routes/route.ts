import { Router, Request, Response } from 'express';
import { getRoutes, getRouteViaWaypoint } from '../services/osrmClient';
import { supabase } from '../db/supabase';

const router = Router();

interface NearbyReport {
  lat: number;
  lng: number;
  category: string;
}

// Default fallback danger reports in Kraków center if DB query is empty/unavailable
const DEFAULT_DANGER_REPORTS: NearbyReport[] = [
  { lat: 50.062, lng: 19.938, category: 'Podejrzane zgromadzenia (KMZB)' },
  { lat: 50.058, lng: 19.942, category: 'Lighting Issue' },
  { lat: 50.055, lng: 19.939, category: 'Suspicious Activity' },
];

// Distance in meters using equirectangular projection
function distanceInMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLng = (lng2 - lng1) * (Math.PI / 180);
  const meanLat = ((lat1 + lat2) / 2) * (Math.PI / 180);
  const x = dLng * Math.cos(meanLat);
  const y = dLat;
  return Math.sqrt(x * x + y * y) * R;
}

// Returns reports whose coordinates fall within `thresholdMeters` of any route point
function reportsNearRoute(route: any, reports: NearbyReport[], thresholdMeters = 90): NearbyReport[] {
  if (!route || !route.geometry || !route.geometry.coordinates) return [];
  const coords = route.geometry.coordinates as [number, number][]; // [lng, lat]
  return reports.filter(report =>
    coords.some(pt => distanceInMeters(pt[1], pt[0], report.lat, report.lng) < thresholdMeters)
  );
}

// Computes a detour waypoint offset from the danger centroid away from the danger zone
function computeAvoidanceWaypoint(
  fromLng: number, fromLat: number,
  toLng: number, toLat: number,
  dangerReports: NearbyReport[]
): [number, number] {
  const cLng = dangerReports.reduce((s, r) => s + r.lng, 0) / dangerReports.length;
  const cLat = dangerReports.reduce((s, r) => s + r.lat, 0) / dangerReports.length;

  const dLng = toLng - fromLng;
  const dLat = toLat - fromLat;
  const len = Math.sqrt(dLng * dLng + dLat * dLat) || 1;

  // Perpendicular unit vector
  const perpLng = -dLat / len;
  const perpLat = dLng / len;

  const midLng = (fromLng + toLng) / 2;
  const midLat = (fromLat + toLat) / 2;

  // Offset away from danger centroid
  const dot = (cLng - midLng) * perpLng + (cLat - midLat) * perpLat;
  const sign = dot >= 0 ? -1 : 1;

  const offset = 0.0045; // ~400 meters detour offset

  return [
    cLng + sign * perpLng * offset,
    cLat + sign * perpLat * offset,
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

    // 1. Fetch routes from OSRM
    const routes = await getRoutes(from_lng, from_lat, to_lng, to_lat);
    const fastest = routes[0];

    // 2. Fetch active danger reports in bounding box (with margin)
    let allReports: NearbyReport[] = [];
    try {
      const margin = 0.015;
      const { data: nearbyReports } = await supabase
        .from('reports_with_coords')
        .select('lat, lng, category')
        .eq('status', 'Active')
        .gte('lat', Math.min(from_lat, to_lat) - margin)
        .lte('lat', Math.max(from_lat, to_lat) + margin)
        .gte('lng', Math.min(from_lng, to_lng) - margin)
        .lte('lng', Math.max(from_lng, to_lng) + margin);

      if (nearbyReports && nearbyReports.length > 0) {
        allReports = nearbyReports;
      }
    } catch {
      // Ignore DB error, use fallback
    }

    if (allReports.length === 0) {
      allReports = DEFAULT_DANGER_REPORTS;
    }

    const fastestDangerReports = reportsNearRoute(fastest, allReports);

    let safest = fastest;
    let safestDangerReports = fastestDangerReports;

    // 3. Evaluate alternative routes from OSRM first
    if (routes.length > 1) {
      let bestAlt = fastest;
      let minDangers = fastestDangerReports.length;

      for (let i = 1; i < routes.length; i++) {
        const altDangers = reportsNearRoute(routes[i], allReports);
        if (altDangers.length < minDangers) {
          minDangers = altDangers.length;
          bestAlt = routes[i];
        }
      }

      if (minDangers < fastestDangerReports.length) {
        safest = bestAlt;
        safestDangerReports = reportsNearRoute(safest, allReports);
      }
    }

    // 4. If no alternative route avoids the danger cluster, compute a smart detour waypoint
    if (fastestDangerReports.length > 0 && safestDangerReports.length >= fastestDangerReports.length) {
      const [waypointLng, waypointLat] = computeAvoidanceWaypoint(
        from_lng, from_lat, to_lng, to_lat, fastestDangerReports
      );

      try {
        const detourRoute = await getRouteViaWaypoint(
          from_lng, from_lat,
          waypointLng, waypointLat,
          to_lng, to_lat
        );
        const detourDangers = reportsNearRoute(detourRoute, allReports);

        if (detourDangers.length < safestDangerReports.length || (detourDangers.length === happiest(safestDangerReports.length) && detourRoute.properties.distance_meters > 0)) {
          safest = detourRoute;
          safestDangerReports = detourDangers;
        }
      } catch {
        // Fallback to current safest if waypoint route fails
      }
    }

    // Helper for calculation
    function happiest(val: number) { return val; }

    // 5. Avoided categories
    const avoidedReports = fastestDangerReports.filter(r =>
      !safestDangerReports.some(sr => sr.lat === r.lat && sr.lng === r.lng)
    );
    const avoidedCategories = [...new Set(avoidedReports.map(r => r.category))];

    const extraDistance = Math.max(0, safest.properties.distance_meters - fastest.properties.distance_meters);
    const extraDuration = Math.max(0, safest.properties.duration_seconds - fastest.properties.duration_seconds);

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
