/** Sends SMS through Twilio's REST API. Returns the number of messages accepted. */
export function smsGatewayConfigured() {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  return Boolean(sid && !sid.startsWith('your_') && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM_NUMBER);
}

export async function sendSms(recipients: string[], body: string): Promise<number> {
  if (!smsGatewayConfigured() || recipients.length === 0) return 0;

  const sid = process.env.TWILIO_ACCOUNT_SID!;
  const auth = Buffer.from(`${sid}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64');
  const url = `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`;

  const results = await Promise.allSettled(
    recipients.map(async (to) => {
      const res = await fetch(url, {
        method: 'POST',
        headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ From: process.env.TWILIO_FROM_NUMBER!, To: to, Body: body }),
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) throw new Error(`Twilio ${res.status}: ${await res.text()}`);
    })
  );

  results
    .filter((r): r is PromiseRejectedResult => r.status === 'rejected')
    .forEach((r) => console.error('[sms] send failed:', r.reason));
  return results.filter((r) => r.status === 'fulfilled').length;
}

export function sosMessage(lat: number, lng: number, trigger: string) {
  const reason = trigger === 'Manual' ? 'uruchomiła alarm SOS' : `wyzwolony automatycznie (${trigger})`;
  return `🆘 LUMINA SOS: ${reason}. Ostatnia lokalizacja: https://maps.google.com/?q=${lat.toFixed(5)},${lng.toFixed(5)}`;
}
