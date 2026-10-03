import { NextRequest } from 'next/server';
import { getReports, addReport, ReportCategory } from '@/lib/db';
import { json, errorResponse, isValidCoord } from '@/lib/apiHelpers';

export const dynamic = 'force-dynamic';

const CATEGORIES: ReportCategory[] = ['Suspicious Activity', 'Lighting Issue', 'Obstacle'];

export async function GET() {
  try {
    const reports = await getReports();
    return json({
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
    });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { lat, lng, category, description, author_id } = await req.json();

    if (!isValidCoord(lat, lng) || !CATEGORIES.includes(category)) {
      return json({ error: `Valid lat, lng and category (${CATEGORIES.join(', ')}) are required` }, 400);
    }

    const report = await addReport({
      lat: Number(lat),
      lng: Number(lng),
      category,
      description: description ? String(description).trim().slice(0, 500) || undefined : undefined,
      author_id,
    });

    return json(report, 201);
  } catch (err) {
    return errorResponse(err);
  }
}
