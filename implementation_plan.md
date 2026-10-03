# Implementation Plan — ImpactHer Web MVP

**Stack:** Next.js 14 + Express + Supabase (PostGIS) + MapLibre GL JS  
**Target:** Fully working demo deployable via Vercel + Railway in 24h

---

## Repository Structure

```
impact_her/
├── web/                          # Next.js 14 (App Router)
│   ├── app/
│   │   ├── layout.tsx            # Root layout, providers
│   │   ├── page.tsx              # Landing / onboarding
│   │   ├── map/
│   │   │   └── page.tsx          # Main map screen
│   │   ├── sos/
│   │   │   └── page.tsx          # SOS countdown screen
│   │   └── api/                  # Next.js proxy routes (optional)
│   ├── components/
│   │   ├── Map.tsx               # MapLibre wrapper
│   │   ├── ReportMarker.tsx      # Colored map marker
│   │   ├── RouteLayer.tsx        # Safe vs fast route polylines
│   │   ├── ReportModal.tsx       # Slide-up report form
│   │   ├── SosCountdown.tsx      # Countdown timer component
│   │   └── SOSButton.tsx         # Floating SOS trigger
│   ├── lib/
│   │   ├── supabase.ts           # Supabase browser client
│   │   ├── sensorEngine.ts       # GPS + accelerometer logic
│   │   ├── sosDispatcher.ts      # Fires SOS to backend
│   │   └── api.ts                # Typed fetch wrappers
│   ├── store/
│   │   └── appStore.ts           # Zustand: route, reports, user state
│   └── .env.local
│
├── backend/                      # Node.js + Express
│   ├── src/
│   │   ├── index.ts              # App entry, middleware
│   │   ├── routes/
│   │   │   ├── reports.ts
│   │   │   ├── route.ts
│   │   │   └── sos.ts
│   │   ├── services/
│   │   │   ├── osrmClient.ts
│   │   │   ├── trustEngine.ts
│   │   │   └── smsService.ts
│   │   └── db/
│   │       └── supabase.ts       # Supabase service-role client
│   └── .env
│
├── supabase/
│   ├── migrations/
│   │   └── 001_init.sql
│   └── seeds/
│       └── 001_seed.sql
│
├── packages/
│   └── shared/
│       └── types.ts              # Shared TS interfaces
│
├── description.md
├── architecture.md
├── agent_workflow.md
└── implementation_plan.md        # This file
```

---

## Step 0 — Environment Setup

