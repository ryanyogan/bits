// Per-request content metering (decision 026).
//
// Like the D1 meter (packages/db/src/d1/meter.ts): the module-level memos in
// store.ts stay free of request state, and a request that wants its content
// cost measured passes one of these down. It becomes `Server-Timing:
// catalog` (how the live catalog was resolved, and how long the request
// waited for it) and `r2` (content reads that missed the per-isolate memo).
// R2 time is wall time while at least one read is in flight, so parallel
// manifest reads are not double counted.

/** How a request got the live catalog: fresh memo, stale memo (refresh in the background), or a load it waited for. */
export type CatalogSource = 'memo' | 'stale' | 'cold'

export class ContentMeter {
  catalog: CatalogSource | undefined
  /** Time the request waited for the catalog, ms. */
  catalogMs = 0
  /** R2 reads made for this request (memo misses). */
  reads = 0
  /** Wall time with at least one R2 read in flight, ms. */
  ms = 0
  #inFlight = 0
  #busySince = 0

  async timeRead<T>(read: () => Promise<T>): Promise<T> {
    this.reads += 1
    if (this.#inFlight++ === 0) this.#busySince = Date.now()
    try {
      return await read()
    } finally {
      if (--this.#inFlight === 0) this.ms += Date.now() - this.#busySince
    }
  }

  /** `catalog;dur=0;desc="memo"` and `r2;dur=31;desc="2 reads"`, when there is something to say. */
  serverTiming(): string[] {
    let entries: string[] = []
    if (this.catalog) entries.push(`catalog;dur=${this.catalogMs};desc="${this.catalog}"`)
    if (this.reads > 0) entries.push(`r2;dur=${this.ms};desc="${this.reads} reads"`)
    return entries
  }
}
