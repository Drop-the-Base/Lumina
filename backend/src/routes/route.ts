import { Router, Request, Response } from 'express';
import { getRoute } from '../services/osrmClient';
import { supabase } from '../db/supabase';

const router = Router();

// POST /api/route
// Body: { from_lat, from_lng, to_lat, to_lng }
router.post('/', async (req: Request, res: Response) => {
  try {
    const { from_lat, from_lng, to_lat, to_lng } = req.body;

    if (!from_lat || !from_lng || !to_lat || !to_lng) {
      return res.status(400).json({ error: 'from_lat, from_lng, to_lat, to_lng are required' });
    }

    // 1. Get fastest route from OSRM
    const fastest = await getRoute(from_lng, from_lat, to_lng, to_lat);

    // 2. Fetch active danger reports near the bounding box
    const minLng = Math.min(from_lng, to_lng) - 0.01;
    const maxLng = Math.max(from_lng, to_lng) + 0.01;
    const minLat = Math.min(from_lat, to_lat) - 0.01;
    const maxLat = Math.max(from_lat, to_lat) + 0.01;

    const { data: nearbyReports } = await supabase
      .from('reports_with_coords')
      .select('lat, lng, category')
      .eq('status', 'Active')
      .gte('lat', minLat).lte('lat', maxLat)
      .gte('lng', minLng).lte('lng', maxLng);

    const dangerCount = nearbyReports?.length || 0;

    // 3. Safest route: if danger reports exist, get an alternate via midpoint offset
    let safest = fastest;
    if (dangerCount > 0 && nearbyReports && nearbyReports.length > 0) {
      // Calculate centroid of danger reports
      const centroidLat = nearbyReports.reduce((s, r) => s + r.lat, 0) / nearbyReports.length;
      const centroidLng = nearbyReports.reduce((s, r) => s + r.lng, 0) / nearbyReports.length;

      // Offset midpoint away from danger centroid
      const midLat = (from_lat + to_lat) / 2;
      const midLng = (from_lng + to_lng) / 2;
      const offsetLat = midLat + (midLat - centroidLat) * 0.3;
      const offsetLng = midLng + (midLng - centroidLng) * 0.3;

      safest = await getRoute(from_lng, from_lat, to_lng, to_lat, [offsetLng, offsetLat]);
    }

    res.json({
      fastest,
      safest,
      danger_reports_on_fastest: dangerCount,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
