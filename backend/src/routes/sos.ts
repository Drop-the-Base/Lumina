import { Router, Request, Response } from 'express';
import { supabase, isSupabaseConfigured } from '../db/supabase';
import { sendSosAlert } from '../services/smsService';

const router = Router();

// POST /api/sos
router.post('/', async (req: Request, res: Response) => {
  try {
    const { user_id, trigger_type, lat, lng } = req.body;

    if (!trigger_type || !lat || !lng) {
      return res.status(400).json({ error: 'trigger_type, lat, and lng are required' });
    }

    const validTriggers = ['Manual', 'Accelerometer', 'GPS_Deviation', 'Timeout'];
    if (!validTriggers.includes(trigger_type)) {
      return res.status(400).json({ error: `trigger_type must be one of: ${validTriggers.join(', ')}` });
    }

    let eventId = 'sos_' + Date.now();
    let contactsNotified = 0;

    if (isSupabaseConfigured && supabase) {
      // 1. Insert SOS event
      const { data: event, error: insertError } = await supabase
        .from('sos_events')
        .insert({
          user_id: user_id || null,
          trigger_type,
          location: `POINT(${lng} ${lat})`,
          dispatched_via: 'API',
        })
        .select()
        .single();

      if (insertError) throw insertError;
      if (event) eventId = event.event_id;

      // 2. Fetch trusted contacts if user_id provided
      if (user_id) {
        const { data: user } = await supabase
          .from('users')
          .select('trusted_contacts, display_name')
          .eq('user_id', user_id)
          .single();

        if (user?.trusted_contacts?.length) {
          await sendSosAlert(user.trusted_contacts, user.display_name || 'A user', lat, lng);
          contactsNotified = user.trusted_contacts.length;

          await supabase
            .from('sos_events')
            .update({ contacts_notified: contactsNotified })
            .eq('event_id', eventId);
        }
      }
    }

    res.status(201).json({
      ok: true,
      event_id: eventId,
      dispatched: true,
      method: 'API',
      contacts_notified: contactsNotified,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
