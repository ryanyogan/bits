import { css, type Handle, type RemixNode } from 'remix/component'
import { CellGrid } from '@bits/ui/cell-grid'
import { RuledSection } from '@bits/ui/ruled-section'

import { cardDesc, cardTitle, cellLabel, h2Style, PHONE, voltText } from './styles.ts'

/** "Read it. Watch it. Run it." (Main.md §5): three ModeCards as cells (components §12.3). */
export function Modes(_handle: Handle) {
  return () => (
    <RuledSection aria-labelledby="modes-title" pad="none">
      <div mix={headerRow}>
        <h2 id="modes-title" mix={[h2Style, titleStyle]}>
          Read it. Watch it. <span mix={voltText}>Run it.</span>
        </h2>
        <p mix={introStyle}>
          Every lesson works as text. Some come with a video. The coding ones hand you a real
          editor.
        </p>
      </div>
      <CellGrid as="ul" cols={3} fill="ink">
        <ModeCard
          eyebrow="TEXT · ALWAYS"
          color="var(--volt)"
          title="Chat or terminal"
          desc="Read the lesson as a conversation with a tutor, or flip to terminal mode for a CLI feel. Either way, you type to move forward."
          art={<ReadArt />}
        />
        <ModeCard
          eyebrow="VIDEO · OPTIONAL"
          color="var(--ion)"
          title="Watch when it helps"
          desc="Chaptered videos with a synced transcript. Jump back to text any time — your place is kept in both."
          art={<WatchArt />}
        />
        <ModeCard
          eyebrow="CODE · WHEN IT MATTERS"
          color="var(--volt)"
          title="A real editor"
          desc="Syntax-highlighted, one-click copy, and a “type it yourself” mode for the moments muscle memory matters."
          art={<RunArt />}
        />
      </CellGrid>
    </RuledSection>
  )
}

interface ModeCardProps {
  eyebrow: string
  color: string
  title: string
  desc: string
  art: RemixNode
}

function ModeCard(handle: Handle<ModeCardProps>) {
  return () => {
    let { eyebrow, color, title, desc, art } = handle.props
    return (
      <li mix={cardStyle}>
        <div aria-hidden="true" mix={wellStyle}>
          {art}
        </div>
        <div mix={textStyle}>
          <p mix={cellLabel} style={{ color }}>
            {eyebrow}
          </p>
          <h3 mix={cardTitle}>{title}</h3>
          <p mix={cardDesc}>{desc}</p>
        </div>
      </li>
    )
  }
}

function ReadArt(_handle: Handle) {
  return () => (
    <div mix={readArt}>
      <span mix={[bar, w('82%')]} />
      <span mix={[bar, w('64%')]} />
      <span mix={bubble} />
      <span mix={[bar, w('74%'), mt6]} />
      <span mix={promptLine}>› your prompt here▍</span>
    </div>
  )
}

function WatchArt(_handle: Handle) {
  return () => (
    <div mix={watchArt}>
      <div mix={watchDots} />
      <span mix={playButton}>
        <svg width="20" height="22" viewBox="0 0 20 22">
          <path d="M3 2 L18 11 L3 20 Z" fill="currentColor" />
        </svg>
      </span>
      <div mix={chapters}>
        <span mix={[chapter, chapterOn]} style={{ flex: 3 }} />
        <span mix={chapter} style={{ flex: 2 }} />
        <span mix={chapter} style={{ flex: 4 }} />
        <span mix={chapter} style={{ flex: 2 }} />
      </div>
    </div>
  )
}

