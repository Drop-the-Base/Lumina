import { NextRequest } from 'next/server';
import { recordSos, SosTrigger } from '@/lib/db';
import { json, errorResponse, isValidCoord } from '@/lib/apiHelpers';
import { sendSms, smsGatewayConfigured, sosMessage } from '@/lib/sms';

const TRIGGERS: SosTrigger[] = ['Manual', 'Accelerometer', 'GPS_Deviation', 'Timeout', 'LowBattery', 'DeadManSwitch'];

export async function POST(req: NextRequest) {
  try {
    const { user_id, trigger_type, lat, lng, contacts } = await req.json();

    if (!isValidCoord(lat, lng)) return json({ error: 'lat and lng are required' }, 400);
    const trigger: SosTrigger = TRIGGERS.includes(trigger_type) ? trigger_type : 'Manual';

    const phones: string[] = Array.isArray(contacts)
      ? contacts
          .map((c: any) => String(c?.phone ?? '').replace(/[^\d+]/g, ''))
          .filter((p: string) => p.length >= 9)
          .slice(0, 10)
      : [];

    const smsSent = await sendSms(phones, sosMessage(Number(lat), Number(lng), trigger));

    const eventId = await recordSos({
      user_id,
      trigger_type: trigger,
      lat: Number(lat),
      lng: Number(lng),
      dispatched_via: smsSent > 0 ? 'SMS' : 'API',
      contacts_notified: smsSent,
    });

    return json({
      ok: true,
      event_id: eventId,
      sms_gateway: smsGatewayConfigured(),
      sms_sent: smsSent,
      sms_requested: phones.length,
    });
  } catch (err) {
    return errorResponse(err);
  }
}
