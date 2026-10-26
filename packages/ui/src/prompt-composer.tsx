import type { Handle } from 'remix/component'
import { clientEntry, css, on, ref } from 'remix/component'

import { CheckChip, checkListStyle } from './check-chip.tsx'
import { Keycap } from './keycap.tsx'
import { FOCUS_WITHIN } from './lib/states.ts'
import { TEMPERATURE_EVENT } from './odds-bars.tsx'
import { announceReward, RewardToast, type RewardNext } from './reward-toast.tsx'
import { Tag } from './tag.tsx'
import { LearnerBubble, ModelOutput } from './tutor.tsx'

/** A regex as plain data, so it can cross the island boundary. */
export interface PatternSource {
  source: string
  flags?: string
}

export interface PromptCheck {
  label: string
  /** Every pattern must match the draft. */
  patterns?: PatternSource[]
  /** Passes once the learner has run at each of these temperatures (× 100). */
  ranAt?: number[]
}

export interface TemperatureOption {
  /** T × 100. */
  value: number
  label: string
}

export interface PromptComposerProps {
  /** Unique per lesson exercise; keys the saved draft and the field ids. */
  id: string
  task: string
  placeholder?: string
  checks: PromptCheck[]
  temperatures?: TemperatureOption[]
  /** Canned outputs per temperature value, cycled per run (example output, no model). */
  examples?: Record<string, string[]>
  /** Reward shown once every check passes. */
  reward?: { xp: number; message: string; next?: RewardNext }
  /** Max runs kept on screen. */
  keepRuns?: number
  /** Style-guide only: render the focused composer look. */
  forceFocus?: boolean
}

interface Run {
  id: number
  prompt: string
  temperature: TemperatureOption
  output?: string
  tokens: number
}

export function draftTokens(text: string): number {
  return Math.max(1, Math.round(text.length / 4))
}

export function checkPasses(check: PromptCheck, draft: string, ranAt: Set<number>): boolean {
  if (check.ranAt && !check.ranAt.every((t) => ranAt.has(t))) return false
  if (check.patterns && !check.patterns.every((p) => new RegExp(p.source, p.flags).test(draft))) return false
  return Boolean(check.patterns || check.ranAt)
}

const DEFAULT_TEMPS: TemperatureOption[] = [
  { value: 0, label: '0' },
  { value: 70, label: '0.7' },
  { value: 100, label: '1.0' },
]

/**
 * The prompt exercise (components §10.9): textarea, live CheckChips, the
 * "run at" temperature radiogroup, a token estimate and the Run key. Enter
 * runs, Shift+Enter adds a newline. Runs append a LearnerBubble + example
 * ModelOutput (last four kept); when every check passes a RewardToast pops
 * above the composer and `bits:reward` fires. The draft is kept in
 * localStorage. With JS off the composer renders with Run disabled and a
 * note. Client entry.
 */
