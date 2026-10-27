// Lesson drafts in the browser (the app's decision 029): what a learner typed
// into an exercise, the code they retyped, and where they stopped a video.
// Every write lands in localStorage at once, so switching modes or lessons
// (client navigation re-creates the islands) finds it there. Signed in, the
// page also passes `sync`, and writes are batched to the server in the
// background (debounced, keepalive, flushed when the page hides); the server
// copy comes back as `saved` on the next page render, so another device
// resumes too. Nothing here blocks typing or playback.

/** Where a lesson's drafts are saved on the server (signed in only). */
export interface DraftSync {
  /** POST URL, e.g. /api/drafts. */
  action: string
  /** Sent with every save: course and lesson. */
  fields: Record<string, string>
}

/** The server's copy of one draft. */
export interface SavedDraft {
  value: string
  /** Epoch ms of the save. */
  at: number
}

/** How an island keeps one draft. */
export interface DraftPersist {
  /** Unique across lessons: keys localStorage (`bits:draft:<id>`). */
  id: string
  /** The draft's name within its lesson on the server, e.g. `prompt:main`. */
  key: string
  saved?: SavedDraft
  sync?: DraftSync
}

const valueKey = (id: string) => `bits:draft:${id}`
const atKey = (id: string) => `bits:draft-at:${id}`

function storage(): Storage | undefined {
  try {
    return window.localStorage
  } catch {
    return undefined
  }
}

/**
 * The newest of the local and server copies, or undefined when neither
 * exists. A local copy newer than the server's (written while signed out,
 * or not yet flushed) is queued for upload: that is the sign-in merge.
 */
export function readDraft(persist: DraftPersist): string | undefined {
  let local: SavedDraft | undefined
  try {
    let store = storage()
    let value = store?.getItem(valueKey(persist.id))
    if (value != null) local = { value, at: Number(store?.getItem(atKey(persist.id))) || 0 }
  } catch {
    // Storage unavailable (private mode): fall back to the server copy.
  }
  let saved = persist.saved
  if (local && (!saved || local.at > saved.at)) {
    if (persist.sync && local.value !== saved?.value) queue(persist, local.value)
    return local.value
  }
  if (saved) {
    // Keep the local copy current, so a signed-out reload still has it.
    writeLocal(persist.id, saved.value, saved.at)
    return saved.value
  }
  return local?.value
}

/** Saves locally now, and on the server soon (when `sync` is set). */
export function writeDraft(persist: DraftPersist, value: string, options: { delay?: number } = {}): void {
  writeLocal(persist.id, value, Date.now())
  if (persist.sync) queue(persist, value, options.delay)
}

function writeLocal(id: string, value: string, at: number) {
  try {
    let store = storage()
    store?.setItem(valueKey(id), value)
    store?.setItem(atKey(id), String(at))
  } catch {
    // Storage full or unavailable: the draft just isn't kept locally.
  }
}

// ---- Server sync --------------------------------------------------------------

interface Pending {
  sync: DraftSync
  values: Map<string, string>
}

const DEFAULT_DELAY = 1500
/** The endpoint takes this many drafts per request. */
const MAX_PER_REQUEST = 8

let pending = new Map<string, Pending>()
let timer: ReturnType<typeof setTimeout> | undefined
let listening = false

function queue(persist: DraftPersist, value: string, delay = DEFAULT_DELAY) {
  let sync = persist.sync!
  let group = `${sync.action}?${new URLSearchParams(sync.fields)}`
  let entry = pending.get(group)
  if (!entry) pending.set(group, (entry = { sync, values: new Map() }))
  entry.values.set(persist.key, value)
  listen()
  // The shortest wait wins, so a position save never delays a typed draft.
  clearTimeout(timer)
  timer = setTimeout(flushDrafts, delay)
}

function listen() {
  if (listening || typeof window === 'undefined') return
  listening = true
  window.addEventListener('pagehide', flushDrafts)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushDrafts()
  })
}

/** Sends every queued draft now (keepalive, so it survives the page going away). */
export function flushDrafts(): void {
  clearTimeout(timer)
  timer = undefined
  let groups = [...pending.values()]
  pending = new Map()
  for (let { sync, values } of groups) {
    let entries = [...values]
    for (let i = 0; i < entries.length; i += MAX_PER_REQUEST) {
      let body = new FormData()
      for (let [name, value] of Object.entries(sync.fields)) body.append(name, value)
      for (let [key, value] of entries.slice(i, i + MAX_PER_REQUEST)) {
        body.append('key', key)
        body.append('value', value)
      }
      // Best effort: a failed save leaves the local copy, which is newer and
      // gets queued again the next time the page reads it.
      fetch(sync.action, { method: 'POST', body, keepalive: true, credentials: 'same-origin' }).catch(() => {})
    }
  }
}
