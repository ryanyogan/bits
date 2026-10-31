// The learner's theme (decision 062): `system` (follow the device), `dark`
// or `light`. Modelled on the lesson depth (depth.ts): signed in, it is
// `users.theme` (null = system); signed out, the session's `theme` key. The
// server resolves it for every page, and `Document` sets `<html data-theme>`
// from it, so no client script ever picks the theme.
import { saveTheme } from '@bits/db'
import type { ThemePreference } from '@bits/ui/theme'
import type { RequestContext } from 'remix/router'
import { Session } from 'remix/session'

import { currentUser } from '../auth/identity.ts'
import { getDatabase } from '../middleware/database.ts'

type AnyContext = RequestContext<any, any>

/** Session key: the theme a signed-out learner pinned. */
const THEME_KEY = 'theme'

/**
 * The theme to render with: the signed-in user's column, then the
 * session's, then `system`. A signed-in user who never picked one (null)
 * keeps whatever they picked while signed out.
 */
export function themeFor(context: AnyContext): ThemePreference {
  let saved = currentUser(context)?.theme
  if (saved === 'dark' || saved === 'light') return saved
  let stored = (context.get(Session) as Session | undefined)?.get(THEME_KEY)
  return stored === 'dark' || stored === 'light' ? stored : 'system'
}

/**
 * Saves a choice: one UPDATE for a signed-in user (only when it changes),
 * else the session. Signed in, the session's copy is dropped as well, so
 * picking `system` there can't fall back to an old signed-out pick.
 */
export async function rememberTheme(context: AnyContext, preference: ThemePreference): Promise<void> {
  let session = context.get(Session) as Session | undefined
  let user = currentUser(context)
  let pinned = preference === 'system' ? null : preference
  if (user) {
    if ((user.theme ?? null) !== pinned) {
      await saveTheme(getDatabase(context), user.id, pinned)
      user.theme = pinned
    }
    if (session?.has(THEME_KEY)) session.unset(THEME_KEY)
    return
  }
  if (!session) return
  if (pinned === null) {
    if (session.has(THEME_KEY)) session.unset(THEME_KEY)
  } else if (session.get(THEME_KEY) !== pinned) {
    session.set(THEME_KEY, pinned)
  }
}
