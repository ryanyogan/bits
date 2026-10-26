// Sample data for the UI-first build. Every page reads course, lesson and
// viewer data from here until the content pipeline and auth land, so pages
// stay consistent with each other. Shapes mirror the design artboards
// (docs/design/spec/pages/*.md); swap these functions for D1/R2 queries later.
import type { CourseFormat } from '@bits/ui/course-card'
import type { CoverPattern } from '@bits/ui/course-cover'
import type { LessonState } from '@bits/ui/lesson-node'
import type { CourseCardProps } from '@bits/ui/course-card'

type Tone = CourseCardProps['tone']

export type Track = 'Foundations' | 'Prompting' | 'Tools' | 'Agents'
export type LessonKind = 'chat' | 'type' | 'video' | 'code' | 'project'

export interface CourseSummary {
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
  /** Viewer progress, 0–100. */
  pct: number
}

export interface LessonSummary {
  n: number
  slug: string
  title: string
  state: LessonState
  mins: number
  xp: number
  kinds: LessonKind[]
}

export interface CourseModule {
  n: string
  title: string
  lessons: LessonSummary[]
}

export interface CourseDetail extends CourseSummary {
  outcomes: string[]
  modules: CourseModule[]
  badge: { id: string; name: string; glyph: string }
}

export interface Viewer {
  name: string
  handle: string
  initials: string
  email: string
  xp: number
  streak: number
  bestStreak: number
  isPublic: boolean
}

export const courses: CourseSummary[] = [
  { slug: 'what-is-an-llm', title: 'What is an LLM, really?', track: 'Foundations', level: 'Beginner', lessons: 8, mins: 45, sigil: 'LLM', tone: 'volt', pattern: 'dots', formats: ['text', 'video'], pct: 100,
    desc: 'What happens between your prompt and the answer — explained with toys, not equations.' },
  { slug: 'tokens-and-temperature', title: 'Tokens & temperature', track: 'Foundations', level: 'Beginner', lessons: 8, mins: 50, sigil: 'T°', tone: 'ion', pattern: 'stripes-115', formats: ['text', 'video'], pct: 62,
    desc: 'Why the same prompt gives different answers, and how to dial randomness up or down.' },
  { slug: 'prompting-that-works', title: 'Prompting that works', track: 'Prompting', level: 'Beginner', lessons: 10, mins: 70, sigil: '›_', tone: 'volt', pattern: 'rules', formats: ['text', 'video'], pct: 0,
    desc: 'Roles, examples and structure. Write a prompt, run it, see what each change does.' },
  { slug: 'context-is-everything', title: 'Context is everything', track: 'Prompting', level: 'Intermediate', lessons: 7, mins: 55, sigil: '[ctx]', tone: 'ion', pattern: 'grid', formats: ['text'], pct: 0,
    desc: 'What fits in the window, what falls out, and how to pack it so the model notices.' },
  { slug: 'give-your-model-tools', title: 'Give your model tools', track: 'Tools', level: 'Intermediate', lessons: 9, mins: 80, sigil: 'fn()', tone: 'synapse', pattern: 'rings', formats: ['text', 'code'], pct: 0,
    desc: 'Describe a function, let the model call it, feed back the result. Build a weather bot.' },
  { slug: 'retrieval-without-tears', title: 'Retrieval without tears', track: 'Tools', level: 'Intermediate', lessons: 8, mins: 75, sigil: 'RAG', tone: 'synapse', pattern: 'dots-offset', formats: ['text', 'code', 'video'], pct: 0,
    desc: 'Search your own docs, hand the best bits to the model, and cite where they came from.' },
  { slug: 'first-agent-loop', title: 'Your first agent loop', track: 'Agents', level: 'Intermediate', lessons: 10, mins: 90, sigil: 'loop', tone: 'volt', pattern: 'rays', formats: ['text', 'code', 'video'], pct: 10,
    desc: 'Plan, act, observe, repeat. Write the 30 lines of code every agent is built on.' },
  { slug: 'ship-an-agent-to-the-edge', title: 'Ship an agent to the edge', track: 'Agents', level: 'Advanced', lessons: 8, mins: 85, sigil: 'edge', tone: 'ion', pattern: 'crosshatch', formats: ['text', 'code'], pct: 0,
    desc: 'Take your agent from a script to a deployed endpoint with memory, limits and logs.' },
]

const lesson = (n: number, slug: string, title: string, state: LessonState, mins: number, xp: number, kinds: LessonKind[]): LessonSummary =>
  ({ n, slug, title, state, mins, xp, kinds })

