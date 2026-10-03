'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/store/appStore';
import { api } from '@/lib/api';
import { SensorEngine } from '@/lib/sensorEngine';
import ReportModal from '@/components/ReportModal';
import AddHavenModal from '@/components/AddHavenModal';

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
  const havenMarkersRef = useRef<any[]>([]);
  const reportPopupRef = useRef<any>(null);
  const sourcesReadyRef = useRef(false);

  const {
    reports, setReports,
    safeHavens,
    routeData, setRouteData,
    activeRoute, setActiveRoute,
    activateSOS,
    reportModalOpen, setReportModalOpen,
    addHavenModalOpen, setAddHavenModalOpen,
    setUserLocation, userLocation,
    destination, setDestination,
    deadManSettings,
    toastMessage,
  } = useAppStore();

  const [mapLoaded, setMapLoaded] = useState(false);
  const [loadingRoute, setLoadingRoute] = useState(false);
  const [showPanel, setShowPanel] = useState(false);

  // Load MapLibre and init map
  useEffect(() => {
    (async () => {
      const mod: any = await import('maplibre-gl');
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
        sourcesReadyRef.current = true;
        setMapLoaded(true);

        map.addSource('safe-route', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
        map.addSource('reports', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });

        // Only the safe route is shown on the map
        map.addLayer({
          id: 'safe-route-line', type: 'line', source: 'safe-route',
          paint: { 'line-color': '#22c55e', 'line-width': 6, 'line-opacity': 0.95 },
        });

        // Danger report circles
        map.addLayer({
          id: 'reports-circles', type: 'circle', source: 'reports',
          paint: {
            'circle-radius': 11,
            'circle-color': ['match', ['get', 'category'],
              'Suspicious Activity', '#ef4444',
              'Lighting Issue', '#f59e0b',
              'Obstacle', '#f97316',
              '#6b7280'],
            'circle-opacity': 0.9,
            'circle-stroke-color': '#fff',
            'circle-stroke-width': 2,
          },
        });

        // Report hover/click popups
        const CATEGORY_META: Record<string, { emoji: string; color: string }> = {
          'Suspicious Activity': { emoji: '🚨', color: '#ef4444' },
          'Lighting Issue':      { emoji: '💡', color: '#f59e0b' },
          'Obstacle':            { emoji: '🚧', color: '#f97316' },
        };

        map.on('click', 'reports-circles', (e: any) => {
          if (!e.features?.length) return;
          const props = e.features[0].properties;
          const coords = (e.features[0].geometry as any).coordinates.slice() as [number, number];
          const meta = CATEGORY_META[props.category] ?? { emoji: '⚠️', color: '#6b7280' };

          const diff = props.created_at ? Date.now() - new Date(props.created_at).getTime() : 0;
          const h = Math.floor(diff / 3600000);
          const m = Math.floor((diff % 3600000) / 60000);
          const timeAgo = diff ? (h > 0 ? `${h}h temu` : `${m}m temu`) : '';

          reportPopupRef.current?.remove();
          reportPopupRef.current = new maplibregl.Popup({ offset: 16, maxWidth: '260px', closeButton: true })
            .setLngLat(coords)
            .setHTML(`
              <div style="font-family:sans-serif;padding:4px 0;">
                <div style="display:flex;align-items:center;gap:7px;margin-bottom:7px;">
                  <span style="font-size:22px;line-height:1;">${meta.emoji}</span>
                  <span style="font-weight:700;font-size:13px;color:${meta.color};">${props.category}</span>
                </div>
                ${props.description
                  ? `<div style="font-size:12px;color:#374151;margin-bottom:8px;line-height:1.45;">"${props.description}"</div>`
                  : ''}
                <div style="display:flex;justify-content:space-between;align-items:center;font-size:11px;color:#6b7280;border-top:1px solid #e5e7eb;padding-top:6px;">
                  <span>👍 ${props.validation_count ?? 0} potwierdzeń</span>
                  ${timeAgo ? `<span>${timeAgo}</span>` : ''}
                </div>
              </div>
            `)
            .addTo(map);
        });

        map.on('mouseenter', 'reports-circles', () => { map.getCanvas().style.cursor = 'pointer'; });
        map.on('mouseleave', 'reports-circles', () => { map.getCanvas().style.cursor = ''; });
      });

      // General map click — set destination, but not when clicking a report circle
      map.on('click', (e: any) => {
        const hit = map.queryRenderedFeatures(e.point, { layers: ['reports-circles'] });
        if (hit.length > 0) return;
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

  // Fetch initial reports on map load
  useEffect(() => {
    api.getReports().then((fc) => {
      const mapped = (fc.features || []).map((f: any) => ({
        ...f.properties,
        lat: f.geometry.coordinates[1],
        lng: f.geometry.coordinates[0],
      }));
      setReports(mapped);
    }).catch(console.error);
  }, []);

  // Sync reports to map source when they change in store
  useEffect(() => {
    if (!mapRef.current || !mapLoaded || !sourcesReadyRef.current) return;
    const fc: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: reports.map((r: any) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [r.lng, r.lat] },
        properties: { ...r }
      }))
    };
    mapRef.current.getSource('reports')?.setData(fc);
  }, [reports, mapLoaded]);

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
    if (!mapRef.current || !sourcesReadyRef.current) return;
    if (routeData.safest) {
      mapRef.current.getSource('safe-route')?.setData(routeData.safest);
      setShowPanel(true); // auto-show panel when new route arrives
    }
  }, [routeData, mapLoaded]);

  // Fetch initial route when map loads (destination may already be set in store)
  useEffect(() => {
    if (!mapLoaded) return;
    const { destination: dest, userLocation: loc } = useAppStore.getState();
    if (dest && loc) {
      setLoadingRoute(true);
      api.getRoute(loc, dest)
        .then((data) => setRouteData(data))
        .catch(console.error)
        .finally(() => setLoadingRoute(false));
    }
  }, [mapLoaded]);

  // Sync markers (User + Destination)
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

  // Sync Safe Havens markers (Police, Safe Havens, Personal places)
  useEffect(() => {
    if (!mapRef.current || !maplibregl || !mapLoaded) return;

    // Clear old haven markers
    havenMarkersRef.current.forEach((m) => m.remove());
    havenMarkersRef.current = [];

    safeHavens.forEach((haven) => {
      const el = document.createElement('div');
      el.className = 'custom-haven-marker flex items-center justify-center cursor-pointer';
      
      const badgeBg = haven.category === 'Police'
        ? 'bg-blue-600 border-blue-300'
        : haven.category === 'SafeHaven'
        ? 'bg-emerald-600 border-emerald-300'
        : haven.category === 'Medical'
        ? 'bg-red-600 border-red-300'
        : 'bg-purple-600 border-purple-300';

      el.innerHTML = `
        <div class="w-8 h-8 rounded-full ${badgeBg} border-2 text-white flex items-center justify-center text-sm shadow-xl font-bold transform hover:scale-125 transition-transform origin-bottom">
          ${haven.icon || '🛡️'}
        </div>
      `;

      const popup = new maplibregl.Popup({ offset: 25 }).setHTML(`
        <div style="color: #111827; font-family: sans-serif; padding: 4px;">
          <div style="font-weight: bold; font-size: 13px; margin-bottom: 2px;">${haven.name}</div>
          <div style="font-size: 11px; color: #4b5563; margin-bottom: 6px;">${haven.address}</div>
          <button id="set-dest-${haven.id}" style="background-color: #059669; color: white; border: none; padding: 4px 8px; border-radius: 6px; font-size: 11px; font-weight: bold; cursor: pointer; width: 100%;">
            🎯 Ustaw jako bezpieczny cel
          </button>
        </div>
      `);

      popup.on('open', () => {
        const btn = document.getElementById(`set-dest-${haven.id}`);
        if (btn) {
          btn.onclick = () => {
            setDestination([haven.lat, haven.lng]);
            popup.remove();
          };
        }
      });

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([haven.lng, haven.lat])
        .setPopup(popup)
        .addTo(mapRef.current);

      havenMarkersRef.current.push(marker);
    });
  }, [safeHavens, mapLoaded]);

  // Highlight active route
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
    <div className="relative w-full h-full min-h-[600px] flex-1 overflow-hidden bg-gray-950">
      <div ref={mapContainer} className="w-full h-full" />

      {/* Top bar */}
      <div className="absolute top-4 left-4 right-4 flex items-start justify-between pointer-events-none">
        <div className="pointer-events-auto bg-gray-900/90 backdrop-blur rounded-2xl px-4 py-2.5 border border-gray-700 shadow-xl space-y-0.5">
          <div className="flex items-center gap-2">
            <span className="text-white font-bold text-sm">🛡️ Lumina</span>
            <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
              deadManSettings?.enabled
                ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                : 'bg-gray-800 text-gray-400'
            }`}>
              {deadManSettings?.enabled ? '⚡ Dead Man: ON' : 'OFF'}
            </span>
          </div>
          {loadingRoute && (
            <div className="text-blue-400 text-xs mt-0.5">Obliczanie bezpiecznej trasy...</div>
          )}
        </div>

        <button
          onClick={() => {
            activateSOS('Manual');
            router.push('/sos');
          }}
          className="pointer-events-auto w-14 h-14 bg-red-600 hover:bg-red-500 rounded-full flex flex-col items-center justify-center shadow-lg shadow-red-900/50 transition-all active:scale-95 border-2 border-red-400/50"
        >
          <span className="text-white font-black text-sm leading-none">SOS</span>
          <span className="text-[9px] text-red-200 font-bold tracking-tighter">({deadManSettings?.manualCountdownSeconds || 5}s)</span>
        </button>
      </div>

      {/* Safe route info panel */}
      {routeData.safest && showPanel && (
        <div className="absolute bottom-20 left-3 right-3 z-35 pointer-events-auto">
          <div className="bg-gray-900/95 backdrop-blur border border-gray-700 rounded-2xl p-3 shadow-2xl">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-green-500 flex-shrink-0" />
                <span className="text-white font-bold text-sm">Bezpieczna trasa</span>
                {routeData.danger_reports_on_safest === 0 && (
                  <span className="text-[10px] text-green-400 font-semibold bg-green-950/60 border border-green-800 px-1.5 py-0.5 rounded-full">✅ Czysta</span>
                )}
              </div>
              <button
                onClick={() => setShowPanel(false)}
                className="text-[10px] text-gray-400 hover:text-white px-1.5 py-0.5 rounded bg-gray-800"
              >
                ✕ Zamknij
              </button>
            </div>

            <div className="flex items-end gap-4">
              <div>
                <div className="text-white text-2xl font-bold leading-none">
                  {formatMin(routeData.safest.properties?.duration_seconds || 0)}
                </div>
                <div className="text-gray-400 text-xs mt-0.5">
                  {formatKm(routeData.safest.properties?.distance_meters || 0)}
                </div>
              </div>

              {routeData.danger_reports_on_safest > 0 && (
                <div className="text-orange-400 text-xs">
                  ⚠️ {routeData.danger_reports_on_safest} zagrożeń na trasie
                </div>
              )}
            </div>

            {hasDetour && (
              <div className="mt-2 pt-2 border-t border-gray-700/60 text-[10px]">
                <span className="text-gray-400">Trasa omija: </span>
                <span className="text-amber-400 font-medium">
                  {routeData.avoided_categories.join(' · ')}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tap hint */}
      {!destination && (
        <div className="absolute bottom-44 left-1/2 -translate-x-1/2 bg-gray-900/90 border border-gray-700 backdrop-blur rounded-xl px-3 py-1.5 text-[11px] text-gray-300 font-medium whitespace-nowrap z-30 shadow-lg">
          Kliknij na mapę lub posterunek / dom, aby wyznaczyć cel
        </div>
      )}

      {/* Legend (only shown when comparison panel is not active) */}
      {!hasRoutes && (
        <div className="absolute bottom-20 left-3 bg-gray-900/90 backdrop-blur rounded-xl p-2.5 border border-gray-700 text-[10px] space-y-1 z-30 shadow-xl max-w-[170px]">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-1 bg-green-500 rounded" />
            <span className="text-gray-300">Bezpieczna trasa</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-1" style={{ background: 'repeating-linear-gradient(to right,#3b82f6 0,#3b82f6 3px,transparent 3px,transparent 5px)' }} />
            <span className="text-gray-300">Najszybsza trasa</span>
          </div>
          <div className="flex items-center gap-1.5 pt-0.5">
            <span>🚓</span>
            <span className="text-blue-300 font-medium">Policja</span>
            <span className="ml-1">🛡️</span>
            <span className="text-emerald-300 font-medium">Safe Haven</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span>🏠</span>
            <span className="text-purple-300 font-medium">Mój Dom / Bliscy</span>
          </div>
        </div>
      )}

      {/* Action buttons (Report danger & Add Safe Haven) */}
      <div className={`absolute ${hasRoutes ? 'bottom-60' : 'bottom-20'} right-3 flex flex-col items-end gap-2 z-30 transition-all`}>
        <button
          onClick={() => setAddHavenModalOpen(true)}
          className="bg-emerald-600 hover:bg-emerald-500 text-white rounded-full px-4 py-2 font-semibold text-[13px] shadow-lg shadow-emerald-900/50 transition-all active:scale-95 flex items-center justify-center gap-1.5 border border-emerald-400/40 w-32"
        >
          <span>🏠 + Miejsce</span>
        </button>

        <button
          onClick={() => setReportModalOpen(true)}
          className="bg-red-600 hover:bg-red-500 text-white rounded-full px-4 py-2 font-semibold text-[13px] shadow-xl shadow-red-900/50 transition-all active:scale-95 flex items-center justify-center gap-1.5 border border-red-400/50 w-32"
        >
          <span>⚠️ + Zgłoś</span>
        </button>
      </div>

      {/* Global Toast */}
      {toastMessage && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-top-4 pointer-events-none">
          <div className="bg-green-600/95 backdrop-blur text-white px-4 py-2.5 rounded-full shadow-xl shadow-green-900/50 border border-green-400/50 font-bold text-sm flex items-center gap-2 whitespace-nowrap">
            <span>✅</span>
            <span>{toastMessage}</span>
          </div>
        </div>
      )}

      {reportModalOpen && <ReportModal />}
      {addHavenModalOpen && <AddHavenModal />}
    </div>
  );
}
