import { NextResponse } from 'next/server';
import { DbError, storageMode } from './db';

/** JSON response that also tells the client whether the data is really persisted. */
export function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { 'x-lumina-storage': storageMode(), 'cache-control': 'no-store' },
  });
}

export function errorResponse(err: unknown) {
  const status = err instanceof DbError ? err.status : 500;
  const message = err instanceof Error ? err.message : 'Unknown error';
  if (status >= 500) console.error('[api]', err);
  return json({ error: message }, status);
}

export function isValidCoord(lat: unknown, lng: unknown) {
  const la = Number(lat);
  const ln = Number(lng);
  return Number.isFinite(la) && Number.isFinite(ln) && Math.abs(la) <= 90 && Math.abs(ln) <= 180;
}
