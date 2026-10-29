// The learner's lesson depth (decision 053): `new` or `engineer`. A lesson
// URL's `?depth=` picks it and is remembered, in the session when signed
// out and in `users.lesson_depth` when signed in, so every lesson after it
// follows the choice.
import { saveLessonDepth } from '@bits/db'
import type { RequestContext } from 'remix/router'
import { Session } from 'remix/session'

import { DEFAULT_DEPTH, isLessonDepth, type LessonDepth } from '../actions/courses/lesson/content.ts'
import { currentUser } from '../auth/identity.ts'
import { getDatabase } from '../middleware/database.ts'

type AnyContext = RequestContext<any, any>

/** Session key: the depth a signed-out learner picked. */
const DEPTH_KEY = 'depth'

/** The `?depth=` on a URL, when it names a depth. */
export function requestedDepth(url: URL): LessonDepth | undefined {
  let value = url.searchParams.get('depth')
  return isLessonDepth(value) ? value : undefined
}

/**
 * The depth to render a lesson at: the URL's `?depth=`, then the signed-in
 * user's saved choice, then the session's, then `new`. A `?depth=` is
 * remembered (a preference write on GET, like a theme toggle): one UPDATE
 * for a signed-in user, else the session, and only when it changes.
 */
export async function lessonDepth(context: AnyContext): Promise<LessonDepth> {
  let user = currentUser(context)
  let session = context.get(Session) as Session | undefined
  let stored = session?.get(DEPTH_KEY)
  let sessionDepth = isLessonDepth(stored) ? stored : undefined
  let requested = requestedDepth(context.url)
  if (!requested) {
    let saved = user?.lesson_depth
    return (isLessonDepth(saved) ? saved : undefined) ?? sessionDepth ?? DEFAULT_DEPTH
  }
  if (user) {
    if (user.lesson_depth !== requested) {
      await saveLessonDepth(getDatabase(context), user.id, requested)
      user.lesson_depth = requested
    }
  } else if (session && sessionDepth !== requested) {
    session.set(DEPTH_KEY, requested)
  }
  return requested
}
