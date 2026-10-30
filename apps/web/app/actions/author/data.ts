// Data for /author and /author/:course (docs/design/spec/pages/Authoring.md),
// read from the content index in D1 (courses, course_versions,
// course_authors) and the built manifests in R2 (decision 018).
import {
  readAuthorCourses,
  type AuthorCourseRows,
  type Course,
  type CourseVersion as VersionRow,
  type D1DataTableDatabase,
  type ReportItem,
} from '@bits/db'

// report.ts, not the compile index: the Worker loads the compiler lazily.
import { formatItem } from '../../content/compile/report.ts'
import { loadManifest } from '../../content/store.ts'
import { tracks, type CourseInfo, type CourseManifest } from '../../content/types.ts'

export type ValidationLevel = ReportItem['level']

export interface ValidationItem {
  level: ValidationLevel
  text: string
}

export interface CourseVersion {
  n: number
  /** `live` is the published pointer; `draft` is the latest build when it isn't live. */
  state: 'live' | 'draft' | 'previous'
  /** The build has errors (or never finished uploading): it can't go live. */
  failed?: boolean
  when: string
  source: string
}

export interface VideoUpload {
  file: string
  lesson: string
  /**
   * ready: the latest build plays it. uploaded: in R2, linked by the next
   * build. uploading: started, not finished (resumable). missing: no upload
   * (the lesson publishes text-only). Decision 029.
   */
  status: 'ready' | 'uploaded' | 'uploading' | 'missing'
  /** Upload progress for `uploading`, 0–100. */
  pct?: number
  duration?: string
}

export interface TreeNode {
  name: string
  depth: number
  kind: 'folder' | 'course' | 'file' | 'asset' | 'more'
  selected?: boolean
}

export interface AuthorCourse {
  course: CourseInfo
  /** The course folder name in the repo or upload. */
  folder: string
  files: number
  /** When the latest build was uploaded ("4 min ago"). */
  lastPush: string
  /** Latest build. */
  build: number
  /** Published version, if any. */
  live?: number
  /** The latest build's validation report. */
  items: ValidationItem[]
  versions: CourseVersion[]
  videos: VideoUpload[]
  /** The newest clean build and its first lesson: what "Preview draft" opens. */
  preview?: { n: number; lesson: string }
  /** The file shown in the Source pane, when there is one. */
  source?: { tree: TreeNode[]; file: string; markdown: string }
  /** users.id of the authors who own it. */
  ownerIds: string[]
}

/** The GitHub sync card is a stub until the webhook milestone. */
export const repo = { name: 'jamie-park/courses', branch: 'main', connected: true }

/** Authors manage the courses they own; admins manage every course (handoff, Roles). */
export function canManageCourse(user: { id: string; role: string }, item: Pick<AuthorCourse, 'ownerIds'>): boolean {
  if (user.role === 'admin') return true
  return user.role === 'author' && item.ownerIds.includes(user.id)
}

/** The courses this user may open in /author: one D1 batch, then the manifests (decision 035). */
export async function getManagedCourses(
  db: D1DataTableDatabase,
  bucket: R2Bucket,
  user: { id: string; role: string },
): Promise<AuthorCourse[]> {
  let rows = await readAuthorCourses(db, { user })
  return Promise.all(rows.map((row) => authorCourse(bucket, row)))
}

export async function getAuthoredCourse(db: D1DataTableDatabase, bucket: R2Bucket, slug: string): Promise<AuthorCourse | undefined> {
  let [row] = await readAuthorCourses(db, { slug })
  return row ? authorCourse(bucket, row) : undefined
}

