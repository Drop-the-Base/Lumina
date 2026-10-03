import twilio from 'twilio';

export async function sendSosAlert(
  contacts: string[],
  userName: string,
  lat: number,
  lng: number
): Promise<void> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM_NUMBER;

  if (!sid || !token || !from || sid.startsWith('your_')) {
    console.warn('⚠️  Twilio not configured — SMS not sent. Set TWILIO_* env vars to enable.');
    console.info(`  Would have sent SOS to ${contacts.length} contacts for ${userName} at ${lat},${lng}`);
    return;
  }

  const client = twilio(sid, token);
  const mapsLink = `https://maps.google.com/?q=${lat},${lng}`;
  const body = `🆘 SAFETY ALERT: ${userName} triggered an emergency SOS. Last known location: ${mapsLink} — ImpactHer Safety App`;

  const results = await Promise.allSettled(
    contacts.map((to) =>
      client.messages.create({ from, to, body })
    )
  );

  const failed = results.filter((r) => r.status === 'rejected');
  if (failed.length > 0) {
    console.error(`SMS failed for ${failed.length}/${contacts.length} contacts`);
  } else {
    console.info(`✅ SOS SMS sent to ${contacts.length} contacts`);
  }
}

