'use client';

import { create } from 'zustand';

export interface Report {
  report_id: string;
  category: 'Suspicious Activity' | 'Lighting Issue' | 'Obstacle' | 'KMZB Police Import';
  description?: string;
  validation_count: number;
  status: 'Active' | 'Resolved' | 'Shadowbanned';
  created_at: string;
  lat: number;
  lng: number;
  source?: 'Community' | 'KMZB' | 'User';
}

export interface RouteData {
  fastest: GeoJSON.Feature | null;
  safest: GeoJSON.Feature | null;
  danger_reports_on_fastest: number;
  danger_reports_on_safest: number;
  extra_distance_meters: number;
  extra_duration_seconds: number;
  avoided_categories: string[];
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

  // Reports & Safe Havens
  reports: Report[];
  safeHavens: SafeHaven[];

  // Route
  routeData: RouteData;
  activeRoute: 'safe' | 'fast';

  // SOS
  sosActive: boolean;
  sosTriggerType: string;

  // UI
  reportModalOpen: boolean;
  addHavenModalOpen: boolean;

  // Contacts
  trustedContacts: TrustedContact[];
  smsFallbackGlobal: boolean;
  liveLocationSharing: boolean; // Note: Only during active SOS/Emergency status!

  // Dead Man Switch & Sensors
  deadManSettings: DeadManSettings;

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
  setAddHavenModalOpen: (open: boolean) => void;

  // Contacts actions
  addTrustedContact: (contact: Omit<TrustedContact, 'id'>) => void;
  removeTrustedContact: (id: string) => void;
  toggleSmsFallbackGlobal: () => void;
  toggleLiveLocationSharing: () => void;

  // Dead man actions
  updateDeadManSettings: (settings: Partial<DeadManSettings>) => void;

  // Report & Haven actions
  voteReport: (reportId: string, isPositive: boolean) => void;
  addCommunityReport: (report: Omit<Report, 'report_id' | 'created_at' | 'validation_count' | 'status'>) => void;
  addSafeHaven: (haven: Omit<SafeHaven, 'id'>) => void;
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

export const useAppStore = create<AppState>((set) => ({
  userId: '11111111-1111-1111-1111-111111111111', // Demo user ID
  userLocation: [50.054, 19.935], // Wawel Castle
  destination: [50.061, 19.937],  // Main Square
  reports: [],
  safeHavens: DEFAULT_SAFE_HAVENS,
  routeData: EMPTY_ROUTE_DATA,
  activeRoute: 'safe',
  sosActive: false,
  sosTriggerType: 'Manual',
  reportModalOpen: false,
  addHavenModalOpen: false,

  trustedContacts: DEFAULT_CONTACTS,
  smsFallbackGlobal: true,
  liveLocationSharing: true,

  deadManSettings: DEFAULT_DEADMAN_SETTINGS,

  setUserLocation: (loc) => set({ userLocation: loc }),
  setDestination: (loc) => set({ destination: loc }),
  setReports: (reports) => set({ reports }),
  setRouteData: (routeData) => set({ routeData }),
  setActiveRoute: (activeRoute) => set({ activeRoute }),
  toggleRoute: () => set((s) => ({ activeRoute: s.activeRoute === 'safe' ? 'fast' : 'safe' })),
  activateSOS: (triggerType) => set({ sosActive: true, sosTriggerType: triggerType }),
  dismissSOS: () => set({ sosActive: false }),
  setReportModalOpen: (open) => set({ reportModalOpen: open }),
  setAddHavenModalOpen: (open) => set({ addHavenModalOpen: open }),

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

  voteReport: (reportId, isPositive) =>
    set((s) => ({
      reports: s.reports.map((r) =>
        r.report_id === reportId
          ? { ...r, validation_count: r.validation_count + (isPositive ? 1 : -1) }
          : r
      ),
    })),

  addCommunityReport: (reportData) =>
    set((s) => {
      const newReport: Report = {
        ...reportData,
        report_id: 'rep_' + Date.now(),
        created_at: new Date().toISOString(),
        validation_count: 1,
        status: 'Active',
        source: 'User',
      };
      return {
        reports: [newReport, ...s.reports],
      };
    }),

  addSafeHaven: (havenData) =>
    set((s) => ({
      safeHavens: [
        ...s.safeHavens,
        {
          ...havenData,
          id: 'sh_user_' + Date.now().toString().slice(-5),
        },
      ],
    })),

  removeSafeHaven: (id) =>
    set((s) => ({
      safeHavens: s.safeHavens.filter((h) => h.id !== id),
    })),
}));
