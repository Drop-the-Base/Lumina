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

-- Active reports tightly clustered in Krakow Old Town (Stare Miasto) for a short route test
-- Example test route: Wawel Castle (50.054, 19.935) to Main Square (50.061, 19.937)
INSERT INTO reports (author_id, location, category, description, status) VALUES
  -- Grodzka Street (Direct path from Wawel to Main Square) — suspicious activity
  ('11111111-1111-1111-1111-111111111111',
   ST_Point(19.9380, 50.0570)::geography, 'Suspicious Activity',
   'Group of men following women near tram stop', 'Active'),

  -- Planty Park near Franciszkańska — lighting issue
  ('11111111-1111-1111-1111-111111111111',
   ST_Point(19.9395, 50.0590)::geography, 'Lighting Issue',
   'Street lights broken for past 3 days', 'Active'),

  -- Bracka Street — obstacle
  ('22222222-2222-2222-2222-222222222222',
   ST_Point(19.9360, 50.0600)::geography, 'Obstacle',
   'Construction blocking the sidewalk, forced into road', 'Active'),

  -- Dominikańska Street — suspicious
  ('22222222-2222-2222-2222-222222222222',
   ST_Point(19.9390, 50.0595)::geography, 'Suspicious Activity',
   'Aggressive panhandling, feel unsafe', 'Active'),

  -- Floriańska Street (North of Main Square) — lighting
  ('11111111-1111-1111-1111-111111111111',
   ST_Point(19.9405, 50.0630)::geography, 'Lighting Issue',
   'Entire alleyway is dark at night', 'Active'),

  -- Wiślna Street — suspicious
  ('22222222-2222-2222-2222-222222222222',
   ST_Point(19.9340, 50.0605)::geography, 'Suspicious Activity',
   'Someone was following me here last night', 'Active'),

  -- Shadowbanned reports from bad actor (should NOT appear in routing)
  ('33333333-3333-3333-3333-333333333333',
   ST_Point(19.9370, 50.0610)::geography, 'Suspicious Activity',
   'Fake report to reroute victims', 'Shadowbanned'),

  ('33333333-3333-3333-3333-333333333333',
   ST_Point(19.9350, 50.0540)::geography, 'Obstacle',
   'Another fake report', 'Shadowbanned');

-- Historical SOS event
INSERT INTO sos_events (user_id, trigger_type, location, dispatched_via, contacts_notified) VALUES
  ('11111111-1111-1111-1111-111111111111',
   'Manual',
   ST_Point(19.9372, 50.0614)::geography,
   'API',
   2);
