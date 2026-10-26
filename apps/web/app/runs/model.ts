// The one place that talks to a model provider (decision 019). /api/run,
// the limits, the journal and the fallback depend only on `runModel`,
// `liveTemperatures` and `ModelError`; none of them imports the SDK, so a
// provider (or a second one for other temperatures) can be swapped in here.
//
// Today: Claude Haiku 5.5 through Cloudflare AI Gateway's Anthropic
// endpoint, with the official SDK pointed at the gateway.
import Anthropic from '@anthropic-ai/sdk'

/** What the model module needs from the Worker env (vars + secrets). */
export interface ModelEnv {
  /** Secret: the Anthropic key the gateway forwards. */
  ANTHROPIC_API_KEY?: string
  /** Secret: AI Gateway token (Authenticated Gateway), sent as cf-aig-authorization. */
  CF_AIG_TOKEN?: string
  AI_GATEWAY_ACCOUNT_ID?: string
  AI_GATEWAY_ID?: string
}

export const LIVE_MODEL = 'claude-haiku-5-5'

/**
 * Temperatures (T × 100) that run live. The Messages API takes no sampling
 * parameters, and Claude samples at temperature 1.0, so only 1.0 is a real
 * run; the lesson's examples stand in for the others (labelled as such).
 * A second provider for other temperatures would extend this list.
 */
export const liveTemperatures: readonly number[] = [100]

export function runsLive(temperature: number): boolean {
  return liveTemperatures.includes(temperature)
}

/** Small on purpose: a tagline-sized answer, no thinking, low effort. */
const MAX_TOKENS = 300
const TIMEOUT_MS = 20_000
const SYSTEM =
  'You are the model in bits, a sandbox where people learn to prompt. ' +
  'Answer the prompt directly and briefly (under 80 words). No preamble.'

export type ModelFailure = 'unconfigured' | 'rate-limited' | 'unavailable'

/** The model can't run this prompt; the caller shows canned output instead. */
export class ModelError extends Error {
  readonly reason: ModelFailure
  constructor(reason: ModelFailure, options?: { cause?: unknown }) {
    super(`Model ${reason}`, options)
    this.name = 'ModelError'
    this.reason = reason
  }
}

export interface Usage {
  input: number
  output: number
}

export interface ModelRun {
  /** The reply text as it streams. Cancelling it aborts the provider request. */
  stream: ReadableStream<string>
  model: string
  /** Token counts, once the stream ends or is cancelled. Never rejects. */
  usage: Promise<Usage>
}

export interface RunModelInput {
  prompt: string
  /** T × 100; must be one of `liveTemperatures`. */
  temperature: number
  signal?: AbortSignal
  env: ModelEnv
}

export function modelConfigured(env: ModelEnv): boolean {
  return Boolean(env.ANTHROPIC_API_KEY && env.AI_GATEWAY_ACCOUNT_ID && env.AI_GATEWAY_ID)
}

export function gatewayBaseUrl(env: ModelEnv): string {
  return `https://gateway.ai.cloudflare.com/v1/${env.AI_GATEWAY_ACCOUNT_ID}/${env.AI_GATEWAY_ID}/anthropic`
}

/**
 * Starts a streamed reply. Resolves once the provider has accepted the
 * request (so limits and outages surface here as a ModelError, before any
 * text is sent to the browser).
 */
export async function runModel({ prompt, temperature, signal, env }: RunModelInput): Promise<ModelRun> {
  if (!runsLive(temperature)) throw new Error(`T=${temperature / 100} does not run live`)
  if (!modelConfigured(env)) throw new ModelError('unconfigured')

  let client = new Anthropic({
    apiKey: env.ANTHROPIC_API_KEY,
    baseURL: gatewayBaseUrl(env),
    defaultHeaders: {
      // SDK 1.x sends the key as `Authorization: Bearer`; the gateway's
      // Anthropic docs use x-api-key, so send that too (same key).
      'x-api-key': env.ANTHROPIC_API_KEY,
      ...(env.CF_AIG_TOKEN ? { 'cf-aig-authorization': `Bearer ${env.CF_AIG_TOKEN}` } : {}),
    },
    // Fall back to the example rather than make the learner wait on retries.
    maxRetries: 0,
    timeout: TIMEOUT_MS,
    // Looked up per call, so tests can stub globalThis.fetch.
    fetch: (input, init) => globalThis.fetch(input, init),
  })

  let message = client.messages.stream(
    {
      model: LIVE_MODEL,
      max_tokens: MAX_TOKENS,
      system: SYSTEM,
      messages: [{ role: 'user', content: prompt }],
      output_config: { effort: 'low' },
      thinking: { type: 'disabled' },
    },
    { signal },
  )

  try {
    await message.withResponse()
  } catch (error) {
    throw toModelError(error)
  }

  // A cut-off reply has no final message; count what the stream reported.
  let usage = message
    .finalMessage()
    .then((final) => final.usage)
    .catch(() => message.currentMessage?.usage)
    .then((counts): Usage => ({ input: counts?.input_tokens ?? 0, output: counts?.output_tokens ?? 0 }))

  let events = message[Symbol.asyncIterator]()
  let stream = new ReadableStream<string>({
    async pull(controller) {
      for (;;) {
        let next = await events.next()
        if (next.done) return controller.close()
        let event = next.value
        if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
          return controller.enqueue(event.delta.text)
        }
      }
    },
    cancel() {
      message.abort()
    },
  })

  return { stream, model: LIVE_MODEL, usage }
}

function toModelError(error: unknown): ModelError {
  if (error instanceof Anthropic.RateLimitError) return new ModelError('rate-limited', { cause: error })
  if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError) {
    // A bad key or gateway token is a config bug, not an outage: say so in the logs.
    console.error(JSON.stringify({ level: 'error', message: 'Model credentials rejected', status: error.status }))
  } else if (error instanceof Anthropic.BadRequestError) {
    console.error(JSON.stringify({ level: 'error', message: 'Model request rejected', error: error.message }))
  }
  return new ModelError('unavailable', { cause: error })
}
