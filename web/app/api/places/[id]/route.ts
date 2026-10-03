import { NextRequest } from 'next/server';
import { deletePlace } from '@/lib/db';
import { json, errorResponse } from '@/lib/apiHelpers';

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!(await deletePlace(id))) return json({ error: 'Place not found' }, 404);
    return json({ ok: true, deleted_id: id });
  } catch (err) {
    return errorResponse(err);
  }
}
