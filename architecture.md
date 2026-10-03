# ImpactHer — Architecture Proposal

## Stack Decision (Hackathon-Optimised)

| Layer | Choice | Rationale |
|---|---|---|
| **Mobile** | Expo (React Native) | Native sensor APIs, fast iteration, runs on both iOS & Android |
| **Maps** | `react-native-maps` + MapLibre | Free tile layers, custom vector overlays for safety scores |
| **Routing** | OSRM (self-hosted or hosted endpoint) | Supports custom cost functions via Lua profiles |
| **Backend** | Node.js + Express | Fast setup, same JS ecosystem as frontend |
| **DB / Auth / Realtime** | Supabase (Postgres + PostGIS + Realtime WS) | PostGIS for geospatial queries, Row Level Security for user trust, out-of-the-box auth |
| **SMS Fallback** | Twilio (or native SMS intent on Android) | Offline-resilient SOS broadcast |
| **Hosting** | Railway / Render (backend) + Expo Go (mobile) | Zero-config deploy for hackathon |

---

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     MOBILE CLIENT (Expo)                     │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌─────────────────┐   │
│  │  Map Screen  │  │ SOS Countdown│  │ Report UI       │   │
│  │ (MapLibre)   │  │ (Dead Man's  │  │ (One-tap)       │   │
│  │              │  │  Switch)     │  │                 │   │
│  └──────┬───────┘  └──────┬───────┘  └────────┬────────┘   │
│         │                 │                    │             │
│  ┌──────▼─────────────────▼────────────────────▼────────┐   │
│  │             Local Sensor Engine                        │   │
│  │  Accelerometer Monitor │ GPS Watcher │ Network Watch  │   │
│  └──────────────────────────────┬────────────────────────┘   │
└─────────────────────────────────│───────────────────────────┘
                                  │ HTTPS / WebSocket
                     ┌────────────▼────────────┐
                     │    Node.js / Express     │
                     │       API Gateway        │
                     │                          │
                     │  /route   POST           │
                     │  /reports GET/POST       │
                     │  /sos     POST           │
                     │  /trust   (internal)     │
                     └────────────┬─────────────┘
                                  │
              ┌───────────────────┼───────────────────┐
              │                   │                   │
   ┌──────────▼──────┐  ┌────────▼────────┐  ┌──────▼──────┐
   │   Supabase DB   │  │  OSRM Routing   │  │   Twilio    │
   │ (PostGIS)       │  │  Engine         │  │  SMS API    │
   │                 │  │                 │  │             │
   │  users          │  │ Custom safety   │  │ Offline SOS │
   │  reports        │  │ cost profile    │  │ broadcast   │
   │  sos_events     │  │ (penalizes dark │  │             │
   │                 │  │  streets)       │  │             │
   └─────────────────┘  └─────────────────┘  └─────────────┘
```

---

## Monorepo Structure

```
impact_her/
├── apps/
│   └── mobile/                  # Expo app
│       ├── app/                 # Expo Router file-based routing
│       │   ├── (tabs)/
│       │   │   ├── map.tsx      # Main map + routing screen
│       │   │   └── reports.tsx  # Community reports feed
│       │   └── sos/
│       │       └── countdown.tsx
│       ├── services/
│       │   ├── sensorEngine.ts  # Accel + GPS anomaly detection
│       │   ├── sosDispatcher.ts # API call → SMS fallback
│       │   └── routeService.ts  # Calls backend /route
│       └── store/               # Zustand global state
│
├── apps/
│   └── backend/                 # Node.js / Express
│       ├── src/
│       │   ├── routes/
│       │   │   ├── route.ts     # Routing endpoint
│       │   │   ├── reports.ts   # Community reports CRUD
│       │   │   └── sos.ts       # SOS event handler
│       │   ├── services/
│       │   │   ├── osrmClient.ts
│       │   │   ├── trustEngine.ts   # Shadow Trust Metric logic
│       │   │   └── smsService.ts
│       │   └── db/
│       │       └── supabase.ts
│       └── supabase/
│           └── migrations/      # PostGIS schema migrations
│
└── packages/
    └── shared/                  # Shared TS types (User, Report, SOS_Event)
```

---

## Feature Deep-Dives

### A. Sensor Engine (Local, on device)

```typescript
// Runs as a background task via expo-task-manager
class SensorEngine {
  private accelWindow: number[] = [];  // Rolling 2s variance
  private lastMovement: Date;
  private activeRoute: Coordinate[];

