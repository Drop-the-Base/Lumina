export type LngLat = [number, number];

const R = 6371000;
const toRad = (d: number) => (d * Math.PI) / 180;

export function distanceInMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const x = dLng * Math.cos(toRad((lat1 + lat2) / 2));
  return Math.sqrt(x * x + dLat * dLat) * R;
}

/** Distance from point P to segment AB, all as [lng, lat], using a local equirectangular projection. */
export function distanceToSegment(p: LngLat, a: LngLat, b: LngLat): number {
  const mPerLat = 111132;
  const mPerLng = 111320 * Math.cos(toRad(p[1]));
  const px = p[0] * mPerLng, py = p[1] * mPerLat;
  const ax = a[0] * mPerLng, ay = a[1] * mPerLat;
  const bx = b[0] * mPerLng, by = b[1] * mPerLat;
  const dx = bx - ax, dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  const t = lenSq === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/** Smallest distance from a point to a polyline and the index of the closest segment. */
export function distanceToPolyline(p: LngLat, line: LngLat[]): { distance: number; index: number } {
  if (line.length === 1) return { distance: distanceInMeters(p[1], p[0], line[0][1], line[0][0]), index: 0 };
  let best = { distance: Infinity, index: 0 };
  for (let i = 0; i < line.length - 1; i++) {
    const d = distanceToSegment(p, line[i], line[i + 1]);
    if (d < best.distance) best = { distance: d, index: i };
  }
  return best;
}

export function bearing(from: LngLat, to: LngLat): number {
  const φ1 = toRad(from[1]);
  const φ2 = toRad(to[1]);
  const Δλ = toRad(to[0] - from[0]);
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

/** Point `meters` away from `origin` in direction `bearingDeg`. */
export function offsetPoint(origin: LngLat, bearingDeg: number, meters: number): LngLat {
  const b = toRad(bearingDeg);
  const dLat = (meters * Math.cos(b)) / 111132;
  const dLng = (meters * Math.sin(b)) / (111320 * Math.cos(toRad(origin[1])));
  return [origin[0] + dLng, origin[1] + dLat];
}

/** Evenly spaced points along a polyline (always includes the first and last point). */
export function samplePolyline(line: LngLat[], stepMeters: number): LngLat[] {
  if (line.length < 2) return line.slice();
  const out: LngLat[] = [line[0]];
  let carry = 0;
  for (let i = 0; i < line.length - 1; i++) {
    const [a, b] = [line[i], line[i + 1]];
    const len = distanceInMeters(a[1], a[0], b[1], b[0]);
    let pos = stepMeters - carry;
    while (pos <= len) {
      const f = pos / len;
      out.push([a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]);
      pos += stepMeters;
    }
    carry = len - (pos - stepMeters);
  }
  out.push(line[line.length - 1]);
  return out;
}

export function polylineLength(line: LngLat[]): number {
  let total = 0;
  for (let i = 0; i < line.length - 1; i++) {
    total += distanceInMeters(line[i][1], line[i][0], line[i + 1][1], line[i + 1][0]);
  }
  return total;
}

/**
 * Loop erasure: whenever the line returns to a point it already visited,
 * drop everything in between. Removes out-and-back spurs created when a
 * routing via-point snaps onto a dead-end side street.
 * Returns the cleaned line and the junction points where loops were cut.
 */
export function eraseLoops(line: LngLat[]): { line: LngLat[]; junctions: LngLat[] } {
  const out: LngLat[] = [];
  const index = new Map<string, number>();
  const junctions: LngLat[] = [];
  const key = (p: LngLat) => `${p[0].toFixed(5)},${p[1].toFixed(5)}`;

  for (const p of line) {
    const k = key(p);
    const seenAt = index.get(k);
    if (seenAt !== undefined) {
      for (const removed of out.splice(seenAt + 1)) index.delete(key(removed));
      junctions.push(p);
      continue;
    }
    index.set(k, out.length);
    out.push(p);
  }
  return { line: out, junctions };
}
