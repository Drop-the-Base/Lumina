import { Router, Request, Response } from 'express';
import { getRoutes } from '../services/osrmClient';
import { supabase } from '../db/supabase';

const router = Router();

interface NearbyReport {
  lat: number;
  lng: number;
  category: string;
}


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

// POST /api/route
// Body: { from_lat, from_lng, to_lat, to_lng }
router.post('/', async (req: Request, res: Response) => {
  try {
    const { from_lat, from_lng, to_lat, to_lng } = req.body;

    if (!from_lat || !from_lng || !to_lat || !to_lng) {
      return res.status(400).json({ error: 'from_lat, from_lng, to_lat, to_lng are required' });
    }

    // 1. Fetch up to 3 alternative routes from OSRM
    const routes = await getRoutes(from_lng, from_lat, to_lng, to_lat);
    const fastest = routes[0];

    // 2. Fetch active danger reports in bounding box (with margin)
    let allReports: NearbyReport[] = [];
    try {
      const margin = 0.02;
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
      // Ignore DB error — no danger reports, show fastest route as safe
    }

    const fastestDangerReports = reportsNearRoute(fastest, allReports);

    // Default: safe route = fastest route. Only switch to an OSRM alternative
    // if real DB reports exist AND an alternative genuinely avoids more danger.
    let safest = fastest;
    let safestDangerReports = fastestDangerReports;

    if (allReports.length > 0 && routes.length > 1 && fastestDangerReports.length > 0) {
      for (let i = 1; i < routes.length; i++) {
        const altDangers = reportsNearRoute(routes[i], allReports);
        if (altDangers.length < safestDangerReports.length) {
          safest = routes[i];
          safestDangerReports = altDangers;
        }
      }
    }

    // 4. Build avoided-categories list
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
