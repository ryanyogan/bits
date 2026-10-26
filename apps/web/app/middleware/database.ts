import type { D1DataTableDatabase } from '@bits/db'
import { createContextKey, type Middleware } from 'remix/router'

export const databaseContext = createContextKey<D1DataTableDatabase>()

/**
 * Puts the app database on request context as `context.db`.
 *
 * The router creates the data-table wrapper once per isolate from the D1
 * binding; it holds no connection or per-request state, so sharing it is safe.
 */
export function loadDatabase(db: D1DataTableDatabase): Middleware<{
  key: typeof databaseContext
  value: D1DataTableDatabase
  property: 'db'
}> {
  return (context, next) => {
    context.set(databaseContext, db, { property: 'db' })
    return next()
  }
}
