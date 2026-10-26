import type { Handle } from 'remix/component'
import { clientEntry, css, ref } from 'remix/component'

export interface TurnstileWidgetProps {
  siteKey: string
  /** Checked by the server against siteverify's `action`. */
  action: string
}

interface TurnstileApi {
  render(element: HTMLElement, options: Record<string, unknown>): string
  remove(widgetId: string): void
}

declare global {
  interface Window {
    turnstile?: TurnstileApi
  }
}

/**
 * Cloudflare Turnstile for the email form (handoff: bot check on email
 * sends). Rendered explicitly so it survives enhanced form navigation, which
 * swaps the form without reloading the page: each mount renders a fresh
 * widget and each unmount removes it. `interaction-only` keeps it invisible
 * unless Cloudflare needs the learner to click. The widget writes its token
 * into a hidden `cf-turnstile-response` input inside the form.
 */
export const TurnstileWidget = clientEntry(
  import.meta.url,
  function TurnstileWidget(handle: Handle<TurnstileWidgetProps>) {
    return () => (
      <div
        mix={[
          slotStyle,
          ref((element, signal) => void mount(element as HTMLElement, handle.props, signal)),
        ]}
      />
    )
  },
)

const slotStyle = css({ '&:empty': { display: 'none' } })

async function mount(element: HTMLElement, props: TurnstileWidgetProps, signal: AbortSignal) {
  let turnstile: TurnstileApi
  try {
    turnstile = await loadTurnstile()
  } catch {
    return
  }
  if (signal.aborted) return
  let widgetId = turnstile.render(element, {
    sitekey: props.siteKey,
    action: props.action,
    appearance: 'interaction-only',
    'response-field-name': 'cf-turnstile-response',
  })
  signal.addEventListener('abort', () => turnstile.remove(widgetId), { once: true })
}

let loading: Promise<TurnstileApi> | undefined

function loadTurnstile(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile)
  loading ??= new Promise<TurnstileApi>((resolve, reject) => {
    let script = document.createElement('script')
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
    script.async = true
    script.onload = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error('Turnstile missing')))
    script.onerror = () => {
      loading = undefined
      reject(new Error('Turnstile failed to load'))
    }
    document.head.append(script)
  })
  return loading
}
