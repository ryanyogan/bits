import type { Handle, RemixNode } from 'remix/component'

export interface CspNonceProps {
  /** This response's Content-Security-Policy nonce (base64). */
  nonce: string
  children?: RemixNode
}

/**
 * Provides the response's CSP nonce to the server-rendered tree (decision
 * 027). The app wraps every rendered page in it; `Document` reads it with
 * `cspNonce(handle)` and puts it on the import map and the entry script.
 * Islands never need it: modules they import inherit the trust of the
 * nonced entry (`'strict-dynamic'`).
 */
export function CspNonce(handle: Handle<CspNonceProps, { nonce: string }>) {
  return () => {
    handle.context.set({ nonce: handle.props.nonce })
    return handle.props.children
  }
}

/** The nonce from the nearest `CspNonce`, or undefined outside one (tests, the styleguide's bare renders). */
export function cspNonce(handle: Handle<any, any>): string | undefined {
  let value = handle.context.get(CspNonce) as { nonce: string } | undefined
  return value?.nonce
}
