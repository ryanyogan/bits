// Column-aware encoding and decoding for D1.
//
// D1 stores a boolean as 0/1 and has no JSON type, so a `boolean()` column
// reads back as a number and a `json()` column as text. The driver knows each
// table's column types, so it fixes both on the way in and out:
//
// - Writes: a `json()` column's value is stored as `JSON.stringify(value)`,
//   whatever its type, so strings and numbers round-trip too. Booleans become
//   1/0 (`toD1Value`).
// - Reads (select rows and RETURNING rows): a `boolean()` column's number
//   becomes `true`/`false`, and a `json()` column's text is `JSON.parse`d.
//
// Decoding is idempotent: a value that is already a boolean or an object is
// left alone, and text that isn't valid JSON comes back unchanged. So an
// app's own `afterRead` hooks that decode the same columns keep working.
import { getTableColumnDefinitions, getTableName } from 'remix/data-table'
import type { AnyTable, DataManipulationOperation } from 'remix/data-table'

type Codec = 'boolean' | 'json'
type Codecs = ReadonlyMap<string, Codec>

const noCodecs: Codecs = new Map()
const byTable = new WeakMap<AnyTable, Codecs>()

function tableCodecs(table: AnyTable): Codecs {
  let cached = byTable.get(table)
  if (cached) return cached
  let codecs = new Map<string, Codec>()
  for (let [name, definition] of Object.entries(getTableColumnDefinitions(table))) {
    if (definition.type === 'boolean' || definition.type === 'json') codecs.set(name, definition.type)
  }
  let result = codecs.size ? codecs : noCodecs
  byTable.set(table, result)
  return result
}

function encodeValues(table: AnyTable, values: Record<string, unknown>): Record<string, unknown> {
  let codecs = tableCodecs(table)
  if (codecs.size === 0) return values
  let encoded: Record<string, unknown> | undefined
  for (let [column, value] of Object.entries(values)) {
    if (codecs.get(column) !== 'json' || value == null) continue
    encoded ??= { ...values }
    encoded[column] = JSON.stringify(value)
  }
  return encoded ?? values
}

/** Returns the operation with every `json()` column value stringified. */
export function encodeOperation(operation: DataManipulationOperation): DataManipulationOperation {
  switch (operation.kind) {
    case 'insert':
      return { ...operation, values: encodeValues(operation.table, operation.values) }
    case 'insertMany':
      return { ...operation, values: operation.values.map((values) => encodeValues(operation.table, values)) }
    case 'update':
      return { ...operation, changes: encodeValues(operation.table, operation.changes) }
    case 'upsert':
      return {
        ...operation,
        values: encodeValues(operation.table, operation.values),
        update: operation.update ? encodeValues(operation.table, operation.update) : undefined,
      }
    default:
      return operation
  }
}

function splitPath(path: string): { table?: string; column: string } {
  let dot = path.lastIndexOf('.')
  return dot === -1 ? { column: path } : { table: path.slice(0, dot), column: path.slice(dot + 1) }
}

/** Which output keys of this operation's rows need decoding, and how. */
export function rowCodecs(operation: DataManipulationOperation): Codecs {
  switch (operation.kind) {
    case 'select': {
      let tables = [operation.table, ...operation.joins.map((join) => join.table)]
      if (operation.select === '*') {
        if (tables.length === 1) return tableCodecs(operation.table)
        // The base table wins a name clash, as it is the one the row is typed as.
        let merged = new Map<string, Codec>()
        for (let table of [...tables].reverse()) for (let [k, v] of tableCodecs(table)) merged.set(k, v)
        return merged
      }
      let codecs = new Map<string, Codec>()
      for (let { column, alias } of operation.select) {
        let path = splitPath(column)
        let owner = path.table
          ? tables.find((table) => getTableName(table) === path.table)
          : tables.find((table) => tableCodecs(table).has(path.column))
        let codec = owner ? tableCodecs(owner).get(path.column) : undefined
        if (codec) codecs.set(alias, codec)
      }
      return codecs
    }
    case 'insert':
    case 'insertMany':
    case 'update':
    case 'delete':
    case 'upsert': {
      if (!operation.returning) return noCodecs
      let codecs = tableCodecs(operation.table)
      if (operation.returning === '*') return codecs
      let picked = new Map<string, Codec>()
      for (let name of operation.returning) {
        let codec = codecs.get(splitPath(name).column)
        if (codec) picked.set(name, codec)
      }
      return picked
    }
    default:
      return noCodecs
  }
}

/** Returns a decoded copy of one row. Values that are already decoded are left alone. */
export function decodeRow(row: Record<string, unknown>, codecs: Codecs): Record<string, unknown> {
  let next = { ...row }
  for (let [key, codec] of codecs) {
    let value = next[key]
    if (codec === 'boolean') {
      if (typeof value === 'number' || typeof value === 'bigint') next[key] = value != 0
    } else if (typeof value === 'string') {
      try {
        next[key] = JSON.parse(value)
      } catch {
        // Not JSON (a value written before this driver, or by raw SQL): keep the text.
      }
    }
  }
  return next
}
