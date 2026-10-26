// Sample course and lesson catalogue until the content pipeline writes real
// courses to R2/D1. Shapes mirror the design artboards
// (docs/design/spec/pages/*.md). Viewer progress is not stored here: pass
// the viewer's completed lessons (app/progress/progress.ts loadCompleted)
// to getCourse/listCourses/getLesson/getContinue.
import type { CourseFormat } from '@bits/ui/course-card'
import type { CoverPattern } from '@bits/ui/course-cover'
import type { LessonState } from '@bits/ui/lesson-node'
import type { CourseCardProps } from '@bits/ui/course-card'

type Tone = CourseCardProps['tone']

export type Track = 'Foundations' | 'Prompting' | 'Tools' | 'Agents'
export type LessonKind = 'chat' | 'type' | 'video' | 'code' | 'project'

/** A course as authored: no viewer progress (see CourseSummary). */
export interface CourseInfo {
  slug: string
  title: string
  desc: string
  track: Track
  level: 'Beginner' | 'Intermediate' | 'Advanced'
  lessons: number
  mins: number
  sigil: string
  tone: Tone
  pattern: CoverPattern
  formats: CourseFormat[]
}

/** A course with the viewer's progress, 0–100. */
export interface CourseSummary extends CourseInfo {
  pct: number
}

export interface LessonInfo {
  n: number
  slug: string
  title: string
  mins: number
  xp: number
  kinds: LessonKind[]
}

/** A lesson with the viewer's state: done, current (where to resume) or next. */
export interface LessonSummary extends LessonInfo {
  state: LessonState
}

interface ModuleInfo {
  n: string
  title: string
  lessons: LessonInfo[]
}

export interface CourseModule {
  n: string
  title: string
  lessons: LessonSummary[]
}

interface CourseDetailInfo extends CourseInfo {
  outcomes: string[]
  modules: ModuleInfo[]
  badge: { id: string; name: string; glyph: string }
}

export interface CourseDetail extends CourseSummary {
  outcomes: string[]
  modules: CourseModule[]
  badge: { id: string; name: string; glyph: string }
}

/**
 * Lessons the viewer has completed, keyed `course/lesson` (value: completed
 * at, epoch ms). Loaded per request by app/progress/progress.ts.
 */
export type Completed = ReadonlyMap<string, number>

export const NO_PROGRESS: Completed = new Map()

export interface Viewer {
  /** users.id; 'demo' for the sample viewer. */
  id: string
  role: 'learner' | 'author' | 'admin'
  name: string
  handle: string
  initials: string
  email: string
  xp: number
  streak: number
  bestStreak: number
  isPublic: boolean
}

export const courses: CourseInfo[] = [
  { slug: 'what-is-an-llm', title: 'What is an LLM, really?', track: 'Foundations', level: 'Beginner', lessons: 8, mins: 45, sigil: 'LLM', tone: 'volt', pattern: 'dots', formats: ['text', 'video'],
    desc: 'What happens between your prompt and the answer — explained with toys, not equations.' },
  { slug: 'tokens-and-temperature', title: 'Tokens & temperature', track: 'Foundations', level: 'Beginner', lessons: 8, mins: 50, sigil: 'T°', tone: 'ion', pattern: 'stripes-115', formats: ['text', 'video'],
    desc: 'Why the same prompt gives different answers, and how to dial randomness up or down.' },
  { slug: 'prompting-that-works', title: 'Prompting that works', track: 'Prompting', level: 'Beginner', lessons: 10, mins: 70, sigil: '›_', tone: 'volt', pattern: 'rules', formats: ['text', 'video'],
    desc: 'Roles, examples and structure. Write a prompt, run it, see what each change does.' },
  { slug: 'context-is-everything', title: 'Context is everything', track: 'Prompting', level: 'Intermediate', lessons: 7, mins: 55, sigil: '[ctx]', tone: 'ion', pattern: 'grid', formats: ['text'],
    desc: 'What fits in the window, what falls out, and how to pack it so the model notices.' },
  { slug: 'give-your-model-tools', title: 'Give your model tools', track: 'Tools', level: 'Intermediate', lessons: 9, mins: 80, sigil: 'fn()', tone: 'synapse', pattern: 'rings', formats: ['text', 'code'],
    desc: 'Describe a function, let the model call it, feed back the result. Build a weather bot.' },
  { slug: 'retrieval-without-tears', title: 'Retrieval without tears', track: 'Tools', level: 'Intermediate', lessons: 8, mins: 75, sigil: 'RAG', tone: 'synapse', pattern: 'dots-offset', formats: ['text', 'code', 'video'],
    desc: 'Search your own docs, hand the best bits to the model, and cite where they came from.' },
  { slug: 'first-agent-loop', title: 'Your first agent loop', track: 'Agents', level: 'Intermediate', lessons: 10, mins: 90, sigil: 'loop', tone: 'volt', pattern: 'rays', formats: ['text', 'code', 'video'],
    desc: 'Plan, act, observe, repeat. Write the 30 lines of code every agent is built on.' },
  { slug: 'ship-an-agent-to-the-edge', title: 'Ship an agent to the edge', track: 'Agents', level: 'Advanced', lessons: 8, mins: 85, sigil: 'edge', tone: 'ion', pattern: 'crosshatch', formats: ['text', 'code'],
    desc: 'Take your agent from a script to a deployed endpoint with memory, limits and logs.' },
]

