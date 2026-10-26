import type { Handle, RemixNode } from 'remix/component'
import { clientEntry, css, on } from 'remix/component'

import { Keycap } from './keycap.tsx'

export type TerminalTone = 'text' | 'muted' | 'quiet' | 'ion' | 'volt' | 'synapse'

/** A coloured run of terminal text. */
export type TerminalPart = [tone: TerminalTone, text: string]

/**
 * Entries cross the island boundary as data: `body`/`pointer` JSX may use
 * plain elements (`<code>`, `<mark>`, `<strong>`), never `mix` or components.
 */
export type TerminalEntry =
  | { kind: 'learner'; text: string }
  | { kind: 'tutor'; body: RemixNode; pointer?: RemixNode }
  | { kind: 'command'; command: string; output: TerminalPart[][]; summary?: string }

export interface TerminalReplies {
  /** Reply when the learner's line contains "hint". */
  hint: string
  /** Any other reply. */
  fallback: string
}

export interface TerminalLogProps {
  /** e.g. "~/first-agent-loop". */
  path: string
  /** e.g. "lesson 4/10 · 18% →". */
  progress?: string
  entries: TerminalEntry[]
  replies: TerminalReplies
  placeholder?: string
  /** Appended entries kept on screen. */
  keepAppended?: number
}

/**
 * Terminal-mode lesson (components §10.15): a `role="log"` of learner lines,
 * tutor blocks and command output, and a prompt input. Server-rendered
 * entries read in order with JS off; as a client entry the input appends the
 * learner's line and a canned tutor reply. Client entry.
 */
export const TerminalLog = clientEntry(
  import.meta.url,
  function TerminalLog(handle: Handle<TerminalLogProps>) {
    let appended: (TerminalEntry & { id: number })[] = []
    let count = 0
    let value = ''

    return () => {
      let { path, progress, entries, replies, placeholder = 'answer, ask, or type “hint”', keepAppended = 6 } = handle.props
      return (
        <section aria-label="Lesson" mix={termStyle}>
          <div mix={titleRow}>
            <span mix={tones.volt}>bits</span>
            <span>{path}</span>
            {progress ? <span mix={pushRight}>{progress}</span> : null}
          </div>
          <div role="log" aria-live="polite" mix={logStyle}>
            {entries.map((entry, index) => (
              <TerminalEntryView key={`s${index}`} entry={entry} />
            ))}
            {appended.map((entry) => (
              <TerminalEntryView key={`a${entry.id}`} entry={entry} rise />
            ))}
          </div>
          <form
            mix={[
              inputRow,
              on('submit', (event) => {
                event.preventDefault()
                let text = value.trim()
                if (!text) return
                let reply = /hint/i.test(text) ? replies.hint : replies.fallback
                appended = [
                  ...appended,
                  { kind: 'learner' as const, text, id: ++count },
                  { kind: 'tutor' as const, body: reply, id: ++count },
                ].slice(-keepAppended)
                value = ''
                handle.update()
              }),
            ]}
          >
            <span aria-hidden="true" mix={tones.volt}>
              ›
            </span>
            <label class="sr-only" for="terminal-input">
              Answer or ask the tutor
            </label>
            <input
              id="terminal-input"
              autocomplete="off"
              placeholder={placeholder}
              value={value}
              mix={[
                inputStyle,
                on('input', (event) => {
                  value = event.currentTarget.value
                }),
              ]}
            />
            <span aria-hidden="true" mix={enterHint}>
              ↵
            </span>
          </form>
        </section>
      )
    }
  },
)

