import type { Handle, MixInput } from 'remix/component'
import { css } from 'remix/component'

import { Logo } from './logo.tsx'
import { NavLink } from './nav-link.tsx'

export interface FooterProps {
  brand: string
  homeHref: string
  links: { href: string; label: string }[]
  /** e.g. "© 2026 Bits". */
  copyright: string
  mix?: MixInput<HTMLElement>
}

/** Site footer (components §3.5). Recommended on all public pages. Static. */
export function Footer(handle: Handle<FooterProps>) {
  return () => {
    let { brand, homeHref, links, copyright, mix } = handle.props
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
          <p mix={copyStyle}>{copyright}</p>
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
const copyStyle = css({ margin: 0, fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-12)', color: 'var(--dim)' })
