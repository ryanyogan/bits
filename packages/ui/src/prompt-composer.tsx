import type { Handle } from 'remix/component'
import { clientEntry, css, on, ref } from 'remix/component'

import { Keycap } from './keycap.tsx'
import { requestReference, requestVerdict, type CoachCriterion, type CoachEndpoint, type CoachVerdict } from './lib/coach-client.ts'
import { readDraft, writeDraft, type DraftPersist } from './lib/drafts.ts'
import { fieldFrameStyle, fieldGlyphStyle, fieldGlyphTopStyle, fieldInputStyle, fieldMultiStyle } from './lib/field.ts'
import { runNote, streamRun, type RunEndpoint } from './lib/run-stream.ts'
import { createFollower, scrollWindowStyle } from './lib/stable.tsx'
import { focusOutline, FORCED_COLORS, forcedSelected } from './lib/states.ts'
import { initialTemperature, TEMPERATURE_EVENT } from './odds-bars.tsx'
import { announceReward, REWARD_QUERY_EVENT, RewardToast, type RewardNext } from './reward-toast.tsx'
import { Tag } from './tag.tsx'
import { toyHeaderStyle, toyPanelStyle } from './toy-panel.tsx'
import { LearnerBubble, ModelOutput, TutorMessage } from './tutor.tsx'

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

/**
 * Mirrors the draft into another form on the page (the lesson's "complete"
 * form) as a hidden field, via the `form` attribute. The server re-checks
 * it; runs are counted from the server's own journal, never sent here.
 */
export interface SubmitFields {
  /** id of the form to submit with. */
  form: string
  prompt: string
}

export function submitFieldInputs(fields: SubmitFields | undefined, draft: string) {
  if (!fields) return null
  return <input type="hidden" form={fields.form} name={fields.prompt} value={draft} />
}

export type { RunEndpoint }

/** Canned output for a temperature, cycled per run (no server). */
export function cannedOutput(examples: Record<string, string[]> | undefined, temperature: number, n: number): string {
  let list = examples?.[String(temperature)] ?? []
  return list.length ? list[(n - 1) % list.length]! : 'A bright idea, brewed under moonlight.'
}

export interface TemperatureOption {
  /** T × 100. */
  value: number
  label: string
}

/** A criterion's label as the browser sees it: never its pattern or rubric text beyond the label (decision 064). */
export interface ComposerCriterion {
  label: string
  kind: CoachCriterion['kind']
  level?: 'must' | 'should'
}

export type { CoachEndpoint }

export interface PromptComposerProps {
  /** Unique per lesson exercise; keys the saved draft and the field ids. */
  id: string
  task: string
  /** The exercise's goal, shown above the runs (decision 064). */
  goal?: string
  placeholder?: string
  /** Starting draft (rendered with JS off; a saved draft replaces it). */
  defaultDraft?: string
  /** "What good looks like": the labels only. The server grades them (`coach`). */
  criteria: ComposerCriterion[]
  /** A coach judges the reply (the block has rubric lines). */
  coached?: boolean
  /** Passing is optional (`gate=false`): the reward adds neurons but doesn't open the lesson's gate. */
  optional?: boolean
  temperatures?: TemperatureOption[]
  /** Canned outputs per temperature value, cycled per run (example output, no model). */
  examples?: Record<string, string[]>
  /**
   * Reward shown once every check passes. It celebrates; it never navigates
   * (one save-and-continue action per lesson, at its end: decision 067).
   * `note` says where the progress is saved.
   */
  reward?: { xp: number; message: string; note?: string; next?: RewardNext }
  /**
   * The lesson is already saved as complete: the exercise opens passed (its
   * run checks count as met) and says so, instead of looking untried.
   */
  passed?: boolean
  /** Max runs kept on screen. */
  keepRuns?: number
  /** Style-guide only: render the focused composer look. */
  forceFocus?: boolean
  /**
   * Run through the server (`/api/run`): a streamed live reply or the
   * server's canned output, journalled. Without it, runs show `examples`.
   */
  run?: RunEndpoint
  /**
   * Grade each run on the server (`/api/coach`, decision 064): the verdict
   * per criterion, one hint, escalation and the reward. Without it (the
   * draft preview, the styleguide) the criteria stay "not checked".
   */
  coach?: CoachEndpoint
  /**
   * Where the draft is kept: localStorage under `persist.id`, plus the server
   * when signed in (`lib/drafts.ts`). Defaults to localStorage under `id`.
   */
  persist?: DraftPersist
}

interface Run {
  id: number
  prompt: string
  temperature: TemperatureOption
  output: string
  state: 'streaming' | 'done' | 'example' | 'error'
  note?: string
  tokens: number
  /** The coach's verdict on this run, once it arrives. */
  verdict?: CoachVerdict
  /** checking: waiting for /api/coach. unchecked: the coach couldn't grade it. */
  coach?: 'checking' | 'unchecked'
}

/** The last counted run, kept in this browser so a revisit shows it (decision 067). */
interface SavedRun {
  prompt: string
  output: string
  temperature: TemperatureOption
  state: Run['state']
  at: number
  verdict?: CoachVerdict
}

const ranKey = (id: string) => `bits:ran:${id}`
const lastRunKey = (id: string) => `bits:last-run:${id}`
const passedKey = (id: string) => `bits:passed:${id}`

