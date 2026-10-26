import type { Handle, MixInput, RemixNode } from 'remix/component'
import { css } from 'remix/component'

export interface KbdProps {
  /** Hide from assistive tech when the shortcut is also described in text. */
  decorative?: boolean
  mix?: MixInput<HTMLElement>
  children?: RemixNode
}

/** Keyboard hint, e.g. ⌘ K (components §5.5). Static. */
export function Kbd(handle: Handle<KbdProps>) {
  return () => {
    let { decorative = true, mix, children } = handle.props
    return (
      <kbd aria-hidden={decorative ? 'true' : undefined} mix={[kbdStyle, mix]}>
        {children}
      </kbd>
    )
  }
}

export const kbdStyle = css({
  display: 'inline-block',
  padding: 'var(--space-1) var(--space-2)',
  borderRadius: 'var(--radius-xs)',
  border: '1px solid var(--line-control)',
  boxShadow: 'var(--shadow-kbd)',
  fontFamily: 'var(--font-mono)',
  fontSize: 'var(--fs-12)',
  lineHeight: 'normal',
  color: 'var(--muted)',
  whiteSpace: 'nowrap',
})
