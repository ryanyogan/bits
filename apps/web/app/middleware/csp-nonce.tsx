import { CspNonce } from '@bits/ui/csp-nonce'
import { Renderer, type RenderFunction } from 'remix/middleware/render'
import { createContextKey, type Middleware } from 'remix/router'

/** This request's CSP nonce, made by `responseHeaders()` (decision 027). */
export const cspNonceContext = createContextKey<string>()

/** 128 random bits, base64: a fresh nonce for every response. */
export function createNonce(): string {
  let bytes = crypto.getRandomValues(new Uint8Array(16))
  return btoa(String.fromCharCode(...bytes))
}

/**
 * Wraps `context.render` so every page renders inside `<CspNonce>`, where
 * `Document` finds the nonce for its scripts. Goes right after `render()`;
 * `responseHeaders()` (outermost) made the nonce and sends the policy.
 */
export function cspNonce(): Middleware {
  return (context, next) => {
    let nonce = context.get(cspNonceContext)
    let render = context.get(Renderer) as RenderFunction | undefined
    if (nonce && render) {
      let wrapped: RenderFunction = (node, init) => render(<CspNonce nonce={nonce}>{node}</CspNonce>, init)
      context.set(Renderer, wrapped, { property: 'render' })
    }
    return next()
  }
}
