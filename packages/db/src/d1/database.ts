// bits' database: the `data-table-d1` driver (packages/data-table-d1, published
// on npm), bound to the Workers D1 types so `db.d1` and `db.batch()` keep the
// full `D1Database` / `D1Result` types. The driver decodes `boolean()` and
// `json()` columns itself; the afterRead hooks in tables.ts still run, and
// leave already-decoded values alone.
import { D1DataTableDatabase as DriverDatabase } from 'data-table-d1'
import type { DatabaseOptions } from 'remix/data-table'

import type { D1Database, D1PreparedStatement, D1Result } from './types.ts'

/** A remix/data-table `Database` on a D1 binding, plus `batch()` for atomic writes. */
export class D1DataTableDatabase extends DriverDatabase<D1Database> {
  /**
   * Runs raw statements atomically in one D1 batch. Build them with
   * `db.d1.prepare(sql).bind(...)`. The batch commits or rolls back as a unit.
   */
  override batch<row = Record<string, unknown>>(statements: D1PreparedStatement[]): Promise<D1Result<row>[]> {
    return this.d1.batch<row>(statements)
  }
}

/**
 * Creates the app database for one D1 binding. Timestamps are stored as
 * integer Unix epoch milliseconds, so `now` defaults to `Date.now()`.
 */
export function createD1Database(d1: D1Database, options?: DatabaseOptions): D1DataTableDatabase {
  return new D1DataTableDatabase(d1, options)
}
