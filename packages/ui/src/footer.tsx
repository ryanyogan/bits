import type { Handle, MixInput } from 'remix/component'
import { css } from 'remix/component'

import { FOCUS, FORCED_COLORS, HOVER } from './lib/states.ts'
import { Logo } from './logo.tsx'
import { NavLink } from './nav-link.tsx'
import type { ThemePreference } from './theme.tsx'

export interface FooterThemeOption {
  value: ThemePreference
  label: string
}

export interface FooterProps {
  brand: string
  homeHref: string
  links: { href: string; label: string }[]
  /** e.g. "© 2026 Bits". */
  copyright: string
  /**
   * The theme switch (decision 062): System / Dark / Light as three small
   * submit buttons beside the copyright, in a native form that POSTs
   * `theme` to `action`. Saving is a write, so it is never a link.
   */
  themes?: { current: ThemePreference; action: string; options: FooterThemeOption[] }
  mix?: MixInput<HTMLElement>
}

/** Site footer (components §3.5). Recommended on all public pages. Static. */
export function Footer(handle: Handle<FooterProps>) {
  return () => {
    let { brand, homeHref, links, copyright, themes, mix } = handle.props
    return (
      <footer mix={[footerStyle, mix]}>
        <div mix={innerStyle}>
          <Logo brand={brand} href={homeHref} variant="footer" />
          <nav aria-label="Footer" mix={navStyle}>
            {links.map((link) => (
              <NavLink key={link.href} href={link.href} variant="footer">
                {link.label}
              </NavLink>
            ))}
          </nav>
          <div mix={endStyle}>
            {themes ? (
              <form method="post" action={themes.action} aria-label="Theme" mix={themeStyle}>
                {themes.options.map((option) => (
                  <button
                    key={option.value}
                    type="submit"
                    name="theme"
                    value={option.value}
                    aria-pressed={option.value === themes.current ? 'true' : 'false'}
                    mix={themeButtonStyle}
                  >
                    {option.label}
                  </button>
                ))}
              </form>
            ) : null}
            <p mix={copyStyle}>{copyright}</p>
          </div>
        </div>
      </footer>
    )
  }
}

const footerStyle = css({ borderTop: 'var(--border-w) solid var(--line)', background: 'var(--ink)' })
const innerStyle = css({
  maxWidth: 'var(--page-max)',
  margin: '0 auto',
  padding: 'var(--space-9) var(--page-gutter)',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 'var(--space-5)',
  flexWrap: 'wrap',
})
const navStyle = css({ display: 'flex', gap: 'var(--space-6)', flexWrap: 'wrap', fontSize: 'var(--fs-14)' })
// The theme switch and the copyright: one row on phones (where they have a
// row of their own), stacked from 800px, so the logo, the links and this
// still fit on one 44px row and the footer keeps its height. (Between
// 760px and 800px the copyright used to just fit beside the links; there
// the pair now wraps to a row of its own, 38px taller.)
const endStyle = css({
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-1) var(--space-5)',
  flexWrap: 'wrap',
  '@media (min-width: 800px)': { flexDirection: 'column', alignItems: 'flex-end' },
})
const copyStyle = css({ margin: 0, fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-12)', color: 'var(--dim)' })

// Mono 12px like the copyright. Each button keeps a 44px touch target, but
// the strip's negative block margins give the row only the type's height,
// so the footer is as tall as before (the overhang sits in its padding).
const themeStyle = css({
  display: 'flex',
  gap: 'var(--space-3)',
  marginBlock: 'calc((var(--fs-12) * 1.5 - var(--touch-target)) / 2)',
})
const themeButtonStyle = css({
  appearance: 'none',
  background: 'none',
  border: 0,
  padding: 0,
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: 'var(--touch-target)',
  boxSizing: 'border-box',
  fontFamily: 'var(--font-mono)',
  fontSize: 'var(--fs-12)',
  color: 'var(--muted)',
  textDecoration: 'none',
  // The pick is underlined at the text, not at the foot of the 44px box
  // (which overhangs the copyright line).
  textUnderlineOffset: 'var(--space-1)',
  textDecorationThickness: 'var(--border-w-strong)',
  transition: 'color var(--duration-fast)',
  [HOVER]: { color: 'var(--text)' },
  [FOCUS]: { outline: 'var(--focus-outline)', outlineOffset: 'var(--focus-offset)', borderRadius: 'var(--radius-4)' },
  '&[aria-pressed="true"]': { color: 'var(--text)', textDecorationLine: 'underline', textDecorationColor: 'var(--volt)' },
  '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
  [FORCED_COLORS]: { '&[aria-pressed="true"]': { textDecorationColor: 'Highlight' } },
})