function readJson<T>(key: string): T | undefined {
  try {
    let raw = window.localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : undefined
  } catch {
    return undefined
  }
}

function writeJson(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Storage unavailable: a revisit just starts fresh.
  }
}

/**
 * A long or multi-line prompt shows only its first line in the run log (the
 * rest is one tap away), so the reply stays in view. Undefined: show it all.
 */
export function promptPreview(prompt: string): string | undefined {
  let first = prompt.split('\n')[0]!
  if (first.length > 120) return `${first.slice(0, 117).trimEnd()}…`
  return first.length < prompt.length ? `${first}…` : undefined
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
 * "run at" temperature radiogroup (only when there is a choice), a token
 * estimate and the Run key. Enter adds a line and ⌘/Ctrl+Enter runs: prompts
 * are written, not chatted, and a stray Enter must not spend a rationed run
 * (decision 067). The textarea grows with the prompt.
 *
 * The textarea is uncontrolled (decision 067): typing never waits on a
 * render, and renders are coalesced to one per task. A controlled value
 * re-rendered on every keystroke could trip the runtime's cascade guard (50
 * updates before its timer resets, which background tabs and busy phones
 * delay); the dropped render then left a stale value that the runtime wrote
 * back over every later keystroke. The temperatures run at and the last
 * counted run are kept in this browser too, so a revisit shows a passed
 * exercise passed (the server re-checks its own journal on save).
 *
 * Runs append a LearnerBubble + ModelOutput
 * (last four kept): streamed from `run` (/api/run; a rerun aborts the one in
 * flight), or the canned `examples` without it. Runs land in a fixed-height
 * window above the composer that scrolls inside and follows the newest
 * reply while you're at its bottom (decision 023), so a streaming reply
 * never pushes the page. Until the first run the window is a compact hint;
 * the first run grows it once and scrolls by the growth, so the composer
 * stays put (decision 025). When every check passes a RewardToast joins the
 * reply that earned it (later runs land below it) and `bits:reward` fires. The draft is kept in
 * localStorage, and on the server when signed in (`persist`). With JS off the composer renders with Run disabled and a
 * note in the same slot as the keyboard hint. Client entry.
 */
