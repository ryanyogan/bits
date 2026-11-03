// Browser side of POST /api/coach (the app's decision 064): after a run's
// stream ends, the PromptComposer asks the server to grade that journalled
// run. The server answers with a verdict: each criterion's label and met
// flag, one hint, and what to unlock. Patterns, rubrics and the reference
// never reach the browser; the reference comes back only when asked for
// (after enough misses) or once the exercise has passed.

/** Where an exercise's verdicts come from, and the fields that identify the exercise. */
export interface CoachEndpoint {
  /** POST URL, e.g. /api/coach. */
  action: string
  /** Sent with every request, e.g. course, lesson, exercise. */
  fields: Record<string, string>
}

export interface CoachCriterion {
  label: string
  /** check: on the prompt. run: ran at a temperature. expect: on the reply. rubric: judged by the coach. */
  kind: 'check' | 'run' | 'expect' | 'rubric'
  /** null: not checked (a saved example, or the coach didn't judge it). */
  met: boolean | null
  level?: 'must' | 'should'
  note?: string
}

export interface CoachVerdict {
  attempt: string
  /**
   * coach: the judge graded the rubric. reply: the reply checks decided.
   * pattern: no model connected, or Claude couldn't be reached: a saved
   * example, prompt checks only. soft: the rubric wasn't judged (the coach's
   * limit or an outage), passed on the reply checks. limit: over a run
   * limit, a saved example that isn't graded (no pass, no miss). example: a
   * temperature that never runs live, not graded either.
   */
  layer: 'coach' | 'reply' | 'pattern' | 'soft' | 'limit' | 'example'
  passed: boolean
  criteria: CoachCriterion[]
  /** One sentence: the coach's question, or the next authored hint. */
  hint: string
  /** Says how this was graded when it wasn't the coach on a live reply. */
  note?: string
  /** Graded attempts that missed, this one included. */
  misses: number
  /** From the 3rd miss: the next authored hint, behind "Stronger hint". */
  stronger?: string
  /** From the 5th miss (and not yet passed): "Show a strong prompt" is offered. */
  canReveal: boolean
  /** Once passed: the author's strong prompt, to compare. */
  reference?: string
  /** Neurons this pass earned now (0 for a repeat pass, or a miss). */
  xp: number
  /** The xp went on the account (signed in); else it's held until sign-in. */
  saved: boolean
  /** The block's success message, on a pass. */
  success?: string
  /** A strong prompt was shown before this pass: it earned half. */
  halved?: boolean
  /** layer limit: when a live run is free again, at the latest (ms since epoch). */
  resetsAt?: number
}

export type CoachResult =
  | { ok: true; verdict: CoachVerdict }
  | { ok: false; reason: 'pending' | 'limit' | 'error' }

function body(endpoint: CoachEndpoint, extra: Record<string, string>): FormData {
  let form = new FormData()
  for (let [name, value] of Object.entries(endpoint.fields)) form.append(name, value)
  for (let [name, value] of Object.entries(extra)) form.append(name, value)
  return form
}

/** Grades one journalled run. A 409 (the run is still being journalled) is retried once. */
export async function requestVerdict(
  endpoint: CoachEndpoint,
  attempt: string,
  options: { signal?: AbortSignal } = {},
): Promise<CoachResult> {
  for (let tries = 0; tries < 3; tries++) {
    let response: Response
    try {
      response = await fetch(endpoint.action, {
        method: 'POST',
        headers: { Accept: 'application/json' },
        body: body(endpoint, { attempt }),
        signal: options.signal,
      })
    } catch (error) {
      if (options.signal?.aborted) throw error
      return { ok: false, reason: 'error' }
    }
    if (response.status === 409) {
      await new Promise((resolve) => setTimeout(resolve, 400 * (tries + 1)))
      continue
    }
    if (response.status === 429) return { ok: false, reason: 'limit' }
    if (!response.ok) return { ok: false, reason: 'error' }
    try {
      return { ok: true, verdict: (await response.json()) as CoachVerdict }
    } catch {
      return { ok: false, reason: 'error' }
    }
  }
  return { ok: false, reason: 'pending' }
}

/** Asks for the strong prompt (only offered after enough misses). */
export async function requestReference(endpoint: CoachEndpoint): Promise<string | undefined> {
  try {
    let response = await fetch(endpoint.action, {
      method: 'POST',
      headers: { Accept: 'application/json' },
      body: body(endpoint, { reveal: '1' }),
    })
    if (!response.ok) return undefined
    let json = (await response.json()) as { reference?: unknown }
    return typeof json.reference === 'string' ? json.reference : undefined
  } catch {
    return undefined
  }
}
