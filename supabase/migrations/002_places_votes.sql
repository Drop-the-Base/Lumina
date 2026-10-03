-- ============================================================
-- Lumina — Migration 002: places, report votes, SOS trigger types
-- Run in Supabase SQL Editor AFTER 001_init.sql (+ seeds/001_seed.sql)
-- ============================================================

-- Safe havens & personal places (previously stored in a JSON file,
-- which is read-only on Vercel, so nothing was ever persisted)
CREATE TABLE IF NOT EXISTS places (
  id TEXT PRIMARY KEY DEFAULT ('place_' || replace(gen_random_uuid()::text, '-', '')),
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('Police', 'SafeHaven', 'Personal', 'Medical')),
  address TEXT,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  icon TEXT,
  owner_id UUID REFERENCES users(user_id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO places (id, name, category, address, lat, lng, icon) VALUES
  ('sh_police_1', 'Komisariat I Policji w Krakowie', 'Police', 'ul. Szeroka 35', 50.0515, 19.9480, '🚓'),
  ('sh_police_2', 'Komisariat II Policji w Krakowie', 'Police', 'ul. Radziwiłłowska 18', 50.0635, 19.9470, '🚓'),
  ('sh_haven_1', 'Kawiarnia "Safe Haven" (Akcja Ask for Angela)', 'SafeHaven', 'ul. Floriańska 22', 50.0625, 19.9395, '🛡️'),
  ('sh_haven_2', 'Pub Oaza (Bezpieczny Punkt Schronienia)', 'SafeHaven', 'ul. Szewska 12', 50.0620, 19.9340, '🛡️'),
  ('sh_medical_1', 'Całodobowy Punkt Medyczny & Apteka 24/7', 'Medical', 'ul. Basztowa 15', 50.0650, 19.9410, '🏥'),
  ('sh_personal_1', 'Mój Dom (Bezpieczny Cel)', 'Personal', 'ul. Grodzka 10', 50.0575, 19.9380, '🏠'),
  ('sh_personal_2', 'Dom Mamy (Kasia)', 'Personal', 'ul. Karmelicka 14', 50.0640, 19.9310, '❤️')
ON CONFLICT (id) DO NOTHING;

-- One vote per user per report — basis of the reputation system
CREATE TABLE IF NOT EXISTS report_votes (
  report_id UUID NOT NULL REFERENCES reports(report_id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  verdict TEXT NOT NULL CHECK (verdict IN ('confirm', 'deny')),
  voter_reputation FLOAT NOT NULL DEFAULT 0.5,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (report_id, user_id)
);

-- Dead Man's Switch can fire on combined flags or low battery
ALTER TABLE sos_events DROP CONSTRAINT IF EXISTS sos_events_trigger_type_check;
ALTER TABLE sos_events ADD CONSTRAINT sos_events_trigger_type_check
  CHECK (trigger_type IN ('Manual', 'Accelerometer', 'GPS_Deviation', 'Timeout', 'LowBattery', 'DeadManSwitch'));

-- Reports must stay visible for the demo; expiry is enforced by status instead
ALTER TABLE reports ALTER COLUMN expires_at DROP DEFAULT;

-- The API runs server-side with the service role key; keep anon clients out
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE sos_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE places ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_votes ENABLE ROW LEVEL SECURITY;