### 0.1 Create Supabase Project
1. Go to [supabase.com](https://supabase.com) → New Project
2. Region: Europe (Frankfurt) — closest to Poland
3. Copy: `Project URL`, `anon key`, `service_role key`
4. Enable PostGIS: Dashboard → SQL Editor → run `CREATE EXTENSION postgis;`

### 0.2 Scaffold Projects

```bash
# Next.js
npx create-next-app@latest web --typescript --app --tailwind --eslint --no-src-dir
cd web
npm install maplibre-gl zustand @supabase/supabase-js

# Backend
mkdir backend && cd backend
npm init -y
npm install express cors helmet dotenv @supabase/supabase-js twilio axios
npm install -D typescript @types/express @types/node @types/cors tsx nodemon
npx tsc --init
```

### 0.3 Environment Files

**`web/.env.local`**
```
NEXT_PUBLIC_BACKEND_URL=http://localhost:3001
NEXT_PUBLIC_SUPABASE_URL=your_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
NEXT_PUBLIC_MAP_STYLE=https://demotiles.maplibre.org/style.json
```

**`backend/.env`**
```
PORT=3001
SUPABASE_URL=your_project_url
SUPABASE_SERVICE_KEY=your_service_role_key
TWILIO_ACCOUNT_SID=your_sid
TWILIO_AUTH_TOKEN=your_token
TWILIO_FROM_NUMBER=+1234567890
```

---

## Step 1 — Database (Run First)

### 1.1 Migration — `supabase/migrations/001_init.sql`

```sql
CREATE EXTENSION IF NOT EXISTS postgis;

-- Users
CREATE TABLE users (
  user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone TEXT UNIQUE,
  display_name TEXT,
  trusted_contacts TEXT[] DEFAULT '{}',
  reputation_score FLOAT DEFAULT 1.0,
  total_reports_validated INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Reports
CREATE TABLE reports (
  report_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id UUID REFERENCES users(user_id) ON DELETE SET NULL,
  location GEOGRAPHY(POINT, 4326) NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('Suspicious Activity', 'Lighting Issue', 'Obstacle')),
  description TEXT,
  validation_count INT DEFAULT 0,
  status TEXT DEFAULT 'Active' CHECK (status IN ('Active', 'Resolved', 'Shadowbanned')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '6 hours'
);

-- SOS Events
CREATE TABLE sos_events (
  event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(user_id) ON DELETE SET NULL,
  trigger_type TEXT NOT NULL CHECK (trigger_type IN ('Manual', 'Accelerometer', 'GPS_Deviation', 'Timeout')),
  location GEOGRAPHY(POINT, 4326),
  dispatched_via TEXT DEFAULT 'API' CHECK (dispatched_via IN ('API', 'SMS')),
  contacts_notified INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Spatial index for fast proximity queries
CREATE INDEX reports_location_idx ON reports USING GIST (location);

-- Useful view: reports with lat/lng extracted
CREATE VIEW reports_with_coords AS
SELECT 
  report_id, author_id, category, description,
  validation_count, status, created_at,
  ST_Y(location::geometry) AS lat,
  ST_X(location::geometry) AS lng
FROM reports;
```

### 1.2 Seed — `supabase/seeds/001_seed.sql`

```sql
-- Test users
INSERT INTO users (user_id, display_name, trusted_contacts, reputation_score) VALUES
  ('11111111-1111-1111-1111-111111111111', 'Anna K.', ARRAY['+48600000001'], 0.95),
  ('22222222-2222-2222-2222-222222222222', 'Maria W.', ARRAY['+48600000002'], 0.42),
  ('33333333-3333-3333-3333-333333333333', 'Bad Actor', ARRAY[]::TEXT[], 0.08);

-- Active reports around Warsaw center
INSERT INTO reports (author_id, location, category, status) VALUES
  ('11111111-1111-1111-1111-111111111111', ST_Point(21.0122, 52.2297), 'Suspicious Activity', 'Active'),
  ('11111111-1111-1111-1111-111111111111', ST_Point(21.0050, 52.2310), 'Lighting Issue', 'Active'),
  ('22222222-2222-2222-2222-222222222222', ST_Point(21.0200, 52.2280), 'Obstacle', 'Active'),
  ('22222222-2222-2222-2222-222222222222', ST_Point(21.0150, 52.2350), 'Suspicious Activity', 'Active'),
  ('11111111-1111-1111-1111-111111111111', ST_Point(21.0080, 52.2260), 'Lighting Issue', 'Active'),
  -- Shadowbanned (from bad actor)
  ('33333333-3333-3333-3333-333333333333', ST_Point(21.0122, 52.2297), 'Suspicious Activity', 'Shadowbanned'),
  ('33333333-3333-3333-3333-333333333333', ST_Point(21.0300, 52.2400), 'Obstacle', 'Shadowbanned');

-- Historical SOS
INSERT INTO sos_events (user_id, trigger_type, location, contacts_notified) VALUES
  ('11111111-1111-1111-1111-111111111111', 'Manual', ST_Point(21.0122, 52.2297), 2);
```

---

## Step 2 — Backend Implementation

### 2.1 Entry Point — `backend/src/index.ts`

```typescript
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import reportsRouter from './routes/reports';
import routeRouter from './routes/route';
import sosRouter from './routes/sos';

dotenv.config();
const app = express();

app.use(helmet());
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:3000' }));
app.use(express.json());

app.use('/api/reports', reportsRouter);
app.use('/api/route', routeRouter);
app.use('/api/sos', sosRouter);

app.get('/health', (_, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Backend on :${PORT}`));
```

### 2.2 Reports Route — `backend/src/routes/reports.ts`

Key logic:
- `GET /api/reports` → returns Active reports as GeoJSON FeatureCollection
- `POST /api/reports` → checks reputation, sets status, inserts
- `PATCH /api/reports/:id/validate` → updates reputation scores

### 2.3 Route Engine — `backend/src/routes/route.ts`

```typescript
// POST /api/route
// Body: { from_lat, from_lng, to_lat, to_lng }
// Returns: { fastest: GeoJSON, safest: GeoJSON }

// 1. Call OSRM for fastest route
const osrmUrl = `http://router.project-osrm.org/route/v1/foot/${from_lng},${from_lat};${to_lng},${to_lat}?overview=full&geometries=geojson`;

// 2. Fetch active danger reports near route bounding box (ST_DWithin)
// 3. For safest route: use OSRM with waypoints that avoid report clusters
//    Hackathon shortcut: offset the route 0.002° away from report centroids
```

### 2.4 Trust Engine — `backend/src/services/trustEngine.ts`

```typescript
export const REPUTATION_THRESHOLD = 0.3;

