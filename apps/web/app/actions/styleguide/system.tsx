import type { Handle } from 'remix/component'
import { css } from 'remix/component'
import { Card } from '@bits/ui/card'
import { Chip } from '@bits/ui/chip'
import { Eyebrow, MonoHeading } from '@bits/ui/eyebrow'
import { Kbd } from '@bits/ui/kbd'
import { Keycap } from '@bits/ui/keycap'
import { LessonNodeRow, lessonListStyle } from '@bits/ui/lesson-node'
import { RewardToast } from '@bits/ui/reward-toast'
import { StaticTabs } from '@bits/ui/segmented-tabs'
import { Tag } from '@bits/ui/tag'
import { TokenPill, tokenListStyle } from '@bits/ui/token-pill'

import { row, sectionStyle, specimenGrid } from './layout.tsx'
import { extendedSwatches, swatches, typeRows } from './samples.tsx'

/**
 * The System artboard (docs/design/spec/pages/System.md) rebuilt from the
 * real components: header, colour, type and the six component cards.
 */
export function SystemBoard(handle: Handle) {
  return () => (
    <>
      <header mix={headerStyle}>
        <div mix={headerLeft}>
          <Eyebrow tone="volt" uppercase>
            bits / system
          </Eyebrow>
          <h1 mix={h1Style}>Ink, Volt &amp; Ion.</h1>
        </div>
        <p mix={headerLead}>
          A dark ink ground, one electric accent for “do this”, one cool accent for “the model said this”. Unbounded
          shouts, Geist reads, Geist Mono is anything you type.
        </p>
      </header>

      <section aria-labelledby="sg-color" mix={sectionStyle}>
        <MonoHeading level={2} id="sg-color">
          Color
        </MonoHeading>
        <ul mix={swatchGrid}>
          {swatches.map((swatch) => (
            <Swatch key={swatch.name} {...swatch} />
          ))}
        </ul>
        <h3 mix={subHeading}>Extended tokens (tokens.md “+”)</h3>
        <ul mix={swatchGrid}>
          {extendedSwatches.map((swatch) => (
            <Swatch key={swatch.name} {...swatch} />
          ))}
        </ul>
      </section>

      <section aria-labelledby="sg-type" mix={sectionStyle}>
        <MonoHeading level={2} id="sg-type">
          Type
        </MonoHeading>
        <ul mix={typeList}>
          {typeRows.map((typeRow) => (
            <li key={typeRow.label} mix={typeRowStyle}>
              <span mix={typeLabel}>{typeRow.label}</span>
              <div mix={typeSample}>{typeRow.sample}</div>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="sg-components" mix={sectionStyle}>
        <MonoHeading level={2} id="sg-components">
          Components
        </MonoHeading>
        <div mix={specimenGrid}>
          <Card>
            <span mix={caption}>Keycap buttons — rest · hover · pressed</span>
            <div mix={row}>
              <Keycap>Start lesson →</Keycap>
              <Keycap forceState="hover">Hover</Keycap>
              <Keycap forceState="active">Pressed</Keycap>
            </div>
            <div mix={row}>
              <Keycap variant="dark">Browse courses</Keycap>
              <Keycap variant="ghost" size="sm">
                Ghost
              </Keycap>
              <Kbd>⌘ K</Kbd>
            </div>
          </Card>

          <Card>
            <span mix={caption}>Prompt composer — the most important input on the site</span>
            <div aria-hidden="true" mix={composerSample}>
              <div mix={composerHead}>
                <Tag variant="your-turn">Your turn</Tag>
                <span mix={composerTask}>Make the model answer as a pirate in 3 bullets</span>
              </div>
              <span mix={composerText}>
                You are a salty pirate captain.<span mix={caret}>▍</span>
              </span>
              <div mix={composerFoot}>
                <span>8 tokens · temp 0.7</span>
                <Tag variant="run-hint">Run ↵</Tag>
              </div>
            </div>
          </Card>

          <Card>
            <span mix={caption}>Lesson nodes — done · current · next</span>
            <ol mix={lessonListStyle}>
              <LessonNodeRow state="done">What is a token?</LessonNodeRow>
              <LessonNodeRow state="current">Temperature &amp; randomness</LessonNodeRow>
              <LessonNodeRow state="next">The context window</LessonNodeRow>
            </ol>
          </Card>

          <Card>
            <span mix={caption}>Chips, tabs, token pills</span>
            <div mix={chipRow}>
              <Chip selected>Agents</Chip>
              <Chip>Prompting</Chip>
              <Chip>Foundations</Chip>
            </div>
            <StaticTabs items={['Read', 'Watch', 'Terminal']} />
            <ol aria-label="Tokens" mix={tokenListStyle}>
              <TokenPill text="Un" index={0} />
              <TokenPill text="believ" index={1} />
              <TokenPill text="ably" index={2} />
            </ol>
          </Card>

          <Card>
            <span mix={caption}>Reward toast — fires when an exercise passes</span>
            <RewardToast variant="system" xp={40} message="Prompt passed all 3 checks" />
          </Card>

          <Card>
            <span mix={caption}>Shape &amp; motion</span>
            <dl mix={shapeGrid}>
              {[
                ['radius', '0 (squared, decision 047) · round for dots'],
                ['space', '4-pt; sections 120 / cards 24'],
                ['glass', '#0C0E16 @ 78% · blur 14–18'],
                ['keycap press', '120ms · 3px travel'],
                ['reveal', '400ms ease · 8px rise'],
                ['3D morph', 'lerp 0.055 / frame'],
                ['reduced motion', 'field at ¼ speed, no caret'],
              ].map(([key, value]) => (
                <div key={key} mix={shapeRow}>
                  <dt mix={shapeKey}>{key}</dt>
                  <dd mix={shapeValue}>{value}</dd>
                </div>
              ))}
            </dl>
          </Card>
        </div>
      </section>
    </>
  )
}

function Swatch(handle: Handle<{ name: string; token: string; hex: string; use: string }>) {
  return () => {
    let { name, token, hex, use } = handle.props
    return (
      <li mix={swatchStyle}>
        <span aria-hidden="true" mix={chipStyle} style={{ background: `var(${token})` }} />
        <span mix={swatchText}>
          <span mix={swatchName}>{name}</span>
          <span mix={swatchHex}>{`${hex} · ${token}`}</span>
          <span mix={swatchUse}>{use}</span>
        </span>
      </li>
    )
  }
}

const headerStyle = css({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-end',
  gap: 'var(--space-8)',
  flexWrap: 'wrap',
  paddingBottom: 'var(--space-8)',
  borderBottom: '1px solid var(--line)',
})
const headerLeft = css({ display: 'flex', flexDirection: 'column', gap: 'var(--space-3_5)' })
const h1Style = css({
  margin: 0,
  fontFamily: 'var(--font-display)',
  fontWeight: 800,
  fontSize: 'var(--fs-56)',
  lineHeight: 1,
  letterSpacing: '-0.04em',
  '@media (max-width: 480px)': { fontSize: '40px' },
})
const headerLead = css({ margin: 0, maxWidth: '520px', fontSize: 'var(--fs-16)', lineHeight: 1.6, color: 'var(--muted)' })
const subHeading = css({ margin: 0, fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-12)', fontWeight: 400, color: 'var(--muted)' })

const swatchGrid = css({
  listStyle: 'none',
  margin: 0,
  padding: 0,
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(180px, 100%), 1fr))',
  gap: 'var(--space-3_5)',
})
const swatchStyle = css({
  display: 'flex',
  flexDirection: 'column',
  borderRadius: 'var(--radius-lg)',
  overflow: 'hidden',
  border: '1px solid var(--line)',
  background: 'var(--surface)',
})
const chipStyle = css({ display: 'block', height: '96px', borderBottom: '1px solid var(--line-hair)' })
const swatchText = css({ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)', padding: 'var(--space-3) var(--space-3_5)' })
const swatchName = css({ fontSize: 'var(--fs-15)', fontWeight: 600 })
const swatchHex = css({ fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-12)', color: 'var(--text-quiet)', overflowWrap: 'anywhere' })
const swatchUse = css({ fontSize: 'var(--fs-13)', lineHeight: 1.45, color: 'var(--muted)' })

const typeList = css({ listStyle: 'none', margin: 0, padding: 0, borderTop: '1px solid var(--line)' })
const typeRowStyle = css({
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(220px, 100%), 1fr))',
  gap: 'var(--space-6)',
  alignItems: 'baseline',
  padding: 'var(--space-5_5) 0',
  borderBottom: '1px solid var(--line)',
  '@media (min-width: 900px)': { gridTemplateColumns: '220px 1fr' },
})
const typeLabel = css({ fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-12)', lineHeight: 1.6, color: 'var(--muted)' })
// System.md: the artboard's `span 3` overflows; use 2 / -1 above 900px, full width below.
const typeSample = css({ minWidth: 0, overflowWrap: 'anywhere', '@media (min-width: 900px)': { gridColumn: '2 / -1' } })

const caption = css({ fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-12)', color: 'var(--muted)' })
const composerSample = css({
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-2_5)',
  padding: 'var(--space-3_5)',
  borderRadius: 'var(--radius-16)',
  background: 'var(--well)',
  border: '1px solid var(--volt-a50)',
  boxShadow: '0 0 0 4px var(--volt-tint)',
})
const composerHead = css({ display: 'flex', alignItems: 'center', gap: 'var(--space-2_5)', '& > span:first-child': { flex: 'none' } })
const composerTask = css({ fontSize: 'var(--fs-13)', color: 'var(--muted)' })
const composerText = css({ fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-15)', color: 'var(--text)' })
const caret = css({
  color: 'var(--volt)',
  animation: 'bits-blink var(--duration-caret) steps(1) infinite',
  '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
})
const composerFoot = css({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  fontFamily: 'var(--font-mono)',
  fontSize: 'var(--fs-12)',
  color: 'var(--dim)',
})
const chipRow = css({ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' })
const shapeGrid = css({
  margin: 0,
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: 'var(--space-2_5) var(--space-5)',
  fontFamily: 'var(--font-mono)',
  fontSize: 'var(--fs-13)',
  lineHeight: 'normal',
})
const shapeRow = css({ display: 'contents' })
const shapeKey = css({ color: 'var(--muted)' })
const shapeValue = css({ margin: 0, color: 'var(--text-body)' })
