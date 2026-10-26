// Browser side of POST /api/run (the app's decision 019), shared by the
// PromptComposer and the Terminal prompt. The server answers with plain text,
// streamed; headers say whether it is a live model reply or canned output.

/** Where an exercise's runs go, and the fields that identify the exercise. */
export interface RunEndpoint {
  /** POST URL, e.g. /api/run. */
  action: string
  /** Sent with every run, e.g. course, lesson, exercise. */
  fields: Record<string, string>
}

export interface RunResult {
  /** live: the model ran. example/fallback: canned output. error: no answer from the server. */
  source: 'live' | 'example' | 'fallback' | 'error'
  /** Why a fallback happened (limit, budget, unavailable, …). */
  reason?: string
  text: string
  /** The server journalled this run, so it counts toward the run checks. */
  counted: boolean
}

/**
 * Posts one run and reports the text so far as it streams. An aborted run
 * (the learner ran again) rejects with the AbortError.
 */
export async function streamRun(
  endpoint: RunEndpoint,
  input: { prompt: string; temperature: number },
  options: { signal?: AbortSignal; onText?: (text: string) => void } = {},
): Promise<RunResult> {
  let body = new FormData()
  for (let [name, value] of Object.entries(endpoint.fields)) body.append(name, value)
  body.append('prompt', input.prompt)
  body.append('temperature', String(input.temperature))

  let response: Response
  try {
    response = await fetch(endpoint.action, { method: 'POST', body, signal: options.signal })
  } catch (error) {
    if (options.signal?.aborted) throw error
    return { source: 'error', text: '', counted: false }
  }
  let source = response.headers.get('X-Run-Source')
  if (!response.ok || !response.body || (source !== 'live' && source !== 'example' && source !== 'fallback')) {
    return { source: 'error', reason: response.status === 429 ? 'refused' : undefined, text: '', counted: false }
  }

  let text = ''
  let reader = response.body.pipeThrough(new TextDecoderStream()).getReader()
  try {
    for (;;) {
      let next = await reader.read()
      if (next.done) break
      text += next.value
      options.onText?.(text)
    }
  } catch (error) {
    if (options.signal?.aborted) throw error
    // Cut off mid-reply: keep what arrived; the run was journalled.
    return { source: 'error', reason: 'interrupted', text, counted: true }
  }
  return { source, reason: response.headers.get('X-Run-Reason') ?? undefined, text, counted: true }
}

/** The one-line note shown above a reply that isn't a complete live run. */
export function runNote(result: RunResult): string | undefined {
  if (result.source === 'example') return 'Example output: this temperature doesn’t run live.'
  if (result.source === 'fallback') {
    if (result.reason === 'limit') return 'You’ve reached the hourly run limit — showing the example output.'
    if (result.reason === 'budget') return 'Live runs are paused for today — showing the example output.'
    return 'Couldn’t reach the model — showing the example output.'
  }
  if (result.source === 'error') {
    if (result.reason === 'interrupted') return 'The reply was cut off.'
    if (result.reason === 'refused') return 'Too many runs — take a break, then try again. Showing the example output.'
    return 'Couldn’t reach the server — showing the example output.'
  }
  return undefined
}
