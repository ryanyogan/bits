import { Database, type DatabaseOptions } from 'remix/data-table'

import { D1DatabaseDriver } from './driver.ts'
import type { D1Database, D1Result } from './types.ts'

/**
 * A remix/data-table `Database` backed by a D1 binding, plus `batch()` for
 * atomic multi-statement writes (D1's substitute for transactions).
 */
export class D1DataTableDatabase extends Database {
  readonly d1: D1Database

  constructor(d1: D1Database, options?: DatabaseOptions) {
    super(new D1DatabaseDriver(d1), { now: () => Date.now(), ...options })
    this.d1 = d1
  }

  /**
   * Runs raw statements atomically in one D1 batch. Build them with
   * `db.d1.prepare(sql).bind(...)`. The batch commits or rolls back as a unit.
   */
  batch<row = Record<string, unknown>>(
    statements: Parameters<D1Database['batch']>[0],
  ): Promise<D1Result<row>[]> {
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
