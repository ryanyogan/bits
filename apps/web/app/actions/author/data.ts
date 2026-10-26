// Page-local sample data for /author and /author/:course
// (docs/design/spec/pages/Authoring.md). Mirrors what the build pipeline will
// store (handoff "Course content pipeline"): course_versions rows, the saved
// validation report and the videos table. Swap for D1 queries later.
import { courses, getCourse, type CourseSummary } from '../../data/fixtures.ts'

export type ValidationLevel = 'ok' | 'warning' | 'error'

export interface ValidationItem {
  level: ValidationLevel
  text: string
}

export interface CourseVersion {
  n: number
  /** `live` is the published pointer; `draft` is the latest unpublished build. */
  state: 'live' | 'draft' | 'previous'
  when: string
  source: string
}

export interface VideoUpload {
  file: string
  lesson: string
  status: 'ready' | 'uploading' | 'processing' | 'missing'
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
  course: CourseSummary
  /** The course folder name in the repo or upload. */
  folder: string
  files: number
  lastPush: string
  /** Latest build. */
  build: number
  /** Published version, if any. */
  live?: number
  items: ValidationItem[]
  versions: CourseVersion[]
  videos: VideoUpload[]
  /** The file shown in the Source pane (latest build), when there is one. */
  source?: { tree: TreeNode[]; file: string; markdown: string }
  /** users.id of the authors who own it. The samples have none, so only admins see them. */
  ownerIds?: string[]
}

export const repo = { name: 'jamie-park/courses', branch: 'main', connected: true }

const tree: TreeNode[] = [
  { name: 'courses/', depth: 0, kind: 'folder' },
  { name: 'tokens-and-temperature/', depth: 1, kind: 'file' },
  { name: 'course.md', depth: 2, kind: 'course' },
  { name: '01-what-is-a-token.md', depth: 2, kind: 'file' },
  { name: '02-tokenizers.md', depth: 2, kind: 'file' },
  { name: '…', depth: 2, kind: 'more' },
  { name: '06-temperature.md', depth: 2, kind: 'file', selected: true },
  { name: '07-top-p.md', depth: 2, kind: 'file' },
  { name: '08-checkpoint.md', depth: 2, kind: 'file' },
  { name: 'assets/', depth: 2, kind: 'asset' },
  { name: '06-temperature.mp4', depth: 3, kind: 'asset' },
  { name: 'cover.svg', depth: 3, kind: 'asset' },
]

/** 06-temperature.md, verbatim from the artboard (Authoring.dc.html lines 116–148). */
const temperatureMarkdown = `---
title: Temperature & randomness
order: 6
minutes: 7
xp: 40
video: assets/06-temperature.mp4
---

Last lesson you saw that a model never picks
**the** next word. It gives every token
a probability, then rolls a weighted die.

:::odds{prompt="Moon café tagline:" slider}
 Brew   3.1
 One    2.4
 Lunar  1.9
:::

:::prompt{id="moon-tagline" xp=40}
Ask for a **tagline for a coffee shop on
the moon** with a length limit.

- check "Asks for a tagline"   /tagline|slogan/i
- check "Sets a length limit"  /\\bwords?\\b|under/i
- run   temperature=[0, 1.0]
:::

:::quiz
What does temperature change?
- [ ] How long the answer is
- [x] How spread out the odds are
:::`

const course = (slug: string) => courses.find((c) => c.slug === slug)!