export const PromptComposer = clientEntry(
  import.meta.url,
  function PromptComposer(handle: Handle<PromptComposerProps>) {
    let hydrated = false
    // The server's saved copy renders first (signed in); a newer local copy replaces it on hydration.
    let draft = handle.props.persist?.saved?.value ?? handle.props.defaultDraft ?? ''
    let temperature = initialTemperature(handle.props.temperatures ?? DEFAULT_TEMPS)
    let runs: Run[] = []
    let ranAt = new Set<number>()
    let running = false
    // The run that earned the reward: its toast sits under that reply, so
    // later runs land below it instead of pushing it down (a layout shift).
    let rewardedRun: number | undefined
    let runCount = 0
    let textarea: HTMLTextAreaElement | undefined
    let composer: HTMLFormElement | undefined
    let follower = createFollower()
    let mac = false

    let persist = (): DraftPersist => handle.props.persist ?? { id: handle.props.id, key: 'prompt' }
    let storeId = () => persist().id

    // One render per task, however many input events arrive (see above).
    let renderQueued = false
    function queueRender() {
      if (renderQueued) return
      renderQueued = true
      setTimeout(() => {
        renderQueued = false
        if (!handle.signal.aborted) handle.update()
      }, 0)
    }

    handle.queueTask(() => {
      draft = readDraft(persist()) ?? handle.props.defaultDraft ?? ''
      if (textarea && textarea.value !== draft) textarea.value = draft
      mac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)
      for (let t of readJson<unknown[]>(ranKey(storeId())) ?? []) if (typeof t === 'number') ranAt.add(t)
      let last = readJson<SavedRun>(lastRunKey(storeId()))
      if (last && typeof last.prompt === 'string' && typeof last.output === 'string' && last.temperature) {
        let at = new Date(last.at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
        runs = [
          {
            id: ++runCount,
            prompt: last.prompt,
            temperature: last.temperature,
            output: last.output,
            state: last.state === 'error' || last.state === 'example' ? last.state : 'done',
            note: `Your last run · ${at}`,
            tokens: draftTokens(last.output),
            ...(last.verdict && typeof last.verdict === 'object' && Array.isArray(last.verdict.criteria) ? { verdict: last.verdict } : {}),
          },
        ]
        let restored = runs[0]!.verdict
        if (restored && graded(restored)) {
          latest = restored
          latestPrompt = last.prompt
        }
      }
      passedHere = readJson<boolean>(passedKey(storeId())) === true
      hydrated = true
      // A passed exercise opens the lesson's gate again on a revisit, with no
      // second toast or neurons (the server decides those on save). After the
      // other islands' setup, so the "complete" key is listening.
      let reward = handle.props.reward
      if (!handle.props.passed && reward && passedHere) {
        rewardedRun = runs[0]?.verdict?.passed ? runs[0].id : undefined
        let source = handle.props.optional ? ('ask' as const) : undefined
        let again = () => announceReward({ xp: reward.xp, message: reward.message, silent: true, source })
        setTimeout(again, 0)
        // The "complete" key may hydrate after this: it asks, and we answer.
        window.addEventListener(REWARD_QUERY_EVENT, again, { signal: handle.signal })
      }
      handle.update()
    })

    function saveDraft() {
      writeDraft(persist(), draft)
    }

    // The newest graded verdict drives the goal strip and the escalation
    // (decision 064). A reply that wasn't graded (a run limit) leaves it be.
    let latest: CoachVerdict | undefined
    // The prompt that verdict graded: the strip says "From your last run" once the draft differs.
    let latestPrompt = ''
    // The learner's own open/closed choice for the criteria list; until then
    // it's open before the first verdict and folded after (QA, 2026-11-02).
    let criteriaOpen: boolean | undefined
    // Passed in an earlier visit (this browser); the server re-checks on save.
    let passedHere = false
    // What the polite live region says: "Reply ready, checking…", then the verdict.
    let announcement = ''
    let strongerOpen = false
    let referenceOpen = false
    let reference: string | undefined
    let revealing = false
    let coachAbort: AbortController | undefined
    handle.signal.addEventListener('abort', () => coachAbort?.abort())

    /** Grades a counted run on the server, then rewards a first pass. */
    async function check(entry: Run, runId: string) {
      let endpoint = handle.props.coach
      if (!endpoint) return
      entry.coach = 'checking'
      announcement = 'Reply ready, checking…'
      await handle.update()
      coachAbort?.abort()
      let controller = (coachAbort = new AbortController())
      let result
      try {
        result = await requestVerdict(endpoint, runId, { signal: controller.signal })
      } catch {
        return
      }
      if (handle.signal.aborted) return
      if (!result.ok) {
        entry.coach = 'unchecked'
        announcement = result.reason === 'limit' ? 'Too many checks for now. Try again in a minute.' : 'The coach couldn’t check this run. Run it again.'
        await handle.update()
        return
      }
      let verdict = result.verdict
      entry.coach = undefined
      entry.verdict = verdict
      // The first verdict folds the criteria list above the runs: scroll by
      // what it gave back, so the composer stays put (decision 025).
      let folding = !latest && criteriaOpen === undefined
      let before = folding ? composer?.getBoundingClientRect().top : undefined
      if (graded(verdict) || !latest) {
        latest = verdict
        latestPrompt = entry.prompt
      }
      if (verdict.reference) reference = verdict.reference
      announcement = [tallyText(verdict), verdict.hint, verdict.passed ? verdict.success : ''].filter(Boolean).join(' ')
      writeJson(lastRunKey(storeId()), {
        prompt: entry.prompt,
        output: entry.output,
        temperature: entry.temperature,
        state: entry.state,
        at: Date.now(),
        verdict,
      } satisfies SavedRun)
      let reward = handle.props.reward
      if (verdict.passed) {
        passedHere = true
        writeJson(passedKey(storeId()), true)
        if (reward && rewardedRun === undefined) {
          rewardedRun = entry.id
          rewardXp = verdict.xp
          let source = handle.props.optional ? ('ask' as const) : undefined
          announceReward({ xp: verdict.xp, message: verdict.success ?? reward.message, source, silent: verdict.xp === 0 })
        }
      }
      await handle.update()
      if (before !== undefined && composer) {
        let moved = composer.getBoundingClientRect().top - before
        if (moved) window.scrollBy({ top: moved, behavior: 'instant' })
      }
    }

    async function reveal() {
      let endpoint = handle.props.coach
      if (!endpoint || revealing) return
      if (reference) {
        referenceOpen = !referenceOpen
        handle.update()
        return
      }
      revealing = true
      handle.update()
      reference = await requestReference(endpoint)
      revealing = false
      referenceOpen = Boolean(reference)
      if (!handle.signal.aborted) handle.update()
    }

    function useReference() {
      if (!reference || !textarea) return
      textarea.value = reference
      draft = reference
      saveDraft()
      textarea.focus()
      handle.update()
    }

    // The neurons the rewarding verdict earned (0 for a repeat pass).
    let rewardXp = 0

    // The run in flight; running again aborts it (and the server stops the model).
    let inflight: AbortController | undefined
    handle.signal.addEventListener('abort', () => inflight?.abort())

    /** Server run: streams into the entry; canned output if the server can't answer. */
    async function serverRun(endpoint: RunEndpoint, entry: Run): Promise<{ counted: boolean; runId?: string }> {
      inflight?.abort()
      let controller = (inflight = new AbortController())
      let result
      try {
        result = await streamRun(endpoint, { prompt: entry.prompt, temperature: entry.temperature.value }, {
          signal: controller.signal,
          onText(text) {
            entry.output = text
            handle.update()
          },
        })
      } catch {
        // Aborted by a rerun (or removal): keep what arrived.
        entry.state = 'done'
        entry.note = 'Stopped: you ran it again.'
        return { counted: false }
      } finally {
        if (inflight === controller) inflight = undefined
      }
      entry.output = result.text || cannedOutput(handle.props.examples, entry.temperature.value, entry.id)
      entry.state = result.source === 'live' ? 'done' : result.source === 'error' ? 'error' : 'example'
      entry.note = runNote(result)
      return { counted: result.counted, runId: result.counted && result.source !== 'error' ? result.runId : undefined }
    }

    async function run() {
      let prompt = draft.trim()
      let endpoint = handle.props.run
      if (!prompt || (running && !endpoint)) return
      running = true
      let id = ++runCount
      let entry: Run = { id, prompt, temperature, output: '', state: 'streaming', tokens: 0 }
      // The first run grows the compact empty window to its full height in
      // one step. Scroll by the growth so the composer stays where the
      // learner is looking: the window opens upwards (decision 025).
      let before = runs.length ? undefined : composer?.getBoundingClientRect().top
      runs = [...runs, entry].slice(-(handle.props.keepRuns ?? 4))
      follower.pin()
      await handle.update()
      if (before !== undefined && composer) {
        let grown = composer.getBoundingClientRect().top - before
        if (grown > 0) window.scrollBy({ top: grown, behavior: 'instant' })
      }
      let counted: boolean
      let runId: string | undefined
      if (endpoint) {
        ;({ counted, runId } = await serverRun(endpoint, entry))
      } else {
        await new Promise((resolve) => setTimeout(resolve, 450))
        // Only removal cancels a run: other updates (picking a temperature,
        // typing) mid-run must not leave it stuck on "Running…".
        if (handle.signal.aborted) return
        entry.output = cannedOutput(handle.props.examples, entry.temperature.value, id)
        entry.state = 'example'
        counted = true
      }
      if (handle.signal.aborted) return
      entry.tokens = draftTokens(entry.output)
      if (id === runCount) running = false
      if (!counted) {
        await handle.update()
        return
      }
      ranAt.add(entry.temperature.value)
      writeJson(ranKey(storeId()), [...ranAt])
      writeJson(lastRunKey(storeId()), {
        prompt: entry.prompt,
        output: entry.output,
        temperature: entry.temperature,
        state: entry.state,
        at: Date.now(),
      } satisfies SavedRun)
      window.dispatchEvent(new CustomEvent('bits:run', { detail: { prompt, temperature: entry.temperature.value } }))
      await handle.update()
      textarea?.focus()
      if (runId) await check(entry, runId)
    }

    return () => {
      let { id, task, goal, placeholder = 'Write a tagline for…', criteria, temperatures = DEFAULT_TEMPS, reward, forceFocus } = handle.props
      let empty = draft.trim() === ''
      let passedAlready = handle.props.passed || passedHere
      let misses = latest?.misses ?? 0
      let stronger = latest && !latest.passed ? latest.stronger : undefined
      let canReveal = Boolean(handle.props.coach && (latest?.canReveal || reference))
      // Saved before coaching (or in another browser): passed, with no verdict to show.
      let passedEarlier = passedAlready && !latest
      // A draft saved on the server comes back with CRLF line ends (form encoding).
      let stale = Boolean(latest && hydrated && draft.replace(/\r\n?/g, '\n').trim() !== latestPrompt.replace(/\r\n?/g, '\n'))
      let open = criteriaOpen ?? (!latest && !passedEarlier)
      let status = passedEarlier
        ? 'Passed earlier · run it again to see the coach'
        : latest
          ? `${stale ? 'From your last run · ' : ''}${tallyText(latest)}`
          : handle.props.coached
            ? 'The coach checks the reply'
            : `${criteria.length} to meet`
      let runKeys = mac ? '⌘↵' : 'Ctrl+↵'
      let fieldId = `${id}-prompt`
      let tokens = draftTokens(draft)
      // A server run can be rerun mid-stream (the old one is aborted); a canned one can't.
      let locked = running && !handle.props.run
      return (
        <div mix={[toyPanelStyle, wrapStyle]}>
          <div mix={[toyHeaderStyle, headerStyle]}>
            <Tag variant="your-turn">Your turn</Tag>
            <label for={fieldId} mix={taskStyle}>
              {task}
            </label>
          </div>
          <section aria-label="Goal" mix={goalStyle}>
            {goal ? (
              <p mix={goalTextStyle}>
                <span mix={goalLabelStyle}>Goal</span> {goal}
              </p>
            ) : null}
            {/* Folds to one line after the first verdict, so the replies stay in view on a phone. */}
            <details
              open={open}
              mix={[
                criteriaDetailsStyle,
                on('toggle', (event) => {
                  let now = (event.currentTarget as HTMLDetailsElement).open
                  if (now === open) return
                  criteriaOpen = now
                  handle.update()
                }),
              ]}
            >
              <summary id={`${id}-criteria-label`} mix={criteriaSummaryStyle}>
                <span mix={goalLabelStyle}>What good looks like</span>
                <span mix={summaryStatusStyle}>{status}</span>
                <span aria-hidden="true" mix={summaryToggleStyle}>
                  {open ? 'hide' : 'show'}
                </span>
              </summary>
              <ul id={`${id}-checks`} aria-labelledby={`${id}-criteria-label`} mix={criteriaStyle}>
                {criteria.map((criterion, index) => {
                  let met = passedEarlier ? 'earlier' : criterionState(criterion, index, latest)
                  return (
                    <li key={`${criterion.kind}:${criterion.label}`} data-met={met} mix={criterionStyle}>
                      <span aria-hidden="true" mix={glyphStyle}>
                        {met === 'yes' ? '✓' : met === 'no' ? '✗' : '·'}
                      </span>
                      <span>{criterion.label}</span>
                      <span mix={stateTextStyle}>
                        {met === 'yes'
                          ? 'met'
                          : met === 'no'
                            ? criterion.level === 'should'
                              ? 'not yet (nice to have)'
                              : 'not yet'
                            : met === 'earlier'
                              ? ''
                              : criterion.level === 'should'
                                ? 'nice to have'
                                : 'not checked yet'}
                      </span>
                    </li>
                  )
                })}
              </ul>
            </details>
          </section>
          <section
            aria-label="Your runs"
            tabIndex={0}
            data-empty={runs.length ? undefined : ''}
            mix={[runWindowStyle, scrollWindowStyle, follower.mixin]}
          >
            {runs.length ? null : (
              <p mix={emptyStyle}>
                {passedEarlier
                  ? '✓ You passed this exercise. Run it again to see the coach.'
                  : passedAlready
                    ? '✓ You passed this exercise. Run it again any time.'
                    : 'Run your prompt and the replies land here.'}
              </p>
            )}
            <ol mix={runsStyle}>
              {runs.map((entry) => (
                <li key={entry.id} mix={runStyle}>
                  <LearnerBubble>
                    {promptPreview(entry.prompt) ? (
                      <details mix={promptDetails}>
                        <summary>{promptPreview(entry.prompt)}</summary>
                        {entry.prompt}
                      </details>
                    ) : (
                      entry.prompt
                    )}
                  </LearnerBubble>
                  <ModelOutput
                    temperature={entry.temperature.label}
                    tokens={entry.tokens}
                    state={entry.state}
                    note={entry.note}
                  >
                    {entry.output}
                  </ModelOutput>
                  {entry.coach === 'checking' ? (
                    <TutorMessage variant="preview" continued mix={coachTurnStyle}>
                      <p mix={coachNoteStyle}>Checking the reply…</p>
                    </TutorMessage>
                  ) : entry.coach === 'unchecked' ? (
                    <TutorMessage variant="preview" continued mix={coachTurnStyle}>
                      <p mix={coachNoteStyle}>The coach couldn’t check this run. Run it again.</p>
                    </TutorMessage>
                  ) : entry.verdict ? (
                    <CoachTurn verdict={entry.verdict} rewarded={entry.id === rewardedRun && Boolean(reward) && rewardXp > 0} />
                  ) : null}
                  {entry.id === rewardedRun && reward && (rewardXp > 0 || !entry.verdict) ? (
                    <RewardToast
                      xp={entry.verdict ? rewardXp : reward.xp}
                      title={`+${entry.verdict ? rewardXp : reward.xp} neurons (lesson points)`}
                      message={entry.verdict?.success ?? reward.message}
                      note={entry.verdict?.halved ? 'Half the neurons: you saw the strong prompt first.' : reward.note}
                      next={reward.next}
                      animate
                    />
                  ) : null}
                </li>
              ))}
            </ol>
          </section>
          <form
            mix={[
              composerStyle,
              ref((node) => (composer = node)),
              on('submit', (event) => {
                event.preventDefault()
                void run()
              }),
            ]}
          >
            {/* The shared field (decision 051): the volt › and the prompt in one frame that shows focus. */}
            <div data-force={forceFocus ? 'focus' : undefined} mix={[fieldFrameStyle, promptFrameStyle]}>
              <span aria-hidden="true" mix={[fieldGlyphStyle, fieldGlyphTopStyle]}>
                ›
              </span>
              <textarea
                id={fieldId}
                name="prompt"
                rows={4}
                placeholder={placeholder}
                defaultValue={draft}
                readOnly={locked}
                aria-describedby={`${id}-checks ${id}-hint`}
                aria-keyshortcuts="Control+Enter Meta+Enter"
                mix={[
                  fieldInputStyle,
                  fieldMultiStyle,
                  growStyle,
                  ref((node) => (textarea = node)),
                  on('input', (event) => {
                    draft = event.currentTarget.value
                    saveDraft()
                    queueRender()
                  }),
                  on('keydown', (event) => {
                    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey) && !event.isComposing) {
                      event.preventDefault()
                      event.currentTarget.form?.requestSubmit()
                    }
                  }),
                ]}
              />
            </div>
            {misses > 0 && !latest?.passed ? <p mix={attemptStyle}>Attempt {misses + 1}</p> : null}
            {stronger || canReveal ? (
              <div mix={escalationStyle}>
                {stronger ? (
                  <button
                    type="button"
                    aria-expanded={strongerOpen ? 'true' : 'false'}
                    aria-controls={`${id}-stronger`}
                    mix={[escalateKeyStyle, on('click', () => {
                        strongerOpen = !strongerOpen
                        handle.update()
                      })]}
                  >
                    Stronger hint
                  </button>
                ) : null}
                {canReveal ? (
                  <button
                    type="button"
                    aria-expanded={referenceOpen ? 'true' : 'false'}
                    aria-controls={`${id}-reference`}
                    aria-describedby={latest?.passed ? undefined : `${id}-reveal-cost`}
                    aria-busy={revealing ? 'true' : undefined}
                    mix={[escalateKeyStyle, on('click', () => void reveal())]}
                  >
                    Show a strong prompt
                  </button>
                ) : null}
                {/* The cost is stated before the choice (decision 064 §6). */}
                {canReveal && !latest?.passed && !reference ? (
                  <p id={`${id}-reveal-cost`} mix={revealCostStyle}>
                    Shows a model answer. Passing after you see it earns half the neurons.
                  </p>
                ) : null}
              </div>
            ) : null}
            {stronger ? (
              <p id={`${id}-stronger`} hidden={!strongerOpen} mix={panelStyle}>
                {stronger}
              </p>
            ) : null}
            {canReveal ? (
              <div id={`${id}-reference`} hidden={!referenceOpen || !reference} mix={panelStyle}>
                <p mix={coachNoteStyle}>
                  {latest?.passed
                    ? 'A strong prompt, to compare with yours.'
                    : 'A strong prompt. Passing after seeing it earns half the neurons.'}
                </p>
                <LearnerBubble mix={referenceBubbleStyle}>
                  <span class="sr-only">Example prompt: </span>
                  {reference ?? ''}
                </LearnerBubble>
                <button type="button" mix={[escalateKeyStyle, on('click', useReference)]}>
                  Use this prompt
                </button>
              </div>
            ) : null}
            <div mix={footerStyle}>
              {temperatures.length > 1 ? (
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
              ) : null}
              <span mix={tokensStyle}>
                {hydrated ? `~${tokens} tokens` : '~0 tokens'}
              </span>
              <Keycap
                type="submit"
                size="md"
                disabled={!hydrated || locked}
                mix={[runKeyStyle, empty && hydrated ? emptyKeyStyle : undefined]}
              >
                {locked ? 'Running…' : running ? 'Run again' : 'Run'}
              </Keycap>
            </div>
            <p id={`${id}-hint`} mix={hintStyle}>
              {hydrated ? (
                <>
                  {/* The keys only where there's a keyboard: touch has the Run key. */}
                  <span mix={keyboardOnlyStyle}>
                    {runKeys} runs · Enter adds a line{temperatures.length === 1 ? ' · ' : ''}
                  </span>
                  {temperatures.length === 1 ? `runs at T=${temperatures[0]!.label}` : null}
                </>
              ) : (
                'Turn on JavaScript to run prompts.'
              )}
            </p>
          </form>
          {/* Rendered empty, so the first verdict is announced (decision 031). */}
          <p role="status" aria-live="polite" class="sr-only">
            {announcement}
          </p>
        </div>
      )
    }
  },
)

