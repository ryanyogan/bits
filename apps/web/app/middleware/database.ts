import { createD1Database, type D1DataTableDatabase } from '@bits/db'
import { createContextKey, type Middleware } from 'remix/router'

export const databaseContext = createContextKey<D1DataTableDatabase>()

/**
 * Puts the app database on request context as `context.db`.
 *
 * The data-table wrapper is created once per isolate from the D1 binding; it
 * holds no connection or per-request state, so sharing it is safe.
 */
export function loadDatabase(d1: D1Database): Middleware<{
  key: typeof databaseContext
  value: D1DataTableDatabase
  property: 'db'
}> {
  let db = createD1Database(d1)
  return (context, next) => {
    context.set(databaseContext, db, { property: 'db' })
    return next()
  }
}
