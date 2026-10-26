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
