import { SafeHaven, Report } from '@/store/appStore';

// In browser, relative URLs like /api/... work directly against Next.js.
// If NEXT_PUBLIC_BACKEND_URL is explicitly set to an external service, use it.
const BASE = process.env.NEXT_PUBLIC_BACKEND_URL || '';

export type StorageMode = 'supabase' | 'file' | 'memory';

/** Last storage mode reported by the server; 'memory' means writes are not persisted. */
export let lastStorageMode: StorageMode | null = null;

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const url = BASE ? `${BASE}${path}` : path;
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    cache: 'no-store',
    ...options,
  });
  const mode = res.headers.get('x-lumina-storage');
  if (mode) lastStorageMode = mode as StorageMode;
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `Request failed: ${res.status}`);
  }
  return res.json();
}

export interface RouteStep {
  instruction: string;
  street: string;
  distance_meters: number;
  duration_seconds: number;
  type: string;
  modifier: string;
  location: [number, number]; // [lng, lat]
}

export interface RouteResponse {
  fastest: GeoJSON.Feature;
  safest: GeoJSON.Feature;
  is_safe: boolean;
  safety_status: 'safe' | 'unsafe';
  danger_reports_on_fastest: number;
  danger_reports_on_safest: number;
  dangers_on_route: Array<{
    report_id?: string;
    category: string;
    description?: string;
    lat: number;
    lng: number;
  }>;
  extra_distance_meters: number;
  extra_duration_seconds: number;
  avoided_categories: string[];
  avoided_count?: number;
  lighting?: {
    safest_lit_ratio: number;
    safest_unlit_meters: number;
    fastest_lit_ratio: number;
    fastest_unlit_meters: number;
  };
  fallback?: boolean;
  steps?: RouteStep[];
}

export interface SosResponse {
  ok: boolean;
  event_id: string;
  sms_gateway: boolean;
  sms_sent: number;
  sms_requested: number;
}

export const api = {
  // Places (Safe Havens & Personal Places) - stored in Database
  getPlaces: (): Promise<SafeHaven[]> => request('/api/places'),

  addPlace: (place: Omit<SafeHaven, 'id'> & { owner_id?: string }): Promise<SafeHaven> =>
    request('/api/places', {
      method: 'POST',
      body: JSON.stringify(place),
    }),

  deletePlace: (id: string): Promise<{ ok: boolean; deleted_id: string }> =>
    request(`/api/places/${id}`, {
      method: 'DELETE',
    }),

  // Reports
  getReports: (): Promise<GeoJSON.FeatureCollection> => request('/api/reports'),

  submitReport: (data: {
    lat: number;
    lng: number;
    category: string;
    description?: string;
    author_id?: string;
  }): Promise<Report> => request('/api/reports', { method: 'POST', body: JSON.stringify(data) }),

  voteReport: (reportId: string, userId: string, verdict: 'confirm' | 'deny'): Promise<Report> =>
    request(`/api/reports/${encodeURIComponent(reportId)}/vote`, {
      method: 'POST',
      body: JSON.stringify({ user_id: userId, verdict }),
    }),

  // Routing
  getRoute: (from: [number, number], to: [number, number]): Promise<RouteResponse> =>
    request<RouteResponse>('/api/route', {
      method: 'POST',
      body: JSON.stringify({
        from_lat: from[0],
        from_lng: from[1],
        to_lat: to[0],
        to_lng: to[1],
      }),
    }),

  // SOS
  fireSos: (data: {
    user_id?: string;
    trigger_type: string;
    lat: number;
    lng: number;
    contacts: Array<{ name: string; phone: string }>;
  }): Promise<SosResponse> =>
    request('/api/sos', { method: 'POST', body: JSON.stringify(data), signal: AbortSignal.timeout(10000) }),
};