const tokensAndTemperature: CourseDetail = {
  ...courses[1]!,
  outcomes: [
    'Predict roughly how many tokens a prompt will cost.',
    'Explain why a model “chooses” one word over another.',
    'Pick a temperature for a task and defend it.',
  ],
  badge: { id: 'tokens-temperature', name: 'Temperature Tamer', glyph: 'T°' },
  modules: [
    { n: 'M1', title: 'How text becomes numbers', lessons: [
      lesson(1, 'what-is-a-token', 'What is a token?', 'done', 6, 30, ['chat', 'type', 'video']),
      lesson(2, 'tokenizers-are-weird', 'Tokenizers are weird', 'done', 5, 30, ['chat', 'type']),
      lesson(3, 'counting-tokens', 'Counting tokens (and cost)', 'done', 6, 40, ['chat', 'type', 'video']),
    ] },
    { n: 'M2', title: 'Picking the next word', lessons: [
      lesson(4, 'probabilities-not-answers', 'Probabilities, not answers', 'done', 7, 40, ['chat', 'video']),
      lesson(5, 'greedy-vs-sampled', 'Greedy vs. sampled', 'done', 6, 40, ['chat', 'type']),
      lesson(6, 'temperature', 'Temperature & randomness', 'current', 7, 40, ['chat', 'type', 'video']),
    ] },
    { n: 'M3', title: 'Putting it together', lessons: [
      lesson(7, 'top-p-and-friends', 'Top-p and friends', 'next', 6, 40, ['chat', 'type', 'video']),
      lesson(8, 'checkpoint-tune-a-chatbot', 'Checkpoint: tune a chatbot', 'next', 10, 60, ['project', 'code']),
    ] },
  ],
}

/** Lesson 4 of the agent course is the CodeLesson (terminal mode) artboard. */
const firstAgentLoop: CourseDetail = {
  ...courses[6]!,
  outcomes: [
    'Explain the plan → act → observe loop in your own words.',
    'Write a working tool-calling loop in about 30 lines.',
    'Debug a loop that never ends.',
  ],
  badge: { id: 'first-agent-loop', name: 'Loop Closer', glyph: '↻' },
  modules: [
    { n: 'M1', title: 'What an agent is', lessons: [
      lesson(1, 'agents-are-loops', 'Agents are loops', 'done', 8, 40, ['chat', 'video']),
      lesson(2, 'describing-a-tool', 'Describing a tool', 'done', 9, 40, ['chat', 'code']),
      lesson(3, 'running-a-tool', 'Running a tool', 'done', 9, 40, ['chat', 'code']),
    ] },
    { n: 'M2', title: 'Building the loop', lessons: [
      lesson(4, 'the-loop', 'The loop', 'current', 10, 60, ['chat', 'code']),
      lesson(5, 'stop-reasons', 'Stop reasons', 'next', 8, 40, ['chat', 'type', 'code']),
      lesson(6, 'many-tools', 'Many tools at once', 'next', 9, 40, ['chat', 'code']),
      lesson(7, 'when-loops-go-wrong', 'When loops go wrong', 'next', 9, 40, ['chat', 'code', 'video']),
    ] },
    { n: 'M3', title: 'Shipping it', lessons: [
      lesson(8, 'memory', 'Memory', 'next', 9, 40, ['chat', 'code']),
      lesson(9, 'limits-and-logs', 'Limits and logs', 'next', 9, 40, ['chat', 'code']),
      lesson(10, 'checkpoint-weather-agent', 'Checkpoint: a weather agent', 'next', 10, 80, ['project', 'code']),
    ] },
  ],
}

const details: Record<string, CourseDetail> = {
  [tokensAndTemperature.slug]: tokensAndTemperature,
  [firstAgentLoop.slug]: firstAgentLoop,
}

/** Courses without hand-written detail get a generated single-module syllabus. */
export function getCourse(slug: string): CourseDetail | undefined {
  let found = details[slug]
  if (found) return found
  let summary = courses.find((c) => c.slug === slug)
  if (!summary) return undefined
  let done = Math.round((summary.pct / 100) * summary.lessons)
  let perLesson = Math.max(1, Math.round(summary.mins / summary.lessons))
  return {
    ...summary,
    outcomes: [summary.desc],
    badge: { id: summary.slug, name: summary.title, glyph: summary.sigil },
    modules: [{
      n: 'M1',
      title: summary.title,
      lessons: Array.from({ length: summary.lessons }, (_, i) =>
        lesson(i + 1, `lesson-${i + 1}`, `Lesson ${i + 1}`, i < done ? 'done' : i === done ? 'current' : 'next', perLesson, 40, ['chat', 'type'])),
    }],
  }
}

export function getLesson(courseSlug: string, lessonSlug: string) {
  let course = getCourse(courseSlug)
  if (!course) return undefined
  let all = course.modules.flatMap((m) => m.lessons)
  let index = all.findIndex((l) => l.slug === lessonSlug)
  if (index < 0) return undefined
  return { course, lesson: all[index]!, index, total: all.length, prev: all[index - 1], next: all[index + 1] }
}

/** The Continue banner target: the first started-but-unfinished course. */
export function getContinue() {
  let course = getCourse('tokens-and-temperature')!
  let lessons = course.modules.flatMap((m) => m.lessons)
  let current = lessons.find((l) => l.state === 'current')!
  return { course, lesson: current, total: lessons.length }
}

/**
 * The signed-in viewer for UI work. Pages render the signed-out variant when
 * `?as=anon` is in the URL so both states can be reviewed before auth lands.
 */
export const demoViewer: Viewer = {
  name: 'Jamie Park',
  handle: 'jamie',
  initials: 'JP',
  email: 'jamie@example.com',
  xp: 1240,
  streak: 12,
  bestStreak: 19,
  isPublic: true,
}

export function getViewer(url: URL): Viewer | null {
  return url.searchParams.get('as') === 'anon' ? null : demoViewer
}
