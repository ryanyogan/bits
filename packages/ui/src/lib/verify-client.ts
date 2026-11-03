// Deploy checks (`:::verify`, decision 072) in the browser: the verdict the
// server sends and the POST the VerifyPanel makes. bits calls the learner's
// Worker from the server; the browser never fetches it, and the checks'
// patterns stay on the server.

/** How a check of the learner's Worker ended: `pass`, or why it didn't. */
export type VerifyOutcome = 'pass' | 'checks' | 'status' | 'redirect' | 'timeout' | 'too-large' | 'network'

/** One check on the reply: its label, met or not, and why not (never the pattern). */
export interface VerifyCheckResult {
  label: string
  met: boolean
  note?: string
}

/** The server's verdict on one check of the learner's Worker. */
export interface VerifyVerdict {
  passed: boolean
  outcome: VerifyOutcome
  /** The origin checked, `https://<name>.workers.dev`. */
  origin: string
  /** The authored path bits called on it. */
  path: string
  /** The status the Worker answered with, when it answered. */
  status?: number
  /** How long the call took, ms. */
  ms: number
  /** The status check first, then each `- expect`. Empty when the Worker never answered. */
  checks: VerifyCheckResult[]
  /** One hint: what to try next (or what passing proved). */
  hint: string
}

/** Where a deploy is checked: POST `action` with `fields` plus the learner's URL under `urlField`. */
export interface VerifyEndpoint {
  action: string
  fields: Record<string, string>
  urlField: string
}

export type VerifyResult = { ok: true; verdict: VerifyVerdict } | { ok: false; message: string }

/** Sends one check to the server and reads the verdict. Never throws (an abort rejects). */
export async function postVerify(endpoint: VerifyEndpoint, url: string, signal?: AbortSignal): Promise<VerifyResult> {
  let body = new FormData()
  for (let [name, value] of Object.entries(endpoint.fields)) body.set(name, value)
  body.set(endpoint.urlField, url)
  let response: Response
  try {
    response = await fetch(endpoint.action, { method: 'POST', body, headers: { Accept: 'application/json' }, signal })
  } catch (error) {
    if (signal?.aborted) throw error
    return { ok: false, message: 'Couldn’t reach bits. Check your connection and try again.' }
  }
  let data = (await response.json().catch(() => null)) as (Partial<VerifyVerdict> & { error?: string; message?: string }) | null
  if (response.ok && data && typeof data.passed === 'boolean') return { ok: true, verdict: data as VerifyVerdict }
  if (data?.message) return { ok: false, message: data.message }
  if (response.status === 429) return { ok: false, message: 'That’s a lot of checks in a row. Give it a minute, then try again.' }
  return { ok: false, message: 'Couldn’t check that Worker. Try again.' }
}
