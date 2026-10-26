-- Migration number: 0001 	 users and auth
--
-- Applied by `wrangler d1 migrations apply DB --local|--remote` (journal table
-- `d1_migrations`). Never edit an applied migration; add a new numbered file.
--
-- Conventions:
-- - ids are random UUID text generated in the app (crypto.randomUUID()).
-- - timestamps are INTEGER Unix epoch milliseconds.
-- - booleans are INTEGER 0/1; JSON is TEXT checked with json_valid().
-- - secrets (session tokens, email tokens, codes) are stored only as
--   SHA-256 hex digests.
-- - D1 enforces foreign keys, so child rows cascade when a user is deleted.

create table users (
  id text primary key not null,
  email text not null collate nocase check (length(email) between 3 and 320),
  email_verified_at integer,
  display_name text not null default '' check (length(display_name) <= 80),
  handle text not null collate nocase check (length(handle) between 2 and 32),
  -- Image URL or R2 key; null means "use the generated avatar".
  avatar text,
  role text not null default 'learner' check (role in ('learner', 'author', 'admin')),
  -- "What brings you here?" answers from sign-up, a JSON array of strings.
  goals text not null default '[]' check (json_valid(goals) and json_type(goals) = 'array'),
  -- IANA zone from the browser at sign-up; used to compute streak days.
  timezone text not null default 'UTC',
  xp_total integer not null default 0 check (xp_total >= 0),
  -- Profiles are public by default (open decision, provisional).
  is_public integer not null default 1 check (is_public in (0, 1)),
  created_at integer not null,
  updated_at integer not null
);

create unique index users_email_unique on users (email);
create unique index users_handle_unique on users (handle);

-- OAuth identities (GitHub, Google) linked to a user.
create table identities (
  provider text not null check (provider in ('github', 'google')),
  provider_user_id text not null,
  user_id text not null references users (id) on delete cascade,
  -- Email the provider reported, kept for account-linking audits.
  email text collate nocase,
  created_at integer not null,
  primary key (provider, provider_user_id)
);

create index identities_user_id on identities (user_id);

-- Server-side sessions. The cookie carries an opaque random token; `id` is
-- the SHA-256 hex of that token, so a database leak cannot replay sessions.
create table sessions (
  id text primary key not null,
  user_id text not null references users (id) on delete cascade,
  expires_at integer not null,
  created_at integer not null,
  last_seen_at integer not null,
  user_agent text
);

create index sessions_user_id on sessions (user_id);
create index sessions_expires_at on sessions (expires_at);

-- Email sign-in: one row per email sent. The magic-link token and the 6-digit
-- code are both stored hashed, expire after 15 minutes, and are single use.
create table email_tokens (
  token_hash text primary key not null,
  code_hash text not null,
  email text not null collate nocase,
  attempts integer not null default 0 check (attempts >= 0),
  expires_at integer not null,
  used_at integer,
  -- Where to send the user after verifying (a same-origin path).
  next_path text,
  created_at integer not null
);

-- Code lookup by email and per-email rate limiting (3 per 10 minutes).
create index email_tokens_email_created on email_tokens (email, created_at);

-- WebAuthn credentials.
create table passkeys (
  -- base64url credential id from the authenticator.
  credential_id text primary key not null,
  user_id text not null references users (id) on delete cascade,
  -- base64url COSE public key.
  public_key text not null,
  counter integer not null default 0 check (counter >= 0),
  -- JSON array of AuthenticatorTransport strings.
  transports text not null default '[]' check (json_valid(transports)),
  -- Optional label shown in /settings ("MacBook Touch ID").
  name text,
  created_at integer not null,
  last_used_at integer
);

create index passkeys_user_id on passkeys (user_id);
