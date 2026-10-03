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

function distanceInMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLng = (lng2 - lng1) * (Math.PI / 180);
  const meanLat = ((lat1 + lat2) / 2) * (Math.PI / 180);
  const x = dLng * Math.cos(meanLat);
  const y = dLat;
  return Math.sqrt(x * x + y * y) * R;
}

function calculateBearing(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLng = (lng2 - lng1) * (Math.PI / 180);
  const lat1Rad = lat1 * (Math.PI / 180);
  const lat2Rad = lat2 * (Math.PI / 180);
  const y = Math.sin(dLng) * Math.cos(lat2Rad);
  const x =
    Math.cos(lat1Rad) * Math.sin(lat2Rad) -
    Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLng);
  const brng = Math.atan2(y, x) * (180 / Math.PI);
  return (brng + 360) % 360;
}

function getManeuverIcon(type?: string, modifier?: string): string {
  if (type === 'arrive') return '🎯';
  if (type === 'depart') return '🚶';
  if (type === 'roundabout' || type === 'rotary') return '🔄';
  if (modifier === 'sharp left') return '↰';
  if (modifier === 'left' || modifier === 'slight left') return '⬅️';
  if (modifier === 'sharp right') return '↱';
  if (modifier === 'right' || modifier === 'slight right') return '➡️';
  if (modifier === 'uturn') return '↩️';
  return '⬆️';
}

function interpolateRoute(coords: [number, number][], stepMeters = 7): [number, number][] {
  if (!coords || coords.length < 2) return coords || [];
  const result: [number, number][] = [coords[0]];

  for (let i = 0; i < coords.length - 1; i++) {
    const p1 = coords[i];
    const p2 = coords[i + 1];
    const dist = distanceInMeters(p1[1], p1[0], p2[1], p2[0]);
    const numSubsteps = Math.max(1, Math.floor(dist / stepMeters));

    for (let s = 1; s <= numSubsteps; s++) {
      const frac = s / numSubsteps;
      result.push([
        p1[0] + (p2[0] - p1[0]) * frac,
        p1[1] + (p2[1] - p1[1]) * frac,
      ]);
    }
  }

  return result;
}

function formatETA(durationSec: number): string {
  const date = new Date(Date.now() + durationSec * 1000);
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}

