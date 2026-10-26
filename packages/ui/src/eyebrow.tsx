import type { Handle, MixInput, RemixNode } from 'remix/component'
import { css } from 'remix/component'

export type EyebrowTone = 'volt' | 'ion' | 'synapse' | 'muted' | 'dim' | 'text'
export type EyebrowSize = 'md' | 'sm' | 'xs'

export interface EyebrowProps {
  tone?: EyebrowTone
  /** `md` 13px / .14em, `sm` 12px / .12em (card eyebrows), `xs` 11px / .14em (HUD). */
  size?: EyebrowSize
  /** Uppercase via CSS (default). Set false for literal caps such as "AUTHORS". */
  uppercase?: boolean
  /** Element to render; defaults to `span`. Use `p` for a standalone line. */
  as?: 'span' | 'p' | 'div'
  mix?: MixInput<HTMLElement>
  children?: RemixNode
}

/** Mono eyebrow label (components §8.1): "02 — How it works", "All courses · free". Static. */
export function Eyebrow(handle: Handle<EyebrowProps>) {
  return () => {
    let { tone = 'volt', size = 'md', uppercase = true, as = 'span', mix, children } = handle.props
    let styles = [baseStyle, sizeStyles[size], toneStyles[tone], uppercase ? upperStyle : undefined, mix]
    if (as === 'p') return <p mix={styles}>{children}</p>
    if (as === 'div') return <div mix={styles}>{children}</div>
    return <span mix={styles}>{children}</span>
  }
}

export interface MonoHeadingProps {
  /** Heading level; the look is the same. */
  level?: 2 | 3
  id?: string
  uppercase?: boolean
  mix?: MixInput<HTMLElement>
  children?: RemixNode
}

/**
 * A real heading styled as an eyebrow (components §8.2): "Color", "Syllabus",
 * "ACTIVITY · LAST 26 WEEKS". Static.
 */
export function MonoHeading(handle: Handle<MonoHeadingProps>) {
  return () => {
    let { level = 2, id, uppercase = true, mix, children } = handle.props
    let styles = [headingStyle, uppercase ? upperStyle : undefined, mix]
    return level === 3 ? (
      <h3 id={id} mix={styles}>
        {children}
      </h3>
    ) : (
      <h2 id={id} mix={styles}>
        {children}
      </h2>
    )
  }
}

const baseStyle = css({
  margin: 0,
  fontFamily: 'var(--font-mono)',
  fontWeight: 400,
  lineHeight: 'normal',
})

const sizeStyles: Record<EyebrowSize, ReturnType<typeof css>> = {
  md: css({ fontSize: 'var(--fs-13)', letterSpacing: 'var(--tracking-eyebrow)' }),
  sm: css({ fontSize: 'var(--fs-12)', letterSpacing: 'var(--tracking-eyebrow-s)' }),
  xs: css({ fontSize: 'var(--fs-11)', letterSpacing: 'var(--tracking-eyebrow)' }),
}

const toneStyles: Record<EyebrowTone, ReturnType<typeof css>> = {
  volt: css({ color: 'var(--volt)' }),
  ion: css({ color: 'var(--ion)' }),
  synapse: css({ color: 'var(--synapse)' }),
  muted: css({ color: 'var(--muted)' }),
  dim: css({ color: 'var(--dim)' }),
  text: css({ color: 'var(--text)' }),
}

const upperStyle = css({ textTransform: 'uppercase' })

const headingStyle = css({
  margin: 0,
  fontFamily: 'var(--font-mono)',
  fontWeight: 500,
  fontSize: 'var(--fs-13)',
  lineHeight: 'normal',
  letterSpacing: 'var(--tracking-eyebrow)',
  color: 'var(--muted)',
})