function RunArt(_handle: Handle) {
  return () => (
    <div mix={runArt}>
      <span mix={gutter}>{'1\n2\n3\n4\n5\n6'}</span>
      <span mix={codeStyle}>
        <span mix={kw}>while</span> (<span mix={ion}>true</span>) {'{\n  '}
        <span mix={kw}>const</span> res = <span mix={kw}>await</span> <span mix={fn}>think</span>
        {'(msgs)\n  '}
        <span mix={kw}>if</span> (!res.<span mix={ion}>toolUse</span>) <span mix={kw}>break</span>
        {'\n  msgs.'}
        <span mix={fn}>push</span>(<span mix={kw}>await</span> <span mix={fn}>act</span>
        {'(res))\n}\n'}
        <span mix={comment}>// observe → repeat</span>
      </span>
      <span mix={copyTag}>Copy</span>
    </div>
  )
}

const headerRow = css({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-end',
  gap: 'var(--space-8)',
  flexWrap: 'wrap',
  padding: 'var(--section-pad-y) var(--section-pad-x) calc(var(--section-pad-y) / 2)',
})
const titleStyle = css({ maxWidth: '720px', textWrap: 'wrap' })
const introStyle = css({
  margin: 0,
  maxWidth: '380px',
  fontSize: 'var(--fs-17)',
  lineHeight: 1.6,
  color: 'var(--text-lead)',
})
const cardStyle = css({
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-6)',
  [PHONE]: { gap: 'var(--space-5)' },
})
const wellStyle = css({
  position: 'relative',
  height: '200px',
  background: 'var(--well)',
  border: 'var(--border-w) solid var(--line-hair)',
  overflow: 'hidden',
  boxSizing: 'border-box',
})
const textStyle = css({ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' })

const readArt = css({
  height: '100%',
  padding: 'var(--space-4_5)',
  boxSizing: 'border-box',
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-2_5)',
})
const bar = css({ display: 'block', height: '8px', borderRadius: 'var(--radius-4)', background: 'var(--skeleton)' })
const widths = new Map<string, ReturnType<typeof css>>()
function w(width: string) {
  let style = widths.get(width)
  if (!style) widths.set(width, (style = css({ width })))
  return style
}
const mt6 = css({ marginTop: 'var(--space-1_5)' })
const bubble = css({
  display: 'block',
  alignSelf: 'flex-end',
  marginTop: 'var(--space-1_5)',
  height: '28px',
  width: '46%',
  background: 'var(--skeleton-bubble)',
})
const promptLine = css({
  marginTop: 'auto',
  height: '34px',
  borderRadius: 'var(--radius-9)',
  border: '1px solid var(--volt-a45)',
  display: 'flex',
  alignItems: 'center',
  padding: '0 var(--space-2_5)',
  fontFamily: 'var(--font-mono)',
  fontSize: 'var(--fs-12)',
  color: 'var(--volt)',
})

const watchArt = css({ height: '100%', display: 'grid', placeItems: 'center' })
const watchDots = css({
  position: 'absolute',
  inset: 0,
  backgroundImage: 'radial-gradient(var(--ion-a18) 1px, transparent 1px)',
  backgroundSize: '14px 14px',
})
const playButton = css({
  position: 'relative',
  width: '60px',
  height: '60px',
  borderRadius: 'var(--radius-pill)',
  background: 'var(--text)',
  color: 'var(--ink)',
  display: 'grid',
  placeItems: 'center',
})
const chapters = css({
  position: 'absolute',
  left: 'var(--space-3_5)',
  right: 'var(--space-3_5)',
  bottom: 'var(--space-3_5)',
  display: 'flex',
  gap: 'var(--space-1)',
})
const chapter = css({ display: 'block', height: '4px', borderRadius: 'var(--radius-2)', background: 'var(--line-dashed-strong)' })
const chapterOn = css({ background: 'var(--ion)' })

const runArt = css({
  height: '100%',
  padding: 'var(--space-4) var(--space-4) var(--space-4) 0',
  boxSizing: 'border-box',
  display: 'grid',
  gridTemplateColumns: '36px 1fr',
  fontFamily: 'var(--font-mono)',
  fontSize: 'var(--fs-12)',
  lineHeight: 1.75,
})
const gutter = css({ color: 'var(--dim)', textAlign: 'right', paddingRight: 'var(--space-3)', whiteSpace: 'pre' })
const codeStyle = css({ whiteSpace: 'pre', color: 'var(--text-body)', overflow: 'hidden' })
const kw = css({ color: 'var(--synapse)' })
const ion = css({ color: 'var(--ion)' })
const fn = css({ color: 'var(--volt)' })
const comment = css({ color: 'var(--dim)' })
const copyTag = css({
  position: 'absolute',
  top: 'var(--space-3)',
  right: 'var(--space-3)',
  padding: '5px 9px',
  borderRadius: 'var(--radius-7)',
  background: 'var(--fill-btn)',
  color: 'var(--text)',
  fontSize: 'var(--fs-11)',
  lineHeight: 'normal',
})
