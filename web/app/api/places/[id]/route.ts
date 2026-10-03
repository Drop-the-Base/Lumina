import { NextRequest, NextResponse } from 'next/server';
import { deletePlace } from '@/lib/db';

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const deleted = deletePlace(id);
    if (!deleted) {
      return NextResponse.json({ error: 'Place not found' }, { status: 404 });
    }
    return NextResponse.json({ ok: true, deleted_id: id });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
