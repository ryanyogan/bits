import {
  detectMultipleImportMapSupport,
  importModule,
  preloadShim,
} from 'remix/multiple-import-maps-polyfill'
import { run } from 'remix/component'

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
  async processClientEntryPreloads(preloads) {
    if (await detectMultipleImportMapSupport()) return preloads

    preloadShim(preloads)
    return []
  },
})

// Pending forms (aria-busy submitter, no double submit) and the top progress bar.
installNavigationFeedback(app.frames.top)

// A failed enhanced navigation falls back to the browser's own (guide 12,
// "Handle browser runtime errors at the app root"). The default resolver
// rejects a 5xx, a redirect to another origin or a non-HTML redirect, so
// without this the page would just freeze. A link becomes a document load
// of its destination; a form is submitted again natively, so the browser
// shows whatever the server answers.
let navigating = false
let lastNavigation: { url: string; source: Element | null; post: boolean } | null = null
app.frames.top.addEventListener('reloadStart', () => (navigating = true))
app.frames.top.addEventListener('reloadComplete', () => (navigating = false))
window.navigation?.addEventListener('navigate', (event) => {
  lastNavigation = { url: event.destination.url, source: event.sourceElement ?? null, post: event.formData != null }
})

app.addEventListener('error', (event) => {
  console.error('Browser runtime error:', event.error)
  if (!navigating || !lastNavigation) return
  let { url, source, post } = lastNavigation
  lastNavigation = null
  let form = source instanceof HTMLFormElement ? source : (source as HTMLButtonElement | null)?.form
  if (post && form) {
    form.setAttribute('data-rmx-document', '')
    let submitter = source instanceof HTMLButtonElement || source instanceof HTMLInputElement ? source : undefined
    form.requestSubmit(submitter)
    return
  }
  window.location.assign(post ? window.location.href : url)
})

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
