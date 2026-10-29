import type { Handle } from 'remix/component'
import { css } from 'remix/component'
import { CellGrid, cellLinkStyle } from '@bits/ui/cell-grid'
import { Crosshair } from '@bits/ui/crosshair'
import { PageFrame } from '@bits/ui/page-frame'
import { RuledSection } from '@bits/ui/ruled-section'

import { Section, Specimen } from './layout.tsx'

/**
 * The squared-grid primitives (decision 047): a PageFrame with two ruled
 * sections, a flush CellGrid (one cell a link), and a boxed grid inside
 * padding. The specimen clips the sections' full-bleed rules at its edge.
 */
export function GridSection(_handle: Handle) {
  return () => (
    <Section
      id="sg-grid"
      title="Grid"
      intro="PageFrame draws the rails, RuledSection a full-bleed rule with + marks and an optional 02 / label strip, CellGrid cells that share 1px borders (cols, colsMid, colsPhone; flush or boxed). Decision 047."
    >
      <Specimen caption="PageFrame · RuledSection (index, label, aside) · CellGrid flush, ink fill, a cellLinkStyle link" wide>
        <div mix={stage}>
          <PageFrame mix={frameSample}>
            <RuledSection aria-label="Sample section" index="02" label="How it works" tone="ion" aside="3 cells" pad="none">
              <CellGrid as="ul" cols={3} fill="ink" aria-label="Sample cells">
                <li>
                  <p mix={cellTitle}>Read</p>
                  <p mix={cellText}>A plain cell, padded with --cell-pad.</p>
                </li>
                <li mix={linkCell}>
                  <a href="#sg-grid" mix={cellLinkStyle}>
                    <span mix={cellTitle}>Type</span>
                    <span mix={cellText}>A whole-cell link: hover fills, focus sits inside.</span>
                  </a>
                </li>
                <li>
                  <p mix={cellTitle}>Run</p>
                  <p mix={cellText}>The last cell of a row draws no right border.</p>
                </li>
              </CellGrid>
            </RuledSection>
            <RuledSection aria-label="Second sample section" label="A label without an index">
              <p mix={cellText}>Default padding: --section-pad-y / --section-pad-x.</p>
            </RuledSection>
          </PageFrame>
        </div>
      </Specimen>
      <Specimen caption="CellGrid boxed, colsPhone 3 (a row of stats) · Crosshair placements">
        <CellGrid cols={3} colsMid={3} colsPhone={3} edge="boxed">
          <p mix={cellTitle}>12</p>
          <p mix={cellTitle}>1,240</p>
          <p mix={cellTitle}>37</p>
        </CellGrid>
        <div mix={markBox}>
          <Crosshair placement="top-start" />
          <Crosshair placement="top-end" />
          <Crosshair placement="bottom-start" />
          <Crosshair placement="bottom-end" />
        </div>
      </Specimen>
    </Section>
  )
}

// The specimen keeps the full-bleed rules to itself, with room for the marks.
const stage = css({ overflow: 'clip', padding: 'var(--space-3) 0' })
const frameSample = css({ '--frame-inset': 'var(--space-3)' })
const linkCell = css({ display: 'flex' })
const cellTitle = css({ margin: 0, fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 'var(--fs-20)' })
const cellText = css({ margin: 0, color: 'var(--muted)', fontSize: 'var(--fs-14)' })
const markBox = css({
  position: 'relative',
  height: 'var(--space-16)',
  margin: 'var(--space-4) var(--space-3) 0',
  borderInline: 'var(--border-w) solid var(--line-rail)',
})
