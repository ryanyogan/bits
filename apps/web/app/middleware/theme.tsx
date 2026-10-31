import { ThemeScope } from '@bits/ui/theme'
import { Renderer, type RenderFunction } from 'remix/middleware/render'
import type { Middleware } from 'remix/router'

import { themeFor } from '../progress/theme.ts'

/**
 * The theme (decision 062), after the session, auth and `render()`: every
 * page renders inside `<ThemeScope>`, so `Document` sets `<html data-theme>`
 * and the metas from the resolved preference. Saving one is `POST /theme`
 * and `POST /settings/appearance`, never a GET.
 */
export function theme(): Middleware {
  return (context, next) => {
    let render = context.get(Renderer) as RenderFunction | undefined
    if (render) {
      let wrapped: RenderFunction = (node, init) =>
        render(<ThemeScope preference={themeFor(context)}>{node}</ThemeScope>, init)
      context.set(Renderer, wrapped, { property: 'render' })
    }
    return next()
  }
}