function TerminalEntryView(handle: Handle<{ entry: TerminalEntry; rise?: boolean }>) {
  return () => {
    let { entry, rise } = handle.props
    let riseMix = rise ? riseStyle : undefined
    if (entry.kind === 'learner') {
      return (
        <p mix={[entryP, riseMix]}>
          <span aria-hidden="true" mix={tones.volt}>
            ›{' '}
          </span>
          <span class="sr-only">You: </span>
          <span mix={tones.text}>{entry.text}</span>
        </p>
      )
    }
    if (entry.kind === 'tutor') {
      return (
        <div mix={[tutorStyle, riseMix]}>
          <span mix={tones.volt}>◆ tutor</span>
          <div mix={tutorBody}>{entry.body}</div>
          {entry.pointer ? <div mix={pointerStyle}>{entry.pointer}</div> : null}
        </div>
      )
    }
    return (
      <div mix={[tutorStyle, riseMix]}>
        <p mix={entryP}>
          <span aria-hidden="true" mix={tones.synapse}>
            ${' '}
          </span>
          <span mix={tones.text}>{entry.command}</span>
        </p>
        <TerminalOutput lines={entry.output} summary={entry.summary} />
      </div>
    )
  }
}

/** The bordered command-output box inside the log. Static. */
export function TerminalOutput(handle: Handle<{ lines: TerminalPart[][]; summary?: string }>) {
  return () => (
    <div mix={outputBox}>
      {handle.props.lines.map((line, index) => (
        <div key={index} mix={preLine}>
          {line.map(([tone, text], i) => (
            <span key={i} mix={tones[tone]}>
              {text}
            </span>
          ))}
        </div>
      ))}
      {handle.props.summary ? <div mix={summaryStyle}>{handle.props.summary}</div> : null}
    </div>
  )
}

export interface OutputPanelProps {
  command: string
  /** Scripted output lines. */
  lines: TerminalPart[][]
}

/**
 * `:::terminal` block (components §10.16): Run replays the scripted output
 * line by line (120ms a line; instant under reduced motion). The full output
 * is server-rendered for JS-off readers. Client entry.
 */
