import { Router, Request, Response } from 'express';
import { supabase } from '../db/supabase';
import { checkReputation, applyValidation } from '../services/trustEngine';

const router = Router();

// GET /api/reports — returns all Active reports as GeoJSON FeatureCollection
router.get('/', async (_req: Request, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('reports_with_coords')
      .select('*')
      .eq('status', 'Active')
      .order('created_at', { ascending: false });

    if (error) throw error;

    const featureCollection = {
      type: 'FeatureCollection',
      features: (data || []).map((r: any) => ({
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
    const reputation = author_id ? await checkReputation(author_id) : 1.0;
    const status = reputation < 0.3 ? 'Shadowbanned' : 'Active';

    const { data, error } = await supabase
      .from('reports')
      .insert({
        author_id: author_id || null,
        location: `POINT(${lng} ${lat})`,
        category,
        description: description || null,
        status,
      })
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({ ...data, shadowbanned: status === 'Shadowbanned' });
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

    await applyValidation(String(id), String(user_id), verdict as 'safe' | 'unsafe');
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