function renderWalkingPersonHTML(isWalking: boolean, speed: number, heading: number): string {
  const duration = speed === 4 ? '0.18s' : speed === 2 ? '0.28s' : '0.46s';
  const walkClass = isWalking ? 'walking-active' : 'walking-paused';
  const isFacingLeft = heading > 180 && heading < 360;
  const flip = isFacingLeft ? 'scaleX(-1)' : 'scaleX(1)';

  return `
    <div class="relative flex flex-col items-center justify-center -translate-y-4 pointer-events-none select-none ${walkClass}" style="--walk-duration: ${duration};">
      <!-- Ground Radar Pulse / Safety Circle -->
      <div class="absolute -bottom-1 w-14 h-5 rounded-full bg-emerald-500/30 border border-emerald-400/60 shadow-lg shadow-emerald-500/50 animate-pulse"></div>

      <!-- Direction Pointer / Shield Halo -->
      <div class="absolute -top-3.5 px-2 py-0.5 rounded-full bg-gray-950/95 border border-emerald-400 shadow-md flex items-center gap-1 scale-75 origin-bottom">
        <span class="text-[9px] font-black text-emerald-400">🛡️ LUMINA</span>
      </div>

      <!-- Walking Character SVG with moving legs -->
      <div id="nav-walking-figure" style="transform: ${flip}; transition: transform 0.25s ease;" class="relative w-12 h-14 filter drop-shadow-md">
        <svg viewBox="0 0 40 56" class="w-full h-full overflow-visible">
          <!-- Feet Ground Shadow & Radar Ring -->
          <ellipse cx="20" cy="46" rx="13" ry="4" fill="rgba(6, 78, 59, 0.4)" />
          <ellipse cx="20" cy="46" rx="16" ry="5" fill="none" stroke="rgba(52, 211, 153, 0.7)" stroke-width="1.2" stroke-dasharray="3,2" class="lumina-radar-ring" />

          <!-- Back Leg (swings opposite to front leg) -->
          <g class="lumina-leg-back" style="transform-origin: 20px 30px;">
            <path d="M19 30 L18 40 L23 41" stroke="#047857" stroke-width="4.2" stroke-linecap="round" stroke-linejoin="round" fill="none" />
            <path d="M20.5 41 L24.5 41" stroke="#e5e7eb" stroke-width="4.8" stroke-linecap="round" fill="none" />
          </g>

          <!-- Back Arm (swings opposite to front arm) -->
          <g class="lumina-arm-back" style="transform-origin: 20px 20px;">
            <path d="M20 20 L15 28" stroke="#047857" stroke-width="3.2" stroke-linecap="round" fill="none" />
            <circle cx="15" cy="28" r="1.8" fill="#fed7aa" />
          </g>

          <!-- Torso & Head Group (bobs up and down while walking) -->
          <g class="lumina-body-group">
            <!-- Backpack / Satchel on back -->
            <rect x="13" y="19" width="4.5" height="9" rx="2" fill="#065f46" stroke="#047857" stroke-width="0.8" />
            <circle cx="15.2" cy="23.5" r="1.2" fill="#34d399" />

            <!-- Torso (Emerald Jacket) -->
            <rect x="16.5" y="17" width="7.5" height="13" rx="3.5" fill="#059669" stroke="#047857" stroke-width="0.8" />
            <path d="M20.2 18 L20.2 30" stroke="#047857" stroke-width="0.8" />

            <!-- Head & Face -->
            <circle cx="20" cy="10" r="5.5" fill="#fed7aa" />
            <!-- Cap / Hair -->
            <path d="M14.5 10 C14.5 5 25.5 5 25.5 9.5 C25.5 10.5 24 11 23 11 C22 8.5 17 8.5 16 11 Z" fill="#1f2937" />
            <path d="M22.5 10.2 L27 10.5" stroke="#1f2937" stroke-width="1.8" stroke-linecap="round" />
            <!-- Eye -->
            <circle cx="22.5" cy="9.5" r="0.8" fill="#111827" />
            <!-- Smile -->
            <path d="M21.5 12 Q23 13 24 12" stroke="#c2410c" stroke-width="0.75" fill="none" stroke-linecap="round" />
          </g>

          <!-- Front Leg (swings forward/backward) -->
          <g class="lumina-leg-front" style="transform-origin: 20px 30px;">
            <path d="M20.5 30 L21 40 L26 41" stroke="#10b981" stroke-width="4.2" stroke-linecap="round" stroke-linejoin="round" fill="none" />
            <path d="M22.5 41 L27 41" stroke="#ffffff" stroke-width="4.8" stroke-linecap="round" fill="none" />
          </g>

          <!-- Front Arm (swings opposite to front leg) -->
          <g class="lumina-arm-front" style="transform-origin: 20px 20px;">
            <path d="M20.5 20 L25 28" stroke="#34d399" stroke-width="3.2" stroke-linecap="round" fill="none" />
            <circle cx="25" cy="28" r="1.8" fill="#fed7aa" />
          </g>
        </svg>
      </div>
    </div>
  `;
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
  const isNavigatingRef = useRef(false);

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

  // Active Walking Navigation state
  const [isNavigating, setIsNavigating] = useState(false);
  const [isWalking, setIsWalking] = useState(false);
  const [walkSpeed, setWalkSpeed] = useState<number>(1); // 1x, 2x, 4x
  const [navCoordIndex, setNavCoordIndex] = useState(0);
  const [navStepIndex, setNavStepIndex] = useState(0);
  const [currentHeading, setCurrentHeading] = useState(0);
  const [interpolatedCoords, setInterpolatedCoords] = useState<[number, number][]>([]);
  const [approachingDanger, setApproachingDanger] = useState<{
    category: string;
    description?: string;
    distanceMeters: number;
  } | null>(null);
  const [hasArrived, setHasArrived] = useState(false);

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
        if (isNavigatingRef.current) return;
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

  // Calculate route whenever destination changes (unless in active navigation)
  useEffect(() => {
    if (!destination || !userLocation || isNavigatingRef.current) return;
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

        const geom = data.safest?.geometry as any;
        if (geom?.coordinates && geom.coordinates.length > 0) {
          const densified = interpolateRoute(geom.coordinates, 7);
          setInterpolatedCoords(densified);
        }

        // Fit map bounds to encompass the route
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
  }, [destination]);

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

    // User Location Marker (Green Pulse or Directional Nav Arrow)
    if (userLocation) {
      if (!userMarkerRef.current) {
        const el = document.createElement('div');
        if (isNavigating) {
          el.className = 'custom-nav-marker flex items-center justify-center';
          el.innerHTML = renderWalkingPersonHTML(isWalking, walkSpeed, currentHeading);
        } else {
          el.className = 'w-7 h-7 rounded-full bg-emerald-500 border-3 border-white shadow-xl flex items-center justify-center text-[10px] text-white font-bold ring-4 ring-emerald-500/30 animate-pulse';
          el.innerHTML = '🚶';
        }
        userMarkerRef.current = new maplibregl.Marker({ element: el })
          .setLngLat([userLocation[1], userLocation[0]])
          .addTo(mapRef.current);
      } else {
        const el = userMarkerRef.current.getElement();
        if (isNavigating) {
          if (!el.classList.contains('custom-nav-marker')) {
            el.className = 'custom-nav-marker flex items-center justify-center';
          }
          el.innerHTML = renderWalkingPersonHTML(isWalking, walkSpeed, currentHeading);
        } else {
          if (el.classList.contains('custom-nav-marker')) {
            el.className = 'w-7 h-7 rounded-full bg-emerald-500 border-3 border-white shadow-xl flex items-center justify-center text-[10px] text-white font-bold ring-4 ring-emerald-500/30 animate-pulse';
            el.innerHTML = '🚶';
          }
        }
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
  }, [userLocation, destination, mapLoaded, isNavigating]);

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

  useEffect(() => {
    isNavigatingRef.current = isNavigating;
  }, [isNavigating]);

  // Start Live Walking Navigation
  const handleStartNavigation = () => {
    if (!routeData.safest) return;

    const rawCoords = (routeData.safest.geometry as any)?.coordinates as [number, number][];
    if (!rawCoords || rawCoords.length < 2) return;

    const densified = interpolateRoute(rawCoords, 7);
    setInterpolatedCoords(densified);
    setNavCoordIndex(0);
    setNavStepIndex(0);
    setHasArrived(false);
    setIsNavigating(true);
    setIsWalking(true);

    const p1 = densified[0];
    const p2 = densified[Math.min(densified.length - 1, 2)];
    const bearing = calculateBearing(p1[1], p1[0], p2[1], p2[0]);
    setCurrentHeading(bearing);
    setUserLocation([p1[1], p1[0]]);

    mapRef.current?.easeTo({
      center: p1,
      zoom: 17.5,
      pitch: 55,
      bearing,
      duration: 1000,
    });

    // Switch marker to animated walking figure
    const el = userMarkerRef.current?.getElement();
    if (el) {
      el.className = 'custom-nav-marker flex items-center justify-center';
      el.innerHTML = renderWalkingPersonHTML(true, 1, bearing);
    }
  };

  // Stop / Exit Navigation
  const handleStopNavigation = () => {
    setIsNavigating(false);
    setIsWalking(false);
    setHasArrived(false);
    setApproachingDanger(null);

    const rawCoords = (routeData.safest?.geometry as any)?.coordinates;
    if (mapRef.current && rawCoords && rawCoords.length > 1) {
      const bounds = rawCoords.reduce(
        (acc: any, coord: any) => [
          Math.min(acc[0], coord[0]),
          Math.min(acc[1], coord[1]),
          Math.max(acc[2], coord[0]),
          Math.max(acc[3], coord[1]),
        ],
        [rawCoords[0][0], rawCoords[0][1], rawCoords[0][0], rawCoords[0][1]]
      );
      mapRef.current.fitBounds(bounds, {
        padding: { top: 70, bottom: 260, left: 40, right: 40 },
        pitch: 0,
        bearing: 0,
        maxZoom: 16,
        duration: 800,
      });
    } else {
      mapRef.current?.easeTo({ pitch: 0, bearing: 0, zoom: 15, duration: 800 });
    }

    // Restore standard marker
    const el = userMarkerRef.current?.getElement();
    if (el) {
      el.className = 'w-7 h-7 rounded-full bg-emerald-500 border-3 border-white shadow-xl flex items-center justify-center text-[10px] text-white font-bold ring-4 ring-emerald-500/30 animate-pulse';
      el.innerHTML = '🚶';
    }
  };

  // Walking simulation tick loop
  useEffect(() => {
    if (!isNavigating || !isWalking || hasArrived || interpolatedCoords.length === 0) return;

    const interval = setInterval(() => {
      setNavCoordIndex((prevIndex) => {
        const nextIndex = prevIndex + walkSpeed;
        if (nextIndex >= interpolatedCoords.length - 1) {
          setHasArrived(true);
          setIsWalking(false);
          const lastPt = interpolatedCoords[interpolatedCoords.length - 1];
          setUserLocation([lastPt[1], lastPt[0]]);
          return interpolatedCoords.length - 1;
        }

        const curPt = interpolatedCoords[nextIndex];
        const lookAhead = interpolatedCoords[Math.min(interpolatedCoords.length - 1, nextIndex + 2)];
        const heading = calculateBearing(curPt[1], curPt[0], lookAhead[1], lookAhead[0]);

        setCurrentHeading(heading);
        setUserLocation([curPt[1], curPt[0]]);

        mapRef.current?.easeTo({
          center: [curPt[0], curPt[1]],
          bearing: heading,
          pitch: 55,
          zoom: 17.5,
          duration: 350,
        });

        const figureEl = document.getElementById('nav-walking-figure');
        if (figureEl) {
          const isFacingLeft = heading > 180 && heading < 360;
          figureEl.style.transform = isFacingLeft ? 'scaleX(-1)' : 'scaleX(1)';
        }

        return nextIndex;
      });
    }, 400);

    return () => clearInterval(interval);
  }, [isNavigating, isWalking, hasArrived, interpolatedCoords, walkSpeed]);

  // Sync walking animation state (play / pause / speed) to marker
  useEffect(() => {
    if (!isNavigating || !userMarkerRef.current) return;
    const el = userMarkerRef.current.getElement();
    if (el && el.classList.contains('custom-nav-marker')) {
      el.innerHTML = renderWalkingPersonHTML(isWalking, walkSpeed, currentHeading);
    }
  }, [isWalking, walkSpeed, isNavigating]);

  const steps = routeData.steps || [];
  const currentStep = steps[navStepIndex] || steps[0];
  const nextStep = steps[navStepIndex + 1];

  // Auto-advance step when approaching turn
  useEffect(() => {
    if (!isNavigating || !userLocation || steps.length === 0) return;
    const targetStep = steps[navStepIndex];
    if (!targetStep || !targetStep.location) return;

    const dist = distanceInMeters(userLocation[0], userLocation[1], targetStep.location[1], targetStep.location[0]);
    if (dist < 20 && navStepIndex < steps.length - 1) {
      setNavStepIndex((prev) => prev + 1);
    }
  }, [isNavigating, userLocation, steps, navStepIndex]);

  // Real-time danger proximity alert during walk
  useEffect(() => {
    if (!isNavigating || !userLocation || reports.length === 0) {
      setApproachingDanger(null);
      return;
    }

    const danger = reports.find((r: any) => {
      const d = distanceInMeters(userLocation[0], userLocation[1], r.lat, r.lng);
      return d < 80;
    });

    if (danger) {
      const d = Math.round(distanceInMeters(userLocation[0], userLocation[1], danger.lat, danger.lng));
      setApproachingDanger({
        category: danger.category,
        description: danger.description,
        distanceMeters: d,
      });
    } else {
      setApproachingDanger(null);
    }
  }, [isNavigating, userLocation, reports]);

  const handleClearRoute = () => {
    if (isNavigating) {
      handleStopNavigation();
    }
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
      steps: [],
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

  const totalPoints = interpolatedCoords.length;
  const progressRatio = totalPoints > 1 ? Math.min(1, navCoordIndex / (totalPoints - 1)) : 0;
  const remainingDistanceMeters = Math.max(0, Math.round(distanceMeters * (1 - progressRatio)));
  const remainingDurationSeconds = Math.max(0, Math.round(durationSec * (1 - progressRatio)));
  const distToNextManeuver = currentStep && userLocation && currentStep.location
    ? Math.round(distanceInMeters(userLocation[0], userLocation[1], currentStep.location[1], currentStep.location[0]))
    : 0;

  return (
    <div className="relative w-full h-full min-h-[600px] flex-1 overflow-hidden bg-gray-950">
      <div ref={mapContainer} className="w-full h-full" />

      {/* Top Bar: Standard Mode vs Active Navigation Mode */}
      {!isNavigating ? (
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
      ) : (
        /* Top Navigation Turn HUD */
        <div className="absolute top-4 left-3 right-3 flex items-start justify-between gap-2.5 z-40 pointer-events-none">
          <div className="pointer-events-auto flex-1 bg-gray-950/95 border-2 border-emerald-500/80 rounded-2xl p-3.5 shadow-2xl backdrop-blur flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-600/30 border border-emerald-400 flex items-center justify-center text-2xl flex-shrink-0 shadow-inner">
              {getManeuverIcon(currentStep?.type, currentStep?.modifier)}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-emerald-400 font-black text-base tracking-wide">
                  {distToNextManeuver < 18 ? 'Teraz skręć!' : `Za ${distToNextManeuver} m`}
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800">
                  NAWIGACJA
                </span>
              </div>
              <div className="text-white font-extrabold text-sm truncate leading-snug">
                {currentStep?.instruction || 'Idź prosto wyznaczoną trasą'}
              </div>
              {nextStep && (
                <div className="text-gray-400 text-[11px] truncate mt-0.5">
                  Następnie: {nextStep.instruction}
                </div>
              )}
            </div>
          </div>

          <button
            onClick={() => {
              activateSOS('Manual');
              router.push('/sos');
            }}
            className="pointer-events-auto w-14 h-14 bg-red-600 hover:bg-red-500 rounded-full flex flex-col items-center justify-center shadow-lg shadow-red-900/50 transition-all active:scale-95 border-2 border-red-400/50 flex-shrink-0"
          >
            <span className="text-white font-black text-sm leading-none">SOS</span>
            <span className="text-[9px] text-red-200 font-bold tracking-tighter">
              ({deadManSettings?.manualCountdownSeconds || 5}s)
            </span>
          </button>
        </div>
      )}

      {/* Proximity Danger Warning Banner during Navigation */}
      {isNavigating && approachingDanger && (
        <div className="absolute top-24 left-3 right-3 z-40 animate-bounce pointer-events-auto">
          <div className="bg-red-950/95 border-2 border-red-500 text-red-100 rounded-2xl p-3 shadow-2xl backdrop-blur flex items-center gap-3">
            <span className="text-2xl animate-pulse flex-shrink-0">🚨</span>
            <div className="flex-1 min-w-0">
              <div className="font-extrabold text-xs text-red-300 uppercase tracking-wider">
                Uwaga! Zagrożenie w odległości {approachingDanger.distanceMeters} m!
              </div>
              <div className="text-xs font-bold text-white truncate">
                {approachingDanger.category} {approachingDanger.description ? `• ${approachingDanger.description}` : ''}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Save Place Success Banner */}
      {saveSuccessMsg && (
        <div className="absolute top-20 left-4 right-4 z-40 bg-emerald-600 text-white font-bold text-xs p-3 rounded-2xl shadow-xl flex items-center justify-between animate-fade-in">
          <span>{saveSuccessMsg}</span>
          <button onClick={() => setSaveSuccessMsg(null)} className="text-white/80 hover:text-white">✕</button>
        </div>
      )}

      {/* ROUTE SAFETY OVERVIEW WIDGET (when not actively walking) */}
      {!isNavigating && routeData.safest && showWidget && (
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

            {/* START WALKING NAVIGATION BUTTON */}
            <button
              onClick={handleStartNavigation}
              className="w-full mt-3 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-500 hover:from-emerald-500 hover:to-teal-400 text-white font-black text-sm py-3 px-4 rounded-xl shadow-lg shadow-emerald-950/60 active:scale-[0.98] transition-all flex items-center justify-center gap-2 border border-emerald-400/40 cursor-pointer"
            >
              <span className="text-lg">🚶</span>
              <span>Rozpocznij nawigację pieszą</span>
            </button>
          </div>
        </div>
      )}

      {/* ACTIVE NAVIGATION BOTTOM CONTROL PANEL */}
      {isNavigating && (
        <div className="absolute bottom-4 left-3 right-3 z-40 pointer-events-auto animate-slide-up">
          <div className="bg-gray-950/95 border-2 border-emerald-500/80 rounded-2xl p-4 shadow-2xl backdrop-blur ring-1 ring-emerald-500/30">
            {/* Walk Progress Bar */}
            <div className="w-full bg-gray-800 rounded-full h-1.5 overflow-hidden mb-3">
              <div
                className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full transition-all duration-300"
                style={{ width: `${Math.round(progressRatio * 100)}%` }}
              />
            </div>

            {/* Metrics & Simulation Controls */}
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-baseline gap-2">
                  <span className="text-white text-2xl font-black">
                    {formatMin(remainingDurationSeconds)}
                  </span>
                  <span className="text-emerald-400 text-xs font-bold">
                    ({formatKm(remainingDistanceMeters)})
                  </span>
                </div>
                <div className="text-gray-400 text-[11px] flex items-center gap-1.5">
                  <span>Godz. przybycia:</span>
                  <span className="text-gray-200 font-bold font-mono">
                    {formatETA(remainingDurationSeconds)}
                  </span>
                  <span className="text-emerald-500 font-bold">• Chroniona</span>
                </div>
              </div>

              {/* Simulation Controls */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsWalking(!isWalking)}
                  className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition-all active:scale-95 cursor-pointer ${
                    isWalking
                      ? 'bg-gray-800 hover:bg-gray-700 text-white border-gray-700'
                      : 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-400'
                  }`}
                >
                  <span>{isWalking ? '⏸️ Pauza' : '▶️ Idź dalej'}</span>
                </button>

                <button
                  onClick={() => setWalkSpeed((prev) => (prev === 1 ? 2 : prev === 2 ? 4 : 1))}
                  className="px-2.5 py-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-emerald-400 border border-emerald-500/50 text-xs font-black transition-all active:scale-95 cursor-pointer"
                  title="Zmień prędkość symulacji"
                >
                  ⚡ {walkSpeed}x
                </button>
              </div>
            </div>

            {/* Cancel Navigation Button */}
            <button
              onClick={handleStopNavigation}
              className="w-full mt-3 py-2 bg-gray-900 hover:bg-gray-800 text-gray-300 hover:text-white font-bold text-xs rounded-xl border border-gray-800 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <span>✕ Zakończ nawigację</span>
            </button>
          </div>
        </div>
      )}

      {/* ARRIVAL CELEBRATION MODAL */}
      {hasArrived && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in pointer-events-auto">
          <div className="bg-gray-900 border-2 border-emerald-500/80 rounded-3xl p-6 max-w-sm w-full text-center shadow-2xl shadow-emerald-950/80 animate-scale-up space-y-4">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 border-2 border-emerald-400 flex items-center justify-center mx-auto text-3xl">
              🎉
            </div>
            <div>
              <h3 className="text-xl font-black text-white">Dotarłaś bezpiecznie do celu!</h3>
              <p className="text-xs text-gray-300 mt-1 leading-relaxed">
                Trasa zakończona sukcesem. System Lumina monitorował Twoje bezpieczeństwo na każdym kroku.
              </p>
            </div>
            <div className="bg-gray-800/80 rounded-2xl p-3 border border-gray-700/60 flex justify-around text-center">
              <div>
                <div className="text-[10px] text-gray-400 uppercase font-bold">Dystans</div>
                <div className="text-sm font-black text-white">{formatKm(distanceMeters)}</div>
              </div>
              <div className="w-px bg-gray-700" />
              <div>
                <div className="text-[10px] text-gray-400 uppercase font-bold">Status</div>
                <div className="text-sm font-black text-emerald-400">Bezpiecznie 🛡️</div>
              </div>
            </div>
            <button
              onClick={handleStopNavigation}
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-xl shadow-lg transition-all active:scale-95 cursor-pointer text-sm"
            >
              Zakończ nawigację
            </button>
          </div>
        </div>
      )}

      {/* Tap hint when no destination is selected */}
      {!destination && !isNavigating && (
        <div className="absolute bottom-40 left-1/2 -translate-x-1/2 bg-gray-900/90 border border-gray-700 backdrop-blur rounded-xl px-3.5 py-2 text-[11px] text-gray-200 font-semibold whitespace-nowrap z-30 shadow-xl flex items-center gap-2">
          <span>📍</span>
          <span>Kliknij dowolne miejsce na mapie, aby wyznaczyć trasę</span>
        </div>
      )}

      {/* Floating Action Buttons (hidden during active navigation) */}
      {!isNavigating && (
        <div className={`absolute ${routeData.safest && showWidget ? 'bottom-72' : 'bottom-20'} right-3 flex flex-col items-end gap-2.5 z-30 transition-all`}>
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
      )}

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
