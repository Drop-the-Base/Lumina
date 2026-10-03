'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export interface Report {
  report_id: string;
  author_id?: string;
  category: 'Suspicious Activity' | 'Lighting Issue' | 'Obstacle' | 'KMZB Police Import';
  description?: string;
  validation_count: number;
  status: 'Active' | 'Resolved' | 'Shadowbanned';
  created_at: string;
  lat: number;
  lng: number;
  source?: 'Community' | 'KMZB' | 'User';
}

export interface RouteStep {
  instruction: string;
  street: string;
  distance_meters: number;
  duration_seconds: number;
  type: string;
  modifier: string;
  location: [number, number];
}

export interface RouteData {
  fastest: GeoJSON.Feature | null;
  safest: GeoJSON.Feature | null;
  is_safe?: boolean;
  safety_status?: 'safe' | 'unsafe';
  danger_reports_on_fastest: number;
  danger_reports_on_safest: number;
  dangers_on_route?: Array<{
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

export type DangerFlagType = 'Accelerometer' | 'GPS_Deviation' | 'Timeout' | 'LowBattery';

export interface DangerFlag {
  type: DangerFlagType;
  label: string;
  at: number;
}

export interface TrustedContact {
  id: string;
  name: string;
  phone: string;
  relation: string;
  appAccount?: string;
  smsFallback: boolean;
  liveLocation: boolean;
}

export interface SafeHaven {
  id: string;
  name: string;
  category: 'Police' | 'SafeHaven' | 'Personal' | 'Medical';
  address: string;
  lat: number;
  lng: number;
  icon?: string;
}

export interface DeadManSettings {
  enabled: boolean;
  detectRun: boolean;
  detectDarkStop: boolean;
  stopMinutes: number;
  detectRouteDeviation: boolean;
  deviationMeters: number;
  detectLowBattery: boolean;
  requiredFlags: number;
  autoCountdownSeconds: number;
  manualCountdownSeconds: number;
}

interface AppState {
  // User
  userId: string;
  userLocation: [number, number] | null; // [lat, lng]
  destination: [number, number] | null;
  clickedLocation: [number, number] | null;

  // Reports & Safe Havens
  reports: Report[];
  safeHavens: SafeHaven[];

  // Route
  routeData: RouteData;
  activeRoute: 'safe' | 'fast';

  // SOS
  sosActive: boolean;
  sosTriggerType: string;
  sosFlags: DangerFlag[];

  // Dead Man's Switch flags raised during the current walk
  dangerFlags: DangerFlag[];
  navigationActive: boolean;

  // Bumped whenever reports change so the route is re-evaluated
  routeRefreshKey: number;
  votedReports: Record<string, 'confirm' | 'deny'>;

  // UI
  reportModalOpen: boolean;
  addHavenModalOpen: boolean;
  toastMessage: string | null;

  // Contacts
  trustedContacts: TrustedContact[];
  smsFallbackGlobal: boolean;
  liveLocationSharing: boolean; // Note: Only during active SOS/Emergency status!

  // Dead Man Switch & Sensors
  deadManSettings: DeadManSettings;

  // Actions
  setUserLocation: (loc: [number, number]) => void;
  setDestination: (loc: [number, number] | null) => void;
  setClickedLocation: (loc: [number, number] | null) => void;
  setReports: (reports: Report[]) => void;
  setSafeHavens: (havens: SafeHaven[]) => void;
  setRouteData: (data: RouteData) => void;
  setActiveRoute: (route: 'safe' | 'fast') => void;
  toggleRoute: () => void;
  activateSOS: (triggerType: string, flags?: DangerFlag[]) => void;
  dismissSOS: () => void;
  setReportModalOpen: (open: boolean) => void;
  setAddHavenModalOpen: (open: boolean) => void;
  showToast: (msg: string) => void;
  hideToast: () => void;

  // Contacts actions
  addTrustedContact: (contact: Omit<TrustedContact, 'id'>) => void;
  removeTrustedContact: (id: string) => void;
  toggleSmsFallbackGlobal: () => void;
  toggleLiveLocationSharing: () => void;

  // Dead man actions
  updateDeadManSettings: (settings: Partial<DeadManSettings>) => void;

  // Dead man flags
  raiseFlag: (type: DangerFlagType, label: string) => void;
  clearFlags: () => void;
  setNavigationActive: (active: boolean) => void;

  // Report & Haven actions
  upsertReport: (report: Report) => void;
  markVoted: (reportId: string, verdict: 'confirm' | 'deny') => void;
  bumpRouteRefresh: () => void;
  addSafeHaven: (haven: SafeHaven | Omit<SafeHaven, 'id'>) => void;
  removeSafeHaven: (id: string) => void;
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

const DEFAULT_CONTACTS: TrustedContact[] = [
  {
    id: 'c1',
    name: 'Kasia (Mama)',
    phone: '+48 601 234 567',
    relation: 'Rodzina',
    appAccount: '@kasia_mama',
    smsFallback: true,
    liveLocation: true,
  },
  {
    id: 'c2',
    name: 'Marek (Przyjaciel)',
    phone: '+48 502 987 654',
    relation: 'Bliski znajomy',
    appAccount: '@marek_dev',
    smsFallback: true,
    liveLocation: false,
  },
];

const DEFAULT_SAFE_HAVENS: SafeHaven[] = [
  {
    id: 'sh_police_1',
    name: 'Komisariat I Policji w Krakowie',
    category: 'Police',
    address: 'ul. Szeroka 35',
    lat: 50.0515,
    lng: 19.9480,
    icon: '🚓',
  },
  {
    id: 'sh_police_2',
    name: 'Komisariat II Policji w Krakowie',
    category: 'Police',
    address: 'ul. Radziwiłłowska 18',
    lat: 50.0635,
    lng: 19.9470,
    icon: '🚓',
  },
  {
    id: 'sh_haven_1',
    name: 'Kawiarnia "Safe Haven" (Akcja Ask for Angela)',
    category: 'SafeHaven',
    address: 'ul. Floriańska 22',
    lat: 50.0625,
    lng: 19.9395,
    icon: '🛡️',
  },
  {
    id: 'sh_haven_2',
    name: 'Pub Oaza (Bezpieczny Punkt Schronienia)',
    category: 'SafeHaven',
    address: 'ul. Szewska 12',
    lat: 50.0620,
    lng: 19.9340,
    icon: '🛡️',
  },
  {
    id: 'sh_medical_1',
    name: 'Całodobowy Punkt Medyczny & Apteka 24/7',
    category: 'Medical',
    address: 'ul. Basztowa 15',
    lat: 50.0650,
    lng: 19.9410,
    icon: '🏥',
  },
  {
    id: 'sh_personal_1',
    name: 'Mój Dom (Bezpieczny Cel)',
    category: 'Personal',
    address: 'ul. Grodzka 10',
    lat: 50.0575,
    lng: 19.9380,
    icon: '🏠',
  },
  {
    id: 'sh_personal_2',
    name: 'Dom Mamy (Kasia)',
    category: 'Personal',
    address: 'ul. Karmelicka 14',
    lat: 50.0640,
    lng: 19.9310,
    icon: '❤️',
  },
];

const DEFAULT_DEADMAN_SETTINGS: DeadManSettings = {
  enabled: true,
  detectRun: true,
  detectDarkStop: true,
  stopMinutes: 2,
  detectRouteDeviation: true,
  deviationMeters: 50,
  detectLowBattery: true,
  requiredFlags: 2,
  autoCountdownSeconds: 60,
  manualCountdownSeconds: 5,
};

const FLAG_TTL_MS = 5 * 60 * 1000;

// Anonymous per-device identity for the reputation system. Seed reports belong
// to the demo users, so using a fixed demo id here would make every vote a self-vote.
function newUserId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx'.replace(/x/g, () => Math.floor(Math.random() * 16).toString(16));
}

export const useAppStore = create<AppState>()(persist((set) => ({
  userId: newUserId(),
  userLocation: [50.0646, 19.9449], // Kraków Główny — the route start and the marker must agree
  destination: [50.061, 19.937],  // Main Square
  clickedLocation: null,
  reports: [],
  safeHavens: DEFAULT_SAFE_HAVENS,
  routeData: EMPTY_ROUTE_DATA,
  activeRoute: 'safe',
  sosActive: false,
  sosTriggerType: 'Manual',
  sosFlags: [],
  dangerFlags: [],
  navigationActive: false,
  routeRefreshKey: 0,
  votedReports: {},
  reportModalOpen: false,
  addHavenModalOpen: false,
  toastMessage: null,

  trustedContacts: DEFAULT_CONTACTS,
  smsFallbackGlobal: true,
  liveLocationSharing: true,

  deadManSettings: DEFAULT_DEADMAN_SETTINGS,

  setUserLocation: (loc) => set({ userLocation: loc }),
  setDestination: (loc) => set({ destination: loc }),
  setClickedLocation: (loc) => set({ clickedLocation: loc }),
  setReports: (reports) => set({ reports }),
  setSafeHavens: (safeHavens) => set({ safeHavens }),
  setRouteData: (routeData) => set({ routeData }),
  setActiveRoute: (activeRoute) => set({ activeRoute }),
  toggleRoute: () => set((s) => ({ activeRoute: s.activeRoute === 'safe' ? 'fast' : 'safe' })),
  activateSOS: (triggerType, flags = []) => set({ sosActive: true, sosTriggerType: triggerType, sosFlags: flags }),
  dismissSOS: () => set({ sosActive: false, sosFlags: [], dangerFlags: [] }),
  setReportModalOpen: (open) => set({ reportModalOpen: open }),
  setAddHavenModalOpen: (open) => set({ addHavenModalOpen: open }),
  showToast: (msg) => set({ toastMessage: msg }),
  hideToast: () => set({ toastMessage: null }),

  addTrustedContact: (contact) =>
    set((s) => ({
      trustedContacts: [
        ...s.trustedContacts,
        { ...contact, id: 'c_' + Date.now().toString().slice(-5) },
      ],
    })),

  removeTrustedContact: (id) =>
    set((s) => ({
      trustedContacts: s.trustedContacts.filter((c) => c.id !== id),
    })),

  toggleSmsFallbackGlobal: () => set((s) => ({ smsFallbackGlobal: !s.smsFallbackGlobal })),
  toggleLiveLocationSharing: () => set((s) => ({ liveLocationSharing: !s.liveLocationSharing })),

  updateDeadManSettings: (newSettings) =>
    set((s) => ({
      deadManSettings: { ...s.deadManSettings, ...newSettings },
    })),

  raiseFlag: (type, label) =>
    set((s) => {
      const now = Date.now();
      // One live flag per type; old flags expire so unrelated events don't add up over a night
      const live = s.dangerFlags.filter((f) => f.type !== type && now - f.at < FLAG_TTL_MS);
      return { dangerFlags: [...live, { type, label, at: now }] };
    }),
  clearFlags: () => set({ dangerFlags: [] }),
  setNavigationActive: (navigationActive) => set({ navigationActive }),

  upsertReport: (report) =>
    set((s) => {
      const others = s.reports.filter((r) => r.report_id !== report.report_id);
      // Resolved reports disappear; shadowbanned ones stay visible to their author only
      return { reports: report.status === 'Resolved' ? others : [report, ...others] };
    }),
  markVoted: (reportId, verdict) =>
    set((s) => ({ votedReports: { ...s.votedReports, [reportId]: verdict } })),
  bumpRouteRefresh: () => set((s) => ({ routeRefreshKey: s.routeRefreshKey + 1 })),

  addSafeHaven: (havenData) =>
    set((s) => ({
      safeHavens: [
        {
          ...havenData,
          id: 'id' in havenData && havenData.id ? havenData.id : 'sh_user_' + Date.now().toString().slice(-5),
        },
        ...s.safeHavens,
      ],
    })),

  removeSafeHaven: (id) =>
    set((s) => ({
      safeHavens: s.safeHavens.filter((h) => h.id !== id),
    })),
}), {
  name: 'lumina-settings',
  storage: createJSONStorage(() => localStorage),
  // Rehydrated manually on the client (see StoreHydration) to avoid SSR mismatches
  skipHydration: true,
  partialize: (s) => ({
    userId: s.userId,
    trustedContacts: s.trustedContacts,
    smsFallbackGlobal: s.smsFallbackGlobal,
    liveLocationSharing: s.liveLocationSharing,
    deadManSettings: s.deadManSettings,
    votedReports: s.votedReports,
  }),
}));
