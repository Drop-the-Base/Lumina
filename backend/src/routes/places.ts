import { Router, Request, Response } from 'express';
import { supabase, isSupabaseConfigured } from '../db/supabase';
import { getLocalPlaces, addLocalPlace, deleteLocalPlace } from '../services/dbStore';

const router = Router();

// GET /api/places
router.get('/', async (_req: Request, res: Response) => {
  try {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase.from('places').select('*').order('created_at', { ascending: false });
      if (!error && data) {
        return res.json(data);
      }
    }
    const local = getLocalPlaces();
    res.json(local);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/places
router.post('/', async (req: Request, res: Response) => {
  try {
    const { name, category, address, lat, lng, icon } = req.body;

    if (!name || !category || lat === undefined || lng === undefined) {
      return res.status(400).json({ error: 'name, category, lat, and lng are required' });
    }

    const iconMap: Record<string, string> = {
      Police: '🚓',
      SafeHaven: '🛡️',
      Personal: '🏠',
      Medical: '🏥',
    };

    const newPlace = addLocalPlace({
      name: String(name).trim(),
      category,
      address: address ? String(address).trim() : 'Wskazany punkt na mapie',
      lat: Number(lat),
      lng: Number(lng),
      icon: icon || iconMap[category] || '📍',
    });

    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from('places').insert({
          id: newPlace.id,
          name: newPlace.name,
          category: newPlace.category,
          address: newPlace.address,
          location: `POINT(${newPlace.lng} ${newPlace.lat})`,
          icon: newPlace.icon,
        });
      } catch (sbErr) {
        console.warn('Could not sync place to Supabase, saved locally:', sbErr);
      }
    }

    res.status(201).json(newPlace);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/places/:id
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const ok = deleteLocalPlace(String(id));
    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from('places').delete().eq('id', id);
      } catch {}
    }
    res.json({ ok, deleted_id: id });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