export const PromptComposer = clientEntry(
  import.meta.url,
  function PromptComposer(handle: Handle<PromptComposerProps>) {
    let hydrated = false
    let draft = ''
    let temperature = (handle.props.temperatures ?? DEFAULT_TEMPS)[0]!
    let runs: Run[] = []
    let ranAt = new Set<number>()
    let running = false
    let rewarded = false
    let runCount = 0
    let textarea: HTMLTextAreaElement | undefined

    let storageKey = () => `bits:draft:${handle.props.id}`

    handle.queueTask(() => {
      try {
        draft = window.localStorage.getItem(storageKey()) ?? ''
      } catch {
        draft = ''
      }
      hydrated = true
      handle.update()
    })

    function saveDraft() {
      try {
        window.localStorage.setItem(storageKey(), draft)
      } catch {
        // Storage can be unavailable (private mode); the draft just isn't kept.
      }
    }

    function allPassed() {
      return handle.props.checks.every((check) => checkPasses(check, draft, ranAt))
    }

    async function run() {
      let prompt = draft.trim()
      if (!prompt || running) return
      running = true
      let id = ++runCount
      let examples = handle.props.examples?.[String(temperature.value)] ?? []
      let entry: Run = { id, prompt, temperature, tokens: 0 }
      runs = [...runs, entry].slice(-(handle.props.keepRuns ?? 4))
      let signal = await handle.update()
      await new Promise((resolve) => setTimeout(resolve, 450))
      if (signal.aborted || handle.signal.aborted) return
      let output = examples.length ? examples[(id - 1) % examples.length]! : 'A bright idea, brewed under moonlight.'
      entry.output = output
      entry.tokens = draftTokens(output)
      ranAt.add(temperature.value)
      running = false
      window.dispatchEvent(new CustomEvent('bits:run', { detail: { prompt, temperature: temperature.value } }))
      let reward = handle.props.reward
      if (reward && !rewarded && allPassed()) {
        rewarded = true
        announceReward(reward)
      }
      await handle.update()
      textarea?.focus()
    }

    return () => {
      let { id, task, placeholder = 'Write a tagline for…', checks, temperatures = DEFAULT_TEMPS, reward, forceFocus } = handle.props
      let empty = draft.trim() === ''
      let fieldId = `${id}-prompt`
      let tokens = draftTokens(draft)
      return (
        <div mix={wrapStyle}>
          {runs.length ? (
            <ol aria-label="Your runs" aria-live="polite" mix={runsStyle}>
              {runs.map((entry) => (
                <li key={entry.id} mix={runStyle}>
                  <LearnerBubble>{entry.prompt}</LearnerBubble>
                  <ModelOutput
                    temperature={entry.temperature.label}
                    tokens={entry.tokens}
                    state={entry.output === undefined ? 'streaming' : 'example'}
                  >
                    {entry.output ?? ''}
                  </ModelOutput>
                </li>
              ))}
            </ol>
          ) : null}
          <div role="status" mix={toastSlot}>
            {rewarded && reward ? <RewardToast xp={reward.xp} message={reward.message} next={reward.next} animate /> : null}
          </div>
          <form
            data-force={forceFocus ? 'focus' : undefined}
            mix={[
              composerStyle,
              on('submit', (event) => {
                event.preventDefault()
                void run()
              }),
            ]}
          >
            <div mix={headerStyle}>
              <Tag variant="your-turn">Your turn</Tag>
              <label for={fieldId} mix={taskStyle}>
                {task}
              </label>
            </div>
            <textarea
              id={fieldId}
              name="prompt"
              rows={3}
              placeholder={placeholder}
              value={draft}
              readOnly={running}
              aria-describedby={`${id}-checks`}
              mix={[
                textareaStyle,
                ref((node) => (textarea = node)),
                on('input', (event) => {
                  draft = event.currentTarget.value
                  saveDraft()
                  handle.update()
                }),
                on('keydown', (event) => {
                  if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
                    event.preventDefault()
                    event.currentTarget.form?.requestSubmit()
                  }
                }),
              ]}
            />
            <ul id={`${id}-checks`} aria-label="Checks" mix={checkListStyle}>
              {checks.map((check) => (
                <CheckChip key={check.label} passed={hydrated && checkPasses(check, draft, ranAt)}>
                  {check.label}
                </CheckChip>
              ))}
            </ul>
            <div mix={footerStyle}>
              <fieldset mix={tempsStyle}>
                <legend mix={runAtStyle}>run at</legend>
                <div mix={tempOptions}>
                  {temperatures.map((option) => (
                    <label key={option.value} mix={tempStyle}>
                      <input
                        type="radio"
                        name="temperature"
                        value={String(option.value)}
                        checked={option.value === temperature.value}
                        class="sr-only"
                        mix={on('change', () => {
                          temperature = option
                          window.dispatchEvent(new CustomEvent(TEMPERATURE_EVENT, { detail: option.value }))
                          handle.update()
                        })}
                      />
                      {option.label}
                    </label>
                  ))}
                </div>
              </fieldset>
              <span mix={tokensStyle}>
                {hydrated ? `~${tokens} tokens` : '~0 tokens'}
              </span>
              <Keycap
                type="submit"
                size="md"
                disabled={!hydrated || running}
                mix={[runKeyStyle, empty && hydrated ? emptyKeyStyle : undefined]}
              >
                {running ? 'Running…' : 'Run ↵'}
              </Keycap>
            </div>
            {hydrated ? null : <p mix={noJsStyle}>Turn on JavaScript to run prompts.</p>}
          </form>
        </div>
      )
    }
  },
)

