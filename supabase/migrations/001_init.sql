-- ============================================================
-- ImpactHer Safety App — Database Migration 001
-- Run in Supabase SQL Editor
-- ============================================================

-- Enable PostGIS extension for geospatial data
CREATE EXTENSION IF NOT EXISTS postgis;

-- ============================================================
-- TABLES
-- ============================================================

CREATE TABLE IF NOT EXISTS users (
  user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone TEXT UNIQUE,
  display_name TEXT,
  trusted_contacts TEXT[] DEFAULT '{}',
  reputation_score FLOAT DEFAULT 1.0 CHECK (reputation_score >= 0 AND reputation_score <= 1),
  total_reports_validated INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS reports (
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

CREATE TABLE IF NOT EXISTS sos_events (
  event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(user_id) ON DELETE SET NULL,
  trigger_type TEXT NOT NULL CHECK (trigger_type IN ('Manual', 'Accelerometer', 'GPS_Deviation', 'Timeout')),
  location GEOGRAPHY(POINT, 4326),
  dispatched_via TEXT DEFAULT 'API' CHECK (dispatched_via IN ('API', 'SMS')),
  contacts_notified INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- INDEXES
-- ============================================================

-- Spatial index for fast proximity queries (ST_DWithin)
CREATE INDEX IF NOT EXISTS reports_location_idx ON reports USING GIST (location);

-- Filter by status frequently
CREATE INDEX IF NOT EXISTS reports_status_idx ON reports (status);

-- ============================================================
-- VIEWS
-- ============================================================

-- Convenience view: reports with lat/lng extracted from geography
CREATE OR REPLACE VIEW reports_with_coords AS
SELECT
  report_id,
  author_id,
  category,
  description,
  validation_count,
  status,
  created_at,
  expires_at,
  ST_Y(location::geometry) AS lat,
  ST_X(location::geometry) AS lng
FROM reports;

-- ============================================================
-- HELPER FUNCTIONS
-- ============================================================

-- Increment total_reports_validated for a user
CREATE OR REPLACE FUNCTION increment_validated(uid UUID)
RETURNS VOID AS $$
  UPDATE users SET total_reports_validated = total_reports_validated + 1 WHERE user_id = uid;
$$ LANGUAGE sql;

-- Get reports within radius (meters) of a point
CREATE OR REPLACE FUNCTION reports_near(
  center_lat FLOAT,
  center_lng FLOAT,
  radius_meters FLOAT DEFAULT 500
)
RETURNS TABLE (
  report_id UUID,
  category TEXT,
  description TEXT,
  validation_count INT,
  status TEXT,
  lat FLOAT,
  lng FLOAT,
  distance_meters FLOAT
) AS $$
  SELECT
    r.report_id, r.category, r.description, r.validation_count, r.status,
    ST_Y(r.location::geometry) AS lat,
    ST_X(r.location::geometry) AS lng,
    ST_Distance(r.location, ST_Point(center_lng, center_lat)::geography) AS distance_meters
  FROM reports r
  WHERE
    r.status = 'Active'
    AND ST_DWithin(r.location, ST_Point(center_lng, center_lat)::geography, radius_meters)
  ORDER BY distance_meters;
$$ LANGUAGE sql;
