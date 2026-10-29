import type { Handle, MixInput, RemixNode } from 'remix/component'
import { css } from 'remix/component'
import { RuledSection, type RuledSectionTone } from '@bits/ui/ruled-section'

export interface PageHeadProps {
  /** The `<h1>`. */
  title: RemixNode
  /** id of the `<h1>`; the band is labelled by it (default `page-title`). */
  titleId?: string
  /** Short mono name in the band's strip ("Account", "Policies"). */
  label?: RemixNode
  /** Strip index, only for a true sequence or a status code ("404"). */
  index?: string
  tone?: RuledSectionTone
  /** Right end of the strip: a date, a count, a link. */
  aside?: RemixNode
  /** One paragraph under the title. */
  lead?: RemixNode
  /** Anything else in the band, under the lead (a notice, actions). */
  children?: RemixNode
  mix?: MixInput<HTMLElement>
}

/**
 * The first band of an app page in the squared grid (decisions 047, 050): a
 * `RuledSection` that hangs from the AppBar (no gap or rule of its own; the
 * bar's rule closes it from above), a mono strip, then the page's `<h1>`
 * and lead at the section inset. The same title size and spacing on every
 * app page, so moving between them doesn't shift the heading. Put it first
 * inside the page's `PageFrame`; the page's next `RuledSection` sits
 * `--section-gap` below it.
 */
export function PageHead(handle: Handle<PageHeadProps>) {
  return () => {
    let { title, titleId = 'page-title', label, index, tone, aside, lead, children, mix } = handle.props
    return (
      <RuledSection
        rule={false}
        label={label}
        index={index}
        tone={tone}
        aside={aside}
        pad="none"
        aria-labelledby={titleId}
        mix={mix}
      >
        <div mix={bodyStyle}>
          <h1 id={titleId} mix={titleStyle}>
            {title}
          </h1>
          {lead ? <p mix={leadStyle}>{lead}</p> : null}
          {children}
        </div>
      </RuledSection>
    )
  }
}

const bodyStyle = css({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-start',
  gap: 'var(--space-4)',
  padding: 'var(--space-14) var(--section-pad-x) var(--space-12)',
  '& > *': { maxWidth: 'var(--read-width)' },
  '@media (max-width: 480px)': { padding: 'var(--space-8) var(--section-pad-x)' },
})

/** `h2-section` type for a page title: Unbounded 700, one step down on phones (a ~280px column). */
export const pageTitleStyle = css({
  margin: 0,
  fontFamily: 'var(--font-display)',
  fontWeight: 700,
  fontSize: 'var(--type-h2-size)',
  lineHeight: 'var(--type-h2-leading)',
  letterSpacing: 'var(--type-h2-tracking)',
  textWrap: 'balance',
  '@media (max-width: 480px)': { fontSize: 'var(--fs-30)' },
})
const titleStyle = pageTitleStyle

const leadStyle = css({
  margin: 0,
  maxWidth: '60ch',
  fontSize: 'var(--fs-17)',
  lineHeight: 1.6,
  color: 'var(--text-lead)',
  textWrap: 'pretty',
})
