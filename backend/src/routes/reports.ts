import { Router, Request, Response } from 'express';
import { supabase, isSupabaseConfigured } from '../db/supabase';
import { checkReputation, applyValidation } from '../services/trustEngine';
import { getLocalReports, addLocalReport } from '../services/dbStore';

const router = Router();

// GET /api/reports — returns all Active reports as GeoJSON FeatureCollection
router.get('/', async (_req: Request, res: Response) => {
  try {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('reports_with_coords')
        .select('*')
        .eq('status', 'Active')
        .order('created_at', { ascending: false });

      if (!error && data) {
        const featureCollection = {
          type: 'FeatureCollection',
          features: data.map((r: any) => ({
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [r.lng, r.lat] },
            properties: {
              report_id: r.report_id,
              category: r.category,
              description: r.description,
              validation_count: r.validation_count,
              status: r.status,
              created_at: r.created_at,
            },
          })),
        };
        return res.json(featureCollection);
      }
    }

    const local = getLocalReports();
    const featureCollection = {
      type: 'FeatureCollection',
      features: local.map((r) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [r.lng, r.lat] },
        properties: {
          report_id: r.report_id,
          category: r.category,
          description: r.description,
          validation_count: r.validation_count,
          status: r.status,
          created_at: r.created_at,
        },
      })),
    };

    res.json(featureCollection);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/reports — submit a new report
router.post('/', async (req: Request, res: Response) => {
  try {
    const { author_id, lat, lng, category, description } = req.body;

    if (!lat || !lng || !category) {
      return res.status(400).json({ error: 'lat, lng, and category are required' });
    }

    // Check author reputation (shadow trust gate)
    let reputation = 1.0;
    if (isSupabaseConfigured && author_id) {
      try {
        reputation = await checkReputation(author_id);
      } catch {}
    }
    const status = reputation < 0.3 ? 'Shadowbanned' : 'Active';

    const localReport = addLocalReport({
      author_id: author_id || undefined,
      category,
      description: description || undefined,
      lat: Number(lat),
      lng: Number(lng),
      status,
    });

    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from('reports').insert({
          report_id: localReport.report_id,
          author_id: author_id || null,
          location: `POINT(${lng} ${lat})`,
          category,
          description: description || null,
          status,
        });
      } catch (sbErr) {
        console.warn('Could not sync report to Supabase:', sbErr);
      }
    }

    res.status(201).json({ ...localReport, shadowbanned: status === 'Shadowbanned' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/reports/:id/validate — community validation
router.patch('/:id/validate', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { user_id, verdict } = req.body;

    if (!user_id || !['safe', 'unsafe'].includes(verdict)) {
      return res.status(400).json({ error: 'user_id and verdict (safe|unsafe) are required' });
    }

    if (isSupabaseConfigured) {
      await applyValidation(String(id), String(user_id), verdict as 'safe' | 'unsafe');
    }
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
