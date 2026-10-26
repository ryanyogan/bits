-- Local development seed. Applied with `pnpm db:seed:local` (never remote).
-- Idempotent: safe to run repeatedly.
insert or ignore into users (
  id, email, email_verified_at, display_name, handle, avatar, role, goals,
  timezone, xp_total, is_public, created_at, updated_at
) values (
  '00000000-0000-4000-8000-000000000001',
  'demo@bits.local',
  1761436800000,
  'Demo Learner',
  'demo',
  null,
  'admin',
  '["agents","prompting"]',
  'UTC',
  120,
  1,
  1761436800000,
  1761436800000
);