export async function checkReputation(userId: string): Promise<number> { ... }

export async function applyValidation(
  reportId: string,
  validatorId: string,
  verdict: 'safe' | 'unsafe'
): Promise<void> {
  // verdict='unsafe' → report confirmed dangerous, boost author
  // verdict='safe'   → report contradicted, penalize author
}
```

### 2.5 SMS Service — `backend/src/services/smsService.ts`

```typescript
import twilio from 'twilio';
const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

export async function sendSosAlert(
  contacts: string[],
  userName: string,
  lat: number,
  lng: number
): Promise<void> {
  const mapsLink = `https://maps.google.com/?q=${lat},${lng}`;
  const body = `🆘 SAFETY ALERT: ${userName} triggered an emergency. Last location: ${mapsLink}`;
  
  await Promise.allSettled(
    contacts.map(to => client.messages.create({
      from: process.env.TWILIO_FROM_NUMBER!,
      to,
      body
    }))
  );
}
```

---

## Step 3 — Frontend Implementation

### 3.1 Supabase Client — `web/lib/supabase.ts`

```typescript
import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
```

### 3.2 API Wrappers — `web/lib/api.ts`

```typescript
const BASE = process.env.NEXT_PUBLIC_BACKEND_URL;

export const api = {
  getReports: () => fetch(`${BASE}/api/reports`).then(r => r.json()),
  
  submitReport: (data: { lat: number; lng: number; category: string; author_id: string }) =>
    fetch(`${BASE}/api/reports`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }).then(r => r.json()),

  getRoute: (from: [number, number], to: [number, number]) =>
    fetch(`${BASE}/api/route`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ from_lat: from[0], from_lng: from[1], to_lat: to[0], to_lng: to[1] }) }).then(r => r.json()),

  fireSos: (data: { user_id: string; trigger_type: string; lat: number; lng: number }) =>
    fetch(`${BASE}/api/sos`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }).then(r => r.json()),
};
```

### 3.3 Zustand Store — `web/store/appStore.ts`

```typescript
import { create } from 'zustand';

interface AppState {
  userLocation: [number, number] | null;
  reports: Report[];
  activeRoute: 'safe' | 'fast';
  sosActive: boolean;
  setUserLocation: (loc: [number, number]) => void;
  setReports: (r: Report[]) => void;
  toggleRoute: () => void;
  activateSOS: () => void;
  dismissSOS: () => void;
}

export const useAppStore = create<AppState>(set => ({
  userLocation: null,
  reports: [],
  activeRoute: 'safe',
  sosActive: false,
  setUserLocation: loc => set({ userLocation: loc }),
  setReports: reports => set({ reports }),
  toggleRoute: () => set(s => ({ activeRoute: s.activeRoute === 'safe' ? 'fast' : 'safe' })),
  activateSOS: () => set({ sosActive: true }),
  dismissSOS: () => set({ sosActive: false }),
}));
```

### 3.4 Sensor Engine — `web/lib/sensorEngine.ts`

```typescript
export class SensorEngine {
  private watchId: number | null = null;
  private lastPosition: GeolocationCoordinates | null = null;
  private stoppedSince: Date | null = null;
  private onSOS: (type: string) => void;

  constructor(onSOS: (type: string) => void) {
    this.onSOS = onSOS;
  }

  start() {
    // GPS watcher
    this.watchId = navigator.geolocation.watchPosition(pos => {
      const { latitude, longitude, speed } = pos.coords;
      
      // Stopped > 120s check (simplified for MVP)
      if ((speed ?? 0) < 0.5) {
        if (!this.stoppedSince) this.stoppedSince = new Date();
        else if (Date.now() - this.stoppedSince.getTime() > 120_000) {
          this.onSOS('Timeout');
        }
      } else {
        this.stoppedSince = null;
      }
      
      this.lastPosition = pos.coords;
    }, undefined, { enableHighAccuracy: true, maximumAge: 5000 });

    // Accelerometer
    window.addEventListener('devicemotion', this.handleMotion);
  }

  private handleMotion = (e: DeviceMotionEvent) => {
    const acc = e.accelerationIncludingGravity;
    if (!acc) return;
    const magnitude = Math.sqrt((acc.x ?? 0) ** 2 + (acc.y ?? 0) ** 2 + (acc.z ?? 0) ** 2);
    if (magnitude > 20) this.onSOS('Accelerometer'); // Sprint threshold
  };

