// Lesson metadata from frontmatter (decision 073): freshness (`verified:`,
// `versions:`), phone or desk (`device:`) and the build-along start
// (`tag:` in the course's `repo:`). Pure: the caller passes today's date, so
// the same build gives the same answer in the CLI, the Worker and tests.
import type { LessonContent, LessonFreshness } from '../../actions/courses/lesson/content.ts'
import { highlight, languageOf } from './highlight.ts'
import { parseIsoDate } from './frontmatter.ts'
import type { CompiledLesson } from './lesson.ts'
import type { FileReport } from './report.ts'

/** A code lesson whose `verified:` is older than this many days gets a warning (decision 073). */
export const DEFAULT_MAX_AGE_DAYS = 120

/** A date as YYYY-MM-DD (UTC), for `FreshnessOptions.today`. */
export function todayIso(now: number = Date.now()): string {
  return new Date(now).toISOString().slice(0, 10)
}

export interface FreshnessOptions {
  /** Today, YYYY-MM-DD. Without it the build checks only that code lessons have a date. */
  today?: string
  /** Older than this (days) is stale. Default 120. */
  maxAgeDays?: number
  /** Report a missing or stale date as an error, not a warning (`pnpm content validate --max-age`). */
  strict?: boolean
}

interface LessonMetaContext {
  /** The course's `repo:`, already validated. */
  repo?: string
  freshness?: FreshnessOptions
  /** The lesson source, to point problems at their frontmatter line. */
  text: string
  report: FileReport
}

/** Adds the frontmatter metadata to a compiled lesson's content, and reports its problems. */
export function applyLessonMeta(lesson: CompiledLesson, context: LessonMetaContext) {
  let { meta, content } = lesson
  let { report } = context
  let line = (key: string) => frontmatterLine(context.text, key)

  if (meta.verified || meta.versions) {
    let freshness: LessonFreshness = { versions: Object.entries(meta.versions ?? {}).map(([name, version]) => [name, String(version)]) }
    if (meta.verified) freshness.verified = meta.verified
    content.freshness = freshness
  }
  if (meta.versions && !meta.verified) report.warning('versions: without verified: say when you ran the code with them', line('versions'))
  // Only builds that ask for it check freshness: the CLI, uploads and the Worker always do.
  if (context.freshness) checkFreshness(meta.verified, hasRunnableCode(content), context.freshness, report, line)

  if (meta.device === 'desk') content.device = 'desk'

  if (meta.tag) {
    if (!context.repo) {
      report.error(`tag: ${meta.tag} needs repo: in course.md (the GitHub repository it's a tag of)`, line('tag'))
    } else {
      let name = context.repo.split('/').pop()!
      let source = [`git clone ${context.repo}`, `cd ${name}`, `git checkout ${meta.tag}`].join('\n')
      content.start = {
        tag: meta.tag,
        href: `${context.repo}/tree/${encodeURIComponent(meta.tag)}`,
        lines: highlight(source, 'sh'),
        language: languageOf('sh').name,
      }
    }
  }
}

/** Lessons with code to run: a `:::code` editor, a `:::terminal` or a ``` sample (decision 073). */
export function hasRunnableCode(content: LessonContent): boolean {
  return content.blocks.some(
    (block) =>
      block.type === 'code' ||
      block.type === 'terminal' ||
      (block.type === 'markdown' && block.paragraphs.some((part) => !Array.isArray(part) && 'sample' in part)),
  )
}

function checkFreshness(
  verified: string | undefined,
  code: boolean,
  options: FreshnessOptions,
  report: FileReport,
  line: (key: string) => number,
) {
  let maxAge = options.maxAgeDays ?? DEFAULT_MAX_AGE_DAYS
  let flag = (text: string, at: number) => (options.strict ? report.error(text, at) : report.warning(text, at))
  let day = verified === undefined ? undefined : parseIsoDate(verified)
  let today = options.today === undefined ? undefined : parseIsoDate(options.today)
  if (day !== undefined && today !== undefined && day > today) {
    report.error(`verified: ${verified} is after today (${options.today})`, line('verified'))
    return
  }
  if (!code) return
  if (day === undefined) {
    flag('this lesson has code but no verified: date: add verified: YYYY-MM-DD and versions: once you have run it', 1)
    return
  }
  if (today === undefined) return
  let age = today - day
  if (age > maxAge) {
    flag(
      `verified: ${verified} is ${age} days old (over ${maxAge}): run the code again with current versions, then update verified: and versions:`,
      line('verified'),
    )
  }
}

/** The 1-based line of a top-level frontmatter key, else 1. */
function frontmatterLine(text: string, key: string): number {
  let lines = text.replace(/\r\n?/g, '\n').split('\n')
  if (lines[0] !== '---') return 1
  for (let i = 1; i < lines.length && lines[i] !== '---'; i++) {
    if (lines[i]!.startsWith(`${key}:`)) return i + 1
  }
  return 1
}

/** The newest of the lessons' `verified:` dates (YYYY-MM-DD sorts as text). */
export function newestVerified(dates: (string | undefined)[]): string | undefined {
  return dates.filter((date): date is string => Boolean(date)).sort().pop()
}