const authored: AuthorCourse[] = [
  {
    course: course('tokens-and-temperature'),
    folder: 'tokens-and-temperature',
    files: 9,
    lastPush: '4 min ago',
    build: 4,
    live: 3,
    items: [
      { level: 'ok', text: 'course.md frontmatter valid' },
      { level: 'ok', text: '8 lessons, order 1–8, no gaps' },
      { level: 'ok', text: '6 prompt blocks, each has a check' },
      { level: 'ok', text: '4 of 5 videos uploaded' },
      { level: 'warning', text: '07-top-p.md → video not found: top-p.mp4' },
      { level: 'ok', text: 'regex checks compile' },
    ],
    versions: [
      { n: 4, state: 'draft', when: 'built 4 min ago', source: 'push 3f2a9c1 to main' },
      { n: 3, state: 'live', when: 'published Oct 19', source: 'push 91be04d to main' },
      { n: 2, state: 'previous', when: 'published Oct 12', source: 'push 7d10e2a to main' },
      { n: 1, state: 'previous', when: 'published Oct 3', source: 'folder upload' },
    ],
    videos: [
      { file: '01-what-is-a-token.mp4', lesson: 'L1 · What is a token?', status: 'ready', duration: '4:12' },
      { file: '03-counting-tokens.mp4', lesson: 'L3 · Counting tokens (and cost)', status: 'ready', duration: '5:48' },
      { file: '04-probabilities.mp4', lesson: 'L4 · Probabilities, not answers', status: 'ready', duration: '6:05' },
      { file: '06-temperature.mp4', lesson: 'L6 · Temperature & randomness', status: 'processing' },
      { file: 'top-p.mp4', lesson: 'L7 · Top-p and friends', status: 'missing' },
    ],
    source: { tree, file: '06-temperature.md', markdown: temperatureMarkdown },
  },
  {
    course: course('first-agent-loop'),
    folder: 'first-agent-loop',
    files: 14,
    lastPush: '2 h ago',
    build: 3,
    live: 2,
    items: [
      { level: 'ok', text: 'course.md frontmatter valid' },
      { level: 'error', text: '05-stop-reasons.md, 06-many-tools.md → duplicate order: 5' },
      { level: 'error', text: '07-when-loops-go-wrong.md:31 → :::prompt has no - check lines' },
      { level: 'ok', text: 'regex checks compile' },
      { level: 'warning', text: '10-checkpoint.md → lesson is 18 min (over 15)' },
      { level: 'warning', text: '04-the-loop.md:12 → :::code has no lang' },
      { level: 'ok', text: '2 of 2 videos uploaded' },
    ],
    versions: [
      { n: 3, state: 'draft', when: 'built 2 h ago', source: 'push c41f7aa to main' },
      { n: 2, state: 'live', when: 'published Oct 21', source: 'push 0be5d19 to main' },
      { n: 1, state: 'previous', when: 'published Oct 14', source: 'push 5a22c80 to main' },
    ],
    videos: [
      { file: '01-agents-are-loops.mp4', lesson: 'L1 · Agents are loops', status: 'ready', duration: '7:30' },
      { file: '07-when-loops-go-wrong.mp4', lesson: 'L7 · When loops go wrong', status: 'uploading', pct: 64 },
    ],
  },
  {
    course: course('what-is-an-llm'),
    folder: 'what-is-an-llm',
    files: 11,
    lastPush: 'Oct 8',
    build: 6,
    live: 6,
    items: [
      { level: 'ok', text: 'course.md frontmatter valid' },
      { level: 'ok', text: '8 lessons, order 1–8, no gaps' },
      { level: 'ok', text: '7 prompt blocks, each has a check' },
      { level: 'ok', text: '3 of 3 videos uploaded' },
      { level: 'ok', text: 'regex checks compile' },
    ],
    versions: [
      { n: 6, state: 'live', when: 'published Oct 8', source: 'push e90d3b2 to main' },
      { n: 5, state: 'previous', when: 'published Sep 30', source: 'push 41aa7f0 to main' },
    ],
    videos: [
      { file: '01-next-word.mp4', lesson: 'L1 · The next word', status: 'ready', duration: '3:58' },
      { file: '04-training.mp4', lesson: 'L4 · Where answers come from', status: 'ready', duration: '6:40' },
      { file: '07-limits.mp4', lesson: 'L7 · What it can’t know', status: 'ready', duration: '5:02' },
    ],
  },
  {
    course: course('ship-an-agent-to-the-edge'),
    folder: 'ship-an-agent-to-the-edge',
    files: 6,
    lastPush: 'yesterday',
    build: 1,
    items: [
      { level: 'ok', text: 'course.md frontmatter valid' },
      { level: 'ok', text: '5 lessons, order 1–5, no gaps' },
      { level: 'ok', text: '3 prompt blocks, each has a check' },
      { level: 'ok', text: 'regex checks compile' },
    ],
    versions: [{ n: 1, state: 'draft', when: 'built yesterday', source: 'folder upload' }],
    videos: [],
  },
]

export function getAuthoredCourses(): AuthorCourse[] {
  return authored
}

/** Authors manage the courses they own; admins manage every course (handoff, Roles). */
export function canManageCourse(user: { id: string; role: string }, item: AuthorCourse): boolean {
  if (user.role === 'admin') return true
  return user.role === 'author' && (item.ownerIds ?? []).includes(user.id)
}

/** The courses this user may open in /author. */
export function getManagedCourses(user: { id: string; role: string }): AuthorCourse[] {
  return authored.filter((item) => canManageCourse(user, item))
}

export function getAuthoredCourse(slug: string): AuthorCourse | undefined {
  return authored.find((c) => c.course.slug === slug)
}

export function counts(items: ValidationItem[]) {
  return {
    errors: items.filter((i) => i.level === 'error').length,
    warnings: items.filter((i) => i.level === 'warning').length,
  }
}

/** First lesson slug, for "Preview draft". */
export function firstLessonSlug(slug: string): string {
  return getCourse(slug)?.modules[0]?.lessons[0]?.slug ?? 'lesson-1'
}

export const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

/** Block reference rows (artboard lines 213–221), with the handoff's attrs for quiz and tokenizer. */
export const blocks = [
  { name: 'plain markdown', attrs: '—', what: 'A tutor message in chat mode, a comment block in terminal mode.' },
  { name: ':::prompt', attrs: 'id, xp, model?, temperature?', what: 'The “Your turn” composer. Each “- check” line is a live goal; “- run” requires specific runs before it passes.' },
  { name: ':::code', attrs: 'file, lang, copy, type-mode, highlight="12-32"', what: 'The editor: tabs, syntax highlighting, copy button, optional retype-it mode.' },
  { name: ':::quiz', attrs: 'id, xp, multiple?', what: 'Single or multiple choice, marked with [x]. Explanations go under each option.' },
  { name: ':::odds / :::tokenizer', attrs: 'prompt, slider / sample?', what: 'Built-in toys: next-token probability bars, live tokenizer.' },
  { name: ':::terminal', attrs: 'cmd', what: 'A scripted run log shown in the output panel.' },
  { name: 'video: (frontmatter)', attrs: 'path, chapters?', what: 'Turns on the Watch tab. Lessons without it stay text-only.' },
]
