// One public address, so sessions, passkeys and magic links don't split
// across hosts. worker.ts calls this before the router.
//
// - A host in LEGACY_HOSTS always 301s to CANONICAL_ORIGIN.
// - In production, so does every other workers.dev host. `preview_urls` is
//   on for Workers Previews (decision 032), which also gives every
//   production version a Version URL on workers.dev; this keeps those from
//   serving production as a second host. (Only workers.dev: `pnpm preview`
//   on localhost without a .dev.vars runs with the production vars.)
//   Previews run with APP_ENV=preview and no CANONICAL_ORIGIN, so they
//   answer on their own host.

export interface CanonicalHostEnv {
  APP_ENV?: string
  CANONICAL_ORIGIN?: string
  LEGACY_HOSTS?: string
}

/** The redirect target for a request on the wrong host, or null to serve it. */
export function canonicalRedirect(url: URL, env: CanonicalHostEnv): string | null {
  let canonical = env.CANONICAL_ORIGIN
  if (!canonical) return null
  let target = new URL(canonical)
  if (url.host === target.host) return null
  let legacy = (env.LEGACY_HOSTS ?? '')
    .split(',')
    .map((host) => host.trim())
    .filter(Boolean)
  let versionHost = env.APP_ENV === 'production' && url.hostname.endsWith('.workers.dev')
  if (!legacy.includes(url.host) && !versionHost) return null
  // Assign the path rather than resolving it: `//evil.example` would
  // otherwise resolve as a protocol-relative URL and leave the site.
  target.pathname = url.pathname
  target.search = url.search
  return target.href
}