export const OutputPanel = clientEntry(
  import.meta.url,
  function OutputPanel(handle: Handle<OutputPanelProps>) {
    let shown = handle.props.lines.length
    let running = false

    async function replay() {
      if (running) return
      running = true
      shown = 0
      let signal = await handle.update()
      let reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      for (let i = 1; i <= handle.props.lines.length; i++) {
        if (!reduced) await new Promise((resolve) => setTimeout(resolve, 120))
        if (signal.aborted || handle.signal.aborted) return
        shown = i
        handle.update()
      }
      running = false
      handle.update()
    }

    return () => {
      let { command, lines } = handle.props
      return (
        <div mix={panelStyle}>
          <div mix={panelHeader}>
            <span>OUTPUT</span>
            <Keycap size="sm" disabled={running} mix={on('click', () => void replay())}>
              ▶ Run
            </Keycap>
          </div>
          <div aria-live="polite" mix={panelBody}>
            <div mix={preLine}>
              <span aria-hidden="true" mix={tones.synapse}>
                ${' '}
              </span>
              <span mix={tones.text}>{command}</span>
            </div>
            {lines.slice(0, shown).map((line, index) => (
              <div key={index} mix={preLine}>
                {line.map(([tone, text], i) => (
                  <span key={i} mix={tones[tone]}>
                    {text}
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>
      )
    }
  },
)

const tones: Record<TerminalTone, ReturnType<typeof css>> = {
  text: css({ color: 'var(--text)' }),
  muted: css({ color: 'var(--muted)' }),
  quiet: css({ color: 'var(--text-quiet)' }),
  ion: css({ color: 'var(--ion)' }),
  volt: css({ color: 'var(--volt)' }),
  synapse: css({ color: 'var(--synapse)' }),
}

const termStyle = css({
  flex: '1 1 460px',
  minWidth: 0,
  display: 'flex',
  flexDirection: 'column',
  borderRadius: 'var(--radius-xl)',
  background: 'var(--terminal)',
  border: '1px solid var(--line-glass)',
  overflow: 'hidden',
  fontFamily: 'var(--font-mono)',
  fontSize: 'var(--fs-14)',
  lineHeight: 1.7,
  transition: 'border-color var(--duration-focus)',
  '&:focus-within': { borderColor: 'var(--volt-a55)' },
})
const titleRow = css({
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-3)',
  flexWrap: 'wrap',
  padding: 'var(--space-3) var(--space-4)',
  borderBottom: '1px solid var(--line-bar)',
  fontSize: 'var(--fs-12)',
  color: 'var(--muted)',
})
const pushRight = css({ marginLeft: 'auto' })
const logStyle = css({
  flex: 1,
  padding: 'var(--space-5) var(--space-5) var(--space-2)',
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-4_5)',
  color: 'var(--text-quiet)',
  '@media (max-width: 480px)': { padding: 'var(--space-4) var(--space-3_5) var(--space-2)' },
})
const entryP = css({ margin: 0, overflowWrap: 'anywhere' })
const tutorStyle = css({ display: 'flex', flexDirection: 'column', gap: 'var(--space-1_5)', minWidth: 0 })
const tutorBody = css({
  paddingLeft: 'var(--space-4_5)',
  whiteSpace: 'pre-wrap',
  color: 'var(--text-body)',
  '& code': { color: 'var(--ion)', fontFamily: 'inherit' },
  '& mark': { color: 'var(--text)', background: 'var(--volt-a14)', padding: '0 var(--space-1)', borderRadius: 'var(--radius-4)' },
})
const pointerStyle = css({ paddingLeft: 'var(--space-4_5)', color: 'var(--muted)', '& strong': { color: 'var(--text)', fontWeight: 400 } })
const riseStyle = css({
  animation: 'bits-rise var(--duration-sigil) var(--ease) both',
  '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
})
const outputBox = css({
  marginLeft: 'var(--space-4_5)',
  padding: 'var(--space-3) var(--space-3_5)',
  borderRadius: 'var(--radius-10)',
  background: 'var(--surface)',
  border: '1px solid var(--line-hair)',
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-0_5)',
  fontSize: 'var(--fs-13)',
  overflowX: 'auto',
  '@media (max-width: 480px)': { marginLeft: 0 },
})
const preLine = css({ whiteSpace: 'pre' })
const summaryStyle = css({ marginTop: 'var(--space-1_5)', color: 'var(--muted)' })
const inputRow = css({
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-2_5)',
  margin: 'var(--space-3)',
  padding: '0 var(--space-2) 0 var(--space-3_5)',
  borderRadius: 'var(--radius-12)',
  background: 'var(--surface)',
  border: '1px solid var(--volt-a35)',
  '&:focus-within': { borderColor: 'var(--volt-a70)', boxShadow: 'var(--focus-ring)' },
})
const inputStyle = css({
  flex: 1,
  minWidth: 0,
  height: '50px',
  background: 'transparent',
  border: 0,
  outline: 'none',
  color: 'var(--text)',
  fontFamily: 'var(--font-mono)',
  fontSize: 'var(--fs-14)',
  '&::placeholder': { color: 'var(--dim)' },
})
const enterHint = css({ fontSize: 'var(--fs-12)', color: 'var(--dim)' })

const panelStyle = css({
  borderRadius: 'var(--radius-xl)',
  background: 'var(--terminal)',
  border: '1px solid var(--line-glass)',
  overflow: 'hidden',
})
const panelHeader = css({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 'var(--space-3)',
  padding: 'var(--space-2_5) var(--space-4)',
  borderBottom: '1px solid var(--line-bar)',
  fontFamily: 'var(--font-mono)',
  fontSize: 'var(--fs-12)',
  color: 'var(--muted)',
})
const panelBody = css({
  padding: 'var(--space-3_5) var(--space-4)',
  fontFamily: 'var(--font-mono)',
  fontSize: 'var(--fs-13)',
  lineHeight: 1.8,
  color: 'var(--text-quiet)',
  overflowX: 'auto',
  minHeight: '120px',
})
