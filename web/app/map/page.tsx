'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAppStore, SafeHaven } from '@/store/appStore';
import { api, RouteResponse } from '@/lib/api';
import { SensorEngine } from '@/lib/sensorEngine';
import ReportModal from '@/components/ReportModal';
import AddHavenModal from '@/components/AddHavenModal';

let maplibregl: any;

const KRAKOW_CENTER: [number, number] = [19.9449, 50.0646]; // [lng, lat]

function formatMin(seconds: number) {
  return `${Math.max(1, Math.round(seconds / 60))} min`;
}
function formatKm(meters: number) {
  return meters >= 1000 ? `${(meters / 1000).toFixed(1)} km` : `${Math.round(meters)} m`;
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
  const destPopupRef = useRef<any>(null);
  const sourcesReadyRef = useRef(false);

  const {
    reports, setReports,
    safeHavens, setSafeHavens,
    routeData, setRouteData,
    activateSOS,
    reportModalOpen, setReportModalOpen,
    addHavenModalOpen, setAddHavenModalOpen,
    setUserLocation, userLocation,
    destination, setDestination,
    clickedLocation, setClickedLocation,
    deadManSettings,
    toastMessage,
  } = useAppStore();

  const [mapLoaded, setMapLoaded] = useState(false);
  const [loadingRoute, setLoadingRoute] = useState(false);
  const [showWidget, setShowWidget] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  // Initialize MapLibre
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

        // Source for Route
        map.addSource('safe-route', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] },
        });

        // Source for Danger Reports
        map.addSource('reports', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] },
        });

        // Layer for Route line (glow underneath)
        map.addLayer({
          id: 'safe-route-glow',
          type: 'line',
          source: 'safe-route',
          paint: {
            'line-color': '#22c55e',
            'line-width': 12,
            'line-opacity': 0.35,
            'line-blur': 3,
          },
        });

        // Layer for Route line (solid foreground)
        map.addLayer({
          id: 'safe-route-line',
          type: 'line',
          source: 'safe-route',
          paint: {
            'line-color': '#22c55e',
            'line-width': 6,
            'line-opacity': 0.95,
          },
        });

        // Layer for Danger reports
        map.addLayer({
          id: 'reports-circles',
          type: 'circle',
          source: 'reports',
          paint: {
            'circle-radius': 11,
            'circle-color': [
              'match', ['get', 'category'],
              'Suspicious Activity', '#ef4444',
              'Lighting Issue', '#f59e0b',
              'Obstacle', '#f97316',
              '#6b7280',
            ],
            'circle-opacity': 0.9,
            'circle-stroke-color': '#fff',
            'circle-stroke-width': 2,
          },
        });

        const CATEGORY_META: Record<string, { emoji: string; color: string }> = {
          'Suspicious Activity': { emoji: '🚨', color: '#ef4444' },
          'Lighting Issue': { emoji: '💡', color: '#f59e0b' },
          'Obstacle': { emoji: '🚧', color: '#f97316' },
        };

        // Click on danger report circle
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
          destPopupRef.current?.remove();

          reportPopupRef.current = new maplibregl.Popup({ offset: 16, maxWidth: '280px', closeButton: true })
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

      // Map click handler — sets destination, calculates route, and allows adding to database
      map.on('click', (e: any) => {
        const hit = map.queryRenderedFeatures(e.point, { layers: ['reports-circles'] });
        if (hit.length > 0) return;

        const { lng, lat } = e.lngLat;
        setDestination([lat, lng]);
        setClickedLocation([lat, lng]);
      });

      mapRef.current = map;
    })();

    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  // Set user start location (Kraków Main Station / Rynek area)
  useEffect(() => {
    setUserLocation([50.0646, 19.9449]);
  }, []);

  // Fetch Safe Havens from Database
  useEffect(() => {
    api.getPlaces()
      .then((places) => {
        if (places && Array.isArray(places)) {
          setSafeHavens(places);
        }
      })
      .catch((err) => console.error('Failed to load places from database:', err));
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
        properties: { ...r },
      })),
    };
    mapRef.current.getSource('reports')?.setData(fc);
  }, [reports, mapLoaded]);

  // Calculate route whenever destination or userLocation changes
  useEffect(() => {
    if (!destination || !userLocation) return;
    setLoadingRoute(true);
    setShowWidget(true);

    api.getRoute(userLocation, destination)
      .then((data: RouteResponse) => {
        setRouteData({
          ...data,
          is_safe: data.is_safe,
          safety_status: data.safety_status,
          dangers_on_route: data.dangers_on_route,
        });

        // Fit map bounds to encompass the route
        const geom = data.safest?.geometry as any;
        if (mapRef.current && geom?.coordinates) {
          const coords = geom.coordinates;
          if (coords.length > 1) {
            const bounds = coords.reduce(
              (acc: any, coord: any) => [
                Math.min(acc[0], coord[0]),
                Math.min(acc[1], coord[1]),
                Math.max(acc[2], coord[0]),
                Math.max(acc[3], coord[1]),
              ],
              [coords[0][0], coords[0][1], coords[0][0], coords[0][1]]
            );
            mapRef.current.fitBounds(bounds, {
              padding: { top: 70, bottom: 260, left: 40, right: 40 },
              maxZoom: 16,
              duration: 700,
            });
          }
        }
      })
      .catch((err) => console.error('Route calculation error:', err))
      .finally(() => setLoadingRoute(false));
  }, [destination, userLocation]);

  // Update Route GeoJSON on map and adjust colors based on safety
  useEffect(() => {
    if (!mapRef.current || !sourcesReadyRef.current) return;
    if (routeData.safest) {
      mapRef.current.getSource('safe-route')?.setData(routeData.safest);

      const isSafe = routeData.is_safe ?? (routeData.danger_reports_on_safest === 0);
      const routeColor = isSafe ? '#22c55e' : '#ef4444';
      const glowColor = isSafe ? '#22c55e' : '#ef4444';

      mapRef.current.setPaintProperty('safe-route-line', 'line-color', routeColor);
      mapRef.current.setPaintProperty('safe-route-glow', 'line-color', glowColor);
      setShowWidget(true);
    } else {
      mapRef.current.getSource('safe-route')?.setData({ type: 'FeatureCollection', features: [] });
    }
  }, [routeData, mapLoaded]);

  // Sync markers for User and Destination
  useEffect(() => {
    if (!mapRef.current || !maplibregl || !mapLoaded) return;

    // User Location Marker (Green Pulse)
    if (userLocation) {
      if (!userMarkerRef.current) {
        const el = document.createElement('div');
        el.className = 'w-7 h-7 rounded-full bg-emerald-500 border-3 border-white shadow-xl flex items-center justify-center text-[10px] text-white font-bold ring-4 ring-emerald-500/30 animate-pulse';
        el.innerHTML = '🚶';
        userMarkerRef.current = new maplibregl.Marker({ element: el })
          .setLngLat([userLocation[1], userLocation[0]])
          .addTo(mapRef.current);
      } else {
        userMarkerRef.current.setLngLat([userLocation[1], userLocation[0]]);
      }
    }

    // Destination Marker (Pin with quick actions)
    if (destination) {
      if (!destMarkerRef.current) {
        const destEl = document.createElement('div');
        destEl.className = 'w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-blue-600 border-2 border-white shadow-2xl flex items-center justify-center text-sm text-white font-black cursor-pointer hover:scale-110 transition-transform';
        destEl.innerHTML = '🎯';

        destMarkerRef.current = new maplibregl.Marker({ element: destEl })
          .setLngLat([destination[1], destination[0]])
          .addTo(mapRef.current);
      } else {
        destMarkerRef.current.setLngLat([destination[1], destination[0]]);
      }
    } else if (destMarkerRef.current) {
      destMarkerRef.current.remove();
      destMarkerRef.current = null;
    }
  }, [userLocation, destination, mapLoaded]);

  // Sync Safe Haven markers from Database
  useEffect(() => {
    if (!mapRef.current || !maplibregl || !mapLoaded) return;

    havenMarkersRef.current.forEach((m) => m.remove());
    havenMarkersRef.current = [];

    safeHavens.forEach((haven) => {
      const el = document.createElement('div');
      el.className = 'custom-haven-marker flex items-center justify-center cursor-pointer';

      const badgeBg =
        haven.category === 'Police'
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
        <div style="color: #111827; font-family: sans-serif; padding: 4px; min-width: 170px;">
          <div style="font-weight: bold; font-size: 13px; margin-bottom: 2px;">${haven.name}</div>
          <div style="font-size: 11px; color: #4b5563; margin-bottom: 8px;">${haven.address}</div>
          <button id="set-dest-${haven.id}" style="background-color: #059669; color: white; border: none; padding: 6px 10px; border-radius: 8px; font-size: 11px; font-weight: bold; cursor: pointer; width: 100%; display: flex; align-items: center; justify-content: center; gap: 4px;">
            <span>🎯 Wyznacz trasę tutaj</span>
          </button>
        </div>
      `);

      popup.on('open', () => {
        const btn = document.getElementById(`set-dest-${haven.id}`);
        if (btn) {
          btn.onclick = () => {
            setDestination([haven.lat, haven.lng]);
            setClickedLocation([haven.lat, haven.lng]);
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

  // Start sensor anomaly detection
  useEffect(() => {
    sensorRef.current = new SensorEngine((type) => {
      activateSOS(type);
      router.push('/sos');
    });
    sensorRef.current.start();
    return () => sensorRef.current?.stop();
  }, []);

  const handleClearRoute = () => {
    setDestination(null);
    setClickedLocation(null);
    setShowWidget(false);
    setRouteData({
      fastest: null,
      safest: null,
      is_safe: true,
      safety_status: 'safe',
      danger_reports_on_fastest: 0,
      danger_reports_on_safest: 0,
      extra_distance_meters: 0,
      extra_duration_seconds: 0,
      avoided_categories: [],
    });
    if (mapRef.current) {
      mapRef.current.getSource('safe-route')?.setData({ type: 'FeatureCollection', features: [] });
    }
  };

  const handleOpenAddHaven = () => {
    if (destination) {
      setClickedLocation(destination);
    }
    setAddHavenModalOpen(true);
  };

  const isSafe = routeData.is_safe ?? (routeData.danger_reports_on_safest === 0);
  const durationSec = routeData.safest?.properties?.duration_seconds || 0;
  const distanceMeters = routeData.safest?.properties?.distance_meters || 0;
  const dangerCount = routeData.danger_reports_on_safest || 0;
  const dangers = routeData.dangers_on_route || [];

  return (
    <div className="relative w-full h-full min-h-[600px] flex-1 overflow-hidden bg-gray-950">
      <div ref={mapContainer} className="w-full h-full" />

      {/* Top Bar */}
      <div className="absolute top-4 left-4 right-4 flex items-start justify-between pointer-events-none z-30">
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
          {loadingRoute ? (
            <div className="text-blue-400 text-xs mt-0.5 flex items-center gap-1.5 animate-pulse">
              <span className="w-2 h-2 rounded-full bg-blue-400 animate-ping" />
              <span>Wyznaczanie trasy i analiza bezpieczeństwa...</span>
            </div>
          ) : destination ? (
            <div className="text-gray-400 text-[11px] mt-0.5">
              Cel: <span className="text-white font-mono">{destination[0].toFixed(4)}, {destination[1].toFixed(4)}</span>
            </div>
          ) : (
            <div className="text-gray-400 text-[11px] mt-0.5">
              Kraków Centrum (Nawigacja bezpieczna)
            </div>
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
          <span className="text-[9px] text-red-200 font-bold tracking-tighter">
            ({deadManSettings?.manualCountdownSeconds || 5}s)
          </span>
        </button>
      </div>

      {/* Save Place Success Banner */}
      {saveSuccessMsg && (
        <div className="absolute top-20 left-4 right-4 z-40 bg-emerald-600 text-white font-bold text-xs p-3 rounded-2xl shadow-xl flex items-center justify-between animate-fade-in">
          <span>{saveSuccessMsg}</span>
          <button onClick={() => setSaveSuccessMsg(null)} className="text-white/80 hover:text-white">✕</button>
        </div>
      )}

      {/* ROUTE SAFETY WIDGET */}
      {routeData.safest && showWidget && (
        <div className="absolute bottom-20 left-3 right-3 z-35 pointer-events-auto animate-slide-up">
          <div
            className={`backdrop-blur rounded-2xl p-4 shadow-2xl transition-all border-2 ${
              isSafe
                ? 'bg-gray-900/95 border-emerald-500/80 shadow-emerald-950/40 ring-1 ring-emerald-500/20'
                : 'bg-gray-950/98 border-red-500 shadow-red-950/60 ring-2 ring-red-500/30'
            }`}
          >
            {/* Header: Safe vs Unsafe Badge */}
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-2">
                <span
                  className={`w-3.5 h-3.5 rounded-full flex-shrink-0 ${
                    isSafe ? 'bg-emerald-500 animate-pulse' : 'bg-red-500 animate-ping'
                  }`}
                />
                <h3
                  className={`font-black text-sm tracking-wide flex items-center gap-1.5 ${
                    isSafe ? 'text-emerald-400' : 'text-red-400'
                  }`}
                >
                  {isSafe ? '🛡️ TRASA JEST BEZPIECZNA' : '⚠️ TRASA JEST NIEBEZPIECZNA'}
                </h3>
              </div>

              <div className="flex items-center gap-1.5">
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                    isSafe
                      ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
                      : 'bg-red-950 text-red-300 border-red-800'
                  }`}
                >
                  {isSafe ? '✅ Czysta trasa' : `🚨 Zagrożenia: ${dangerCount}`}
                </span>
                <button
                  onClick={handleClearRoute}
                  className="text-[11px] text-gray-400 hover:text-white px-2 py-0.5 rounded-lg bg-gray-800/80 transition-colors"
                  title="Anuluj trasę"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Safety Assessment Description */}
            <div className="text-xs mb-3 text-gray-300 leading-snug">
              {isSafe ? (
                <p className="text-emerald-200/90 font-medium">
                  ✅ Na tej trasie nie wykryto żadnych zgłoszonych zagrożeń ani nieoświetlonych zaułków. Droga jest bezpieczna do powrotu.
                </p>
              ) : (
                <div className="space-y-1.5">
                  <p className="text-red-300 font-semibold">
                    🚨 Uwaga! W pobliżu tej trasy znajdują się aktywne punkty ostrzegawcze:
                  </p>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {dangers.length > 0 ? (
                      dangers.map((d, idx) => (
                        <span
                          key={idx}
                          className="bg-red-950/80 border border-red-700/80 text-red-200 text-[10px] px-2 py-0.5 rounded-lg font-medium flex items-center gap-1"
                        >
                          <span>{d.category === 'Suspicious Activity' ? '🚨' : d.category === 'Lighting Issue' ? '💡' : '🚧'}</span>
                          <span>{d.category}</span>
                          {d.description && <span className="opacity-80">({d.description})</span>}
                        </span>
                      ))
                    ) : (
                      routeData.avoided_categories.map((cat, idx) => (
                        <span
                          key={idx}
                          className="bg-red-950/80 border border-red-700/80 text-red-200 text-[10px] px-2 py-0.5 rounded-lg font-medium"
                        >
                          ⚠️ {cat}
                        </span>
                      ))
                    )}
                  </div>
                  <p className="text-[11px] text-amber-300/90 pt-1">
                    💡 Zalecamy ominięcie tego obszaru lub udanie się do najbliższego punktu schronienia (Safe Haven).
                  </p>
                </div>
              )}
            </div>

            {/* Time & Distance Stats */}
            <div className="flex items-center justify-between pt-2 border-t border-gray-800">
              <div className="flex items-center gap-4">
                <div>
                  <div className="text-white text-xl font-black leading-tight">
                    {formatMin(durationSec)}
                  </div>
                  <div className="text-gray-400 text-[10px]">
                    {formatKm(distanceMeters)} pieszo
                  </div>
                </div>

                <div className="h-6 w-px bg-gray-800" />

                <div>
                  <div className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">
                    Poziom ryzyka
                  </div>
                  <div
                    className={`text-xs font-black ${
                      isSafe ? 'text-emerald-400' : 'text-red-400'
                    }`}
                  >
                    {isSafe ? 'BARDZO NISKI' : 'PODWYŻSZONY'}
                  </div>
                </div>
              </div>

              {/* Action: Save destination to database */}
              <button
                onClick={handleOpenAddHaven}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] px-3 py-2 rounded-xl shadow-md transition-all active:scale-95 flex items-center gap-1.5"
              >
                <span>💾 Zapisz w bazie</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tap hint when no destination is selected */}
      {!destination && (
        <div className="absolute bottom-40 left-1/2 -translate-x-1/2 bg-gray-900/90 border border-gray-700 backdrop-blur rounded-xl px-3.5 py-2 text-[11px] text-gray-200 font-semibold whitespace-nowrap z-30 shadow-xl flex items-center gap-2">
          <span>📍</span>
          <span>Kliknij dowolne miejsce na mapie, aby wyznaczyć trasę</span>
        </div>
      )}

      {/* Floating Action Buttons */}
      <div className={`absolute ${routeData.safest && showWidget ? 'bottom-68' : 'bottom-20'} right-3 flex flex-col items-end gap-2.5 z-30 transition-all`}>
        <button
          onClick={() => {
            setClickedLocation(destination || userLocation || [50.0646, 19.9449]);
            setAddHavenModalOpen(true);
          }}
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

      {/* Global Toast Notification */}
      {toastMessage && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-top-4 pointer-events-none">
          <div className="bg-emerald-600/95 backdrop-blur text-white px-5 py-2.5 rounded-full shadow-2xl shadow-emerald-950/70 border border-emerald-400/50 font-bold text-xs flex items-center gap-2 whitespace-nowrap">
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
