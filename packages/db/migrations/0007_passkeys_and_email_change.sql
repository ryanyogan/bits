-- Migration number: 0007 	 Passkey sign-in and email change (decision 030)
--
-- Passkeys: the table exists since 0001. It gains what the verifier reports
-- at registration (whether the credential is synced, and the authenticator
-- model id) so Settings can describe each passkey.
--
-- WebAuthn challenges are stored server-side, single use, for 10 minutes.
-- The verify step deletes the row with DELETE ... RETURNING, so exactly one
-- request can spend a challenge.
--
-- Email change reuses email_tokens (hashed token + code, 15 minutes, attempt
-- counting). `purpose` keeps the kinds apart: sign-in queries only ever see
-- 'sign-in' rows. An 'email-change' row (to the new address) and an
-- 'email-revert' row (to the old address, 7 days, link only) belong to
-- `user_id`.

alter table passkeys add column backed_up integer not null default 0 check (backed_up in (0, 1));
-- 'singleDevice' or 'multiDevice' as the verifier reports it.
alter table passkeys add column device_type text;
-- Authenticator model (AAGUID, UUID text). All zeros for most synced passkeys.
alter table passkeys add column aaguid text;

create table webauthn_challenges (
  -- base64url of 32 random bytes, exactly as sent to the browser.
  challenge text primary key not null,
  purpose text not null check (purpose in ('register', 'sign-in')),
  -- The signed-in user a registration challenge was issued to. Null for sign-in.
  user_id text references users (id) on delete cascade,
  expires_at integer not null,
  created_at integer not null
);

create index webauthn_challenges_expires_at on webauthn_challenges (expires_at);

alter table email_tokens add column purpose text not null default 'sign-in' check (purpose in ('sign-in', 'email-change', 'email-revert'));
-- The account an 'email-change' or 'email-revert' token moves to `email`. Null for sign-in.
alter table email_tokens add column user_id text references users (id) on delete cascade;
-- 'email-revert' only: the address the change moved TO. A revert applies only
-- while the account still has it, so a stale link can't rewrite a later email.
alter table email_tokens add column changed_to text collate nocase;

create index email_tokens_user_purpose on email_tokens (user_id, purpose, created_at);
