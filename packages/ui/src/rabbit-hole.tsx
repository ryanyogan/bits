import type { Handle, MixInput } from 'remix/component'
import { css } from 'remix/component'

import { MonoHeading } from './eyebrow.tsx'
import { Icon } from './icon.tsx'
import { toyHeaderStyle, toyPanelStyle } from './toy-panel.tsx'

export interface RabbitHoleLink {
  kind: 'video' | 'read'
  title: string
  /** Author or channel, e.g. "3Blue1Brown". */
  by: string
  /** https only (the content build checks). */
  url: string
  /** Length in minutes. */
  mins?: number
  /** A long piece (a "deep dive"). */
  deep?: boolean
}

export interface RabbitHoleProps {
  links: RabbitHoleLink[]
  /** Heading id (unique on the page). */
  id?: string
  mix?: MixInput<HTMLElement>
}

/** "video · 8 min · deep dive" */
export function linkMeta(link: RabbitHoleLink): string {
  return [link.kind === 'video' ? 'video' : 'read', link.mins ? `${link.mins} min` : undefined, link.deep ? 'deep dive' : undefined]
    .filter(Boolean)
    .join(' · ')
}

/**
 * `:::rabbithole` (lesson block): "Down the rabbit hole", up to three link
 * cards to the best source on the idea. Links open in a new tab, skip
 * client navigation (`data-rmx-document`) and send no referrer or opener.
 * Static, no JS.
 */
export function RabbitHole(handle: Handle<RabbitHoleProps>) {
  return () => {
    let { links, id = 'rabbit-hole', mix } = handle.props
    return (
      <section aria-labelledby={id} mix={[toyPanelStyle, mix]}>
        <div mix={toyHeaderStyle}>
          <MonoHeading level={2} id={id}>
            Down the rabbit hole
          </MonoHeading>
          <span aria-hidden="true" mix={countStyle}>{`${links.length} ${links.length === 1 ? 'link' : 'links'} ↗`}</span>
        </div>
        <ul mix={listStyle}>
          {links.map((link) => (
            <li key={link.url} mix={itemStyle}>
              <a href={link.url} target="_blank" rel="noopener noreferrer" data-rmx-document="" data-kind={link.kind} mix={cardStyle}>
                <span aria-hidden="true" data-kind={link.kind} mix={kindStyle}>
                  <Icon name={link.kind === 'video' ? 'play-inline' : 'book'} color="currentColor" />
                </span>
                <span mix={bodyStyle}>
                  <span mix={titleStyle}>{link.title}</span>
                  <span mix={metaStyle}>
                    {link.by} · {linkMeta(link)}
                  </span>
                </span>
                <span aria-hidden="true" mix={arrowStyle}>
                  ↗
                </span>
                <span class="sr-only"> (opens in a new tab)</span>
              </a>
            </li>
          ))}
        </ul>
      </section>
    )
  }
}

const countStyle = css({ fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-12)', color: 'var(--dim)' })
// Cells sharing 1px hairlines (decision 047): the gaps show the list's
// line-coloured ground. Flex, not grid, so a short last row still fills.
const listStyle = css({
  listStyle: 'none',
  margin: 0,
  padding: 0,
  display: 'flex',
  flexWrap: 'wrap',
  gap: 'var(--border-w)',
  background: 'var(--line-cell)',
  '@media (forced-colors: active)': { background: 'CanvasText' },
})
const itemStyle = css({ flex: '1 1 220px', display: 'flex', minWidth: 0, background: 'var(--surface)' })
const cardStyle = css({
  flex: 1,
  minWidth: 0,
  minHeight: 'var(--touch-target)',
  display: 'flex',
  alignItems: 'flex-start',
  gap: 'var(--space-3)',
  padding: 'var(--space-4) var(--space-5)',
  color: 'var(--text)',
  textDecoration: 'none',
  transition: 'background-color var(--duration-fast), box-shadow var(--duration-fast)',
  // Hover: a fill step and the link's colour along the top edge.
  '&:hover': { background: 'var(--fill-hover)', boxShadow: 'inset 0 2px 0 var(--ion)' },
  '&[data-kind="read"]:hover': { boxShadow: 'inset 0 2px 0 var(--synapse)' },
  '&:focus-visible': { outlineOffset: 'var(--focus-offset-inset)' },
  '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
  '@media (max-width: 480px)': { padding: 'var(--space-4)' },
})
const kindStyle = css({
  flex: 'none',
  display: 'grid',
  placeItems: 'center',
  width: '32px',
  height: '32px',
  borderRadius: 'var(--radius-sm)',
  background: 'var(--ion-a12)',
  color: 'var(--ion)',
  '&[data-kind="read"]': { background: 'var(--syn-a14)', color: 'var(--synapse)' },
})
const bodyStyle = css({ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' })
const titleStyle = css({ fontSize: 'var(--fs-15)', lineHeight: 1.4, color: 'var(--text)', overflowWrap: 'anywhere' })
const metaStyle = css({ fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-12)', color: 'var(--muted)' })
const arrowStyle = css({ flex: 'none', fontSize: 'var(--fs-14)', color: 'var(--text-quiet)' })
