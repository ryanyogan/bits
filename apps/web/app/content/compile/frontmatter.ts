// Frontmatter: YAML parsed with line numbers, validated with remix/data-schema
// so every problem names its key and line.
import {
  array,
  boolean,
  enum_,
  number,
  object,
  optional,
  parseSafe,
  record,
  string,
  union,
  type Schema,
} from 'remix/data-schema'
import { max, min, minLength } from 'remix/data-schema/checks'
import { isMap, isScalar, LineCounter, parseDocument, type Node as YamlNode } from 'yaml'
import type { CoverPattern } from '@bits/ui/course-cover'
import { coverPatterns } from '@bits/ui/course-cover'

import { MAX_LESSON_XP } from '../limits.ts'
import type { FileReport } from './report.ts'

const slugPattern = /^[a-z0-9][a-z0-9-]*$/

const text = () => string().pipe(minLength(1))
const slug = () =>
  string().refine((value) => slugPattern.test(value), 'Expected lowercase letters, digits and dashes (like "my-course")')
/** A calendar date, `YYYY-MM-DD` (unquoted YAML dates stay strings in YAML 1.2). */
const isoDate = () =>
  string().refine((value) => parseIsoDate(value) !== undefined, 'Expected a date like 2026-11-03 (YYYY-MM-DD)')
/** An npm package name, scoped or not. */
const packageName = () =>
  string().refine(
    (value) => /^(@[a-z0-9][a-z0-9._~-]*\/)?[a-z0-9][a-z0-9._~-]*$/.test(value) && value.length <= 214,
    'Expected an npm package name, like agents or "@cloudflare/ai-chat"',
  )
/** An exact version: `4.45.2` or `1.0.0-beta.3`, never a range. */
const exactVersion = () =>
  union([string(), number()]).refine(
    (value) => typeof value === 'string' && EXACT_VERSION.test(value),
    'Expected an exact version in quotes, like "4.45.2" (no ranges)',
  )
/** A git tag in the course repo: letters, digits, `.`, `_`, `-` (like a-03). */
export function isGitTag(value: string): boolean {
  return /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(value) && !value.includes('..') && !value.endsWith('.lock')
}
const gitTag = () => string().refine(isGitTag, 'Expected a git tag like a-03 (letters, digits, dots, dashes, underscores)')
/** The course's reference repo: an https GitHub repository URL. */
const githubRepo = () =>
  string().refine(
    (value) => parseGithubRepo(value) !== undefined,
    'Expected an https GitHub repository URL, like https://github.com/ryanyogan/klippy',
  )
/** `4:30`, `1:02:03` or seconds. */
const clock = () =>
  union([number().pipe(min(0)), string().refine((value) => parseClock(value) !== undefined, 'Expected seconds or m:ss')])

export const CourseFrontmatter = object(
  {
    title: text(),
    slug: optional(slug()),
    track: enum_(['foundations', 'prompting', 'tools', 'agents']),
    level: enum_(['beginner', 'intermediate', 'advanced']),
    summary: text(),
    /**
     * `free` (default) or `pro` (decision 048: a tag only, nothing is gated),
     * or `soon` (decision 073): listed with its outline, no lesson opens.
     */
    access: optional(enum_(['free', 'pro', 'soon'])),
    /** Catalog position, low first (decision 073: the build-along sequence). */
    order: optional(number().pipe(min(0)).refine(Number.isInteger, 'Expected a whole number')),
    /** The build-along reference repo (decision 073): lessons with `tag:` start from its tags. */
    repo: optional(githubRepo()),
    outcomes: array(text()).refine((list) => list.length > 0, 'Expected at least one outcome'),
    cover: object(
      {
        pattern: enum_(coverPatterns as [CoverPattern, ...CoverPattern[]]),
        sigil: text(),
        tone: optional(enum_(['volt', 'ion', 'synapse'])),
      },
      { unknownKeys: 'error' },
    ),
    badge: object({ id: optional(slug()), name: text(), glyph: text() }, { unknownKeys: 'error' }),
    authors: optional(array(text())),
    /** Secondary hero CTA when lesson 1 has a video ("Watch the 90-second intro"). */
    intro: optional(text()),
    /** "You stopped at the exercise: …" hint on the course page. */
    exercise: optional(text()),
  },
  { unknownKeys: 'error' },
)

export const LessonFrontmatter = object(
  {
    title: text(),
    order: number().pipe(min(1)),
    minutes: number().pipe(min(1), max(240)),
    xp: number().pipe(min(0), max(MAX_LESSON_XP)).refine(Number.isInteger, 'Expected a whole number'),
    slug: optional(slug()),
    /** Syllabus module; lessons with the same module sit together. */
    module: optional(text()),
    /** A checkpoint project lesson (◆ in the syllabus). */
    project: optional(boolean()),
    /** Asset path of the lesson video, e.g. assets/06-temperature.mp4. */
    video: optional(text()),
    /** Video length until the video provider reports it. */
    duration: optional(clock()),
    chapters: optional(array(object({ at: clock(), title: text() }, { unknownKeys: 'error' }))),
    /** Labels every toy in the lesson as illustrative (a block can say illustrative=false). */
    illustrative: optional(boolean()),
    /** Canned Terminal-mode replies until the tutor model is wired up. */
    replies: optional(object({ hint: text(), fallback: text() }, { unknownKeys: 'error' })),
    /** The day the lesson's code was last run against `versions` (decision 073). */
    verified: optional(isoDate()),
    /** Packages the lesson was verified with, each at an exact version (decision 073). */
    versions: optional(record(packageName(), exactVersion())),
    /** `desk` for build steps that need a computer; `any` (default) works on a phone (decision 073). */
    device: optional(enum_(['any', 'desk'])),
    /** The course repo's tag this lesson starts from, e.g. a-03 (needs `repo:` in course.md; decision 073). */
    tag: optional(gitTag()),
  },
  { unknownKeys: 'error' },
)

