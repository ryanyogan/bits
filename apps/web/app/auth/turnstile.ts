// Server-side Turnstile siteverify, in the canonical shape from the
// turnstile-spin skill: require success, the expected action and an approved
// hostname, and fail closed on any error.
import { isProduction, turnstileConfig } from './config.ts'

/** The hidden field the Turnstile widget adds to its form. */
export const TURNSTILE_FIELD = 'cf-turnstile-response'

interface SiteverifyResult {
  success: boolean
  action?: string
  hostname?: string
  'error-codes'?: string[]
}

/**
 * True when the request carries a valid Turnstile token for `action`. Always
 * true when Turnstile is off (the test suite); false when production is
 * missing its keys.
 */
export async function verifyTurnstile(
  token: unknown,
  input: { action: string; remoteIp: string | null },
): Promise<boolean> {
  let config = turnstileConfig()
  if (!config) return true
  if (!config.siteKey || !config.secretKey) return false
  if (typeof token !== 'string' || token.length === 0 || token.length > 2048) return false

  let result: SiteverifyResult
  try {
    let body = new URLSearchParams({ secret: config.secretKey, response: token })
    if (input.remoteIp) body.set('remoteip', input.remoteIp)
    let response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
      signal: AbortSignal.timeout(10_000),
    })
    if (!response.ok) throw new Error(`siteverify ${response.status}`)
    result = (await response.json()) as SiteverifyResult
  } catch (error) {
    console.error(JSON.stringify({ level: 'error', message: 'Turnstile siteverify failed', error: String(error) }))
    return false
  }

  if (!result.success) return false
  // Development uses Cloudflare's test keys, which report no action or
  // hostname. Production must name its hostnames (TURNSTILE_HOSTNAMES).
  if (config.hostnames.length === 0) return !isProduction
  return result.action === input.action && config.hostnames.includes(result.hostname ?? '')
}

/** The public site key for the widget, or null when Turnstile is off. */
export function turnstileSiteKey(): string | null {
  return turnstileConfig()?.siteKey || null
}