  stop() {
    if (this.watchId) navigator.geolocation.clearWatch(this.watchId);
    window.removeEventListener('devicemotion', this.handleMotion);
  }
}
```

### 3.5 Map Page — `web/app/map/page.tsx`

Key elements:
- `useEffect` → load MapLibre map on mount
- `useEffect` → call `api.getReports()` on mount, add circle layers
- Route layer: two GeoJSON sources (`safe-route`, `fast-route`), toggled by state
- Floating buttons: "Report Danger" (bottom-right), "SOS" (top-right, red)
- Click on map → set destination → fetch route

### 3.6 SOS Countdown — `web/app/sos/page.tsx`

```typescript
'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

export default function SosPage() {
  const [count, setCount] = useState(60);
  const router = useRouter();

  useEffect(() => {
    if (count <= 0) {
      api.fireSos({ user_id: 'demo-user', trigger_type: 'Timeout', lat: 52.2297, lng: 21.0122 });
      return;
    }
    const t = setTimeout(() => setCount(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [count]);

  return (
    <div className="fixed inset-0 bg-red-900 flex flex-col items-center justify-center">
      <div className="text-9xl font-bold text-white animate-pulse">{count}</div>
      <p className="text-white text-2xl mt-4">Are you safe?</p>
      <button onClick={() => router.push('/map')}
        className="mt-8 px-12 py-4 bg-white text-red-900 font-bold text-xl rounded-full">
        I'M SAFE
      </button>
    </div>
  );
}
```

---

## Step 4 — Shared Types

**`packages/shared/types.ts`**

```typescript
export type TriggerType = 'Manual' | 'Accelerometer' | 'GPS_Deviation' | 'Timeout';
export type ReportStatus = 'Active' | 'Resolved' | 'Shadowbanned';
export type ReportCategory = 'Suspicious Activity' | 'Lighting Issue' | 'Obstacle';

export interface User {
  user_id: string;
  trusted_contacts: string[];
  reputation_score: number;
  total_reports_validated: number;
}

export interface Report {
  report_id: string;
  author_id: string;
  lat: number;
  lng: number;
  category: ReportCategory;
  validation_count: number;
  status: ReportStatus;
  created_at: string;
}

export interface SosEvent {
  event_id: string;
  user_id: string;
  trigger_type: TriggerType;
  lat: number;
  lng: number;
  dispatched_via: 'API' | 'SMS';
}

export interface RouteResponse {
  fastest: GeoJSON.Feature<GeoJSON.LineString>;
  safest: GeoJSON.Feature<GeoJSON.LineString>;
  danger_reports_on_fastest: number;
}
```

---

## Step 5 — Deployment

### 5.1 Backend → Railway

```bash
# In /backend
railway login
railway init
railway up
# Set env vars in Railway dashboard
```

### 5.2 Frontend → Vercel

```bash
# In /web
vercel
# Set NEXT_PUBLIC_BACKEND_URL to Railway URL
# Set NEXT_PUBLIC_SUPABASE_URL and KEY
vercel --prod
```

### 5.3 Supabase Production
- Enable Row Level Security on all tables
- Add policy: `SELECT` on reports → `status = 'Active'`
- Add policy: `INSERT` on reports → `auth.uid() = author_id`

---

## Step 6 — Demo Script (For Judges)

> Run this exact flow. Practice it 3 times before presenting.

1. **Open app on phone browser** → show map with danger markers around Warsaw
2. **Set a destination** → tap anywhere on map → two routes appear (safe = green, fast = blue)
3. **Point at the detour** → "Our app routes you around this danger cluster — 3 reports here"
4. **Trigger SOS manually** → tap SOS button → 60-second countdown appears
5. **Let it count to 0** → "SMS sent to trusted contacts with GPS coordinates"
6. **Open second tab** → show Supabase table with the new `sos_events` row
7. **Submit a danger report** → tap "Report Danger" → fill form → submit → marker appears live
8. **Show Shadow Trust** → open Supabase → show the `Shadowbanned` rows from the bad actor → "These never affect routing"

---

## Critical Path (Must Ship to Demo)

```
[DB schema] → [/api/reports GET] → [Map renders markers]
                                                        ↘
[/api/route] → [Two routes on map]         [SOS countdown] → [/api/sos POST] → [Twilio SMS]
                                                        ↗
[/api/reports POST] → [New marker appears live]
```

Everything else (polish, animations, validation endpoint) is **nice-to-have**.
