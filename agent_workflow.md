# Agent Workflow — ImpactHer Hackathon

> How to run AI agents in parallel to compress 24h of work into ~8h of real time.

---

## Mental Model

Think of the AI agent as a **junior dev who never sleeps, never gets blocked on syntax, but needs very precise task boundaries**.

The key principle: **one agent = one bounded context**. Never give an agent two disconnected concerns in the same prompt.

---

## Team Roles → Agent Mapping

| Human Role | Agent Instance | Responsibility |
|---|---|---|
| Tech Lead | You (main thread) | Orchestrates agents, reviews output, resolves conflicts |
| Frontend Dev | Agent A | Next.js pages, map UI, SOS countdown, report form |
| Backend Dev | Agent B | Express routes, trust engine, Supabase queries |
| DB Admin | Agent C | Schema migrations, PostGIS queries, seed data |
| QA / Integrator | Agent D | Wires A+B together, writes integration tests, fixes CORS |

---

## Phase 0 — Bootstrap (Hour 0–1, You Only)

Do this yourself before spawning agents. Agents fail when the scaffold doesn't exist.

```bash
# 1. Init Next.js app
npx create-next-app@latest web --typescript --app --tailwind --eslint
cd web

# 2. Init Express backend
mkdir backend && cd backend && npm init -y
npm install express cors helmet dotenv @supabase/supabase-js

# 3. Create Supabase project at supabase.com
#    → Copy SUPABASE_URL and SUPABASE_ANON_KEY into .env files

# 4. Run DB migrations (Agent C output, applied by you)
```

---

## Phase 1 — Parallel Sprint (Hour 1–8)

Run these three agents **simultaneously** in separate chat windows / IDE tabs.

---

### Agent A Prompt — Frontend (Map + SOS)

```
CONTEXT:
- Next.js 14 App Router project at ./web
- Stack: TypeScript, Tailwind, maplibre-gl, Zustand
- Supabase client already initialized at ./web/lib/supabase.ts
- Backend API running at http://localhost:3001

TASK 1 — Map Screen (./web/app/map/page.tsx):
- Render a MapLibre GL JS map centered on Warsaw (52.2297, 21.0122)
- Fetch GET /api/reports from backend and render each report as a colored circle marker
  - 'Suspicious Activity' = red, 'Lighting Issue' = yellow, 'Obstacle' = orange
- Fetch GET /api/route?from=LAT,LNG&to=LAT,LNG from backend
  - Render TWO polylines: safest route (green) and fastest route (blue)
  - Show a toggle in top-right corner to switch between them
- Add a floating "Report Danger" button (bottom-right)

TASK 2 — SOS Countdown (./web/app/sos/page.tsx):
- Full-screen dark red overlay
- Large countdown timer from 60 to 0 (animated)
- Text: "Are you safe? Tap to cancel."
- "I'M SAFE" button — cancels countdown, navigates back to map
- On countdown reaching 0: POST /api/sos with { trigger_type, lat, lng }
- Show confirmation message: "SOS sent. Help is on the way."

TASK 3 — Sensor Engine (./web/lib/sensorEngine.ts):
- Class SensorEngine with start() / stop() methods
- Uses navigator.geolocation.watchPosition for GPS
- Uses DeviceMotionEvent for accelerometer
- Detects: sprint (accel variance > 15 m/s²), prolonged stop (120s with no movement in danger zone)
- On anomaly detected: calls router.push('/sos') via passed callback

Deliver: Working TypeScript components. No placeholder data — use real API calls.
```

---

### Agent B Prompt — Backend (Routes + Trust Engine)

```
CONTEXT:
- Node.js/Express backend at ./backend/src/index.ts
- Supabase client at ./backend/src/db/supabase.ts
- Environment: SUPABASE_URL, SUPABASE_SERVICE_KEY, TWILIO_SID, TWILIO_TOKEN

TASK 1 — Reports API (./backend/src/routes/reports.ts):
GET /api/reports
  → SELECT * FROM reports WHERE status = 'Active'
  → Return as GeoJSON FeatureCollection

POST /api/reports
  → Body: { author_id, lat, lng, category }
  → Check author reputation_score from users table
  → If score < 0.3: insert with status = 'Shadowbanned'
  → Else: insert with status = 'Active'
  → Return created report

PATCH /api/reports/:id/validate
  → Body: { user_id, verdict: 'safe' | 'unsafe' }
  → If verdict = 'unsafe': increment validation_count, author reputation += 0.1
  → If verdict = 'safe': author reputation -= 0.3, check if report should be Resolved
  → Return updated report

TASK 2 — Routing API (./backend/src/routes/route.ts):
POST /api/route
  → Body: { from_lat, from_lng, to_lat, to_lng }
  → Call OSRM public API for fastest route: http://router.project-osrm.org/route/v1/foot/{coords}
  → For safest route: same OSRM call but apply a simple detour heuristic:
    - Fetch all Active reports within 200m of the fastest route
    - Add 30% distance penalty per report on segment
    - Return both routes as GeoJSON LineString arrays

TASK 3 — SOS API (./backend/src/routes/sos.ts):
POST /api/sos
  → Body: { user_id, trigger_type, lat, lng }
  → Insert into sos_events table
  → Fetch user.trusted_contacts
  → For each contact: send SMS via Twilio: "SAFETY ALERT: [name] triggered SOS at coords [lat],[lng]"
  → Return { dispatched: true, method: 'API' }

Deliver: Full Express route handlers with error handling. TypeScript.
```

