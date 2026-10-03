import { Router, Request, Response } from 'express';
import { getRoutes } from '../services/osrmClient';
import { supabase, isSupabaseConfigured } from '../db/supabase';
import { getLocalReports } from '../services/dbStore';

const router = Router();

interface NearbyReport {
  lat: number;
  lng: number;
  category: string;
  description?: string;
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

export interface RouteStep {
  instruction: string;
  street: string;
  distance_meters: number;
  duration_seconds: number;
  type: string;
  modifier: string;
  location: [number, number];
}

function translateManeuver(type: string, modifier?: string, name?: string): string {
  const street = name && name.trim() ? `w ul. ${name.trim()}` : '';
  const streetTarget = name && name.trim() ? `ul. ${name.trim()}` : 'celu';

  switch (type) {
    case 'depart':
      return name && name.trim() ? `Ruszaj ${street}` : 'Rozpocznij marsz';
    case 'arrive':
      return modifier === 'left'
        ? 'Cel znajduje się po Twojej lewej stronie'
        : modifier === 'right'
        ? 'Cel znajduje się po Twojej prawej stronie'
        : 'Dotarłaś bezpiecznie do celu!';
    case 'turn':
    case 'end of road':
    case 'fork':
      if (modifier === 'left' || modifier === 'sharp left') return `Skręć w lewo ${street}`.trim();
      if (modifier === 'right' || modifier === 'sharp right') return `Skręć w prawo ${street}`.trim();
      if (modifier === 'slight left') return `Łagodnie w lewo ${street}`.trim();
      if (modifier === 'slight right') return `Łagodnie w prawo ${street}`.trim();
      return `Skręć ${street}`.trim();
    case 'continue':
    case 'new name':
      return name && name.trim() ? `Kontynuuj ${street}` : 'Idź dalej prosto';
    case 'roundabout':
    case 'rotary':
      return `Na rondzie kieruj się w stronę ${streetTarget}`;
    default:
      if (modifier === 'left') return `Skręć w lewo ${street}`.trim();
      if (modifier === 'right') return `Skręć w prawo ${street}`.trim();
      return name && name.trim() ? `Kieruj się ${street}` : 'Idź prosto';
  }
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
    let routes: any[] = [];
    try {
      routes = await getRoutes(from_lng, from_lat, to_lng, to_lat);
    } catch (osrmErr) {
      console.warn('OSRM failed, falling back to direct line:', osrmErr);
      const approxDist = Math.round(distanceInMeters(from_lat, from_lng, to_lat, to_lng));
      routes = [
        {
          type: 'Feature',
          geometry: {
            type: 'LineString',
            coordinates: [
              [Number(from_lng), Number(from_lat)],
              [Number(to_lng), Number(to_lat)],
            ],
          },
          properties: {
            distance_meters: approxDist,
            duration_seconds: Math.round(approxDist / 1.3),
          },
        },
      ];
    }

    const fastest = routes[0];

    // 2. Fetch active danger reports
    let allReports: NearbyReport[] = [];
    if (isSupabaseConfigured && supabase) {
      try {
        const margin = 0.02;
        const { data: nearbyReports } = await supabase
          .from('reports_with_coords')
          .select('lat, lng, category, description')
          .eq('status', 'Active')
          .gte('lat', Math.min(from_lat, to_lat) - margin)
          .lte('lat', Math.max(from_lat, to_lat) + margin)
          .gte('lng', Math.min(from_lng, to_lng) - margin)
          .lte('lng', Math.max(from_lng, to_lng) + margin);

        if (nearbyReports && nearbyReports.length > 0) {
          allReports = nearbyReports;
        }
      } catch {
        allReports = getLocalReports();
      }
    } else {
      allReports = getLocalReports();
    }

    const fastestDangerReports = reportsNearRoute(fastest, allReports);

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

    const isSafe = safestDangerReports.length === 0;
    const safetyStatus = isSafe ? 'safe' : 'unsafe';

    const extraDistance = Math.max(0, safest.properties.distance_meters - fastest.properties.distance_meters);
    const extraDuration = Math.max(0, safest.properties.duration_seconds - fastest.properties.duration_seconds);

    const rawSteps = safest.properties?.steps || [];
    const mappedSteps: RouteStep[] = rawSteps.map((s: any) => ({
      instruction: translateManeuver(s.maneuver?.type, s.maneuver?.modifier, s.name),
      street: s.name || '',
      distance_meters: Math.round(s.distance || 0),
      duration_seconds: Math.round(s.duration || 0),
      type: s.maneuver?.type || 'turn',
      modifier: s.maneuver?.modifier || '',
      location: s.maneuver?.location || [0, 0],
    }));

    res.json({
      fastest,
      safest,
      is_safe: isSafe,
      safety_status: safetyStatus,
      danger_reports_on_fastest: fastestDangerReports.length,
      danger_reports_on_safest: safestDangerReports.length,
      dangers_on_route: safestDangerReports.map(d => ({
        category: d.category,
        description: d.description,
        lat: d.lat,
        lng: d.lng,
      })),
      extra_distance_meters: extraDistance,
      extra_duration_seconds: extraDuration,
      avoided_categories: avoidedCategories,
      steps: mappedSteps,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