const lesson = (n: number, slug: string, title: string, mins: number, xp: number, kinds: LessonKind[]): LessonInfo =>
  ({ n, slug, title, mins, xp, kinds })

const tokensAndTemperature: CourseDetailInfo = {
  ...courses[1]!,
  outcomes: [
    'Predict roughly how many tokens a prompt will cost.',
    'Explain why a model “chooses” one word over another.',
    'Pick a temperature for a task and defend it.',
  ],
  badge: { id: 'tokens-temperature', name: 'Temperature tamer', glyph: 'T°' },
  modules: [
    { n: 'M1', title: 'How text becomes numbers', lessons: [
      lesson(1, 'what-is-a-token', 'What is a token?', 6, 30, ['chat', 'type', 'video']),
      lesson(2, 'tokenizers-are-weird', 'Tokenizers are weird', 5, 30, ['chat', 'type']),
      lesson(3, 'counting-tokens', 'Counting tokens (and cost)', 6, 40, ['chat', 'type', 'video']),
    ] },
    { n: 'M2', title: 'Picking the next word', lessons: [
      lesson(4, 'probabilities-not-answers', 'Probabilities, not answers', 7, 40, ['chat', 'video']),
      lesson(5, 'greedy-vs-sampled', 'Greedy vs. sampled', 6, 40, ['chat', 'type']),
      lesson(6, 'temperature', 'Temperature & randomness', 7, 40, ['chat', 'type', 'video']),
    ] },
    { n: 'M3', title: 'Putting it together', lessons: [
      lesson(7, 'top-p-and-friends', 'Top-p and friends', 6, 40, ['chat', 'type', 'video']),
      lesson(8, 'checkpoint-tune-a-chatbot', 'Checkpoint: tune a chatbot', 10, 60, ['project', 'code']),
    ] },
  ],
}

/** Lesson 4 of the agent course is the CodeLesson (terminal mode) artboard. */
const firstAgentLoop: CourseDetailInfo = {
  ...courses[6]!,
  outcomes: [
    'Explain the plan → act → observe loop in your own words.',
    'Write a working tool-calling loop in about 30 lines.',
    'Debug a loop that never ends.',
  ],
  badge: { id: 'first-agent-loop', name: 'Loop Closer', glyph: '↻' },
  modules: [
    { n: 'M1', title: 'What an agent is', lessons: [
      lesson(1, 'agents-are-loops', 'Agents are loops', 8, 40, ['chat', 'video']),
      lesson(2, 'describing-a-tool', 'Describing a tool', 9, 40, ['chat', 'code']),
      lesson(3, 'running-a-tool', 'Running a tool', 9, 40, ['chat', 'code']),
    ] },
    { n: 'M2', title: 'Building the loop', lessons: [
      lesson(4, 'the-loop', 'The loop', 10, 60, ['chat', 'code']),
      lesson(5, 'stop-reasons', 'Stop reasons', 8, 40, ['chat', 'type', 'code']),
      lesson(6, 'many-tools', 'Many tools at once', 9, 40, ['chat', 'code']),
      lesson(7, 'when-loops-go-wrong', 'When loops go wrong', 9, 40, ['chat', 'code', 'video']),
    ] },
    { n: 'M3', title: 'Shipping it', lessons: [
      lesson(8, 'memory', 'Memory', 9, 40, ['chat', 'code']),
      lesson(9, 'limits-and-logs', 'Limits and logs', 9, 40, ['chat', 'code']),
      lesson(10, 'checkpoint-weather-agent', 'Checkpoint: a weather agent', 10, 80, ['project', 'code']),
    ] },
  ],
}

