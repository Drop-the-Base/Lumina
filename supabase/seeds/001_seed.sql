-- ============================================================
-- ImpactHer — Seed Data
-- Run AFTER 001_init.sql
-- ============================================================

-- Test users
INSERT INTO users (user_id, display_name, phone, trusted_contacts, reputation_score) VALUES
  ('11111111-1111-1111-1111-111111111111', 'Anna K.', '+48600000001', ARRAY['+48600000002', '+48600000003'], 0.95),
  ('22222222-2222-2222-2222-222222222222', 'Maria W.', '+48600000002', ARRAY['+48600000001'], 0.42),
  ('33333333-3333-3333-3333-333333333333', 'Bad Actor', '+48600000099', ARRAY[]::TEXT[], 0.08)
ON CONFLICT DO NOTHING;

-- Active reports around Warsaw center
INSERT INTO reports (author_id, location, category, description, status) VALUES
  -- Praga district — suspicious activity
  ('11111111-1111-1111-1111-111111111111',
   ST_Point(21.0450, 52.2510)::geography, 'Suspicious Activity',
   'Group of men following women near tram stop', 'Active'),

  -- Near Centrum — lighting issue
  ('11111111-1111-1111-1111-111111111111',
   ST_Point(21.0050, 52.2310)::geography, 'Lighting Issue',
   'Street lights broken for past 3 days', 'Active'),

  -- Śródmieście — obstacle
  ('22222222-2222-2222-2222-222222222222',
   ST_Point(21.0200, 52.2280)::geography, 'Obstacle',
   'Construction blocking the sidewalk, forced into road', 'Active'),

  -- Near Dworzec — suspicious
  ('22222222-2222-2222-2222-222222222222',
   ST_Point(21.0150, 52.2350)::geography, 'Suspicious Activity',
   'Aggressive panhandling, feel unsafe', 'Active'),

  -- Wola — lighting
  ('11111111-1111-1111-1111-111111111111',
   ST_Point(20.9900, 52.2280)::geography, 'Lighting Issue',
   'Entire underpass is dark at night', 'Active'),

  -- Mokotów — suspicious
  ('22222222-2222-2222-2222-222222222222',
   ST_Point(21.0050, 52.2100)::geography, 'Suspicious Activity',
   'Someone was following me here last night', 'Active'),

  -- Shadowbanned reports from bad actor (should NOT appear in routing)
  ('33333333-3333-3333-3333-333333333333',
   ST_Point(21.0122, 52.2297)::geography, 'Suspicious Activity',
   'Fake report to reroute victims', 'Shadowbanned'),

  ('33333333-3333-3333-3333-333333333333',
   ST_Point(21.0300, 52.2400)::geography, 'Obstacle',
   'Another fake report', 'Shadowbanned');

-- Historical SOS event
INSERT INTO sos_events (user_id, trigger_type, location, dispatched_via, contacts_notified) VALUES
  ('11111111-1111-1111-1111-111111111111',
   'Manual',
   ST_Point(21.0122, 52.2297)::geography,
   'API',
   2);
