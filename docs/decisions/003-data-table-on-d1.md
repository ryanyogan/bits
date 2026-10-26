# 003. remix/data-table on D1

Status: Accepted (2026-10-26)

## Context

The handoff says "use whatever query layer the Remix skills or the repo
already use". That is `remix/data-table`. It ships drivers for
better-sqlite3/node:sqlite, Postgres and MySQL, but none for D1. D1 is SQLite
behind an async binding. It has no interactive transactions (a Worker cannot
hold BEGIN/COMMIT across awaits), and `batch()` is the atomic unit.

## Decision

Yes, data-table runs on D1, through a small custom driver in
`packages/db/src/d1/`:

- `sql-compiler.ts` is vendored, MIT, from `@remix-run/data-table-sqlite`.
  The SQLite dialect compiler is not exported publicly, and D1 speaks the
  same SQL.
- `driver.ts` implements `DatabaseDriver<'sqlite'>`. It compiles each
  operation, binds values (booleans as 0/1, Dates as epoch ms, objects as
  JSON) and runs them with `.all()` (reads, RETURNING) or `.run()`.
  Capabilities: `returning` and `upsert` yes; savepoints, transactional DDL
  and migration lock no.
- `db.transaction()`, savepoints, `executeScript()` and `wipe()` throw
  `D1UnsupportedError` with a pointer to the alternative.
- `createD1Database(d1)` returns a `Database` subclass with `.d1` (the raw
  binding) and `batch([...statements])`. `driver.prepare(operation)` gives a
  bound statement for a batch.
- `table()` definitions in `src/tables.ts` decode JSON and boolean columns in
  `afterRead`, because column types are metadata only.
- Tests (`packages/db/src/d1/database.test.ts`) run against real D1 in
  Miniflare with the real migrations applied.

## Consequences

- Multi-write atomicity uses `batch()`, not `transaction()`.
- Scoped `update`/`delete` with `orderBy`/`limit` are unavailable. data-table
  implements them with a transaction.
- Schema is owned by `wrangler d1 migrations` (see 008), not `db.migrate()`.
- When `remix` upgrades, re-vendor `sql-compiler.ts` if the dialect changes.
