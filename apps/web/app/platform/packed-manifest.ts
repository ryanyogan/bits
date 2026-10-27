// The asset manifest as the Worker bundle carries it (decision 026).
//
// Every client entry lists its full preload chain and import map, so the
// same ~100 fingerprinted URLs repeat across entries: inlined as an object
// literal the manifest was ~180 KiB of the Worker's startup code. Packed, each
// distinct string appears once in `strings` and the tree refers to it by
// index, which is ~10x smaller. The manifest holds only strings, arrays and
// objects, so numbers are free to mean "string #n".
import type { AssetManifest } from './types.ts'

type Packed = number | Packed[] | { [key: string]: Packed }

export interface PackedManifest {
  strings: string[]
  tree: Packed
}

export function packManifest(manifest: AssetManifest): PackedManifest {
  let strings: string[] = []
  let index = new Map<string, number>()
  let intern = (value: string) => {
    let n = index.get(value)
    if (n === undefined) {
      n = strings.push(value) - 1
      index.set(value, n)
    }
    return n
  }
  let pack = (value: unknown): Packed => {
    if (typeof value === 'string') return intern(value)
    if (Array.isArray(value)) return value.map(pack)
    if (value && typeof value === 'object') {
      // Undefined properties are dropped, as JSON.stringify would.
      let entries = Object.entries(value).filter(([, item]) => item !== undefined)
      return Object.fromEntries(entries.map(([key, item]) => [intern(key), pack(item)]))
    }
    throw new Error(`The asset manifest can only hold strings, arrays and objects, not ${JSON.stringify(value)}`)
  }
  return { strings, tree: pack(manifest) }
}

export function unpackManifest({ strings, tree }: PackedManifest): AssetManifest {
  let unpack = (value: Packed): unknown => {
    if (typeof value === 'number') return strings[value]
    if (Array.isArray(value)) return value.map(unpack)
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [strings[Number(key)], unpack(item)]))
  }
  return unpack(tree) as AssetManifest
}
