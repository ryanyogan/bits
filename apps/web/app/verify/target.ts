// Which URL bits will call for a `:::verify` block (decision 072). Pure: the
// endpoint, the tests and the threat model share it.
//
// The learner gives an origin; the block gives the path. Only
// `https://<label>[.<label>[.<label>]].workers.dev` is accepted: Cloudflare
// owns that zone's DNS, so a learner can't point a name in it at a private
// address (no SSRF into a network, no DNS rebinding). No other host, no port,
// no credentials in the URL. The final URL is re-parsed and must still be on
// that origin, so an authored path can never name another host.
import { isVerifyPath } from './path.ts'

/** The longest URL a learner may paste. */
export const MAX_LEARNER_URL = 300

/** One to three DNS labels, then `workers.dev`. */
const WORKERS_DEV_HOST = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.){1,3}workers\.dev$/

export type OriginResult = { ok: true; origin: string } | { ok: false; message: string }

const USAGE = 'Paste the https://….workers.dev URL that wrangler deploy printed.'

/**
 * The learner's pasted URL as an origin (`https://name.account.workers.dev`),
 * or why it can't be checked. A missing scheme reads as https; a path, query
 * or fragment is dropped (the block decides the path).
 */
export function learnerOrigin(input: string): OriginResult {
  let text = input.trim()
  if (!text) return { ok: false, message: USAGE }
  if (text.length > MAX_LEARNER_URL) return { ok: false, message: `That URL is over ${MAX_LEARNER_URL} characters. ${USAGE}` }
  if (!/^[a-z][a-z0-9+.-]*:/i.test(text)) text = `https://${text}`
  let url: URL
  try {
    url = new URL(text)
  } catch {
    return { ok: false, message: `That isn’t a URL. ${USAGE}` }
  }
  if (url.protocol !== 'https:') return { ok: false, message: 'Use the https:// address: bits only calls Workers over https.' }
  if (url.username || url.password) return { ok: false, message: `Leave out any user name or password. ${USAGE}` }
  if (url.port) return { ok: false, message: `Leave out the port. ${USAGE}` }
  if (!WORKERS_DEV_HOST.test(url.hostname)) {
    return { ok: false, message: 'bits can check Workers on workers.dev only, like https://klippy.your-name.workers.dev.' }
  }
  return { ok: true, origin: `https://${url.hostname}` }
}

/** The URL to call: the origin plus the authored path, or undefined if they don't make one on that origin. */
export function targetUrl(origin: string, path: string): URL | undefined {
  if (!isVerifyPath(path)) return undefined
  let checked = learnerOrigin(origin)
  if (!checked.ok || checked.origin !== origin) return undefined
  let url: URL
  try {
    url = new URL(`${origin}${path}`)
  } catch {
    return undefined
  }
  return url.origin === origin && url.protocol === 'https:' && !url.username && !url.password && !url.port ? url : undefined
}
