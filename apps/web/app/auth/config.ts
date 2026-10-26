// Auth settings read from the Worker environment (vars in wrangler.jsonc,
// secrets via `wrangler secret put` or apps/web/.dev.vars). Outside
// production, missing secrets fall back to development values so a fresh
// clone and the test suite run without setup; production fails closed.
import { platform } from '#platform'

const env = platform.env
export const appEnv: string = env.APP_ENV ?? 'development'
export const isProduction = appEnv === 'production'

/** 30 days; renewed when a signed-in session is used (see identity.ts). */
export const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60

/** Cookie signing secrets, newest first. SESSION_SECRET may be comma-separated for rotation. */
export function sessionSecrets(): string[] {
  let secrets = (env.SESSION_SECRET ?? '')
    .split(',')
    .map((secret) => secret.trim())
    .filter(Boolean)
  if (secrets.length) return secrets
  if (isProduction) throw new Error('SESSION_SECRET is not set. Run `wrangler secret put SESSION_SECRET`.')
  return ['bits-development-session-secret']
}

// Cloudflare's published Turnstile test keys: always pass, no challenge.
const TEST_SITE_KEY = '1x00000000000000000000AA'
const TEST_SECRET_KEY = '1x0000000000000000000000000000000AA'

export interface TurnstileConfig {
  siteKey: string
  secretKey: string
  /** Hostnames siteverify must report; empty skips the check (test keys report none). */
  hostnames: string[]
}

/**
 * Turnstile for the email form. Production uses the real widget and fails
 * closed if it is not configured; development uses the test keys; the test
 * suite (APP_ENV=test) skips the check entirely.
 */
export function turnstileConfig(): TurnstileConfig | null {
  if (appEnv === 'test') return null
  if (!isProduction) {
    return {
      siteKey: env.TURNSTILE_SITE_KEY && env.TURNSTILE_SECRET_KEY ? env.TURNSTILE_SITE_KEY : TEST_SITE_KEY,
      secretKey: env.TURNSTILE_SITE_KEY && env.TURNSTILE_SECRET_KEY ? env.TURNSTILE_SECRET_KEY : TEST_SECRET_KEY,
      hostnames: [],
    }
  }
  return {
    siteKey: env.TURNSTILE_SITE_KEY ?? '',
    secretKey: env.TURNSTILE_SECRET_KEY ?? '',
    hostnames: (env.TURNSTILE_HOSTNAMES ?? '')
      .split(',')
      .map((hostname) => hostname.trim())
      .filter(Boolean),
  }
}

/** The From address for sign-in mail; must be on a domain onboarded to Email Sending. */
export function emailFrom(): { email: string; name: string } {
  return { email: env.EMAIL_FROM ?? 'signin@bits.yogan.dev', name: 'Bits' }
}

export interface OAuthCredentials {
  clientId: string
  clientSecret: string
}

/** GitHub / Google app credentials, or null when that provider is not set up. */
export function oauthCredentials(provider: 'github' | 'google'): OAuthCredentials | null {
  let clientId = provider === 'github' ? env.GITHUB_CLIENT_ID : env.GOOGLE_CLIENT_ID
  let clientSecret = provider === 'github' ? env.GITHUB_CLIENT_SECRET : env.GOOGLE_CLIENT_SECRET
  return clientId && clientSecret ? { clientId, clientSecret } : null
}
