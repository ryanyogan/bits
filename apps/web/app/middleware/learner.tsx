import { Renderer, type RenderFunction } from 'remix/middleware/render'
import type { Middleware } from 'remix/router'
import { Session } from 'remix/session'

import { currentUser } from '../auth/identity.ts'
import { PROGRESS_KEY } from '../progress/progress.ts'
import { LearnerScope } from '../ui/learner-scope.tsx'

/**
 * Whether this signed-out visitor has completed a lesson, read from the
 * session already loaded (no D1). Signed in, the header always offers
 * Continue, so it isn't needed.
 */
export function hasSessionProgress(context: Parameters<Middleware>[0]): boolean {
  if (currentUser(context)) return false
  let value = (context.get(Session) as Session | undefined)?.get(PROGRESS_KEY)
  return value != null && typeof value === 'object' && Object.keys(value).length > 0
}

/**
 * After the session, auth and `render()`: every page renders inside
 * `<LearnerScope>`, so the header shows one primary action (decision 070).
 */
export function learner(): Middleware {
  return (context, next) => {
    let render = context.get(Renderer) as RenderFunction | undefined
    if (render) {
      let wrapped: RenderFunction = (node, init) =>
        render(<LearnerScope hasProgress={hasSessionProgress(context)}>{node}</LearnerScope>, init)
      context.set(Renderer, wrapped, { property: 'render' })
    }
    return next()
  }
}
