// Quick checks (`:::ask`, decision 052) in the browser: the verdict shape
// the server sends, and the POST both the AskPanel and the Terminal use.
// The patterns and the right answers stay on the server; the browser only
// ever sees a verdict for what the learner typed.

/** One accept check (passed or not), or a reject that matched. */
export interface AskCheckResult {
  label: string
  kind: 'accept' | 'reject'
  passed: boolean
}

/** The server's grade of one answer. */
export interface AskVerdict {
  correct: boolean
  /** What was graded (trimmed, at most 500 characters). */
  answer: string
  /** The explanation when right; the reason or the hint when not. */
  feedback: string
  checks: AskCheckResult[]
  /** Options the answer named, each right or not. */
  picks: { key: string; correct: boolean }[]
  /** Neurons this answer earned now (0 when wrong or already counted). */
  xp: number
  /** Signed in: the neurons are on the account. Signed out: sign in to keep them. */
  saved: boolean
}

/** Where an ask is graded: POST `action` with `fields` plus the answer under `answerField`. */
export interface AskEndpoint {
  action: string
  fields: Record<string, string>
  answerField: string
}

export type AskResult = { ok: true; verdict: AskVerdict } | { ok: false; message: string }

/** A right answer opens the ask's gate on "Complete lesson" (`detail.id` is the ask id). */
export const GATE_EVENT = 'bits:gate'

export function announceGate(id: string) {
  window.dispatchEvent(new CustomEvent<{ id: string }>(GATE_EVENT, { detail: { id } }))
}

/** Sends one answer to the server and reads the verdict. Never throws (an abort rejects). */
export async function postAnswer(endpoint: AskEndpoint, answer: string, signal?: AbortSignal): Promise<AskResult> {
  let body = new FormData()
  for (let [name, value] of Object.entries(endpoint.fields)) body.set(name, value)
  body.set(endpoint.answerField, answer)
  let response: Response
  try {
    response = await fetch(endpoint.action, { method: 'POST', body, headers: { Accept: 'application/json' }, signal })
  } catch (error) {
    if (signal?.aborted) throw error
    return { ok: false, message: 'Couldn’t reach the server. Check your connection and try again.' }
  }
  let data = (await response.json().catch(() => null)) as (Partial<AskVerdict> & { error?: string }) | null
  if (response.ok && data && typeof data.correct === 'boolean') return { ok: true, verdict: data as AskVerdict }
  if (response.status === 429) return { ok: false, message: 'That’s a lot of answers in a row. Take a breath and try again in a minute.' }
  return { ok: false, message: 'Couldn’t check that answer. Try again.' }
}

/** "+20 neurons · saved" / "+20 neurons · sign in to keep them". */
export function verdictXpLabel(verdict: AskVerdict): string | undefined {
  if (!verdict.correct || verdict.xp <= 0) return undefined
  return `+${verdict.xp} neurons · ${verdict.saved ? 'saved' : 'sign in to keep them'}`
}