export interface Frontmatter<T> {
  value?: T
  /** 1-based line of the closing `---`, where the body starts. */
  bodyLine: number
}

/**
 * Validates YAML frontmatter. `yaml` is the text between the `---` fences
 * and `firstLine` the 1-based line of its first row. Problems go to `report`
 * with the offending key's line.
 */
export function readFrontmatter<T>(schema: Schema<unknown, T>, yaml: string, firstLine: number, report: FileReport): T | undefined {
  let lineCounter = new LineCounter()
  let doc = parseDocument(yaml, { lineCounter, prettyErrors: false })
  let lineAt = (offset: number) => firstLine - 1 + lineCounter.linePos(offset).line
  if (doc.errors.length) {
    for (let error of doc.errors) report.error(`frontmatter isn't valid YAML: ${error.message.split('\n')[0]}`, lineAt(error.pos[0]))
    return undefined
  }
  let data: unknown = doc.toJS()
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    report.error('frontmatter must be a list of `key: value` lines', firstLine)
    return undefined
  }
  let result = parseSafe(schema, data)
  if (result.success) return result.value
  for (let issue of result.issues) {
    let path = (issue.path ?? []).map((part) => (typeof part === 'object' ? part.key : part)) as (string | number)[]
    let node = nodeAt(doc.contents, path)
    let line = node?.range ? lineAt(node.range[0]) : firstLine
    let where = path.length ? `${formatPath(path)}: ` : ''
    let message = issue.message === 'Unknown key' ? `unknown key (check the spelling)` : issue.message
    if (issue.message === 'Expected string' || issue.message === 'Expected number' || issue.message === 'Expected array') {
      if (valueAt(data, path) === undefined) message = 'is required'
    }
    report.error(`${where}${message}`, line)
  }
  return undefined
}

function formatPath(path: (string | number)[]): string {
  return path.map((part, i) => (typeof part === 'number' ? `[${part}]` : i ? `.${part}` : part)).join('')
}

function valueAt(data: unknown, path: (string | number)[]): unknown {
  let value = data
  for (let part of path) {
    if (!value || typeof value !== 'object') return undefined
    value = (value as Record<string | number, unknown>)[part]
  }
  return value
}

/** The YAML node at `path` (the key's node for map entries), or the deepest parent found. */
function nodeAt(node: unknown, path: (string | number)[]): YamlNode | undefined {
  let current = node as YamlNode | undefined
  for (let part of path) {
    if (!current) return undefined
    if (isMap(current)) {
      let pair = current.items.find((item) => isScalar(item.key) && item.key.value === part)
      if (!pair) return current
      current = (pair.value as YamlNode | null) ?? (pair.key as YamlNode)
      if (part === path[path.length - 1]) return pair.key as YamlNode
    } else if ('items' in current && Array.isArray((current as { items: unknown[] }).items)) {
      let item = (current as { items: unknown[] }).items[part as number] as YamlNode | undefined
      if (!item) return current
      current = item
    } else {
      return current
    }
  }
  return current
}

/** Seconds from `4:30`, `1:02:03` or a number; undefined when it's neither. */
export function parseClock(value: string | number): number | undefined {
  if (typeof value === 'number') return value >= 0 ? value : undefined
  let parts = value.trim().split(':')
  if (parts.length < 2 || parts.length > 3 || parts.some((part) => !/^\d+$/.test(part))) {
    return /^\d+(\.\d+)?$/.test(value.trim()) ? Number(value) : undefined
  }
  return parts.reduce((total, part) => total * 60 + Number(part), 0)
}

/** `1.2.3`, `0.33.1`, `1.0.0-beta.3`: semver with no range operators. */
const EXACT_VERSION = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/

/** Days since 1970-01-01 for a real `YYYY-MM-DD` date; undefined otherwise (2026-02-30 included). */
export function parseIsoDate(value: string): number | undefined {
  let match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return undefined
  let [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])]
  let time = Date.UTC(year, month - 1, day)
  let date = new Date(time)
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return undefined
  return time / 86_400_000
}

/** `https://github.com/owner/repo` (a trailing `/` dropped), or undefined for anything else. */
export function parseGithubRepo(value: string): string | undefined {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    return undefined
  }
  if (url.protocol !== 'https:' || url.hostname !== 'github.com' || url.port || url.username || url.password) return undefined
  if (url.search || url.hash || value.includes('?') || value.includes('#')) return undefined
  let parts = url.pathname.replace(/\/$/, '').split('/').slice(1)
  if (parts.length !== 2) return undefined
  let [owner, repo] = parts as [string, string]
  if (!/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/.test(owner)) return undefined
  if (!/^[A-Za-z0-9._-]{1,100}$/.test(repo) || repo === '.' || repo === '..' || repo.endsWith('.git')) return undefined
  return `https://github.com/${owner}/${repo}`
}
