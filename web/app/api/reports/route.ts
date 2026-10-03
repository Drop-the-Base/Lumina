import { NextRequest, NextResponse } from 'next/server';
import { getReports, addReport } from '@/lib/db';

export async function GET() {
  try {
    const reports = getReports();
    const featureCollection = {
      type: 'FeatureCollection',
      features: reports.map((r) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [r.lng, r.lat] },
        properties: {
          report_id: r.report_id,
          author_id: r.author_id,
          category: r.category,
          description: r.description,
          validation_count: r.validation_count,
          status: r.status,
          created_at: r.created_at,
        },
      })),
    };

    return NextResponse.json(featureCollection);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { lat, lng, category, description, author_id } = body;

    if (lat === undefined || lng === undefined || !category) {
      return NextResponse.json(
        { error: 'lat, lng, and category are required' },
        { status: 400 }
      );
    }

    const newReport = addReport({
      lat: Number(lat),
      lng: Number(lng),
      category,
      description: description ? String(description).trim() : undefined,
      author_id,
    });

    return NextResponse.json(newReport, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
