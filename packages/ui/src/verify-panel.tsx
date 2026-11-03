import type { Handle } from 'remix/component'
import { clientEntry, css, on, ref } from 'remix/component'

import { CheckChip, checkListStyle } from './check-chip.tsx'
import { Keycap } from './keycap.tsx'
import { announceGate } from './lib/ask-client.ts'
import { fieldFrameStyle, fieldGlyphStyle, fieldInputStyle, fieldKeyedStyle } from './lib/field.ts'
import { FORCED_COLORS } from './lib/states.ts'
import { postVerify, type VerifyEndpoint, type VerifyVerdict } from './lib/verify-client.ts'
import { toyHeaderStyle, toyLabelStyle, toyPanelStyle } from './toy-panel.tsx'

export interface VerifyPanelProps {
  /** The block's id: the panel is `#verify-<id>`. */
  id: string
  /** What the deployed Worker must do. */
  goal: string
  /** The block's text: what to paste, where to find it. */
  task?: string
  /** The path bits calls on the learner's origin. */
  path: string
  /** Every check's label, the status check first (the patterns stay on the server). */
  checks: string[]
  /** Neurons the block is worth, earned with the lesson save. */
  xp: number
  /**
   * Where checks run (`/api/verify`). The panel is also a native form posting
   * to it, so it works before hydration and without JS (the server redirects
   * back with the verdict). Absent: the author preview, which can't check.
   */
  endpoint?: VerifyEndpoint
  /** A verdict the server already gave (a native check, flashed back). */
  initial?: VerifyVerdict
  /** Why the server refused the URL a native check sent (flashed back). */
  initialError?: string
  /** The field's starting value: the origin this browser checked last, or the URL a refused native check sent. */
  defaultUrl?: string
  /** Passed before (this browser's session). */
  passed?: boolean
  /** Mono label in the strip (default "deploy check"). */
  label?: string
}

/**
 * A check of the learner's deployed Worker (decision 072): the goal, the
 * path bits will call, a URL field and a Check key. The server calls the
 * Worker (the browser never does), runs the checks and sends back each
 * one's result and one hint, announced in a polite region. A pass opens
 * the lesson's gate (`bits:gate`); the neurons come with the lesson save.
 * Client entry; without JS the form posts natively and the server
 * redirects back with the verdict.
 */
