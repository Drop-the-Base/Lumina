import { NextRequest, NextResponse } from 'next/server';
import { getReports } from '@/lib/db';

const OSRM_BASE = 'https://router.project-osrm.org/route/v1/foot';

function distanceInMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLng = (lng2 - lng1) * (Math.PI / 180);
  const meanLat = ((lat1 + lat2) / 2) * (Math.PI / 180);
  const x = dLng * Math.cos(meanLat);
  const y = dLat;
  return Math.sqrt(x * x + y * y) * R;
}

function distanceToSegmentInMeters(
  pLat: number, pLng: number,
  aLat: number, aLng: number,
  bLat: number, bLng: number
): number {
  const meanLat = ((aLat + bLat + pLat) / 3) * (Math.PI / 180);
  const mPerLat = 111132;
  const mPerLng = 111320 * Math.cos(meanLat);

  const px = pLng * mPerLng;
  const py = pLat * mPerLat;
  const ax = aLng * mPerLng;
  const ay = aLat * mPerLat;
  const bx = bLng * mPerLng;
  const by = bLat * mPerLat;

  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;

  if (lenSq === 0) {
    const distSq = (px - ax) ** 2 + (py - ay) ** 2;
    return Math.sqrt(distSq);
  }

  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq));
  const projX = ax + t * dx;
  const projY = ay + t * dy;

  return Math.sqrt((px - projX) ** 2 + (py - projY) ** 2);
}

function reportsNearRoute(route: any, reports: any[], thresholdMeters = 140): any[] {
  if (!route || !route.geometry || !route.geometry.coordinates) return [];
  const coords = route.geometry.coordinates as [number, number][]; // [lng, lat]
  if (coords.length === 0) return [];
  if (coords.length === 1) {
    return reports.filter(r => distanceInMeters(coords[0][1], coords[0][0], r.lat, r.lng) < thresholdMeters);
  }

  return reports.filter((report) => {
    for (let i = 0; i < coords.length - 1; i++) {
      const [aLng, aLat] = coords[i];
      const [bLng, bLat] = coords[i + 1];
      const dist = distanceToSegmentInMeters(report.lat, report.lng, aLat, aLng, bLat, bLng);
      if (dist < thresholdMeters) return true;
    }
    return false;
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { from_lat, from_lng, to_lat, to_lng } = body;

    if (!from_lat || !from_lng || !to_lat || !to_lng) {
      return NextResponse.json(
        { error: 'from_lat, from_lng, to_lat, to_lng are required' },
        { status: 400 }
      );
    }

    const coords = `${from_lng},${from_lat};${to_lng},${to_lat}`;
    const url = `${OSRM_BASE}/${coords}?overview=full&geometries=geojson&alternatives=3`;

    let routes: any[] = [];
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        if (data.routes && data.routes.length > 0) {
          routes = data.routes.map((r: any) => ({
            type: 'Feature',
            geometry: r.geometry,
            properties: {
              distance_meters: Math.round(r.distance),
              duration_seconds: Math.round(r.duration),
            },
          }));
        }
      }
    } catch (fetchErr) {
      console.warn('OSRM request failed, creating fallback line:', fetchErr);
    }

    // Fallback if OSRM was unavailable
    if (routes.length === 0) {
      const approxDist = Math.round(distanceInMeters(from_lat, from_lng, to_lat, to_lng));
      const approxDuration = Math.round((approxDist / 1.3));
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
            duration_seconds: approxDuration,
          },
        },
      ];
    }

    const fastest = routes[0];

    // Fetch active danger reports
    const allReports = getReports();
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

    const avoidedReports = fastestDangerReports.filter(
      (r) => !safestDangerReports.some((sr) => sr.lat === r.lat && sr.lng === r.lng)
    );
    const avoidedCategories = [...new Set(avoidedReports.map((r) => r.category))];

    const isSafe = safestDangerReports.length === 0;
    const safetyStatus = isSafe ? 'safe' : 'unsafe';

    const extraDistance = Math.max(
      0,
      safest.properties.distance_meters - fastest.properties.distance_meters
    );
    const extraDuration = Math.max(
      0,
      safest.properties.duration_seconds - fastest.properties.duration_seconds
    );

    return NextResponse.json({
      fastest,
      safest,
      is_safe: isSafe,
      safety_status: safetyStatus,
      danger_reports_on_fastest: fastestDangerReports.length,
      danger_reports_on_safest: safestDangerReports.length,
      dangers_on_route: safestDangerReports.map((d) => ({
        category: d.category,
        description: d.description,
        lat: d.lat,
        lng: d.lng,
      })),
      extra_distance_meters: extraDistance,
      extra_duration_seconds: extraDuration,
      avoided_categories: avoidedCategories,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
