const BASE = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `Request failed: ${res.status}`);
  }
  return res.json();
}

export const api = {
  // Reports
  getReports: () => request<GeoJSON.FeatureCollection>('/api/reports'),

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
  getRoute: (from: [number, number], to: [number, number]) =>
    request<{
      fastest: GeoJSON.Feature;
      safest: GeoJSON.Feature;
      danger_reports_on_fastest: number;
      danger_reports_on_safest: number;
      extra_distance_meters: number;
      extra_duration_seconds: number;
      avoided_categories: string[];
    }>(
      '/api/route',
      {
        method: 'POST',
        body: JSON.stringify({
          from_lat: from[0],
          from_lng: from[1],
          to_lat: to[0],
          to_lng: to[1],
        }),
      }
    ),

  // SOS
  fireSos: (data: { user_id?: string; trigger_type: string; lat: number; lng: number }) =>
    request('/api/sos', { method: 'POST', body: JSON.stringify(data) }),
};
