import type { Handle, RemixNode } from 'remix/component'
import { clientEntry, css, on, ref } from 'remix/component'
import * as tabs from '@remix-run/ui/tabs'

import { Keycap } from './keycap.tsx'
import { stackStyle } from './lib/stable.tsx'
import { ToolButton } from './tool-button.tsx'

export type SyntaxKind = 'keyword' | 'string' | 'type' | 'function' | 'plain' | 'comment' | 'number' | 'punct'

/** One coloured run of text. Build-time highlighting maps Shiki scopes to these kinds. */
export type CodeSegment = [kind: SyntaxKind, text: string]

export interface CodeFile {
  name: string
  /** Badge before the filename, e.g. "TS" or "#". */
  badge: string
  badgeTone?: 'ion' | 'muted'
  /** Language name in the status bar, e.g. "TypeScript". */
  language: string
  lines: CodeSegment[][]
}

export interface CodeEditorProps {
  files: CodeFile[]
  /** Highlighted line range (1-based, inclusive) on the first file, with a status label. */
  highlight?: { from: number; to: number; label: string }
  /** The single emphasised line inside the range. */
  focusLine?: number
  /** Allow "Type it" mode on the first file. */
  typeMode?: boolean
  /** Style-guide only: open in type mode with this many characters typed. */
  initialTyped?: string
  /** Style-guide only: show the copy key in its "Copied ✓" state. */
  initialCopied?: boolean
}

function fileText(file: CodeFile): string {
  return file.lines.map((line) => line.map(([, text]) => text).join('')).join('\n')
}

/**
 * The `:::code` editor (components §10.14): file tabs (`@remix-run/ui/tabs`,
 * real ARIA tabs with arrow-key roving), highlighted line range + focus line,
 * Copy keycap (Copy → Copied ✓ for 1.6s → Copy off in type mode) and Type
 * mode (retype the first file from memory; accuracy and characters update
 * live). The first file renders statically with JS off; Copy stays disabled
 * until hydrated. Client entry.
 */
