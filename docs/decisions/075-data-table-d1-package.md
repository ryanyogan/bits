# 075. data-table-d1: bits' D1 driver as its own MIT package

Status: Accepted (2026-11-03). Lane P of `docs/plans/build-along.md` (§2.2, §7). Amends 003.

## Context

The Klippy build-along (071) uses `remix/data-table` on D1. Remix ships no D1
driver. The S0 spike (`docs/plans/build-along/s0.md` §3) ran one 17-check suite
against bits' driver and two community packages:
- bits' driver passed;
- `@pitlane/data-table-d1` 0.3.0 binds upsert values in the wrong order;
- `@sdxc/data-table-d1` works, but a lesson shouldn't depend on a package we don't control.

## Decision

- Extract bits' driver into `packages/data-table-d1`, published to npm as
  `data-table-d1` (MIT; it also carries Shopify's notice for the vendored
  `sql-compiler.ts`). `remix ^3.1.0` is a peer dependency, and it has no runtime
  dependencies.
- The driver decodes by column type. On read, `boolean()` comes back as
  `true`/`false` and `json()` is parsed. On write, `json()` values are
  stringified. Decoding is idempotent, so existing `afterRead` hooks keep
  working, and raw SQL results are left alone.
- Bindings are typed structurally (`D1DatabaseLike`), so the package doesn't
  import Cloudflare's types. `packages/db` subclasses it, binds the
  workers-types `D1Database`, and narrows `batch()` back to `D1Result<row>[]`.
- Bits uses it as `workspace:*`. The owner publishes it with
  `pnpm publish --access public` from `packages/data-table-d1`. Use pnpm, not
  npm: only pnpm applies the `publishConfig.exports` that point at `dist/`.

## Consequences

- Klippy lessons install one small, tested package instead of copying a driver.
- A `remix` upgrade that changes the SQLite dialect means re-vendoring the
  compiler in `packages/data-table-d1`, not in `packages/db`.
- The tests run on Miniflare D1: the 17 S0 checks plus 7 for decoding and refusals.