export const VerifyPanel = clientEntry(
  import.meta.url,
  function VerifyPanel(handle: Handle<VerifyPanelProps>) {
    let hydrated = false
    let verdict: VerifyVerdict | undefined = handle.props.initial
    let error: string | undefined = handle.props.initialError
    let passed = Boolean(handle.props.passed || handle.props.initial?.passed)
    let pending = false
    let field: HTMLInputElement | undefined
    let inflight: AbortController | undefined
    handle.signal.addEventListener('abort', () => inflight?.abort())

    handle.queueTask(() => {
      hydrated = true
      // A pass the server flashed back still opens the gate.
      if (handle.props.initial?.passed) announceGate(handle.props.id)
      handle.update()
    })

    async function check() {
      let endpoint = handle.props.endpoint
      let url = field?.value.trim() ?? ''
      if (!endpoint || pending) return
      if (!url) {
        error = 'Paste your Worker’s https://….workers.dev URL first.'
        verdict = undefined
        handle.update()
        field?.focus({ preventScroll: true })
        return
      }
      pending = true
      error = undefined
      handle.update()
      inflight?.abort()
      let controller = (inflight = new AbortController())
      let result
      try {
        result = await postVerify(endpoint, url, controller.signal)
      } catch {
        return
      } finally {
        if (inflight === controller) inflight = undefined
        pending = false
      }
      if (result.ok) {
        verdict = result.verdict
        if (result.verdict.passed && !passed) {
          passed = true
          announceGate(handle.props.id)
        }
      } else {
        verdict = undefined
        error = result.message
      }
      await handle.update()
      field?.focus({ preventScroll: true })
    }

    return () => {
      let { id, goal, task, path, checks, xp, endpoint, defaultUrl, label = 'deploy check' } = handle.props
      let base = `verify-${id}`
      let fieldId = `${base}-url`
      let goalId = `${base}-goal`
      let errorId = `${base}-error`
      let live = Boolean(endpoint)
      let results = verdict?.checks.length ? verdict.checks : undefined
      return (
        <form
          id={base}
          method="post"
          action={endpoint?.action}
          aria-labelledby={goalId}
          // A native check comes back as this same lesson: keep focus, the
          // scroll and the history where they are (as the quick check does).
          data-rmx-reset-focus="manual"
          data-rmx-reset-scroll="manual"
          data-rmx-history="replace"
          mix={[
            toyPanelStyle,
            wrapStyle,
            on('submit', (event) => {
              if (!hydrated) return
              event.preventDefault()
              void check()
            }),
          ]}
        >
          <div mix={[toyHeaderStyle, headerStyle]}>
            <span mix={[toyLabelStyle, labelTone]}>{label}</span>
            <span mix={xpStyle}>{passed ? '✓ live' : xp > 0 ? `+${xp} neurons` : ''}</span>
          </div>
          <div mix={bodyStyle}>
            <p id={goalId} mix={goalStyle}>
              <span mix={goalLabel}>Goal </span>
              {goal}
            </p>
            {task ? <p mix={taskStyle}>{task}</p> : null}
            <p mix={callStyle}>
              <span class="sr-only">bits calls </span>
              <span aria-hidden="true">GET </span>
              <code>{path}</code>
              <span mix={callNote}> on your Worker, from bits’ server</span>
            </p>
            <ul aria-label="Checks" mix={checkListStyle}>
              {results
                ? results.map((result) => (
                    <CheckChip key={result.label} passed={result.met} compact>
                      {result.label}
                    </CheckChip>
                  ))
                : checks.map((name) => (
                    <CheckChip key={name} passed={passed} compact>
                      {name}
                    </CheckChip>
                  ))}
            </ul>
          </div>
          <div mix={composerStyle}>
            <label for={fieldId} mix={fieldLabel}>
              Your Worker’s URL
            </label>
            {/* The shared field (decision 051): mono 16px, the Check key inside the frame. */}
            <div mix={[fieldFrameStyle, fieldKeyedStyle]}>
              <span aria-hidden="true" mix={fieldGlyphStyle}>
                ›
              </span>
              <input
                id={fieldId}
                type="url"
                name={endpoint?.urlField}
                defaultValue={defaultUrl}
                placeholder="https://klippy.your-name.workers.dev"
                disabled={!live}
                inputMode="url"
                autoComplete="url"
                autoCapitalize="none"
                spellCheck={false}
                enterkeyhint="go"
                maxLength={300}
                aria-invalid={error ? 'true' : undefined}
                aria-describedby={error ? errorId : undefined}
                mix={[fieldInputStyle, inputStyle, ref((node) => (field = node))]}
              />
              <Keycap type="submit" size="md" disabled={!live} loading={pending} mix={checkKeyStyle}>
                Check ↵
              </Keycap>
            </div>
            {endpoint
              ? Object.entries(endpoint.fields).map(([name, value]) => <input key={name} type="hidden" name={name} value={value} />)
              : null}
            {/* Mounted empty, so each verdict is announced as it lands (decision 031). */}
            <div aria-live="polite" mix={resultStyle}>
              {pending ? (
                <p aria-busy="true" mix={checkingStyle}>
                  Calling your Worker…
                </p>
              ) : error ? (
                <p id={errorId} mix={[verdictStyle, wrongStyle, errorText]}>
                  {error}
                </p>
              ) : verdict ? (
                <div data-passed={verdict.passed ? 'true' : 'false'} mix={[verdictStyle, verdict.passed ? rightStyle : wrongStyle]}>
                  <p mix={verdictHead}>
                    <span aria-hidden="true">{verdict.passed ? '✓ ' : '✗ '}</span>
                    {verdict.passed ? 'Your Worker passed' : 'Not yet'}
                    <span mix={verdictMeta}>
                      {` · ${verdict.origin}${verdict.path}${verdict.status !== undefined ? ` · ${verdict.status}` : ''} · ${verdict.ms} ms`}
                    </span>
                  </p>
                  <p mix={hintStyle}>{verdict.hint}</p>
                  {verdict.passed ? (
                    <p mix={noteStyle}>
                      {xp > 0 ? `Complete the lesson to keep the ${xp} neurons. ` : ''}
                      This proves a Worker at that address answers; it doesn’t prove who wrote it.
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>
            {!live ? <p mix={noteStyle}>Deploys are checked on the published lesson.</p> : null}
          </div>
        </form>
      )
    }
  },
)

// The prompt window's frame (as the AskPanel's): a well with the volt
// "your turn" hairline.
const wrapStyle = css({ background: 'var(--well)', borderColor: 'var(--volt-a40)', scrollMarginTop: 'calc(var(--shell-h, 0px) + var(--space-4))' })
const headerStyle = css({ paddingInline: 'var(--space-4)', '@media (max-width: 480px)': { paddingInline: 'var(--space-3)' } })
const labelTone = css({ color: 'var(--ion)' })
const xpStyle = css({ fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-12)', color: 'var(--volt-soft)' })
const bodyStyle = css({
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-3)',
  padding: 'var(--space-4)',
  background: 'var(--surface)',
  borderBottom: 'var(--border-w) solid var(--line-cell)',
  '@media (max-width: 480px)': { paddingInline: 'var(--space-3)' },
})
const goalStyle = css({ margin: 0, fontSize: 'var(--fs-15)', lineHeight: 1.55, color: 'var(--text)' })
const goalLabel = css({ fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-12)', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em' })
const taskStyle = css({ margin: 0, fontSize: 'var(--fs-15)', lineHeight: 1.55, color: 'var(--text-body)' })
const callStyle = css({
  margin: 0,
  fontFamily: 'var(--font-mono)',
  fontSize: 'var(--fs-13)',
  color: 'var(--text)',
  overflowWrap: 'anywhere',
  '& code': { fontFamily: 'inherit', color: 'var(--ion)' },
})
const callNote = css({ color: 'var(--muted)' })
const composerStyle = css({
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-3)',
  padding: 'var(--space-4)',
  '@media (max-width: 480px)': { padding: 'var(--space-3_5) var(--space-3)' },
})
const fieldLabel = css({ fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-13)', color: 'var(--text-body)' })
const inputStyle = css({ '&:disabled': { cursor: 'not-allowed' } })
const checkKeyStyle = css({ flex: 'none' })
const resultStyle = css({ display: 'flex', flexDirection: 'column', '&:empty': { display: 'contents' } })
const checkingStyle = css({ margin: 0, fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-13)', color: 'var(--muted)' })
const verdictStyle = css({
  margin: 0,
  padding: 'var(--space-3) var(--space-4)',
  border: 'var(--border-w) solid var(--line-panel)',
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-2)',
  fontSize: 'var(--fs-15)',
  lineHeight: 1.55,
  color: 'var(--text-body)',
})
const rightStyle = css({
  borderColor: 'var(--volt-a45)',
  background: 'var(--volt-tint-on)',
  boxShadow: 'inset 2px 0 0 var(--volt)',
  [FORCED_COLORS]: { borderLeftWidth: '3px' },
})
const wrongStyle = css({
  borderColor: 'var(--warn-line)',
  background: 'var(--warn-tint)',
  boxShadow: 'inset 2px 0 0 var(--warn)',
  [FORCED_COLORS]: { borderLeftWidth: '3px' },
})
const errorText = css({ color: 'var(--text)' })
const verdictHead = css({
  margin: 0,
  fontFamily: 'var(--font-mono)',
  fontSize: 'var(--fs-13)',
  color: 'var(--text)',
  overflowWrap: 'anywhere',
  '[data-passed="true"] > &': { color: 'var(--volt-soft)' },
  '[data-passed="false"] > &': { color: 'var(--warn)' },
})
const verdictMeta = css({ color: 'var(--muted)' })
const hintStyle = css({ margin: 0 })
const noteStyle = css({ margin: 0, fontSize: 'var(--fs-13)', color: 'var(--muted)' })