export const CodeEditor = clientEntry(
  import.meta.url,
  function CodeEditor(handle: Handle<CodeEditorProps>) {
    let hydrated = false
    let activeTab = handle.props.files[0]?.name ?? ''
    let copied = handle.props.initialCopied ?? false
    let typing = handle.props.initialTyped !== undefined
    let typed = handle.props.initialTyped ?? ''
    let input: HTMLTextAreaElement | undefined
    let copyTimer: ReturnType<typeof setTimeout> | undefined

    handle.queueTask(() => {
      hydrated = true
      handle.update()
    })
    handle.signal.addEventListener('abort', () => clearTimeout(copyTimer))

    async function copy() {
      let file = handle.props.files.find((f) => f.name === activeTab) ?? handle.props.files[0]
      if (!file) return
      try {
        await navigator.clipboard.writeText(fileText(file))
      } catch {
        return
      }
      copied = true
      handle.update()
      clearTimeout(copyTimer)
      copyTimer = setTimeout(() => {
        copied = false
        handle.update()
      }, 1600)
    }

    return () => {
      let { files, highlight, focusLine, typeMode = true } = handle.props
      let first = files[0]
      let source = first ? fileText(first) : ''
      let correct = 0
      for (let i = 0; i < typed.length; i++) if (typed[i] === source[i]) correct++
      let accuracy = typed.length ? Math.round((correct / typed.length) * 100) : 100
      let active = files.find((f) => f.name === activeTab) ?? first
      let cursorLine = source.slice(0, typed.length).split('\n').length

      return (
        <div mix={editorStyle}>
          <tabs.Context
            defaultActiveTab={first?.name}
            onActiveTabChange={(name) => {
              activeTab = name
              handle.update()
            }}
          >
            <div mix={[rootStyle, tabs.root()]}>
              <div mix={toolbarStyle}>
                <div aria-label="Files" mix={[fileTabsStyle, tabs.list()]}>
                  {files.map((file) => (
                    <button key={file.name} type="button" mix={[fileTabStyle, tabs.tab({ name: file.name })]}>
                      <span aria-hidden="true" mix={file.badgeTone === 'muted' ? badgeMuted : badgeIon}>
                        {file.badge}
                      </span>
                      {file.name}
                    </button>
                  ))}
                </div>
                <div mix={actionsStyle}>
                  {typeMode ? (
                    <ToolButton
                      pressed={typing}
                      disabled={!hydrated}
                      mix={on('click', async () => {
                        typing = !typing
                        if (typing) copied = false
                        await handle.update()
                        if (typing) input?.focus()
                      })}
                    >
                      ⌨ Type it
                    </ToolButton>
                  ) : null}
                  <Keycap
                    size="sm"
                    variant={copied ? 'ion' : 'primary'}
                    disabled={!hydrated || typing}
                    mix={on('click', () => void copy())}
                  >
                    {typing ? 'Copy off' : copied ? 'Copied ✓' : 'Copy'}
                  </Keycap>
                </div>
              </div>
              {typing ? (
                <div aria-live="polite" mix={bannerStyle}>
                  <span>Type mode — retype the code from memory. Copy is off.</span>
                  <span mix={bannerStats}>{`${typed.length} / ${source.length} chars · ${accuracy}% accurate`}</span>
                </div>
              ) : null}
              {/* Panels share one grid cell: the editor is as tall as its longest file, so switching tabs never moves the page (decision 023). */}
              <div mix={[stackStyle, panelsStyle]}>
                {files.map((file, fileIndex) => (
                  <div key={file.name} mix={[panelStyle, tabs.panel({ name: file.name })]}>
                    <div
                      role="region"
                      aria-label={file.name}
                      mix={[codeAreaStyle, typing && fileIndex === 0 ? on('click', () => input?.focus()) : undefined]}
                    >
                      <div mix={codeInner}>
                        {file.lines.map((line, index) => {
                          let n = index + 1
                          let state =
                            fileIndex !== 0 || !highlight
                              ? 'normal'
                              : n === focusLine
                                ? 'focus'
                                : n >= highlight.from && n <= highlight.to
                                  ? 'range'
                                  : 'normal'
                          let ghost = typing && fileIndex === 0 && n > cursorLine
                          return (
                            <div key={n} data-line={state} data-ghost={ghost ? 'true' : undefined} mix={lineStyle}>
                              <span aria-hidden="true" mix={markerStyle} />
                              <span aria-hidden="true" mix={gutterStyle}>
                                {String(n)}
                              </span>
                              <span mix={codeStyle}>
                                {typing && fileIndex === 0 && n <= cursorLine
                                  ? renderTypedLine(file, index, source, typed)
                                  : line.map(([kind, text], i) => (
                                      <span key={i} mix={syntax[kind]}>
                                        {text}
                                      </span>
                                    ))}
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {typing ? (
                <textarea
                  aria-label={`Type ${first?.name ?? 'the code'}`}
                  autocomplete="off"
                  autocapitalize="off"
                  spellcheck={false}
                  value={typed}
                  mix={[
                    typeInputStyle,
                    ref((node) => (input = node)),
                    on('input', (event) => {
                      typed = event.currentTarget.value.slice(0, source.length)
                      handle.update()
                    }),
                    on('keydown', (event) => {
                      if (event.key === 'Tab') {
                        event.preventDefault()
                        typed = (typed + '  ').slice(0, source.length)
                        handle.update()
                      }
                    }),
                  ]}
                />
              ) : null}
              <div mix={statusStyle}>
                <span>{active?.language ?? ''}</span>
                <span>UTF-8</span>
                {highlight && activeTab === first?.name ? (
                  <span mix={statusRange}>{`● lines ${highlight.from}–${highlight.to}: ${highlight.label}`}</span>
                ) : null}
              </div>
            </div>
          </tabs.Context>
        </div>
      )
    }
  },
)

/** One line of the first file in type mode: typed chars (mismatches in warn), caret, ghosted rest. */
function renderTypedLine(file: CodeFile, index: number, source: string, typed: string): RemixNode {
  let start = 0
  for (let i = 0; i < index; i++) start += file.lines[i]!.reduce((sum, [, text]) => sum + text.length, 0) + 1
  let text = file.lines[index]!.map(([, t]) => t).join('')
  let typedHere = typed.slice(start, start + text.length)
  let cursorHere = typed.length >= start && typed.length <= start + text.length
  let parts: RemixNode[] = []
  for (let i = 0; i < typedHere.length; i++) {
    let wrong = typedHere[i] !== source[start + i]
    parts.push(
      <span key={`t${i}`} mix={wrong ? wrongChar : typedChar}>
        {typedHere[i] === ' ' && wrong ? '·' : typedHere[i]}
      </span>,
    )
  }
  if (cursorHere) {
    parts.push(
      <span key="caret" aria-hidden="true" mix={caretStyle}>
        ▍
      </span>,
    )
  }
  parts.push(
    <span key="rest" mix={restStyle}>
      {text.slice(typedHere.length)}
    </span>,
  )
  return parts
}

const editorStyle = css({
  display: 'flex',
  flexDirection: 'column',
  minWidth: 0,
  borderRadius: 'var(--radius-xl)',
  background: 'var(--well)',
  border: '1px solid var(--line-glass)',
  overflow: 'hidden',
  boxShadow: 'var(--shadow-editor)',
})
const rootStyle = css({ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0, position: 'relative' })
const toolbarStyle = css({
  display: 'flex',
  alignItems: 'stretch',
  flexWrap: 'wrap',
  borderBottom: '1px solid var(--line-bar)',
  background: 'var(--ink)',
})
const fileTabsStyle = css({ display: 'flex', fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-13)', overflowX: 'auto' })
const fileTabStyle = css({
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-2)',
  padding: '0 var(--space-4)',
  minHeight: '46px',
  border: 0,
  borderRight: '1px solid var(--line-bar)',
  background: 'transparent',
  color: 'var(--muted)',
  font: 'inherit',
  whiteSpace: 'nowrap',
  cursor: 'pointer',
  '&:last-child': { borderRight: 0 },
  '&:hover': { color: 'var(--text)' },
  '&[aria-selected="true"]': { background: 'var(--well)', color: 'var(--text)', boxShadow: 'var(--tab-active-top)' },
  '&:focus-visible': { outline: '2px solid var(--focus-ring-color)', outlineOffset: '-2px' },
})
const badgeIon = css({ color: 'var(--ion)' })
const badgeMuted = css({ color: 'var(--muted)' })
const actionsStyle = css({
  marginLeft: 'auto',
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-2)',
  padding: 'var(--space-1_5) var(--space-2_5)',
})
const bannerStyle = css({
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-3)',
  flexWrap: 'wrap',
  padding: 'var(--space-2_5) var(--space-4)',
  background: 'var(--volt-a08)',
  borderBottom: '1px solid var(--volt-a25)',
  fontFamily: 'var(--font-mono)',
  fontSize: 'var(--fs-12)',
  color: 'var(--volt-soft)',
  animation: 'bits-rise var(--duration-sigil) var(--ease) both',
  '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
})
const bannerStats = css({ marginLeft: 'auto', color: 'var(--text)', fontVariantNumeric: 'tabular-nums' })
const panelsStyle = css({ flex: 1 })
// A hidden panel keeps its box (invisible, out of the a11y tree and tab order).
const panelStyle = css({ minWidth: 0, '&[hidden]': { display: 'block', visibility: 'hidden' } })
const codeAreaStyle = css({ overflowX: 'auto', padding: 'var(--space-3_5) 0 var(--space-4_5)' })
const codeInner = css({
  minWidth: '560px',
  fontFamily: 'var(--font-mono)',
  fontSize: 'var(--fs-14)',
  lineHeight: 1.75,
  '@media (max-width: 480px)': { fontSize: 'var(--fs-13)' },
})
const lineStyle = css({
  display: 'flex',
  '&:hover': { background: 'var(--fill-codeline-hover)' },
  '&[data-line="range"]': { background: 'var(--volt-a035)' },
  '&[data-line="focus"]': { background: 'var(--volt-tint)' },
  '&[data-ghost]': { opacity: 0.28 },
})
const markerStyle = css({
  flex: 'none',
  width: '4px',
  '[data-line="range"] > &': { background: 'var(--volt-a35)' },
  '[data-line="focus"] > &': { background: 'var(--volt)' },
})
// Resolutions §6: line numbers outside the highlighted range use --dim.
const gutterStyle = css({
  flex: 'none',
  width: '44px',
  paddingRight: 'var(--space-4)',
  textAlign: 'right',
  color: 'var(--dim)',
  userSelect: 'none',
  '[data-line="range"] > &': { color: 'var(--muted)' },
  '[data-line="focus"] > &': { color: 'var(--volt)' },
  '@media (max-width: 480px)': { width: '36px', paddingRight: 'var(--space-3)' },
})
const codeStyle = css({ whiteSpace: 'pre', paddingRight: 'var(--space-4)' })
const syntax: Record<SyntaxKind, ReturnType<typeof css>> = {
  keyword: css({ color: 'var(--syntax-keyword)' }),
  string: css({ color: 'var(--syntax-string)' }),
  type: css({ color: 'var(--syntax-type)' }),
  function: css({ color: 'var(--syntax-function)' }),
  plain: css({ color: 'var(--syntax-plain)' }),
  comment: css({ color: 'var(--syntax-comment)' }),
  number: css({ color: 'var(--syntax-number)' }),
  punct: css({ color: 'var(--text-quiet)' }),
}
const typedChar = css({ color: 'var(--text)' })
const wrongChar = css({ color: 'var(--warn)', background: 'var(--warn-tint)', borderRadius: '2px' })
const restStyle = css({ color: 'var(--muted)', opacity: 0.5 })
const caretStyle = css({
  color: 'var(--volt)',
  marginRight: '-0.6em',
  animation: 'bits-blink var(--duration-caret) steps(1) infinite',
  '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
})
const typeInputStyle = css({
  position: 'absolute',
  width: '1px',
  height: '1px',
  opacity: 0,
  left: 0,
  top: 0,
  pointerEvents: 'none',
})
const statusStyle = css({
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-4)',
  flexWrap: 'wrap',
  padding: 'var(--space-2) var(--space-4)',
  borderTop: '1px solid var(--line-bar)',
  background: 'var(--ink)',
  fontFamily: 'var(--font-mono)',
  fontSize: 'var(--fs-12)',
  color: 'var(--muted)',
})
const statusRange = css({ marginLeft: 'auto', color: 'var(--volt)' })