/** A verdict that graded the reply (not a run limit's saved example, not a temperature that never runs live). */
function graded(verdict: CoachVerdict): boolean {
  return verdict.layer !== 'limit' && verdict.layer !== 'example'
}

/**
 * The verdict in a few words. The count is of the checks that decide and
 * were checked; the rest are named, so "3 of 4" never stands unexplained
 * beside a longer list (QA, 2026-11-02).
 */
export function tallyText(verdict: CoachVerdict): string {
  if (!graded(verdict)) return 'Not graded.'
  if (verdict.passed) return 'Passed.'
  let deciding = verdict.criteria.filter((criterion) => criterion.level !== 'should')
  let checked = deciding.filter((criterion) => criterion.met !== null)
  let met = checked.filter((criterion) => criterion.met).length
  let waiting = deciding.length - checked.length
  let tally = `${met} of ${checked.length} checks met`
  if (!waiting) return `${tally}.`
  return verdict.layer === 'pattern'
    ? `${tally} · ${waiting} not checked on a saved example.`
    : `${tally} · ${waiting} more checked once these pass.`
}

/** A criterion's state in the goal strip: from the newest graded verdict, else "not checked yet". */
function criterionState(criterion: ComposerCriterion, index: number, verdict: CoachVerdict | undefined): 'yes' | 'no' | 'unknown' {
  if (!verdict) return 'unknown'
  let match = verdict.criteria[index]
  let met = match && match.label === criterion.label ? match.met : verdict.criteria.find((c) => c.label === criterion.label)?.met
  return met === true ? 'yes' : met === false ? 'no' : 'unknown'
}

