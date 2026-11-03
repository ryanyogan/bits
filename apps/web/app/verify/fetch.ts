// The one call bits makes to a learner's Worker (decision 072). A GET with
// a fixed User-Agent and no cookies, credentials or forwarded headers; no
// redirects followed; 5 s for the whole exchange, body included; at most
// 64 KiB of body read, then the stream is cancelled.

export const VERIFY_TIMEOUT_MS = 5000
export const VERIFY_MAX_BYTES = 64 * 1024
export const VERIFY_USER_AGENT = 'bits-verify/1 (+https://bits.yogan.dev/privacy)'

export type Fetched =
  | { kind: 'response'; status: number; body: string; ms: number }
  | { kind: 'redirect'; status: number; ms: number }
  | { kind: 'too-large'; status: number; ms: number }
  | { kind: 'timeout'; ms: number }
  | { kind: 'network'; ms: number }

export interface FetchOptions {
  timeoutMs?: number
  maxBytes?: number
  /** The fetch to use (tests pass a stub; defaults to the global one at call time). */
  fetch?: typeof fetch
}

/** Calls `url` once and reads at most `maxBytes` of its body. Never throws. */
export async function fetchLearnerWorker(url: URL, options: FetchOptions = {}): Promise<Fetched> {
  let timeoutMs = options.timeoutMs ?? VERIFY_TIMEOUT_MS
  let maxBytes = options.maxBytes ?? VERIFY_MAX_BYTES
  let started = Date.now()
  let elapsed = () => Date.now() - started
  let controller = new AbortController()
  let timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    let response = await (options.fetch ?? globalThis.fetch)(url.href, {
      method: 'GET',
      redirect: 'manual',
      headers: { 'User-Agent': VERIFY_USER_AGENT, Accept: 'application/json, text/plain;q=0.9, */*;q=0.5' },
      signal: controller.signal,
    })
    let status = response.status
    if ((status >= 300 && status < 400) || response.type === 'opaqueredirect') {
      await response.body?.cancel().catch(() => {})
      return { kind: 'redirect', status, ms: elapsed() }
    }
    let declared = Number(response.headers.get('Content-Length'))
    if (Number.isFinite(declared) && declared > maxBytes) {
      await response.body?.cancel().catch(() => {})
      return { kind: 'too-large', status, ms: elapsed() }
    }
    let bytes = new Uint8Array(0)
    if (response.body) {
      let reader = response.body.getReader()
      for (;;) {
        let { done, value } = await reader.read()
        if (done || !value) break
        if (bytes.length + value.length > maxBytes) {
          await reader.cancel().catch(() => {})
          return { kind: 'too-large', status, ms: elapsed() }
        }
        let next = new Uint8Array(bytes.length + value.length)
        next.set(bytes)
        next.set(value, bytes.length)
        bytes = next
      }
    }
    return { kind: 'response', status, body: new TextDecoder().decode(bytes), ms: elapsed() }
  } catch {
    return controller.signal.aborted ? { kind: 'timeout', ms: elapsed() } : { kind: 'network', ms: elapsed() }
  } finally {
    clearTimeout(timer)
  }
}
