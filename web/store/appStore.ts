'use client';

import { create } from 'zustand';

export interface Report {
  report_id: string;
  category: 'Suspicious Activity' | 'Lighting Issue' | 'Obstacle';
  description?: string;
  validation_count: number;
  status: 'Active' | 'Resolved' | 'Shadowbanned';
  created_at: string;
  lat: number;
  lng: number;
}

export interface RouteData {
  fastest: GeoJSON.Feature<GeoJSON.LineString> | null;
  safest: GeoJSON.Feature<GeoJSON.LineString> | null;
  danger_reports_on_fastest: number;
  danger_reports_on_safest: number;
  extra_distance_meters: number;
  extra_duration_seconds: number;
  avoided_categories: string[];
}

interface AppState {
  // User
  userId: string;
  userLocation: [number, number] | null; // [lat, lng]
  destination: [number, number] | null;

  // Reports
  reports: Report[];

  // Route
  routeData: RouteData;
  activeRoute: 'safe' | 'fast';

  // SOS
  sosActive: boolean;
  sosTriggerType: string;

  // UI
  reportModalOpen: boolean;

  // Actions
  setUserLocation: (loc: [number, number]) => void;
  setDestination: (loc: [number, number] | null) => void;
  setReports: (reports: Report[]) => void;
  setRouteData: (data: RouteData) => void;
  setActiveRoute: (route: 'safe' | 'fast') => void;
  toggleRoute: () => void;
  activateSOS: (triggerType: string) => void;
  dismissSOS: () => void;
  setReportModalOpen: (open: boolean) => void;
}

const EMPTY_ROUTE_DATA: RouteData = {
  fastest: null,
  safest: null,
  danger_reports_on_fastest: 0,
  danger_reports_on_safest: 0,
  extra_distance_meters: 0,
  extra_duration_seconds: 0,
  avoided_categories: [],
};

export const useAppStore = create<AppState>((set) => ({
  userId: '11111111-1111-1111-1111-111111111111', // Demo user ID
  userLocation: [50.054, 19.935], // Wawel Castle
  destination: [50.061, 19.937],  // Main Square
  reports: [],
  routeData: EMPTY_ROUTE_DATA,
  activeRoute: 'safe',
  sosActive: false,
  sosTriggerType: 'Manual',
  reportModalOpen: false,

  setUserLocation: (loc) => set({ userLocation: loc }),
  setDestination: (loc) => set({ destination: loc }),
  setReports: (reports) => set({ reports }),
  setRouteData: (routeData) => set({ routeData }),
  setActiveRoute: (activeRoute) => set({ activeRoute }),
  toggleRoute: () => set((s) => ({ activeRoute: s.activeRoute === 'safe' ? 'fast' : 'safe' })),
  activateSOS: (triggerType) => set({ sosActive: true, sosTriggerType: triggerType }),
  dismissSOS: () => set({ sosActive: false }),
  setReportModalOpen: (open) => set({ reportModalOpen: open }),
}));