/**
 * The coach's turn under a reply (decision 064): the tally and one line,
 * then only what isn't met (the goal strip holds the full list). On a pass
 * the line comes from the verdict, and the success text shows here only
 * when no reward box under this run already carries it.
 */
function CoachTurn(handle: Handle<{ verdict: CoachVerdict; rewarded?: boolean }>) {
  return () => {
    let { verdict, rewarded } = handle.props
    let unmet = verdict.passed || !graded(verdict) ? [] : verdict.criteria.filter((criterion) => criterion.met === false)
    let success = verdict.passed && !rewarded ? verdict.success : undefined
    return (
      <TutorMessage variant="preview" continued mix={coachTurnStyle}>
        <p>
          <strong>{tallyText(verdict)}</strong> {[verdict.hint, success].filter(Boolean).join(' ')}
        </p>
        {unmet.length ? (
          <ul aria-label="Not met yet" mix={turnListStyle}>
            {unmet.map((criterion) => (
              <li key={`${criterion.kind}:${criterion.label}`} data-met="no" mix={criterionStyle}>
                <span aria-hidden="true" mix={glyphStyle}>
                  ✗
                </span>
                <span>
                  {criterion.label}
                  {criterion.note ? <span mix={stateTextStyle}> {criterion.note}</span> : null}
                </span>
                <span mix={stateTextStyle}>{criterion.level === 'should' ? 'not yet (nice to have)' : 'not yet'}</span>
              </li>
            ))}
          </ul>
        ) : null}
        {verdict.note ? <p mix={coachNoteStyle}>{verdict.note}</p> : null}
      </TutorMessage>
    )
  }
}

