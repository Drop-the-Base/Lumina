import { NextRequest } from 'next/server';
import { getPlaces, addPlace } from '@/lib/db';
import { json, errorResponse, isValidCoord } from '@/lib/apiHelpers';

export const dynamic = 'force-dynamic';

const ICONS: Record<string, string> = {
  Police: '🚓',
  SafeHaven: '🛡️',
  Personal: '🏠',
  Medical: '🏥',
};

export async function GET() {
  try {
    return json(await getPlaces());
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { name, category, address, lat, lng, icon, owner_id } = await req.json();

    if (!name || !String(name).trim() || !isValidCoord(lat, lng)) {
      return json({ error: 'name, lat and lng are required' }, 400);
    }
    if (!(category in ICONS)) {
      return json({ error: `category must be one of: ${Object.keys(ICONS).join(', ')}` }, 400);
    }

    const place = await addPlace(
      {
        name: String(name).trim().slice(0, 120),
        category,
        address: address ? String(address).trim().slice(0, 200) : 'Wskazany punkt na mapie',
        lat: Number(lat),
        lng: Number(lng),
        icon: icon || ICONS[category],
      },
      owner_id
    );

    return json(place, 201);
  } catch (err) {
    return errorResponse(err);
  }
}
