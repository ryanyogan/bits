// A course folder → a validated build: the manifest, every lesson's
// compiled JSON and the validation report. Errors block publishing;
// warnings don't (handoff "Validation").
import type { CourseFormat } from '@bits/ui/course-card'

import type { LessonContent } from '../../actions/courses/lesson/content.ts'
import {
  levels,
  tracks,
  type CourseManifest,
  type LessonInfo,
  type ModuleInfo,
  type Tone,
  type Track,
} from '../types.ts'
import { CourseFrontmatter, readFrontmatter } from './frontmatter.ts'
import { compileLesson, parseMarkdown, type CompiledLesson, type LinkedVideo } from './lesson.ts'
import { Report, type ReportItem, type SourceFile } from './report.ts'

export interface CourseBuild {
  /** course.md `slug`, else the folder name. */
  slug: string
  /** course.md `title`, else the slug. */
  title: string
  track: Track | null
  /** Catalog position (course.md `order`). */
  sort: number
  report: ReportItem[]
  errors: number
  warnings: number
  /** Files in the folder. */
  files: number
  /** Present only when there are no errors. */
  manifest?: CourseManifest
  lessons?: Map<string, LessonContent>
}

export interface BuildOptions {
  /** The folder's name: the slug when course.md doesn't set one. */
  folder: string
  /**
   * Ready uploaded videos (decision 029): course slug + a lesson's `video:`
   * path → where it plays. The build stays pure; callers look them up first.
   */
  videos?: (course: string, path: string) => LinkedVideo | undefined
}

const TONES: Tone[] = ['volt', 'ion', 'synapse']

/** Builds one course folder. Never throws on bad content: it reports it. */
export function buildCourse(sourceFiles: SourceFile[], options: BuildOptions): CourseBuild {
  let report = new Report()
  let files = new Map(sourceFiles.map((file) => [file.path, file]))
  let fallbackSlug = options.folder.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '') || 'course'

  // ---- course.md
  let courseFile = files.get('course.md')
  let course: ReturnType<typeof readCourse> | undefined
  if (!courseFile) {
    report.error('course.md is missing: every course folder needs one', 'course.md')
  } else {
    course = readCourse(courseFile, report)
  }
  if (course && report.count('error', 'course.md') === 0) report.ok('course.md frontmatter valid')
  let slug = course?.meta?.slug ?? fallbackSlug
  if (!course?.meta?.slug && !/^[a-z0-9][a-z0-9-]*$/.test(options.folder)) {
    report.error(`folder name "${options.folder}" isn't a slug; set slug: in course.md`, 'course.md')
  }

  // ---- lessons
  let lessonFiles = sourceFiles
    .filter((file) => /^[^/]+\.md$/i.test(file.path) && !/^(course|readme)\.md$/i.test(file.path))
    .sort((a, b) => a.path.localeCompare(b.path))
  if (!lessonFiles.length) report.error('the course has no lessons: add 01-first-lesson.md next to course.md')

  let compiled: (CompiledLesson & { file: string })[] = []
  for (let file of lessonFiles) {
    let lesson = compileLesson(file, {
      files,
      report: report.forFile(file.path),
      videos: options.videos && ((path) => options.videos!(slug, path)),
    })
    if (lesson) compiled.push({ ...lesson, file: file.path })
  }

  checkOrder(compiled, report)
  let modules = groupModules(compiled, course?.meta?.title ?? slug, report)

  let prompts = compiled.reduce((sum, lesson) => sum + lesson.stats.prompts, 0)
  let patterns = compiled.reduce((sum, lesson) => sum + lesson.stats.patterns, 0)
  let promptErrors = report.items.some((item) => item.level === 'error' && /:::prompt/.test(item.text))
  let regexErrors = report.items.some((item) => item.level === 'error' && /^check “/.test(item.text))
  if (prompts && !promptErrors) report.ok(`${prompts} prompt block${prompts === 1 ? '' : 's'}, each has a check`)
  if (patterns && !regexErrors) report.ok('regex checks compile')
  let videos = compiled.flatMap((lesson) => (lesson.stats.video ? [lesson.stats.video] : []))
  if (videos.length) {
    let found = videos.filter((video) => video.found).length
    report.ok(`${found} of ${videos.length} video${videos.length === 1 ? '' : 's'} uploaded and ready`)
  }

  let build: CourseBuild = {
    slug,
    title: course?.meta?.title ?? slug,
    track: course?.meta ? titleCase(course.meta.track, tracks) : null,
    sort: course?.meta?.order ?? 0,
    report: sortReport(report.items),
    errors: report.errors,
    warnings: report.warnings,
    files: sourceFiles.length,
  }
  if (report.errors || !course?.meta || !modules) return build

  let meta = course.meta
  let all = modules.flatMap((m) => m.lessons)
  let formats: CourseFormat[] = ['text']
  if (all.some((l) => l.kinds.includes('video'))) formats.push('video')
  if (all.some((l) => l.kinds.includes('code'))) formats.push('code')
  let manifest: CourseManifest = {
    slug,
    title: meta.title,
    desc: meta.summary,
    track: titleCase(meta.track, tracks),
    level: titleCase(meta.level, levels),
    lessons: all.length,
    mins: all.reduce((sum, l) => sum + l.mins, 0),
    sigil: meta.cover.sigil,
    tone: meta.cover.tone ?? TONES[(meta.order ?? 0) % TONES.length]!,
    pattern: meta.cover.pattern,
    formats,
    outcomes: meta.outcomes,
    badge: { id: meta.badge.id ?? slug, name: meta.badge.name, glyph: meta.badge.glyph },
    authors: meta.authors ?? [],
    modules,
  }
  let courseVideos = compiled.flatMap((lesson, i) =>
    lesson.stats.video
      ? [{ n: i + 1, lesson: lesson.meta.title, file: lesson.stats.video.path, found: lesson.stats.video.found, duration: lesson.stats.video.duration ?? 0 }]
      : [],
  )
  if (courseVideos.length) manifest.videos = courseVideos
  if (course.lead) manifest.lead = course.lead
  if (meta.intro) manifest.introLabel = meta.intro
  if (meta.exercise) manifest.exercise = meta.exercise
  build.manifest = manifest
  build.lessons = new Map(compiled.map((lesson) => [lesson.slug, lesson.content]))
  return build
}

