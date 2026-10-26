// Content for the current request: the published catalog, loaded at most
// once per request (one D1 query; manifests come from the per-isolate memo
// or R2, see store.ts).
import type { RequestContext } from 'remix/router'

import { platform } from '#platform'

import { getDatabase } from '../middleware/database.ts'
import type { Catalog } from './catalog.ts'
import { loadCatalog } from './store.ts'

/** The R2 bucket that holds built course versions. */
export function contentBucket(): R2Bucket {
  return platform.env.CONTENT
}

const requestCatalogs = new WeakMap<object, Promise<Catalog>>()

/** The published catalog for this request. */
export function getCatalog(context: RequestContext<any, any>): Promise<Catalog> {
  let catalog = requestCatalogs.get(context)
  if (!catalog) {
    catalog = loadCatalog(getDatabase(context), contentBucket())
    requestCatalogs.set(context, catalog)
  }
  return catalog
}
