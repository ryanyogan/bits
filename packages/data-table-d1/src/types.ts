// The D1 binding, typed by shape.
//
// These interfaces describe only what the driver calls, so any D1 binding
// fits them: the global `D1Database` that `wrangler types` writes into
// `worker-configuration.d.ts`, the one in `@cloudflare/workers-types`,
// Miniflare's `getD1Database()`, or a `D1DatabaseSession` from
// `env.DB.withSession()`. The package never imports Cloudflare's types.

/** The `meta` block of a D1 result. Only `changes` and `last_row_id` are read. */
export interface D1MetaLike {
  changes: number
  last_row_id: number
  [key: string]: unknown
}

/** A D1 result: the rows and the `meta` block. */
export interface D1ResultLike<row = Record<string, unknown>> {
  results: row[]
  meta: D1MetaLike
}

/** A prepared D1 statement. */
export interface D1PreparedStatementLike {
  bind(...values: unknown[]): D1PreparedStatementLike
  first<row = Record<string, unknown>>(): Promise<row | null>
  all<row = Record<string, unknown>>(): Promise<D1ResultLike<row>>
  run<row = Record<string, unknown>>(): Promise<D1ResultLike<row>>
}

/** A D1 binding (or a D1 session): `prepare()` and `batch()`. */
export interface D1DatabaseLike {
  prepare(query: string): D1PreparedStatementLike
  batch<row = unknown>(statements: D1PreparedStatementLike[]): Promise<D1ResultLike<row>[]>
}