function readCourse(file: SourceFile, report: Report) {
  let fileReport = report.forFile(file.path)
  let tree = parseMarkdown((file.text ?? '').replace(/\r\n?/g, '\n'))
  let [first, ...body] = tree.children
  if (first?.type !== 'yaml') {
    fileReport.error('needs frontmatter first: a --- block with title, track, level, summary, outcomes, cover and badge', 1)
    return { meta: undefined, lead: undefined }
  }
  let meta = readFrontmatter(CourseFrontmatter, first.value, (first.position?.start.line ?? 1) + 1, fileReport)
  // The body is the course page lead: plain paragraphs.
  let paragraphs: string[] = []
  for (let node of body) {
    if (node.type === 'paragraph') {
      paragraphs.push(text(node).replace(/\s+/g, ' ').trim())
    } else {
      fileReport.error('the course.md body is the course page lead: plain paragraphs only', node.position?.start.line)
    }
  }
  return { meta, lead: paragraphs.join(' ') || undefined }
}

function text(node: unknown): string {
  if (!node || typeof node !== 'object') return ''
  if ('value' in node && typeof node.value === 'string') return node.value
  if ('children' in node && Array.isArray(node.children)) return node.children.map(text).join('')
  return ''
}

function titleCase<T extends string>(value: string, allowed: readonly T[]): T {
  return allowed.find((item) => item.toLowerCase() === value.toLowerCase()) ?? allowed[0]!
}

/** Every lesson has a unique `order`; gaps are allowed but flagged. */
function checkOrder(lessons: (CompiledLesson & { file: string })[], report: Report) {
  let byOrder = new Map<number, string[]>()
  for (let lesson of lessons) byOrder.set(lesson.meta.order, [...(byOrder.get(lesson.meta.order) ?? []), lesson.file])
  let clean = true
  for (let [order, files] of byOrder) {
    if (files.length > 1) {
      report.error(`duplicate order: ${order} (also in ${files.slice(1).join(', ')})`, files[0])
      clean = false
    }
  }
  let slugs = new Map<string, string>()
  for (let lesson of lessons) {
    let other = slugs.get(lesson.slug)
    if (other) {
      report.error(`lesson slug "${lesson.slug}" is also used by ${other}`, lesson.file)
      clean = false
    }
    slugs.set(lesson.slug, lesson.file)
  }
  lessons.sort((a, b) => a.meta.order - b.meta.order)
  let orders = lessons.map((l) => l.meta.order)
  let gaps = orders.some((order, i) => order !== i + 1)
  if (gaps && lessons.length) report.warning(`lesson order isn't 1–${lessons.length} without gaps (${orders.join(', ')})`)
  if (clean && !gaps && lessons.length) {
    report.ok(`${lessons.length} lesson${lessons.length === 1 ? '' : 's'}, order 1–${lessons.length}, no gaps`)
  }
}

/** Consecutive lessons with the same `module` form one syllabus module. */
function groupModules(lessons: (CompiledLesson & { file: string })[], courseTitle: string, report: Report): ModuleInfo[] | undefined {
  let named = lessons.filter((lesson) => lesson.meta.module)
  if (named.length && named.length < lessons.length) {
    for (let lesson of lessons) {
      if (!lesson.meta.module) report.error('module is missing (the other lessons set one)', lesson.file)
    }
    return undefined
  }
  let modules: ModuleInfo[] = []
  let seen = new Set<string>()
  for (let [index, lesson] of lessons.entries()) {
    let title = lesson.meta.module ?? courseTitle
    let current = modules[modules.length - 1]
    if (!current || current.title !== title) {
      if (seen.has(title)) report.error(`module “${title}” is split: keep its lessons next to each other in order`, lesson.file)
      seen.add(title)
      current = { n: `M${modules.length + 1}`, title, lessons: [] }
      modules.push(current)
    }
    let info: LessonInfo = {
      n: index + 1,
      slug: lesson.slug,
      title: lesson.meta.title,
      mins: lesson.meta.minutes,
      xp: lesson.meta.xp,
      kinds: lesson.kinds,
    }
    current.lessons.push(info)
  }
  return modules
}

/** Errors first, then warnings, then passes; each in file and line order. */
function sortReport(items: ReportItem[]): ReportItem[] {
  let rank = { error: 0, warning: 1, ok: 2 }
  return items
    .map((item, i) => ({ item, i }))
    .sort((a, b) => {
      let byLevel = rank[a.item.level] - rank[b.item.level]
      if (byLevel || a.item.level === 'ok') return byLevel || a.i - b.i
      return (a.item.file ?? '').localeCompare(b.item.file ?? '') || (a.item.line ?? 0) - (b.item.line ?? 0) || a.i - b.i
    })
    .map(({ item }) => item)
}
