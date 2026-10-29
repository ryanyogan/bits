import type { Handle } from 'remix/component'
import { css } from 'remix/component'
import { CellGrid, cellLinkStyle } from '@bits/ui/cell-grid'
import { ContinueBanner } from '@bits/ui/continue-banner'
import { CourseCard, WriteCourseCard } from '@bits/ui/course-card'
import { Crosshair } from '@bits/ui/crosshair'
import { EmptyState } from '@bits/ui/empty-state'
import { FilterPill } from '@bits/ui/filter-pill'
import { PageFrame } from '@bits/ui/page-frame'
import { Panel, panelLinkStyle, panelListStyle } from '@bits/ui/panel'
import { RuledSection } from '@bits/ui/ruled-section'
import { SearchField } from '@bits/ui/search-field'
import { OutputPanel } from '@bits/ui/terminal'

import { Section, Specimen } from './layout.tsx'
import { outputLines } from './samples.tsx'

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
      intro="PageFrame draws the rails, RuledSection a full-bleed rule with + marks and an optional 02 / label strip, CellGrid cells that share 1px borders (cols, colsMid, colsPhone; flush or boxed), Panel a block inside a cell. A strip draws the hairline under itself, so a grid right under it takes top={false}. Decision 047."
    >
      <Specimen caption="PageFrame · RuledSection (index, label, aside) · CellGrid flush, top={false}, ink fill, a cellLinkStyle link" wide>
        <div mix={stage}>
          <PageFrame mix={frameSample}>
            <RuledSection aria-label="Sample section" index="02" label="How it works" tone="ion" aside="3 cells" pad="none">
              <CellGrid as="ul" cols={3} fill="ink" top={false} aria-label="Sample cells">
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
            <RuledSection label="A strip label that is the heading (labelAs h3)" labelAs="h3" labelId="sg-grid-second">
              <p mix={cellText}>Default padding: --section-pad-y / --section-pad-x.</p>
            </RuledSection>
          </PageFrame>
        </div>
      </Specimen>
      <Specimen caption="Panel — padded (EmptyState boxed) · flush (panelListStyle rows, a panelLinkStyle aside)" wide>
        <div mix={panelStage}>
          <Panel id="sg-panel-a" title="Courses" level={3} aside="0 started">
            <EmptyState title="No courses yet." hint="Start one from the catalog." />
          </Panel>
          <Panel
            id="sg-panel-b"
            title="Prompt journal"
            level={3}
            aside={
              <a href="#sg-grid" mix={panelLinkStyle}>
                All 12 →
              </a>
            }
            flush
          >
            <ul mix={panelListStyle}>
              <li mix={rowStyle}>› explain tokens like I'm five</li>
              <li mix={rowStyle}>› list three uses of temperature</li>
            </ul>
          </Panel>
        </div>
      </Specimen>
      <Specimen caption="Cell variants — SearchField · FilterPill · CourseCard · WriteCourseCard (variant cell) · ContinueBanner edge flush · OutputPanel flush · EmptyState bare" wide>
        <div mix={stage}>
          <PageFrame mix={frameSample}>
            <RuledSection as="div" label="Find a course" aside="8 courses" pad="none" rule={false}>
              <div mix={toolbar}>
                <SearchField action="#sg-grid" label="Search courses (cell)" id="sg-search-cell" variant="cell" mix={searchCell} />
                <nav aria-label="Sample track filters" mix={pillRow}>
                  <FilterPill href="#sg-grid" dot="var(--text)" count={8} selected variant="cell">
                    All
                  </FilterPill>
                  <FilterPill href="#sg-grid-f" dot="var(--track-foundations)" count={2} variant="cell">
                    Foundations
                  </FilterPill>
                </nav>
              </div>
            </RuledSection>
            <RuledSection aria-label="Sample continue banner" pad="none">
              <ContinueBanner
                href="#sg-grid"
                eyebrow="Continue · lesson 6 of 8"
                courseTitle="Tokens & temperature"
                nextLesson="Temperature & randomness"
                mins={7}
                pct={62}
                sigil="T°"
                tone="ion"
                pattern="stripes-115"
                edge="flush"
              />
            </RuledSection>
            <RuledSection aria-label="Sample course cells" pad="none">
              <CellGrid as="ul" cols={3} fill="ink">
                <li mix={linkCell}>
                  <CourseCard
                    href="#sg-grid"
                    title="What is an LLM, really?"
                    desc="Next-token prediction, from the ground up."
                    track="Foundations"
                    level="Beginner"
                    lessons={6}
                    mins={30}
                    sigil="LLM"
                    tone="volt"
                    pattern="dots"
                    formats={['text']}
                    pct={100}
                    variant="cell"
                  />
                </li>
                <li mix={linkCell}>
                  <WriteCourseCard href="#sg-grid" variant="cell" />
                </li>
                <li>
                  <EmptyState variant="bare" title="0 results for “quantum”" hint="An empty cell uses the bare variant." />
                </li>
              </CellGrid>
            </RuledSection>
            <RuledSection aria-label="Sample flush output" pad="none">
              <OutputPanel command="node run.js" lines={outputLines} flush />
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
// Panels stack inside one cell: the specimen draws that cell's box.
const panelStage = css({ border: 'var(--border-w) solid var(--line-cell)', maxWidth: '520px' })
const rowStyle = css({ padding: 'var(--space-4) var(--cell-pad)', fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-14)' })
// The catalog's toolbar recipe: search fills the left, the pills are cells.
const toolbar = css({
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) auto',
  '@media (max-width: 1023.98px)': { gridTemplateColumns: 'minmax(0, 1fr)' },
})
const searchCell = css({ borderRight: 'var(--border-w) solid var(--line-cell)' })
const pillRow = css({ display: 'flex', minWidth: 0, '& > a:last-child': { borderRight: 0 } })
const markBox = css({
  position: 'relative',
  height: 'var(--space-16)',
  margin: 'var(--space-4) var(--space-3) 0',
  borderInline: 'var(--border-w) solid var(--line-rail)',
})
