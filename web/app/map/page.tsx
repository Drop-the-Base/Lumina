'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/store/appStore';
import { api } from '@/lib/api';
import { SensorEngine } from '@/lib/sensorEngine';
import ReportModal from '@/components/ReportModal';

let maplibregl: any;

const KRAKOW_CENTER: [number, number] = [19.9449, 50.0646]; // [lng, lat]

function formatMin(seconds: number) {
  return `${Math.round(seconds / 60)} min`;
}
function formatKm(meters: number) {
  return meters >= 1000 ? `${(meters / 1000).toFixed(1)} km` : `${meters} m`;
}

export default function MapPage() {
  const router = useRouter();
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const sensorRef = useRef<SensorEngine | null>(null);
  const userMarkerRef = useRef<any>(null);
  const destMarkerRef = useRef<any>(null);

  const {
    reports, setReports,
    routeData, setRouteData,
    activeRoute, setActiveRoute,
    activateSOS,
    reportModalOpen, setReportModalOpen,
    setUserLocation, userLocation,
    destination, setDestination,
  } = useAppStore();

  const [mapLoaded, setMapLoaded] = useState(false);
  const [loadingRoute, setLoadingRoute] = useState(false);

  // Load MapLibre and init map
  useEffect(() => {
    (async () => {
      const mod = await import('maplibre-gl');
      maplibregl = mod.default || mod;
      await import('maplibre-gl/dist/maplibre-gl.css' as any);
      maplibregl.setWorkerUrl('https://unpkg.com/maplibre-gl@6.11.2/dist/maplibre-gl-worker.mjs');

      if (!mapContainer.current || mapRef.current) return;

      const map = new maplibregl.Map({
        container: mapContainer.current,
        style: process.env.NEXT_PUBLIC_MAP_STYLE || 'https://tiles.openfreemap.org/styles/liberty',
        center: KRAKOW_CENTER,
        zoom: 14,
      });

      map.on('load', () => {
        setMapLoaded(true);

        map.addSource('safe-route', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
        map.addSource('fast-route', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
        map.addSource('reports', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });

        // Both routes always visible; active one is thicker/brighter (updated via setPaintProperty)
        map.addLayer({
          id: 'fast-route-line', type: 'line', source: 'fast-route',
          paint: { 'line-color': '#3b82f6', 'line-width': 3, 'line-opacity': 0.35, 'line-dasharray': [4, 2] },
        });
        map.addLayer({
          id: 'safe-route-line', type: 'line', source: 'safe-route',
          paint: { 'line-color': '#22c55e', 'line-width': 6, 'line-opacity': 0.95 },
        });

        // Danger report circles
        map.addLayer({
          id: 'reports-circles', type: 'circle', source: 'reports',
          paint: {
            'circle-radius': 10,
            'circle-color': ['match', ['get', 'category'],
              'Suspicious Activity', '#ef4444',
              'Lighting Issue', '#f59e0b',
              'Obstacle', '#f97316',
              '#6b7280'],
            'circle-opacity': 0.85,
            'circle-stroke-color': '#fff',
            'circle-stroke-width': 2,
          },
        });
      });

      map.on('click', (e: any) => {
        const { lng, lat } = e.lngLat;
        setDestination([lat, lng]);
      });

      mapRef.current = map;
    })();

    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  // Fixed demo location — Kraków center
  useEffect(() => {
    setUserLocation([50.0646, 19.9449]);
  }, []);

  // Fetch reports on map load
  useEffect(() => {
    api.getReports().then((fc) => {
      const mapped = (fc.features || []).map((f: any) => ({
        ...f.properties,
        lat: f.geometry.coordinates[1],
        lng: f.geometry.coordinates[0],
      }));
      setReports(mapped);
      if (mapRef.current && mapLoaded) {
        mapRef.current.getSource('reports')?.setData(fc);
      }
    }).catch(console.error);
  }, [mapLoaded]);

  // Fetch route when destination changes
  useEffect(() => {
    if (!destination || !userLocation) return;
    setLoadingRoute(true);
    api.getRoute(userLocation, destination)
      .then((data) => setRouteData(data))
      .catch(console.error)
      .finally(() => setLoadingRoute(false));
  }, [destination, userLocation]);

  // Sync route GeoJSON to map sources
  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return;
    if (routeData.safest) mapRef.current.getSource('safe-route')?.setData(routeData.safest);
    if (routeData.fastest) mapRef.current.getSource('fast-route')?.setData(routeData.fastest);
  }, [routeData, mapLoaded]);

  // Sync markers
  useEffect(() => {
    if (!mapRef.current || !maplibregl) return;
    if (userLocation) {
      if (!userMarkerRef.current) {
        userMarkerRef.current = new maplibregl.Marker({ color: '#22c55e' })
          .setLngLat([userLocation[1], userLocation[0]])
          .addTo(mapRef.current);
      } else {
        userMarkerRef.current.setLngLat([userLocation[1], userLocation[0]]);
      }
    }
    if (destination) {
      if (!destMarkerRef.current) {
        destMarkerRef.current = new maplibregl.Marker({ color: '#3b82f6' })
          .setLngLat([destination[1], destination[0]])
          .addTo(mapRef.current);
      } else {
        destMarkerRef.current.setLngLat([destination[1], destination[0]]);
      }
    }
  }, [userLocation, destination, mapLoaded]);

  // Highlight active route (both stay visible; active = thick+bright, inactive = thin+dim)
  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return;
    const safeActive = activeRoute === 'safe';
    mapRef.current.setPaintProperty('safe-route-line', 'line-opacity', safeActive ? 0.95 : 0.3);
    mapRef.current.setPaintProperty('safe-route-line', 'line-width', safeActive ? 6 : 3);
    mapRef.current.setPaintProperty('fast-route-line', 'line-opacity', safeActive ? 0.3 : 0.85);
    mapRef.current.setPaintProperty('fast-route-line', 'line-width', safeActive ? 3 : 5);
  }, [activeRoute, mapLoaded]);

  // Start sensor engine
  useEffect(() => {
    sensorRef.current = new SensorEngine((type) => {
      activateSOS(type);
      router.push('/sos');
    });
    sensorRef.current.start();
    return () => sensorRef.current?.stop();
  }, []);

  const hasRoutes = !!routeData.fastest;
  const extraDuration = Math.max(0, routeData.extra_duration_seconds);
  const extraDistance = routeData.extra_distance_meters;
  const hasDetour = routeData.avoided_categories.length > 0;

  return (
    <div className="relative w-full h-screen overflow-hidden bg-gray-950">
      <div ref={mapContainer} className="w-full h-full" />

      {/* Top bar */}
      <div className="absolute top-4 left-4 right-4 flex items-start justify-between pointer-events-none">
        <div className="pointer-events-auto bg-gray-900/90 backdrop-blur rounded-2xl px-4 py-2.5 border border-gray-700 shadow-xl">
          <div className="text-white font-bold text-sm">🛡️ Lumina</div>
          {loadingRoute && (
            <div className="text-blue-400 text-xs mt-0.5">Calculating safe route...</div>
          )}
        </div>

        <button
          onClick={() => router.push('/sos')}
          className="pointer-events-auto w-14 h-14 bg-red-600 hover:bg-red-500 rounded-full flex items-center justify-center shadow-lg shadow-red-900/50 transition-all active:scale-95"
        >
          <span className="text-white font-black text-sm">SOS</span>
        </button>
      </div>

      {/* Route comparison panel */}
      {hasRoutes && (
        <div className="absolute bottom-24 left-4 right-4 pointer-events-auto">
          <div className="bg-gray-900/95 backdrop-blur border border-gray-700 rounded-2xl p-4 shadow-2xl">
            <div className="text-[11px] text-gray-400 font-semibold uppercase tracking-widest mb-3">
              Route Comparison
            </div>

            <div className="grid grid-cols-2 gap-2">
              {/* Fast route card */}
              <button
                onClick={() => setActiveRoute('fast')}
                className={`rounded-xl p-3 border text-left transition-all ${
                  activeRoute === 'fast'
                    ? 'border-blue-500 bg-blue-900/30'
                    : 'border-gray-700 bg-gray-800/40 opacity-70'
                }`}
              >
                <div className="flex items-center gap-1.5 mb-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-500 flex-shrink-0" />
                  <span className="text-white font-bold text-sm">Fast</span>
                  {activeRoute === 'fast' && (
                    <span className="ml-auto text-[10px] text-blue-400 font-semibold">ACTIVE</span>
                  )}
                </div>
                <div className="text-white text-xl font-bold leading-none">
                  {formatMin(routeData.fastest!.properties?.duration_seconds || 0)}
                </div>
                <div className="text-gray-400 text-xs mt-0.5">
                  {formatKm(routeData.fastest!.properties?.distance_meters || 0)}
                </div>
                <div className="mt-2">
                  {routeData.danger_reports_on_fastest > 0 ? (
                    <span className="text-red-400 text-xs">
                      ⚠️ {routeData.danger_reports_on_fastest} danger zone{routeData.danger_reports_on_fastest > 1 ? 's' : ''}
                    </span>
                  ) : (
                    <span className="text-green-400 text-xs">✅ No danger</span>
                  )}
                </div>
              </button>

              {/* Safe route card */}
              <button
                onClick={() => setActiveRoute('safe')}
                className={`rounded-xl p-3 border text-left transition-all ${
                  activeRoute === 'safe'
                    ? 'border-green-500 bg-green-900/30'
                    : 'border-gray-700 bg-gray-800/40 opacity-70'
                }`}
              >
                <div className="flex items-center gap-1.5 mb-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-green-500 flex-shrink-0" />
                  <span className="text-white font-bold text-sm">Safe</span>
                  {activeRoute === 'safe' && (
                    <span className="ml-auto text-[10px] text-green-400 font-semibold">ACTIVE</span>
                  )}
                </div>
                <div className="text-white text-xl font-bold leading-none">
                  {formatMin(routeData.safest?.properties?.duration_seconds || 0)}
                  {extraDuration > 30 && (
                    <span className="text-gray-400 text-sm font-normal ml-1">
                      +{Math.round(extraDuration / 60)}m
                    </span>
                  )}
                </div>
                <div className="text-gray-400 text-xs mt-0.5">
                  {formatKm(routeData.safest?.properties?.distance_meters || 0)}
                  {extraDistance > 50 && (
                    <span className="text-gray-500 ml-1">
                      (+{formatKm(extraDistance)})
                    </span>
                  )}
                </div>
                <div className="mt-2">
                  {routeData.danger_reports_on_safest > 0 ? (
                    <span className="text-orange-400 text-xs">
                      ⚠️ {routeData.danger_reports_on_safest} remaining
                    </span>
                  ) : (
                    <span className="text-green-400 text-xs">✅ Danger free</span>
                  )}
                </div>
              </button>
            </div>

            {/* Detour explanation */}
            {hasDetour ? (
              <div className="mt-3 pt-3 border-t border-gray-700/60 text-xs">
                <span className="text-gray-400">Safe route detours to avoid: </span>
                <span className="text-amber-400 font-medium">
                  {routeData.avoided_categories.join(' · ')}
                </span>
              </div>
            ) : (
              <div className="mt-3 pt-3 border-t border-gray-700/60 text-xs text-gray-500">
                Both routes have similar safety based on current reports.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tap hint */}
      {!destination && (
        <div className="absolute bottom-28 left-1/2 -translate-x-1/2 bg-gray-900/80 backdrop-blur rounded-xl px-4 py-2 text-xs text-gray-400 whitespace-nowrap">
          Tap anywhere on the map to set destination
        </div>
      )}

      {/* Legend */}
      <div className="absolute bottom-8 left-4 bg-gray-900/90 backdrop-blur rounded-xl p-3 border border-gray-700 text-xs space-y-1.5">
        <div className="flex items-center gap-2">
          <span className="w-4 h-1.5 bg-green-500 rounded" />
          <span className="text-gray-300">Safe route</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-4 h-1" style={{ background: 'repeating-linear-gradient(to right,#3b82f6 0,#3b82f6 4px,transparent 4px,transparent 6px)' }} />
          <span className="text-gray-300">Fast route</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-red-500 inline-block" />
          <span className="text-gray-300">Suspicious</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-amber-500 inline-block" />
          <span className="text-gray-300">Lighting</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-orange-500 inline-block" />
          <span className="text-gray-300">Obstacle</span>
        </div>
      </div>

      {/* Report danger button */}
      <div className="absolute bottom-8 right-4">
        <button
          onClick={() => setReportModalOpen(true)}
          className="bg-violet-600 hover:bg-violet-500 text-white rounded-full px-5 py-3 font-semibold shadow-lg shadow-violet-900/50 transition-all active:scale-95 flex items-center gap-2"
        >
          ⚠️ Report Danger
        </button>
      </div>

      {reportModalOpen && <ReportModal />}
    </div>
  );
}
