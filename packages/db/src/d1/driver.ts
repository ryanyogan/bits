// A remix/data-table driver for Cloudflare D1.
//
// D1 is SQLite behind an async binding, so this driver compiles operations
// with the SQLite dialect and executes them through `D1Database.prepare()`.
// Two D1 constraints shape it (see docs/decisions/003-data-table-on-d1.md):
//
// - No interactive transactions. A Worker cannot hold BEGIN/COMMIT across
//   awaits, so `db.transaction()` and scoped writes (update/delete with
//   orderBy/limit) throw. Use `batch()` from this package for atomic writes.
// - Migrations are owned by `wrangler d1 migrations`, not `db.migrate()`.
import type {
  DatabaseCapabilities,
  DatabaseDriver,
  DataManipulationOperation,
  DataManipulationRequest,
  DataManipulationResult,
  TableRef,
  TransactionToken,
} from 'remix/data-table'
import { getTablePrimaryKey } from 'remix/data-table'

import { compileSqliteOperation } from './sql-compiler.ts'
import type { D1Database, D1PreparedStatement } from './types.ts'

const d1Capabilities: DatabaseCapabilities = Object.freeze({
  returning: true,
  savepoints: false,
  upsert: true,
  transactionalDdl: false,
  migrationLock: false,
})

export class D1UnsupportedError extends Error {
  constructor(feature: string, hint: string) {
    super(`D1 does not support ${feature}. ${hint}`)
    this.name = 'D1UnsupportedError'
  }
}

export class D1DatabaseDriver implements DatabaseDriver<'sqlite'> {
  readonly dialect = 'sqlite' as const
  readonly capabilities = d1Capabilities
  readonly #d1: D1Database

  constructor(d1: D1Database) {
    this.#d1 = d1
  }

  /** Compiles an operation to a bound D1 statement without running it. */
  prepare(operation: DataManipulationOperation): D1PreparedStatement {
    let { text, values } = compileSqliteOperation(operation)
    return this.#d1.prepare(text).bind(...values.map(toD1Value))
  }

  async execute(request: DataManipulationRequest): Promise<DataManipulationResult> {
    if (request.transaction) throw transactionsUnsupported()
    let { operation } = request

    if (operation.kind === 'insertMany' && operation.values.length === 0) {
      return { affectedRows: 0, insertId: undefined, rows: operation.returning ? [] : undefined }
    }

    let statement = this.prepare(operation)

    if (readsRows(operation)) {
      let result = await statement.all<Record<string, unknown>>()
      let rows = result.results.map((row) => ({ ...row }))
      if (operation.kind === 'count' || operation.kind === 'exists') {
        rows = rows.map((row) => ({ ...row, count: Number(row.count) }))
      }
      return {
        rows,
        affectedRows: isWrite(operation) ? rows.length : result.meta.changes || undefined,
        insertId: insertIdFromRows(operation, rows),
      }
    }

    let result = await statement.run()
    return {
      affectedRows: result.meta.changes,
      insertId: hasSinglePrimaryKeyInsert(operation) ? result.meta.last_row_id : undefined,
    }
  }

  async executeScript(): Promise<void> {
    // D1's exec() splits on newlines, which breaks ordinary multi-line SQL, and
    // schema changes belong to wrangler's migration journal anyway.
    throw new D1UnsupportedError(
      'multi-statement scripts from the driver',
      'Apply schema with `wrangler d1 migrations apply`; use batch() for atomic writes.',
    )
  }

  async hasTable(table: TableRef): Promise<boolean> {
    let row = await this.#d1
      .prepare("select 1 as found from sqlite_master where type = 'table' and name = ? limit 1")
      .bind(table.name)
      .first()
    return row != null
  }

  async hasColumn(table: TableRef, column: string): Promise<boolean> {
    let { results } = await this.#d1
      .prepare(`pragma table_info(${quoteIdentifier(table.name)})`)
      .all<{ name: string }>()
    return results.some((row) => row.name === column)
  }

  async beginTransaction(): Promise<TransactionToken> {
    throw transactionsUnsupported()
  }

  async commitTransaction(): Promise<void> {
    throw transactionsUnsupported()
  }

  async rollbackTransaction(): Promise<void> {
    throw transactionsUnsupported()
  }

  async createSavepoint(): Promise<void> {
    throw transactionsUnsupported()
  }

  async rollbackToSavepoint(): Promise<void> {
    throw transactionsUnsupported()
  }

  async releaseSavepoint(): Promise<void> {
    throw transactionsUnsupported()
  }

  async wipe(): Promise<void> {
    throw new D1UnsupportedError(
      'wipe() from a Worker',
      'Recreate the database with wrangler (`wrangler d1 delete` / `create`) and re-apply migrations.',
    )
  }

  close(): void {
    // The D1 binding is owned by the Workers runtime.
  }
}

function transactionsUnsupported() {
  return new D1UnsupportedError(
    'interactive transactions (db.transaction(), or update/delete with orderBy/limit)',
    'Use batch() from @bits/db to run several writes atomically.',
  )
}

/** D1 binds null, number, string, ArrayBuffer and typed arrays. Normalize everything else. */
export function toD1Value(value: unknown): unknown {
  if (value === undefined) return null
  if (typeof value === 'boolean') return value ? 1 : 0
  if (typeof value === 'bigint') return Number(value)
  if (value instanceof Date) return value.getTime()
  if (value instanceof ArrayBuffer || ArrayBuffer.isView(value)) return value
  if (typeof value === 'object' && value !== null) return JSON.stringify(value)
  return value
}

function readsRows(operation: DataManipulationOperation): boolean {
  switch (operation.kind) {
    case 'select':
    case 'count':
    case 'exists':
    case 'raw':
      return true
    default:
      return operation.returning !== undefined
  }
}

function isWrite(operation: DataManipulationOperation): boolean {
  return (
    operation.kind === 'insert' ||
    operation.kind === 'insertMany' ||
    operation.kind === 'update' ||
    operation.kind === 'delete' ||
    operation.kind === 'upsert'
  )
}

function hasSinglePrimaryKeyInsert(operation: DataManipulationOperation): boolean {
  if (operation.kind !== 'insert' && operation.kind !== 'insertMany' && operation.kind !== 'upsert') {
    return false
  }
  return getTablePrimaryKey(operation.table).length === 1
}

function insertIdFromRows(
  operation: DataManipulationOperation,
  rows: Record<string, unknown>[],
): unknown {
  if (!hasSinglePrimaryKeyInsert(operation)) return undefined
  if (operation.kind !== 'insert' && operation.kind !== 'insertMany' && operation.kind !== 'upsert') {
    return undefined
  }
  let key = getTablePrimaryKey(operation.table)[0]!
  return rows.at(-1)?.[key]
}

function quoteIdentifier(value: string): string {
  return '"' + value.replace(/"/g, '""') + '"'
}
