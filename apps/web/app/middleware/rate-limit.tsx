import type { Middleware, RequestContext } from 'remix/router'

import { platform } from '#platform'

import { currentUser, getViewer } from '../auth/identity.ts'
import type { AppContext } from '../router.ts'
import { TooManyRequestsPage } from '../ui/not-found-page.tsx'

/**
 * Burst limits on write endpoints, one Workers Rate Limiting binding per tier
 * (wrangler.jsonc `ratelimits`, decision 020). They stop scripts filling D1
 * or spending the email and model quotas in seconds; the exact, durable
 * limits (emails per address, runs per hour) stay in D1.
 */
export type RateLimitTier =
  /** Saving a lesson ("complete lesson"): 20 a minute. */
  | 'RL_WRITES'
  /** Sign-in email and code: 10 a minute. */
  | 'RL_SIGNIN'
  /** Prompt runs (/api/run): 15 a minute. */
  | 'RL_RUNS'
  /** Background draft and watch-position saves (/api/drafts): 60 a minute. */
  | 'RL_DRAFTS'

/**
 * Keyed by the signed-in user, else by the client IP. The binding is
 * per-location and approximate, which is fine for bursts. Without the
 * binding (tests) nothing is limited.
 */
export async function overRateLimit(context: RequestContext<any, any>, tier: RateLimitTier): Promise<boolean> {
  let limiter = (platform.env as Partial<Record<RateLimitTier, RateLimit>>)[tier]
  if (!limiter) return false
  let user = currentUser(context)
  let key = user ? `user:${user.id}` : `ip:${context.headers.get('CF-Connecting-IP') ?? 'local'}`
  let { success } = await limiter.limit({ key })
  return !success
}

/**
 * Action middleware: answers 429 when the tier's limit is hit. The default
 * answer is an HTML page (a 4xx, so client navigation renders it); pass
 * `respond` for JSON endpoints.
 */
export function rateLimit(tier: RateLimitTier, respond?: (context: RequestContext<any, any>) => Response): Middleware {
  return async (context, next) => {
    if (!(await overRateLimit(context, tier))) return next()
    if (respond) return respond(context)
    return (context as unknown as AppContext).render(<TooManyRequestsPage viewer={getViewer(context)} />, {
      status: 429,
      headers: { 'Retry-After': '60' },
    })
  }
}
