import { NextRequest, NextResponse } from 'next/server';
import { getPlaces, addPlace } from '@/lib/db';

export async function GET() {
  try {
    const places = getPlaces();
    return NextResponse.json(places);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, category, address, lat, lng, icon } = body;

    if (!name || !category || lat === undefined || lng === undefined) {
      return NextResponse.json(
        { error: 'name, category, lat, and lng are required fields' },
        { status: 400 }
      );
    }

    const validCategories = ['Police', 'SafeHaven', 'Personal', 'Medical'];
    if (!validCategories.includes(category)) {
      return NextResponse.json(
        { error: `category must be one of: ${validCategories.join(', ')}` },
        { status: 400 }
      );
    }

    const iconMap: Record<string, string> = {
      Police: '🚓',
      SafeHaven: '🛡️',
      Personal: '🏠',
      Medical: '🏥',
    };

    const newPlace = addPlace({
      name: String(name).trim(),
      category,
      address: address ? String(address).trim() : 'Wskazany punkt na mapie',
      lat: Number(lat),
      lng: Number(lng),
      icon: icon || iconMap[category] || '📍',
    });

    return NextResponse.json(newPlace, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