---

### Agent C Prompt — Database

```
CONTEXT:
- Supabase project already created
- Need PostGIS extension enabled

TASK 1 — Write SQL migration file (./supabase/migrations/001_init.sql):
- Enable postgis extension
- Create users table (user_id UUID PK, trusted_contacts TEXT[], reputation_score FLOAT DEFAULT 1.0, total_reports_validated INT DEFAULT 0)
- Create reports table with GEOGRAPHY(POINT, 4326) column for location, status enum, category enum, validation_count INT
- Create sos_events table with GEOGRAPHY(POINT, 4326), trigger_type enum, dispatched_via enum
- Add GIST spatial index on reports.location
- Add RLS policies: users can read Active reports, users can only write their own reports

TASK 2 — Write seed data file (./supabase/seeds/001_seed.sql):
- Insert 3 test users with varying reputation scores (0.9, 0.5, 0.1)
- Insert 8 sample reports around Warsaw city center with realistic coordinates
  - Mix of categories and statuses (including 2 Shadowbanned ones to verify the system)
- Insert 1 historical SOS event

TASK 3 — Write helper queries (./supabase/queries.sql):
- Query: Get all Active reports within 500m of a point (use ST_DWithin)
- Query: Get user reputation with report count
- Query: Reports that need validation (validation_count < 3, older than 10 minutes)

Deliver: Pure SQL files, ready to paste into Supabase SQL editor.
```

---

## Phase 2 — Integration (Hour 8–12, Agent D)

After A, B, C deliver, run this agent to wire everything together.

### Agent D Prompt — Integration + Fixes

```
CONTEXT:
- Next.js frontend at ./web, running on :3000
- Express backend at ./backend, running on :3001
- Both are TypeScript. Supabase is live.
- Frontend needs to talk to backend. CORS must be configured.

TASK 1 — Fix CORS:
- In backend/src/index.ts, configure cors() to allow origin http://localhost:3000
- Add Content-Type and Authorization to allowed headers

TASK 2 — Shared Types:
- Create ./packages/shared/types.ts
- Export: User, Report (with GeoJSON coords), SOS_Event, RouteResponse, TriggerType enum
- Import these types in both frontend and backend (adjust tsconfig paths)

TASK 3 — End-to-end smoke test:
- Write a simple test script (./scripts/smoke-test.ts) using fetch()
- Tests: POST report → GET reports (verify it appears) → POST /sos → check sos_events table
- Run with: npx tsx scripts/smoke-test.ts

TASK 4 — Environment wiring:
- Create ./web/.env.local template with: NEXT_PUBLIC_BACKEND_URL, NEXT_PUBLIC_MAPLIBRE_STYLE
- Create ./backend/.env template with all required vars
- Write a ./README.md with exact setup steps (npm install, env vars, supabase migration command, start commands)

Deliver: Fixed code diffs and a green smoke test.
```

---

## Phase 3 — Polish (Hour 12–20, Agent A again)

```
CONTEXT: App is working end-to-end. Now make it impressive for judges.

TASK 1 — Map polish:
- Add animated pulse on report markers (CSS keyframes)
- Add smooth map fly-to animation when route loads
- Style the two route polylines with dashed pattern for fastest, solid for safest
- Add a legend card (bottom-left): route colors + report category colors

TASK 2 — SOS screen polish:
- Add a pulsing red ring animation behind the countdown number
- Add haptic feedback on countdown start (navigator.vibrate([200, 100, 200]))
- Show GPS coordinates in small text below the countdown

TASK 3 — Report form:
- Slide-up modal from bottom when "Report Danger" is pressed
- Category selector with icons (🔪 Suspicious, 💡 Lighting, 🚧 Obstacle)
- Auto-fill coordinates from current GPS position
- Loading spinner on submit, success toast on completion

Deliver: Updated component files only. Do not change backend.
```

---

## Agent Rules of Engagement

| Rule | Why |
|---|---|
| Always specify exact file paths in prompts | Agents hallucinate paths if left vague |
| Give API contracts (shape of request/response) | Prevents frontend/backend mismatch |
| Say "no placeholders, real API calls" | Agents default to hardcoded mock data |
| Ask for TypeScript, not JavaScript | Catches type mismatches at compile time |
| Review agent output before running | Agents sometimes import nonexistent packages |
| One agent per PR/branch | Easier to merge and review |

---

## Checkpoint Schedule

| Time | Checkpoint | What to verify |
|---|---|---|
| Hour 1 | Scaffold exists | Both apps start without errors |
| Hour 4 | Agent A + B first pass | Map renders, `/api/reports` returns data |
| Hour 8 | Agent C applied | DB has real data, RLS works |
| Hour 10 | Agent D integration | Frontend talks to backend end-to-end |
| Hour 14 | SOS flow works | Countdown fires, Twilio sends SMS |
| Hour 18 | Polish merged | Map looks good, animations smooth |
| Hour 20 | Demo rehearsal | Full flow on real phone browser |
| Hour 22 | Freeze code | No more changes, focus on pitch |
