// Per-request D1 metering (decision 026).
//
// Wraps a D1 binding so one request's queries can be counted and timed
// without AsyncLocalStorage (the Worker has no nodejs_compat): the app builds
// a metered binding per request and a fresh data-table wrapper around it.
// Both are small objects; the binding itself is shared.
//
// Time is wall time while at least one D1 call is in flight, so parallel
// queries are not double counted. `waves` counts the busy periods: how many
// sequential D1 round trips the request waited on.
import type {
  D1Database,
  D1DatabaseSession,
  D1ExecResult,
  D1PreparedStatement,
  D1Result,
  D1SessionBookmark,
  D1SessionConstraint,
} from '@cloudflare/workers-types/index.ts'

export interface D1Meter {
  /** Statements sent (a batch of 3 counts 3). */
  queries: number
  /** Binding calls: one per first/all/run/raw, one per batch. */
  calls: number
  /** Sequential round trips: periods with at least one call in flight. */
  waves: number
  /** Wall time with at least one call in flight, ms. */
  ms: number
}

export function createD1Meter(): D1Meter {
  return { queries: 0, calls: 0, waves: 0, ms: 0 }
}

/** Times calls for one meter; shared by a metered binding and its statements. */
class Clock {
  #inFlight = 0
  #busySince = 0
  readonly meter: D1Meter

  constructor(meter: D1Meter) {
    this.meter = meter
  }

  async time<T>(statements: number, call: () => Promise<T>): Promise<T> {
    this.meter.queries += statements
    this.meter.calls += 1
    if (this.#inFlight++ === 0) {
      this.#busySince = Date.now()
      this.meter.waves += 1
    }
    try {
      return await call()
    } finally {
      if (--this.#inFlight === 0) this.meter.ms += Date.now() - this.#busySince
    }
  }
}

class MeteredStatement implements D1PreparedStatement {
  readonly inner: D1PreparedStatement
  readonly #clock: Clock

  constructor(inner: D1PreparedStatement, clock: Clock) {
    this.inner = inner
    this.#clock = clock
  }

  bind(...values: unknown[]): D1PreparedStatement {
    return new MeteredStatement(this.inner.bind(...values), this.#clock)
  }

  first<T = unknown>(colName: string): Promise<T | null>
  first<T = Record<string, unknown>>(): Promise<T | null>
  first<T>(colName?: string): Promise<T | null> {
    return this.#clock.time(1, () => (colName === undefined ? this.inner.first<T>() : this.inner.first<T>(colName)))
  }

  run<T = Record<string, unknown>>(): Promise<D1Result<T>> {
    return this.#clock.time(1, () => this.inner.run<T>())
  }

  all<T = Record<string, unknown>>(): Promise<D1Result<T>> {
    return this.#clock.time(1, () => this.inner.all<T>())
  }

  raw<T = unknown[]>(options: { columnNames: true }): Promise<[string[], ...T[]]>
  raw<T = unknown[]>(options?: { columnNames?: false }): Promise<T[]>
  raw<T = unknown[]>(options?: { columnNames?: boolean }): Promise<[string[], ...T[]] | T[]> {
    let inner = this.inner
    return this.#clock.time<[string[], ...T[]] | T[]>(1, () =>
      options?.columnNames ? inner.raw<T>({ columnNames: true }) : inner.raw<T>({ columnNames: false }),
    )
  }
}

class MeteredD1 implements D1Database {
  readonly #d1: D1Database
  readonly #clock: Clock

  constructor(d1: D1Database, clock: Clock) {
    this.#d1 = d1
    this.#clock = clock
  }

  prepare(query: string): D1PreparedStatement {
    return new MeteredStatement(this.#d1.prepare(query), this.#clock)
  }

  batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]> {
    let inner = statements.map((statement) => (statement instanceof MeteredStatement ? statement.inner : statement))
    return this.#clock.time(statements.length, () => this.#d1.batch<T>(inner))
  }

  exec(query: string): Promise<D1ExecResult> {
    return this.#clock.time(1, () => this.#d1.exec(query))
  }

  /** Unmetered: a D1 session is its own consistency scope. */
  withSession(constraintOrBookmark?: D1SessionBookmark | D1SessionConstraint): D1DatabaseSession {
    return this.#d1.withSession(constraintOrBookmark)
  }

  dump(): Promise<ArrayBuffer> {
    return this.#d1.dump()
  }
}

/** A D1 binding that records every call it makes on `meter`. */
export function meterD1(d1: D1Database, meter: D1Meter): D1Database {
  return new MeteredD1(d1, new Clock(meter))
}