async function authorCourse(bucket: R2Bucket, rows: AuthorCourseRows, now = Date.now()): Promise<AuthorCourse> {
  let { course: row, versions, authorIds: ownerIds, videos: uploads } = rows
  let latest = versions[0]
  let live = versions.find((version) => version.id === row.current_version_id)
  let ready = versions.find((version) => version.status === 'ready')
  let manifest = ready ? await loadManifest(ready, bucket) : undefined
  let firstLesson = manifest?.modules[0]?.lessons[0]?.slug
  return {
    course: manifest ? cardOf(manifest) : placeholderCard(row),
    folder: row.slug,
    files: latest?.files ?? 0,
    lastPush: latest ? ago(latest.created_at, now) : 'never',
    build: latest?.n ?? 0,
    live: live?.n,
    items: (latest?.report ?? []).map((item) => ({ level: item.level, text: formatItem(item) })),
    versions: versions.map((version) => versionOf(version, live?.n, latest?.n, now)),
    videos: (manifest?.videos ?? []).map((video): VideoUpload => {
      let upload = uploads.get(video.file)
      let base = { file: video.file, lesson: `L${video.n} · ${video.lesson}` }
      if (upload?.status === 'uploading') {
        let parts = Math.ceil(upload.size / upload.part_size)
        return { ...base, status: 'uploading', pct: Math.round((upload.parts.length / parts) * 100) }
      }
      let duration = upload?.duration_s ?? video.duration
      if (video.found) return { ...base, status: 'ready', duration: clock(duration) }
      if (upload?.status === 'ready') return { ...base, status: 'uploaded', duration: clock(duration) }
      return { ...base, status: 'missing' }
    }),
    preview: ready && firstLesson ? { n: ready.n, lesson: firstLesson } : undefined,
    ownerIds,
  }
}

function cardOf(manifest: CourseManifest): CourseInfo {
  let { slug, title, desc, track, level, lessons, mins, sigil, tone, pattern, formats } = manifest
  return { slug, title, desc, track, level, lessons, mins, sigil, tone, pattern, formats }
}

/** A course none of whose builds is clean: enough for its row and header. */
function placeholderCard(row: Course): CourseInfo {
  return {
    slug: row.slug,
    title: row.title,
    desc: '',
    track: tracks.find((track) => track === row.track) ?? 'Foundations',
    level: 'Beginner',
    lessons: 0,
    mins: 0,
    sigil: row.title.slice(0, 3),
    tone: 'volt',
    pattern: 'dots',
    formats: ['text'],
  }
}

function versionOf(version: VersionRow, live: number | undefined, latest: number | undefined, now: number): CourseVersion {
  let when =
    version.status === 'failed'
      ? `${plural(version.errors, 'error')} · built ${ago(version.created_at, now)}`
      : version.published_at
        ? `published ${shortDate(version.published_at)}`
        : `built ${ago(version.created_at, now)}`
  return {
    n: version.n,
    state: version.n === live ? 'live' : version.n === latest ? 'draft' : 'previous',
    failed: version.status !== 'ready' || undefined,
    when,
    source: version.source,
  }
}

/** "just now", "4 min ago", "2 h ago", "yesterday", then a date. */
export function ago(at: number, now = Date.now()): string {
  let minutes = Math.floor((now - at) / 60_000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes} min ago`
  let hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} h ago`
  if (hours < 48) return 'yesterday'
  return shortDate(at)
}

function shortDate(at: number): string {
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(at)
}

