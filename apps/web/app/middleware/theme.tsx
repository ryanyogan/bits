import { ThemeScope } from '@bits/ui/theme'
import { Renderer, type RenderFunction } from 'remix/middleware/render'
import { redirect } from 'remix/response/redirect'
import type { Middleware } from 'remix/router'

import { rememberTheme, requestedTheme, themeFor, withoutThemeParam } from '../progress/theme.ts'

/**
 * The theme (decision 062), after the session, auth and `render()`:
 *
 * - A GET with `?theme=system|dark|light` (the footer's links) saves the
 *   choice and answers 303 to the same URL without the parameter, so
 *   addresses stay clean and a reload doesn't save again.
 * - Every page renders inside `<ThemeScope>`, so `Document` sets
 *   `<html data-theme>` and the metas from the resolved preference.
 */
export function theme(): Middleware {
  return async (context, next) => {
    if (context.method === 'GET') {
      let requested = requestedTheme(context.url)
      if (requested) {
        await rememberTheme(context, requested)
        return redirect(withoutThemeParam(context.url), 303)
      }
    }
    let render = context.get(Renderer) as RenderFunction | undefined
    if (render) {
      let wrapped: RenderFunction = (node, init) =>
        render(<ThemeScope preference={themeFor(context)}>{node}</ThemeScope>, init)
      context.set(Renderer, wrapped, { property: 'render' })
    }
    return next()
  }
}
