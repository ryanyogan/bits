-- Migration number: 0002 	 Remix sessions in D1, email sign-in rate limits
--
-- Sessions become the backing store for `remix/session`: one row per browser
-- session, signed-in or not. The row holds the serialized session data, and
-- user_id is copied out of it so "sign out everywhere" and the settings list
-- can find a user's sessions. No sessions existed when this ran, so the table
-- is recreated rather than rebuilt in place.

drop table sessions;

create table sessions (
  -- SHA-256 hex of the session id carried in the signed __Host-session
  -- cookie, so a database leak cannot replay sessions.
  id text primary key not null,
  -- Null until the browser signs in.
  user_id text references users (id) on delete cascade,
  -- remix/session data: JSON [values, flash].
  data text not null default '[{},{}]' check (json_valid(data)),
  user_agent text,
  expires_at integer not null,
  created_at integer not null,
  last_seen_at integer not null
);

create index sessions_user_id on sessions (user_id);
create index sessions_expires_at on sessions (expires_at);

-- Per-IP rate limit (20 per hour): SHA-256 hex of the client IP.
alter table email_tokens add column ip_hash text;
-- Sign-up answers (display name, goals, timezone) held until the email is
-- verified and the user row is created. JSON object or null.
alter table email_tokens add column signup text check (signup is null or json_valid(signup));

create index email_tokens_ip_created on email_tokens (ip_hash, created_at);
create index email_tokens_expires_at on email_tokens (expires_at);