function clock(seconds: number): string {
  let s = Math.round(seconds)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

export function counts(items: ValidationItem[]) {
  return {
    errors: items.filter((i) => i.level === 'error').length,
    warnings: items.filter((i) => i.level === 'warning').length,
  }
}

export const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

/** Block reference rows (artboard lines 213–221), with the attrs the build accepts. */
export const blocks = [
  { name: 'plain markdown', attrs: '—', what: 'A tutor message. --- starts a new message; ::ask[…] adds the learner’s line. **strong**, `code`, ==mark== and [links](/courses/…) work inline; links are site paths or https:// URLs.' },
  { name: '- lists / 1. lists', attrs: '—', what: 'Bulleted (-) and numbered (1.) lists in a tutor message, with inline markdown in each item and one level of nesting (indent two spaces). Items hold text only: put a code sample after the list. - [ ] task items are for :::quiz.' },
  { name: '``` sample', attrs: 'lang (ts, js, py, sh, json, env; none = plain text)', what: 'A static, highlighted, read-only code sample with a Copy key: no tabs, drafts or type mode (use :::code for an editor). Close it with its own ``` line. Inside :::new or :::engineer it needs no longer fence, unless the sample itself has a ::: line.' },
  { name: '### subheading', attrs: '—', what: 'Starts a new tutor message under a subheading (an h2 on the page: the lesson title is the h1). Only ###; #, ## and #### are errors.' },
  { name: ':::prompt', attrs: 'id, xp, model?, temperature?', what: 'The “Your turn” composer. Each “- check” line is a live goal; “- run” requires specific runs before it passes. In “- draft”, “- placeholder” and “- example” strings, \\n is a line break.' },
  { name: ':::code', attrs: 'file, lang, copy, type-mode, highlight="12-32", label?, focus?', what: 'The editor: tabs, syntax highlighting, copy button, optional retype-it mode. Adjacent blocks become tabs; close each with its own ::: line.' },
  { name: ':::ask', attrs: 'id, xp, gate?, multiple?', what: 'A quick check in the prompt window, graded on the server. The question, then - accept "label" /pattern/i (every one must match), - reject "label" /pattern/i "feedback", - choice "text" correct? "why" (chips that fill the field), - hint, - explain, - placeholder. Patterns use the check grammar. It gates Complete lesson unless gate=false.' },
  { name: ':::quiz', attrs: 'id, xp, multiple?, gate?', what: 'Single or multiple choice, marked with [x], explanations under each option. Builds into a choice-only :::ask: tap an option or type its letter or text.' },
  { name: ':::odds / :::tokenizer', attrs: 'prompt, slider / sample?, illustrative?', what: 'Built-in toys: next-token probability bars, live tokenizer.' },
  { name: ':::terminal', attrs: 'cmd, ask?, summary?', what: 'A scripted run log shown in the output panel. Right after :::code it becomes that editor’s Run output, ask and summary included.' },
  { name: ':::nexttoken', attrs: 'prompt, illustrative?', what: 'A reply forming token by token. One line per step: " Paris" 0.92 | " the":0.03 " a":0.02' },
  { name: ':::training', attrs: 'prompt, illustrative?', what: 'A scrubber over training snapshots with a loss sparkline. Lines: - step 500 loss=6.1 "output"' },
  { name: ':::attention', attrs: 'caption?, illustrative?', what: 'Click a token to see what it attends to. A tokens "The" " cat" … line, then - from=7 to=1 w=0.62 (0-based).' },
  { name: ':::compare', attrs: 'left, right, illustrative?', what: 'Two answers side by side. Lines: - prompt "…", - left "…", - right "…".' },
  { name: ':::rabbithole', attrs: '—', what: 'Up to 3 links: - video "Title" by="3Blue1Brown" mins=8 url="https://…" (or - read …; deep for long pieces).' },
  { name: ':::new / :::engineer', attrs: '—', what: 'Two reading depths of one idea: :::new for someone brand new to AI, :::engineer for the mechanism and the point. The learner picks one and every lesson follows it; text outside both is shared. They hold prose (lists, ``` samples and ### included), ::ask lines, :::code, :::terminal, :::odds, :::tokenizer and the toys, never :::prompt, :::ask, :::quiz or :::rabbithole (those stay shared, so progress never depends on depth). To hold a ::: block, use a longer fence: ::::new … ::::; prose and ``` samples need only :::. They don’t nest; one depth without the other is a warning.' },
  { name: 'video: (frontmatter)', attrs: 'path, chapters?', what: 'Puts the video player at the top of the lesson, above the first block. Lessons without it stay text-only.' },
]
