import { NextRequest } from 'next/server';
import { voteReport } from '@/lib/db';
import { json, errorResponse } from '@/lib/apiHelpers';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { user_id, verdict } = await req.json();

    if (verdict !== 'confirm' && verdict !== 'deny') {
      return json({ error: "verdict must be 'confirm' or 'deny'" }, 400);
    }

    const report = await voteReport(id, user_id, verdict);
    return json(report);
  } catch (err) {
    return errorResponse(err);
  }
}