  onAccelUpdate(data: AccelerometerData) {
    // Trigger if variance > SPRINT_THRESHOLD
  }

  onGPSUpdate(coords: Coords) {
    // Trigger if stopped > 120s in danger zone
    // Trigger if deviation from route > DEVIATION_METERS
  }

  private triggerSOS(type: TriggerType) {
    // → show 60s countdown UI
    // → if not dismissed → sosDispatcher.fire()
  }
}
```

### B. Safety Routing Heuristic

The backend calls OSRM with a **custom Lua weight profile** that:
- Adds penalty cost to road segments tagged `highway=unlit` or `amenity=none`
- Subtracts cost near segments with active `Report.status = Active` within 50m
- Completely avoids segments flagged by the police danger zone API

Response returns **two routes**: fastest + safest, rendered as overlays for comparison.

### C. Shadow Trust Metric (server-side only)

```
New Report submitted
  → author.reputation_score checked
  → if score < THRESHOLD (e.g. 0.3): save to DB, status = Shadowbanned (no routing impact)
  → else: status = Active, added to routing cost layer

User walks past report node (GPS within 30m)
  → prompt: "Is this area [safe/unsafe]?"
  → Validated: report.validation_count++, author.reputation += 0.1
  → Contradicted: author.reputation -= 0.3
```

### D. Offline-Resilient SOS

```
sosDispatcher.fire(location, triggerType):
  1. Try POST /sos → API (internet available)
  2. If fails → compress payload to SMS string:
     "SOS|lat:52.2297|lng:21.0122|type:ACCEL|time:1696341499"
  3. Dispatch via expo-sms (Android native) or Twilio fallback number
```

---

## Database Schema (Supabase / PostGIS)

```sql
-- Enable geospatial extension
CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE users (
  user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trusted_contacts TEXT[],
  reputation_score FLOAT DEFAULT 1.0,
  total_reports_validated INT DEFAULT 0
);

CREATE TABLE reports (
  report_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id UUID REFERENCES users(user_id),
  location GEOGRAPHY(POINT, 4326) NOT NULL,
  category TEXT CHECK (category IN ('Suspicious Activity', 'Lighting Issue', 'Obstacle')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  validation_count INT DEFAULT 0,
  status TEXT DEFAULT 'Active' CHECK (status IN ('Active', 'Resolved', 'Shadowbanned'))
);

CREATE TABLE sos_events (
  event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(user_id),
  trigger_type TEXT CHECK (trigger_type IN ('Manual', 'Accelerometer', 'GPS_Deviation', 'Timeout')),
  location GEOGRAPHY(POINT, 4326),
  dispatched_via TEXT CHECK (dispatched_via IN ('API', 'SMS')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Spatial index for fast proximity queries
CREATE INDEX reports_location_idx ON reports USING GIST (location);
```

---

## 24-Hour Build Priority

| Hour | Task | Owner |
|------|------|-------|
| 0–2 | Monorepo setup, Supabase project + schema, Expo init | All |
| 2–5 | Map screen + hardcoded safe/fast route overlay | Frontend |
| 2–5 | `/route` endpoint + OSRM integration (mock safety layer) | Backend |
| 5–8 | **SOS countdown UI + accelerometer trigger** (WOW factor) | Frontend |
| 5–8 | `/sos` endpoint + Twilio SMS | Backend |
| 8–11 | One-tap report UI + `/reports` CRUD | Frontend |
| 8–11 | Shadow Trust Metric logic in trustEngine.ts | Backend |
| 11–14 | Wire frontend ↔ backend for reports + real-time Supabase WS | Both |
| 14–18 | Polish: animations, countdown timer, map styling | Frontend |
| 18–20 | Offline SMS fallback demo | Frontend |
| 20–24 | Buffer, testing on real device, rehearse demo script | All |

---

## Key Technical Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| OSRM custom Lua profile too slow to configure | Start with mock safety scores as static GeoJSON overlay |
| Background sensor task killed by OS | Use `expo-task-manager` + `expo-background-fetch`; demo in foreground if needed |
| Polish KMZB API unavailable or rate-limited | Pre-cache a static GeoJSON snapshot of danger zones for demo |
| SMS not sent in demo environment | Use Twilio test credentials + log payload to screen as fallback |
| Reputation score gaming during demo | Pre-seed the DB with realistic reputation distribution |