const details: Record<string, CourseDetailInfo> = {
  [tokensAndTemperature.slug]: tokensAndTemperature,
  [firstAgentLoop.slug]: firstAgentLoop,
}

/** Courses without hand-written detail get a generated single-module syllabus. */
function getCourseInfo(slug: string): CourseDetailInfo | undefined {
  let found = details[slug]
  if (found) return found
  let summary = courses.find((c) => c.slug === slug)
  if (!summary) return undefined
  let perLesson = Math.max(1, Math.round(summary.mins / summary.lessons))
  return {
    ...summary,
    outcomes: [summary.desc],
    badge: { id: summary.slug, name: summary.title, glyph: summary.sigil },
    modules: [{
      n: 'M1',
      title: summary.title,
      lessons: Array.from({ length: summary.lessons }, (_, i) =>
        lesson(i + 1, `lesson-${i + 1}`, `Lesson ${i + 1}`, perLesson, 40, ['chat', 'type'])),
    }],
  }
}

/**
 * A course with the viewer's progress applied: completed lessons are done,
 * the first unfinished lesson of a started course is current, the rest next.
 */
export function getCourse(slug: string, completed: Completed = NO_PROGRESS): CourseDetail | undefined {
  let info = getCourseInfo(slug)
  if (!info) return undefined
  let isDone = (l: LessonInfo) => completed.has(`${info.slug}/${l.slug}`)
  let all = info.modules.flatMap((m) => m.lessons)
  let done = all.filter(isDone).length
  let current = done > 0 ? all.find((l) => !isDone(l)) : undefined
  return {
    ...info,
    // Floor: never show more progress than there is (5 of 8 is 62%).
    pct: all.length ? Math.floor((done / all.length) * 100) : 0,
    modules: info.modules.map((m) => ({
      ...m,
      lessons: m.lessons.map((l) => ({ ...l, state: isDone(l) ? 'done' : l === current ? 'current' : 'next' })),
    })),
  }
}

/** Every course with the viewer's progress, in catalog order. */
export function listCourses(completed: Completed = NO_PROGRESS): CourseSummary[] {
  return courses.map((info) => {
    let { outcomes, modules, badge, ...summary } = getCourse(info.slug, completed)!
    return summary
  })
}

export function getLesson(courseSlug: string, lessonSlug: string, completed: Completed = NO_PROGRESS) {
  let course = getCourse(courseSlug, completed)
  if (!course) return undefined
  let all = course.modules.flatMap((m) => m.lessons)
  let index = all.findIndex((l) => l.slug === lessonSlug)
  if (index < 0) return undefined
  return { course, lesson: all[index]!, index, total: all.length, prev: all[index - 1], next: all[index + 1] }
}

/**
 * The Continue banner target: the course of the most recently completed
 * lesson that still has lessons left, at its current lesson.
 */
export function getContinue(completed: Completed) {
  let recent = [...completed].sort((a, b) => b[1] - a[1])
  let seen = new Set<string>()
  for (let [key] of recent) {
    let slug = key.slice(0, key.indexOf('/'))
    if (seen.has(slug)) continue
    seen.add(slug)
    let course = getCourse(slug, completed)
    if (!course) continue
    let lessons = course.modules.flatMap((m) => m.lessons)
    let current = lessons.find((l) => l.state === 'current')
    if (current) return { course, lesson: current, total: lessons.length }
  }
  return undefined
}
