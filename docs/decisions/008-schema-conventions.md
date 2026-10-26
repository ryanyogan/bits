# 008. Schema conventions and migrations

Status: Accepted (2026-10-26)

## Decision

- Migrations are plain SQL in `packages/db/migrations/NNNN_name.sql`, applied
  by `wrangler d1 migrations apply` (`pnpm db:migrate:local`,
  `pnpm db:migrate:remote`). Wrangler tracks them in `d1_migrations`.
  data-table's `db.migrate()` is not used, because it needs transactions (see
  003).
- IDs: users get a text UUID (`crypto.randomUUID()`). Secrets are never
  stored raw. Session ids, email tokens and codes are stored as SHA-256 hex.
- Timestamps are `integer` epoch milliseconds (`*_at`). data-table's
  `timestamps: true` uses `Date.now()` via the database's `now` option.
- Booleans are `integer` 0/1 with a CHECK. JSON is `text` with a
  `json_valid` CHECK, decoded in the table's `afterRead`.
- Emails and handles are `COLLATE NOCASE` with unique indexes, and the app
  normalizes them to lowercase as well.
- Foreign keys use `ON DELETE CASCADE` from user-owned rows, so account
  deletion is a single `DELETE FROM users`.
- Every migration change updates `packages/db/src/tables.ts` in the same
  commit.
- `packages/db/seed/local.sql` seeds local only (demo user
  `demo@bits.local`, handle `demo`).