// The goal strip: the goal, then the criteria labels. Its size never changes:
// only the state words do (decision 023).
const goalStyle = css({
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-2)',
  padding: 'var(--space-3) var(--space-4)',
  borderBottom: 'var(--border-w) solid var(--line-cell)',
  '@media (max-width: 480px)': { paddingInline: 'var(--space-3)' },
})
const goalTextStyle = css({ margin: 0, fontSize: 'var(--fs-14)', color: 'var(--text)' })
const goalLabelStyle = css({
  margin: 0,
  fontFamily: 'var(--font-mono)',
  fontSize: 'var(--fs-12)',
  color: 'var(--dim)',
  marginRight: 'var(--space-2)',
})
const criteriaStyle = css({
  listStyle: 'none',
  margin: 0,
  padding: 'var(--space-2) 0 0',
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-1)',
})
// "What good looks like" is a disclosure: one line (the label, the latest
// tally, show/hide) that opens to the list.
const criteriaDetailsStyle = css({ margin: 0 })
const criteriaSummaryStyle = css({
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'baseline',
  gap: 'var(--space-1) var(--space-2)',
  minHeight: 'var(--touch-target)',
  alignContent: 'center',
  cursor: 'pointer',
  listStyle: 'none',
  '&::-webkit-details-marker': { display: 'none' },
  '&:focus-visible': focusOutline,
})
const summaryStatusStyle = css({ fontSize: 'var(--fs-13)', color: 'var(--text-quiet)' })
const summaryToggleStyle = css({
  marginLeft: 'auto',
  fontFamily: 'var(--font-mono)',
  fontSize: 'var(--fs-12)',
  color: 'var(--muted)',
  textDecoration: 'underline',
  textUnderlineOffset: '2px',
})
const revealCostStyle = css({ margin: 0, flexBasis: '100%', fontSize: 'var(--fs-13)', color: 'var(--muted)' })
const criterionStyle = css({
  display: 'grid',
  gridTemplateColumns: '1.25em 1fr auto',
  gap: 'var(--space-2)',
  alignItems: 'baseline',
  fontSize: 'var(--fs-13)',
  color: 'var(--text-quiet)',
  '&[data-met="yes"] > span:first-child': { color: 'var(--ok)' },
  '&[data-met="no"] > span:first-child': { color: 'var(--danger)' },
})
const glyphStyle = css({ fontFamily: 'var(--font-mono)', textAlign: 'center', color: 'var(--dim)' })
const stateTextStyle = css({ fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-12)', color: 'var(--dim)' })
const coachTurnStyle = css({ '& p': { margin: 0 }, '& > div': { display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' } })
const coachNoteStyle = css({ margin: 0, fontSize: 'var(--fs-13)', color: 'var(--muted)' })
const turnListStyle = css({ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' })
const attemptStyle = css({ margin: 0, fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-12)', color: 'var(--dim)' })
const escalationStyle = css({ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' })
const escalateKeyStyle = css({
  minHeight: 'var(--touch-target)',
  padding: '0 var(--space-3)',
  border: 'var(--border-w) solid var(--line-control)',
  background: 'transparent',
  color: 'var(--text)',
  fontFamily: 'var(--font-mono)',
  fontSize: 'var(--fs-13)',
  cursor: 'pointer',
  '&:hover': { background: 'var(--fill-hover)' },
  '&:focus-visible': focusOutline,
  '&[aria-expanded="true"]': { borderColor: 'var(--ion)', background: 'var(--ion-a16)' },
  [FORCED_COLORS]: { '&[aria-expanded="true"]': forcedSelected },
})
const panelStyle = css({
  margin: 0,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-start',
  gap: 'var(--space-2)',
  padding: 'var(--space-3)',
  border: 'var(--border-w) solid var(--line-hair)',
  fontSize: 'var(--fs-14)',
  color: 'var(--text)',
  '&[hidden]': { display: 'none' },
})
const referenceBubbleStyle = css({ alignSelf: 'stretch', maxWidth: 'none', whiteSpace: 'pre-wrap' })
// The run keys mean nothing on a touch screen (QA, 2026-11-02): only a
// device with a fine pointer that hovers (a hardware keyboard, in practice) shows them.
const keyboardOnlyStyle = css({ display: 'none', '@media (hover: hover) and (pointer: fine)': { display: 'inline' } })

// One ruled panel (decision 047): the task strip, the runs window and the
// composer, stacked and split by hairlines, so the exercise reads as one block.
const wrapStyle = css({ background: 'var(--well)', borderColor: 'var(--volt-a40)' })
// Fixed height whatever arrives: the window scrolls, the page doesn't.
const runWindowStyle = css({
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-4)',
  height: 'var(--run-log-height)',
  boxSizing: 'border-box',
  padding: 'var(--space-4) var(--space-4) var(--space-3)',
  background: 'var(--surface)',
  borderBottom: 'var(--border-w) solid var(--line-cell)',
  // Empty: just the hint. The first run (always the learner's own action)
  // grows it to --run-log-height once; after that the height never changes.
  '&[data-empty]': { height: 'var(--run-log-empty-height)', paddingBlock: 'var(--space-2)' },
  '&:focus-visible': { outlineOffset: 'var(--focus-offset-inset)' },
  '@media (max-width: 480px)': { paddingInline: 'var(--space-3)' },
})
const emptyStyle = css({
  margin: 'auto',
  maxWidth: '32ch',
  textAlign: 'center',
  fontSize: 'var(--fs-14)',
  color: 'var(--dim)',
})
// Runs stack from the window's top. Anchoring them to the floor (chat-style)
// would move every earlier run up as a reply streams in: a layout shift.
const runsStyle = css({
  listStyle: 'none',
  margin: 0,
  padding: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-4)',
  '&:empty': { display: 'none' },
})
const runStyle = css({ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', animation: 'bits-rise var(--duration-sigil) var(--ease) both', '@media (prefers-reduced-motion: reduce)': { animation: 'none' } })

const composerStyle = css({
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-3)',
  padding: 'var(--space-4)',
  '@media (max-width: 480px)': { padding: 'var(--space-3_5) var(--space-3)' },
})
// The frame holds a multi-line prompt: the › rides the first line.
const promptFrameStyle = css({ alignItems: 'stretch' })
const headerStyle = css({ justifyContent: 'flex-start', gap: 'var(--space-1) var(--space-2_5)', paddingInline: 'var(--space-4)', '@media (max-width: 480px)': { paddingInline: 'var(--space-3)' } })
const taskStyle = css({ fontSize: 'var(--fs-14)', color: 'var(--text-quiet)' })
const footerStyle = css({
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-2_5)',
  flexWrap: 'wrap',
  paddingTop: 'var(--space-1)',
  borderTop: 'var(--border-w) solid var(--line-hair)',
})
const tempsStyle = css({ margin: 0, padding: 0, border: 0, minWidth: 0, display: 'flex', alignItems: 'center', gap: 'var(--space-2_5)', paddingTop: 'var(--space-2_5)' })
const runAtStyle = css({ float: 'left', padding: 0, marginRight: 'var(--space-2_5)', fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-12)', color: 'var(--dim)' })
// The temperatures are one segmented control: cells sharing hairlines.
const tempOptions = css({ display: 'flex' })
const tempStyle = css({
  position: 'relative',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: 'var(--control-compact)',
  minWidth: '52px',
  padding: '0 var(--space-2_5)',
  border: 'var(--border-w) solid var(--line-control)',
  color: 'var(--text-quiet)',
  fontFamily: 'var(--font-mono)',
  fontSize: 'var(--fs-13)',
  cursor: 'pointer',
  transition: 'background-color var(--duration-fast), border-color var(--duration-fast)',
  '& + &': { marginLeft: 'calc(-1 * var(--border-w))' },
  '&::before': { content: '""', position: 'absolute', inset: '-2px 0' },
  '&:hover': { zIndex: 1, borderColor: 'var(--line-node-next)', background: 'var(--fill-hover)' },
  // The pick: an ion tint and border, the accent as a signal.
  '&:has(:checked)': { zIndex: 1, background: 'var(--ion-a16)', borderColor: 'var(--ion)', color: 'var(--text)' },
  '&:has(:focus-visible)': { ...focusOutline, zIndex: 2 },
  // Forced colours drop the fill, so the picked temperature looked like the others.
  [FORCED_COLORS]: { '&:has(:checked)': forcedSelected },
})
// Tabular digits and a min width: the estimate changing doesn't nudge the Run key.
const tokensStyle = css({
  marginLeft: 'auto',
  minWidth: '11ch',
  paddingTop: 'var(--space-2_5)',
  textAlign: 'right',
  fontFamily: 'var(--font-mono)',
  fontSize: 'var(--fs-12)',
  fontVariantNumeric: 'tabular-nums',
  color: 'var(--dim)',
})
// Wide enough for "Run again ↵" so the label swap keeps the row still.
const runKeyStyle = css({ marginTop: 'var(--space-2_5)', minWidth: '9.5em', '@media (max-width: 360px)': { width: '100%' } })
const emptyKeyStyle = css({ cursor: 'default' })
const hintStyle = css({ margin: 0, fontSize: 'var(--fs-13)', color: 'var(--muted)' })
// The prompt grows with what's written (four lines at least, then it
// scrolls past fourteen), so a checkpoint prompt is written in view.
const growStyle = css({
  fieldSizing: 'content',
  minHeight: 'calc(4lh + 2 * var(--space-3))',
  maxHeight: 'calc(14lh + 2 * var(--space-3))',
  overflowY: 'auto',
})
// A long prompt in the run log: its first line, the rest one tap away.
const promptDetails = css({
  '& > summary': { cursor: 'pointer', listStyle: 'none', overflowWrap: 'anywhere' },
  '& > summary::-webkit-details-marker': { display: 'none' },
  '& > summary::after': { content: '"  show all"', color: 'var(--muted)' },
  '&[open] > summary': { display: 'none' },
})
