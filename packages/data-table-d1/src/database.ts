import { Database, type DatabaseOptions } from 'remix/data-table'

import { D1DatabaseDriver } from './driver.ts'
import type { D1DatabaseLike, D1ResultLike } from './types.ts'

/**
 * A remix/data-table `Database` backed by a D1 binding, plus `batch()` for
 * atomic multi-statement writes (D1's substitute for transactions).
 *
 * The class is generic over the binding, so `db.d1` keeps the binding's own
 * type: pass `env.DB` (typed by `wrangler types`) and `db.d1.prepare()`
 * returns the full `D1PreparedStatement`. `batch()` results are typed by
 * shape (`results` and `meta`); call `db.d1.batch()` for the binding's own
 * result type, or subclass and narrow `batch()`.
 */
export class D1DataTableDatabase<binding extends D1DatabaseLike = D1DatabaseLike> extends Database {
  /** The D1 binding, for raw statements: `db.d1.prepare(sql).bind(...)`. */
  readonly d1: binding

  constructor(d1: binding, options?: DatabaseOptions) {
    super(new D1DatabaseDriver(d1), { now: () => Date.now(), ...options })
    this.d1 = d1
  }

  /**
   * Runs raw statements atomically in one D1 batch. Build them with
   * `db.d1.prepare(sql).bind(...)`. The batch commits or rolls back as a unit.
   */
  batch<row = Record<string, unknown>>(
    statements: Parameters<binding['batch']>[0],
  ): Promise<D1ResultLike<row>[]> {
    return this.d1.batch<row>(statements)
  }
}

/**
 * Creates a data-table `Database` for one D1 binding. Timestamps are stored
 * as integer Unix epoch milliseconds, so `now` defaults to `Date.now()`.
 */
export function createD1Database<binding extends D1DatabaseLike>(
  d1: binding,
  options?: DatabaseOptions,
): D1DataTableDatabase<binding> {
  return new D1DataTableDatabase(d1, options)
}
