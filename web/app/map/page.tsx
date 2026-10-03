'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/store/appStore';
import { api } from '@/lib/api';
import { SensorEngine } from '@/lib/sensorEngine';
import ReportModal from '@/components/ReportModal';

// MapLibre is client-side only
let maplibregl: any;

const KRAKOW_CENTER: [number, number] = [19.9449, 50.0646]; // [lng, lat]

const CATEGORY_COLORS: Record<string, string> = {
  'Suspicious Activity': '#ef4444',
  'Lighting Issue': '#f59e0b',
  'Obstacle': '#f97316',
};

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
    activeRoute, toggleRoute,
    activateSOS,
    reportModalOpen, setReportModalOpen,
    setUserLocation, userLocation,
    setDestination,
  } = useAppStore();

  const [mapLoaded, setMapLoaded] = useState(false);
  const [loadingRoute, setLoadingRoute] = useState(false);
  const [dangerCount, setDangerCount] = useState(0);

  // Load MapLibre and init map
  useEffect(() => {
    (async () => {
      const maplibreglModule = await import('maplibre-gl');
      maplibregl = maplibreglModule.default || maplibreglModule;
      await import('maplibre-gl/dist/maplibre-gl.css' as any);
      
      // Point MapLibre to the ESM worker on unpkg to bypass Next.js Turbopack bundling bugs
      maplibregl.setWorkerUrl('https://unpkg.com/maplibre-gl@6.11.2/dist/maplibre-gl-worker.mjs');

      if (!mapContainer.current || mapRef.current) return;

      const map = new maplibregl.Map({
        container: mapContainer.current,
        style: process.env.NEXT_PUBLIC_MAP_STYLE || 'https://demotiles.maplibre.org/style.json',
        center: KRAKOW_CENTER,
        zoom: 13,
      });

      map.on('load', () => {
        setMapLoaded(true);

        // Add empty route sources
        map.addSource('safe-route', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
        map.addSource('fast-route', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
        map.addSource('reports', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });

        // Safe route — green solid
        map.addLayer({ id: 'safe-route-line', type: 'line', source: 'safe-route',
          paint: { 'line-color': '#22c55e', 'line-width': 5, 'line-opacity': 0.9 } });

        // Fast route — blue dashed
        map.addLayer({ id: 'fast-route-line', type: 'line', source: 'fast-route',
          paint: { 'line-color': '#3b82f6', 'line-width': 4, 'line-opacity': 0.7,
            'line-dasharray': [4, 2] } });

        // Report markers
        map.addLayer({ id: 'reports-circles', type: 'circle', source: 'reports',
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

      // Click on map to set destination
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

  // Fetch reports and update map
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
  const { destination } = useAppStore();
  useEffect(() => {
    if (!destination || !userLocation) return;

    setLoadingRoute(true);
    api.getRoute(userLocation, destination).then((data) => {
      setRouteData(data);
      setDangerCount(data.danger_reports_on_fastest);

      if (mapRef.current) {
        mapRef.current.getSource('safe-route')?.setData(data.safest);
        mapRef.current.getSource('fast-route')?.setData(data.fastest);
      }
    }).catch(console.error).finally(() => setLoadingRoute(false));
  }, [destination, userLocation]);

  // Sync Markers
  useEffect(() => {
    if (!mapRef.current || !maplibregl) return;
    
    // User Location Marker (Green)
    if (userLocation) {
      if (!userMarkerRef.current) {
        userMarkerRef.current = new maplibregl.Marker({ color: '#22c55e' })
          .setLngLat([userLocation[1], userLocation[0]])
          .addTo(mapRef.current);
      } else {
        userMarkerRef.current.setLngLat([userLocation[1], userLocation[0]]);
      }
    }

    // Destination Marker (Blue)
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

  // Sync route visibility
  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return;
    mapRef.current.setLayoutProperty('safe-route-line', 'visibility', activeRoute === 'safe' ? 'visible' : 'none');
    mapRef.current.setLayoutProperty('fast-route-line', 'visibility', activeRoute === 'fast' ? 'visible' : 'none');
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

  return (
    <div className="relative w-full h-screen overflow-hidden bg-gray-950">
      {/* Map */}
      <div ref={mapContainer} className="w-full h-full" />

      {/* Top bar */}
      <div className="absolute top-4 left-4 right-4 flex items-start justify-between pointer-events-none">
        <div className="pointer-events-auto bg-gray-900/90 backdrop-blur rounded-2xl px-4 py-3 border border-gray-700">
          <div className="text-white font-bold text-sm">🛡️ ImpactHer</div>
          {dangerCount > 0 && (
            <div className="text-red-400 text-xs mt-0.5">
              ⚠️ {dangerCount} danger reports on fastest route
            </div>
          )}
        </div>

        {/* SOS button */}
        <button
          onClick={() => router.push('/sos')}
          className="pointer-events-auto w-14 h-14 bg-red-600 hover:bg-red-500 rounded-full flex items-center justify-center shadow-lg shadow-red-900/50 transition-all active:scale-95"
        >
          <span className="text-white font-black text-sm">SOS</span>
        </button>
      </div>

      {/* Route toggle */}
      {routeData.fastest && (
        <div className="absolute top-24 right-4 pointer-events-auto">
          <button
            onClick={toggleRoute}
            className="bg-gray-900/90 backdrop-blur border border-gray-700 rounded-xl px-3 py-2 text-sm text-white"
          >
            {activeRoute === 'safe' ? '🟢 Safe route' : '🔵 Fast route'}
            <span className="text-gray-400 ml-1">→ switch</span>
          </button>
        </div>
      )}

      {/* Route loading */}
      {loadingRoute && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
          <div className="bg-gray-900/90 backdrop-blur rounded-xl px-4 py-3 text-white text-sm">
            🔍 Calculating safe route...
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="absolute bottom-28 left-4 bg-gray-900/90 backdrop-blur rounded-xl p-3 border border-gray-700 text-xs space-y-1">
        <div className="text-gray-400 font-semibold mb-1">Legend</div>
        <div className="flex items-center gap-2"><span className="w-4 h-1 bg-green-500 rounded" />Safe route</div>
        <div className="flex items-center gap-2"><span className="w-4 h-1 bg-blue-500 rounded" style={{backgroundImage:'repeating-linear-gradient(to right,#3b82f6 0,#3b82f6 4px,transparent 4px,transparent 6px)'}}/>Fast route</div>
        <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-red-500 inline-block" />Suspicious</div>
        <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-amber-500 inline-block" />Lighting</div>
        <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-orange-500 inline-block" />Obstacle</div>
      </div>

      {/* Report button */}
      <div className="absolute bottom-8 right-4">
        <button
          onClick={() => setReportModalOpen(true)}
          className="bg-violet-600 hover:bg-violet-500 text-white rounded-full px-5 py-3 font-semibold shadow-lg shadow-violet-900/50 transition-all active:scale-95 flex items-center gap-2"
        >
          ⚠️ Report Danger
        </button>
      </div>

      {/* Tap hint */}
      {!destination && (
        <div className="absolute bottom-8 left-4 bg-gray-900/80 backdrop-blur rounded-xl px-3 py-2 text-xs text-gray-400">
          Tap map to set destination
        </div>
      )}

      {/* Report Modal */}
      {reportModalOpen && <ReportModal />}
    </div>
  );
}