const wrapStyle = css({ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', minWidth: 0 })
const runsStyle = css({ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' })
const runStyle = css({ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', animation: 'bits-rise var(--duration-sigil) var(--ease) both', '@media (prefers-reduced-motion: reduce)': { animation: 'none' } })
const toastSlot = css({ '&:empty': { display: 'none' } })

const composerStyle = css({
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-3)',
  padding: 'var(--space-4)',
  borderRadius: 'var(--radius-xl)',
  background: 'var(--well)',
  border: '1px solid var(--volt-a40)',
  transition: 'border-color var(--duration-focus), box-shadow var(--duration-focus)',
  [FOCUS_WITHIN]: { borderColor: 'var(--volt-a75)', boxShadow: 'var(--focus-ring)' },
})
const headerStyle = css({ display: 'flex', alignItems: 'center', gap: 'var(--space-2_5)', flexWrap: 'wrap' })
const taskStyle = css({ fontSize: 'var(--fs-14)', color: 'var(--muted)' })
const textareaStyle = css({
  resize: 'vertical',
  minHeight: '84px',
  padding: 0,
  background: 'transparent',
  border: 0,
  color: 'var(--text)',
  fontFamily: 'var(--font-mono)',
  fontSize: 'var(--fs-16)',
  lineHeight: 1.6,
  outline: 'none',
  '&::placeholder': { color: 'var(--dim)' },
})
const footerStyle = css({
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-2_5)',
  flexWrap: 'wrap',
  paddingTop: 'var(--space-1)',
  borderTop: '1px solid var(--line-hair)',
})
const tempsStyle = css({ margin: 0, padding: 0, border: 0, minWidth: 0, display: 'flex', alignItems: 'center', gap: 'var(--space-2_5)', paddingTop: 'var(--space-2_5)' })
const runAtStyle = css({ float: 'left', padding: 0, marginRight: 'var(--space-2_5)', fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-12)', color: 'var(--dim)' })
const tempOptions = css({ display: 'flex', gap: 'var(--space-1_5)' })
const tempStyle = css({
  position: 'relative',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '40px',
  minWidth: '52px',
  padding: '0 var(--space-2_5)',
  borderRadius: 'var(--radius-9)',
  border: '1px solid var(--line-control)',
  color: 'var(--text-quiet)',
  fontFamily: 'var(--font-mono)',
  fontSize: 'var(--fs-13)',
  cursor: 'pointer',
  transition: 'background-color var(--duration-fast), border-color var(--duration-fast)',
  '&::before': { content: '""', position: 'absolute', inset: '-2px 0' },
  '&:hover': { borderColor: 'var(--line-node-next)' },
  '&:has(:checked)': { background: 'var(--ion)', borderColor: 'var(--ion)', color: 'var(--ink)' },
  '&:has(:focus-visible)': { outline: '2px solid var(--focus-ring-color)', outlineOffset: '2px' },
})
const tokensStyle = css({ marginLeft: 'auto', paddingTop: 'var(--space-2_5)', fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-12)', color: 'var(--dim)' })
const runKeyStyle = css({ marginTop: 'var(--space-2_5)', '@media (max-width: 360px)': { width: '100%' } })
const emptyKeyStyle = css({ cursor: 'default' })
const noJsStyle = css({ margin: 0, fontSize: 'var(--fs-13)', color: 'var(--muted)' })
