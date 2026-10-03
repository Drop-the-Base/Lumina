import { SafeHaven } from '@/store/appStore';

// In browser, relative URLs like /api/... work directly against Next.js.
// If NEXT_PUBLIC_BACKEND_URL is explicitly set to an external service, use it.
const BASE = process.env.NEXT_PUBLIC_BACKEND_URL || '';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const url = BASE ? `${BASE}${path}` : path;
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
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
    category: string;
    description?: string;
    lat: number;
    lng: number;
  }>;
  extra_distance_meters: number;
  extra_duration_seconds: number;
  avoided_categories: string[];
  steps?: RouteStep[];
}

export const api = {
  // Places (Safe Havens & Personal Places) - stored in Database
  getPlaces: (): Promise<SafeHaven[]> => request('/api/places'),

  addPlace: (place: Omit<SafeHaven, 'id'>): Promise<SafeHaven> =>
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
  }) => request('/api/reports', { method: 'POST', body: JSON.stringify(data) }),

  validateReport: (reportId: string, userId: string, verdict: 'safe' | 'unsafe') =>
    request(`/api/reports/${reportId}/validate`, {
      method: 'PATCH',
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
  fireSos: (data: { user_id?: string; trigger_type: string; lat: number; lng: number }) =>
    request('/api/sos', { method: 'POST', body: JSON.stringify(data) }),
};
