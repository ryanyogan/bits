-- Migration number: 0010 	 Author invites (decision 037)
--
-- An admin invites an email address to become an author, optionally of some
-- courses. The invitee gets a single-use link that expires after 7 days; it
-- only works from a session signed in as that address, and it never starts
-- a session. Like every other secret, the link's token is stored only as its
-- SHA-256 hex digest.
--
-- An invite is open while accepted_at and revoked_at are null and
-- expires_at is in the future. The daily clean-up deletes rows 30 days
-- after they expire, accepted or not, so invitee addresses don't linger.

create table author_invites (
  id text primary key not null,
  token_hash text not null,
  email text not null collate nocase check (length(email) between 3 and 320),
  -- Course slugs to add the invitee to on accept, a JSON array of strings.
  -- Slugs deleted in the meantime are skipped.
  courses text not null default '[]' check (json_valid(courses) and json_type(courses) = 'array'),
  invited_by text references users (id) on delete set null,
  expires_at integer not null,
  accepted_at integer,
  accepted_by text references users (id) on delete set null,
  revoked_at integer,
  created_at integer not null
);

create unique index author_invites_token_hash on author_invites (token_hash);
create index author_invites_email on author_invites (email, created_at);
create index author_invites_expires_at on author_invites (expires_at);
