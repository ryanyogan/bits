import {
  detectMultipleImportMapSupport,
  importModule,
  preloadShim,
} from 'remix/multiple-import-maps-polyfill'
import { run, type ResolveFrameOptions } from 'remix/component'

import { installNavigationFeedback } from './navigation-feedback.ts'

const app = run({
  async loadModule(moduleUrl, exportName) {
    let mod = await importModule(moduleUrl)
    let Component = mod[exportName]
    if (typeof Component !== 'function') {
      throw new Error(`Unknown component: ${moduleUrl}#${exportName}`)
    }
    return Component
  },
  resolveFrame,
  async processClientEntryPreloads(preloads) {
    if (await detectMultipleImportMapSupport()) return preloads

    preloadShim(preloads)
    return []
  },
})

// Pending forms (aria-busy submitter, no double submit) and the top progress bar.
installNavigationFeedback(app.frames.top)

// A failed enhanced navigation falls back to the browser's own (guide 12,
// "Handle browser runtime errors at the app root"). The resolver rejects a
// GET's 5xx, a redirect to another origin or a non-HTML redirect, so
// without this the page would just freeze: a link becomes a document load
// of its destination. A submission is never sent twice (it may have done
// its work before failing): `resolveFrame` renders a POST's 5xx in place,
// as the browser would without JS, and a POST that got no answer at all
// (offline) leaves the page as it was, with its pending state cleared.
let navigating = false
let lastNavigation: { url: string; post: boolean } | null = null
app.frames.top.addEventListener('reloadStart', () => (navigating = true))
app.frames.top.addEventListener('reloadComplete', () => (navigating = false))
window.navigation?.addEventListener('navigate', (event) => {
  lastNavigation = { url: event.destination.url, post: event.formData != null }
})

app.addEventListener('error', (event) => {
  console.error('Browser runtime error:', event.error)
  if (!navigating || !lastNavigation) return
  let { url, post } = lastNavigation
  lastNavigation = null
  if (!post) window.location.assign(url)
})

/**
 * The runtime's default resolver (remix/component README, "Frame
 * Navigation"; guide 12, "Own frame-resolution failures"), except that a
 * submission's 5xx is returned for the runtime to render instead of
 * rejecting. An answer that isn't HTML (the router's plain-text 500) is
 * wrapped in a minimal page that keeps the current stylesheets.
 */
async function resolveFrame(src: string, options?: ResolveFrameOptions): Promise<Response> {
  let headers = new Headers({ Accept: 'text/html', 'X-Remix-Frame': 'true' })
  if (options?.target != null) headers.set('X-Remix-Target', options.target)
  let { body, encType } = requestBody(options)
  if (encType) headers.set('Content-Type', encType)
  let response = await fetch(src, {
    body,
    headers,
    method: options?.method,
    mode: 'same-origin',
    signal: options?.signal,
  })

  let isHtml = response.headers.get('Content-Type')?.toLowerCase().includes('text/html') ?? false
  if (response.status >= 500 && isSubmission(options)) return isHtml ? response : failurePage(response)
  if (response.status >= 500 || (response.status >= 300 && !isHtml)) {
    throw new Error(`Failed to resolve frame: ${response.status} ${response.statusText}`.trimEnd())
  }
  return response
}

function isSubmission(options?: ResolveFrameOptions): boolean {
  return !['get', 'head'].includes((options?.method ?? 'get').toLowerCase())
}

/** The default resolver's body encoding: urlencoded, multipart or text/plain. */
function requestBody(options?: ResolveFrameOptions): { body?: BodyInit; encType?: string } {
  let formData = options?.formData
  if (!formData || !isSubmission(options)) return {}
  let encType = options?.encType?.toLowerCase()
  if (encType === 'multipart/form-data') return { body: formData }
  let crlf = (value: string) => value.replace(/\r\n|\r|\n/g, '\r\n')
  let text = (value: FormDataEntryValue) => crlf(typeof value === 'string' ? value : value.name)
  if (encType === 'text/plain') {
    let body = ''
    for (let [name, value] of formData) body += `${crlf(name)}=${text(value)}\r\n`
    return { body: new Blob([body], { type: 'text/plain' }), encType: 'text/plain' }
  }
  let body = new URLSearchParams()
  for (let [name, value] of formData) body.append(crlf(name), text(value))
  return { body, encType: 'application/x-www-form-urlencoded' }
}

/** A plain page for a failed submission whose answer isn't HTML. */
async function failurePage(response: Response): Promise<Response> {
  let detail = (await response.text().catch(() => '')).trim().slice(0, 300)
  let page = document.implementation.createHTMLDocument('Something went wrong')
  // The current stylesheets (keyed, so the reconcile keeps them in place).
  for (let el of document.head.querySelectorAll('meta[name="viewport"], style, link[rel="stylesheet"], link[rel="icon"]')) {
    page.head.append(page.importNode(el, true))
  }
  let main = page.createElement('main')
  main.id = 'main'
  main.tabIndex = -1
  main.style.padding = 'var(--space-9) var(--page-gutter)'
  let heading = page.createElement('h1')
  heading.textContent = 'That didn’t go through.'
  let status = page.createElement('p')
  status.textContent = `The server answered ${response.status}${detail ? `: ${detail}` : '.'}`
  let back = page.createElement('a')
  back.href = window.location.href
  back.textContent = 'Back to the page'
  main.append(heading, status, back)
  page.body.append(main)
  return new Response(`<!doctype html>${page.documentElement.outerHTML}`, {
    status: response.status,
    statusText: response.statusText,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}

if (import.meta.hot) {
  import.meta.hot.on('server:update', async () => {
    try {
      await app.ready()
      await app.frames.top.reload()
    } catch (error) {
      console.error('Error reloading top frame on server update', error)
    }
  })
}
