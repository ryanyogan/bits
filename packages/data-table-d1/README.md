# data-table-d1

A [Cloudflare D1](https://developers.cloudflare.com/d1/) driver for
[`remix/data-table`](https://github.com/remix-run/remix/tree/main/packages/data-table).

`remix/data-table` ships drivers for SQLite, Postgres and MySQL, but not for
D1. This package fills that gap. It's the driver [bits](https://bits.yogan.dev)
runs in production.

- **Typed columns come back typed.** A `boolean()` column reads back as
  `true`/`false` and a `json()` column comes back parsed, from selects and from
  `RETURNING` rows.
- **Atomic writes with `db.batch()`**, which is D1's replacement for
  transactions.
- **No silent non-atomic transactions.** `db.transaction()` throws a
  `D1UnsupportedError`, and so do writes scoped with `orderBy`/`limit`, which
  need one.
- **Accepts any D1 binding.** The binding is typed by shape, so the
  `D1Database` from `wrangler types`, `@cloudflare/workers-types`, Miniflare's
  `getD1Database()` and `env.DB.withSession()` all fit.
- **Small, with no runtime dependencies.** `remix` is the only peer, and the
  package doesn't need `nodejs_compat`.

## Install

```sh
pnpm add data-table-d1 remix
```

The package needs `remix` 3.1 or later (`remix/data-table` 1.x).

## Use

```ts
import { createD1Database } from 'data-table-d1'
import { column as c, table } from 'remix/data-table'

const notes = table({
  name: 'notes',
  columns: {
    id: c.integer().primaryKey(),
    body: c.text(),
    pinned: c.boolean(),
    tags: c.json(),
    created_at: c.integer(),
  },
})

export default {
  async fetch(request, env: Env) {
    let db = createD1Database(env.DB)

    await db.create(notes, { body: 'Hello', pinned: true, tags: ['first'], created_at: Date.now() })
    let pinned = await db.findMany(notes, { where: { pinned: true }, orderBy: ['created_at', 'desc'] })
    // pinned[0].pinned === true, pinned[0].tags is ['first']

    return Response.json(pinned)
  },
} satisfies ExportedHandler<Env>
```

`createD1Database(binding, options?)` returns a `D1DataTableDatabase`. That's
a `remix/data-table` `Database`, so `find`, `findMany`, `create`, `update`,
`query()`, joins and `db.exec(sql\`…\`)` all work as the data-table docs
describe. `now` defaults to `Date.now()`, so timestamps are stored as integer
milliseconds.

### Schema

D1's schema belongs to `wrangler d1 migrations`, not to data-table's `db.migrate()`. Write
plain SQL migrations and apply them with wrangler:

```sh
wrangler d1 migrations create DB create_notes
wrangler d1 migrations apply DB --local   # then --remote
```

Store a `boolean()` column as `integer` and a `json()` column as `text`.

### Atomic writes: `db.batch()`

D1 can't hold a transaction open across `await`s in a Worker. A batch runs
several statements in one round trip, and they all commit or all roll back:

```ts
await db.batch([
  db.d1.prepare('update accounts set balance = balance - ? where id = ?').bind(10, from),
  db.d1.prepare('update accounts set balance = balance + ? where id = ?').bind(10, to),
])
```

`db.d1` is the binding you passed in, with its own type. `db.batch()` results
are typed by shape (`results` and `meta`). Call `db.d1.batch()` instead if you
need the binding's own result type.

### What it refuses

Each of these throws a `D1UnsupportedError` that says what to do instead:

- `db.transaction()`. Use `db.batch()`.
- `updateMany` / `deleteMany` with `orderBy` or `limit`. data-table needs a
  transaction for those.
- `db.executeScript()` and `db.wipe()`. Use wrangler's migrations.

### How values are stored

| Column | Written as | Read back as |
|---|---|---|
| `boolean()` | `1` / `0` | `true` / `false` |
| `json()` | `JSON.stringify(value)` (strings and numbers too) | `JSON.parse(text)` |
| `Date` values | epoch milliseconds | a number |
| `bigint` values | a number | a number |

Decoding is idempotent. A value that's already a boolean or an object is left
alone. Text in a `json()` column that isn't valid JSON (say, written by raw
SQL) comes back as the text. An `afterRead` hook that decodes the same columns
keeps working.

Raw queries (`db.exec(sql\`…\`)`, `db.d1.prepare()`) return D1's values as
they are, because the driver doesn't know their column types.

## Testing

Run your tests against a real D1 on [Miniflare](https://www.npmjs.com/package/miniflare),
which uses the same engine as `wrangler dev`:

```ts
import { convertV4MiniflareOptions, Miniflare } from 'miniflare'

let mf = new Miniflare(convertV4MiniflareOptions({
  modules: true,
  script: 'export default { fetch() { return new Response(null) } }',
  d1Databases: { DB: 'test-db' },
}))
let db = createD1Database(await mf.getD1Database('DB'))
```

This package's own suite (`src/database.test.ts`) runs that way.

## Credits

`src/sql-compiler.ts` is copied unchanged, apart from its import paths, from
`@remix-run/data-table-sqlite@1.0.0`, which is © 2025 Shopify Inc. and under
the MIT license. Both notices are in `LICENSE`.

## License

MIT
