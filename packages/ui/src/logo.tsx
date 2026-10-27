import type { Handle, MixInput } from 'remix/component'
import { css } from 'remix/component'

import { BrandMark } from './brand-mark.tsx'
import { prefetchFor, type PrefetchProp } from './lib/prefetch.ts'

export type LogoVariant = 'nav' | 'auth' | 'app' | 'footer'

export interface LogoProps {
  /** Wordmark text. Pass the app's name constant ("bits"); never hard-code it here. */
  brand: string
  href: string
  /** `nav` 30/20px (landing), `auth` 28/19px, `app` 26/17px (app bars), `footer` wordmark only, 16px. */
  variant?: LogoVariant
  /** Accessible name for the link; defaults to "<Brand> home". */
  label?: string
  /** Prefetch the page on hover/focus (`intent`, the default), on `viewport`, or not (`false`). Decision 042. */
  prefetch?: PrefetchProp
  mix?: MixInput<HTMLElement>
}

const markSize: Record<LogoVariant, number | null> = { nav: 30, auth: 28, app: 26, footer: null }

/**
 * The logo link: LogoMark + Wordmark (components §1.1–1.2). Static.
 * The link is at least 44px tall; the mark and wordmark stay visually as drawn.
 */
export function Logo(handle: Handle<LogoProps>) {
  return () => {
    let { brand, href, variant = 'app', label, prefetch, mix } = handle.props
    let size = markSize[variant]
    let name = label ?? `${brand.charAt(0).toUpperCase()}${brand.slice(1)} home`

    return (
      <a href={href} data-rmx-prefetch={prefetchFor(href, prefetch)} aria-label={name} mix={[linkStyle, wordStyles[variant], mix]}>
        {size ? <BrandMark size={size} /> : null}
        <span>{brand}</span>
      </a>
    )
  }
}

const linkStyle = css({
  display: 'inline-flex',
  alignItems: 'center',
  gap: 'var(--space-2_5)',
  minHeight: 'var(--touch-target)',
  color: 'var(--text)',
  textDecoration: 'none',
  fontFamily: 'var(--font-display)',
  fontWeight: 700,
  letterSpacing: 'var(--tracking-title)',
  '&:hover': { color: 'var(--text)' },
})

const wordStyles: Record<LogoVariant, ReturnType<typeof css>> = {
  nav: css({ fontSize: 'var(--fs-20)' }),
  auth: css({ fontSize: 'var(--fs-19)' }),
  app: css({ fontSize: 'var(--fs-17)' }),
  footer: css({ fontSize: 'var(--fs-16)', letterSpacing: 'normal' }),
}
