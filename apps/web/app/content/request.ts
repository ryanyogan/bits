// Content for the current request: the published catalog, resolved at most
// once per request. It usually comes from the isolate's stale-while-
// revalidate memo with no D1 query at all (store.ts, decision 026);
// manifests come from the per-isolate memo or R2.
import type { RequestContext } from 'remix/router'

import { platform } from '#platform'

import { getDatabase } from '../middleware/database.ts'
import type { Catalog } from './catalog.ts'
import { liveCatalog } from './store.ts'

/** The R2 bucket that holds built course versions. */
export function contentBucket(): R2Bucket {
  return platform.env.CONTENT
}

const requestCatalogs = new WeakMap<object, Promise<Catalog>>()

/** The published catalog for this request. */
export function getCatalog(context: RequestContext<any, any>): Promise<Catalog> {
  let catalog = requestCatalogs.get(context)
  if (!catalog) {
    catalog = liveCatalog(getDatabase(context), contentBucket(), platform.waitUntil)
    requestCatalogs.set(context, catalog)
  }
  return catalog
}
