// Page-local sample data for /me and /u/:handle (docs/design/spec/pages/Profile.md).
// The viewer and course progress come from the shared fixtures; everything
// that only the profile shows (level, badges, journal, activity) lives here
// until progress, xp_events and exercise_attempts are read from D1.
import type { ActivityLevel } from '@bits/ui/activity-grid'

import { courses, demoViewer, type CourseSummary, type Viewer } from '../../data/fixtures.ts'

export interface Badge {
  name: string
  glyph: string
  earned: boolean
  /** Fill token for earned badges. */
  color?: string
}

export interface JournalEntry {
  prompt: string
  lesson: string
  result: string
  /** `passed` results are volt, `runs` results ion (components §11.4). */
  tone: 'passed' | 'runs'
}

export interface Profile {
  name: string
  handle: string
  email: string
  isPublic: boolean
  level: number
  levelName: string
  /** Progress to the next level, 0–100. */
  levelPct: number
  toNextLevel: number
  since: string
  goal?: string
  neurons: number
  streak: number
  bestStreak: number
  lessonsFinished: number
  promptsWritten: number
  signIn: string
  courses: CourseSummary[]
  badges: Badge[]
  journal: JournalEntry[]
  activity: ActivityLevel[]
}

/** Profile badge data (Profile.dc.html lines 204–214). */
const badges: Badge[] = [
  { name: 'First token', glyph: '1st', earned: true, color: 'var(--volt)' },
  { name: 'Few-shot', glyph: '×3', earned: true, color: 'var(--synapse)' },
  { name: 'Streak ×7', glyph: '7d', earned: true, color: 'var(--volt-soft)' },
  { name: 'Temperature tamer', glyph: 'T°', earned: true, color: 'var(--ion)' },
  { name: 'Graduate', glyph: 'LLM', earned: true, color: 'var(--volt)' },
  { name: 'Tool wielder', glyph: 'fn', earned: false },
  { name: 'Loop closer', glyph: '∞', earned: false },
  { name: 'Streak ×30', glyph: '30d', earned: false },
  { name: 'Shipped', glyph: '↗', earned: false },
]

const LLM = 'What is an LLM, really?'
const TT = 'Tokens & temperature'
const LOOP = 'Your first agent loop'

const passed = (n: number, of = n): Pick<JournalEntry, 'result' | 'tone'> => ({
  result: `✓ passed ${n}/${of} checks`,
  tone: 'passed',
})
const ran = (temps: string): Pick<JournalEntry, 'result' | 'tone'> => ({ result: `ran at ${temps}`, tone: 'runs' })

/** Newest first. The first three are the artboard's (lines 215–219). */
const journal: JournalEntry[] = [
  { prompt: 'You are a pirate. Answer in exactly 3 bullet points: why is the sea salty?', lesson: `${LLM} · L6`, ...passed(3) },
  { prompt: 'Write a tagline for a coffee shop on the moon. Under 6 words.', lesson: `${TT} · L6`, ...ran('T=0 and T=1.0') },
  { prompt: 'Here are two examples of good commit messages. Write one for this diff…', lesson: `${LLM} · L8`, ...passed(2) },
  { prompt: 'Describe a get_weather tool that takes a city and returns the temperature in °C.', lesson: `${LOOP} · L2`, ...passed(2) },
  { prompt: 'Name a cat in one word. Then name nine more, one per line.', lesson: `${TT} · L5`, ...ran('T=0 and T=1.0') },
  { prompt: 'Count the tokens in “unbelievable” and explain where the splits fall.', lesson: `${TT} · L3`, ...passed(2) },
  { prompt: 'Rewrite this sentence so a ten-year-old gets it: “Latency dominates throughput.”', lesson: `${LLM} · L7`, ...passed(2) },
  { prompt: 'Summarise this support email in one line, then label it urgent or not.', lesson: `${LLM} · L5`, ...passed(3) },
  { prompt: 'Spell “strawberry” one token at a time and count the r’s.', lesson: `${TT} · L2`, ...passed(1) },
  { prompt: 'Finish the sentence: “The capital of France is”. Show the top three guesses.', lesson: `${TT} · L4`, ...ran('T=0.2') },
  { prompt: 'Act as a strict editor. Cut this paragraph to 40 words without losing the point.', lesson: `${LLM} · L6`, ...passed(2) },
  { prompt: 'You are a tour guide on Mars. Recommend one sight, in under 30 words.', lesson: `${LLM} · L4`, ...passed(2) },
  { prompt: 'What is a token? Answer with one example word that becomes two tokens.', lesson: `${TT} · L1`, ...passed(1) },
  { prompt: 'Translate “good morning” into French, Spanish and Japanese as a table.', lesson: `${LLM} · L3`, ...passed(2) },
  { prompt: 'List three things a model cannot know about today. One line each.', lesson: `${LLM} · L2`, ...passed(3) },
  { prompt: 'Explain next-token prediction with a cooking analogy. Keep it to two sentences.', lesson: `${LLM} · L1`, ...passed(2) },
]

/**
 * The artboard's sample heatmap (Profile.dc.html lines 185–196): Park–Miller
 * PRNG, seed 42, busier towards the most recent weeks. Deterministic, so the
 * server render and every test see the same grid.
 */
export function profileActivity(seed = 42): ActivityLevel[] {
  let state = seed
  let rnd = () => {
    state = (state * 16807) % 2147483647
    return (state - 1) / 2147483646
  }
  return Array.from({ length: 182 }, (_, i) => {
    let recent = i / 182
    let r = rnd()
    if (i > 168) return (r < 0.15 ? 2 : 3) as ActivityLevel
    if (r < 0.15 + recent * 0.55) return (r < 0.08 ? 3 : r < 0.25 ? 2 : 1) as ActivityLevel
    return 0
  })
}

const activityCounts = { 0: 0, 1: 1, 2: 3, 3: 5 } as const

/** Hover titles for the heatmap cells, ending on the fixture's "today". */
export function activityTitles(levels: ActivityLevel[], today = new Date(Date.UTC(2026, 9, 26))): string[] {
  let format = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
  return levels.map((level, i) => {
    let day = new Date(today.getTime() - (levels.length - 1 - i) * 86_400_000)
    let n = activityCounts[level]
    return `${format.format(day)} · ${n === 0 ? 'no activity' : `${n === 5 ? '5+' : n} ${n === 1 ? 'activity' : 'activities'}`}`
  })
}

const inProgressOrDone = (slugs: string[]) =>
  slugs.map((slug) => courses.find((c) => c.slug === slug)).filter((c): c is CourseSummary => Boolean(c))

function profileFor(viewer: Viewer, extra: Partial<Profile> = {}): Profile {
  return {
    name: viewer.name,
    handle: viewer.handle,
    email: viewer.email,
    isPublic: viewer.isPublic,
    level: 7,
    levelName: 'Prompt wrangler',
    levelPct: 74,
    toNextLevel: 260,
    since: 'March 2026',
    goal: 'build an agent that triages my inbox',
    neurons: viewer.xp,
    streak: viewer.streak,
    bestStreak: viewer.bestStreak,
    lessonsFinished: 14,
    promptsWritten: 37,
    signIn: 'GitHub · passkey',
    courses: inProgressOrDone(['tokens-and-temperature', 'first-agent-loop', 'what-is-an-llm']),
    badges,
    journal,
    activity: profileActivity(),
    ...extra,
  }
}

const profiles: Record<string, Profile> = {
  [demoViewer.handle]: profileFor(demoViewer),
  // A learner who keeps their profile private: /u/sam-r is a 404.
  'sam-r': profileFor(
    { id: 'sample-sam', role: 'learner', name: 'Sam Rivera', handle: 'sam-r', initials: 'SR', email: 'sam@example.com', xp: 310, streak: 2, bestStreak: 6, isPublic: false },
    { level: 3, levelName: 'Token counter', levelPct: 40, toNextLevel: 180, goal: undefined },
  ),
}

/** The signed-in viewer's own profile (`/me`). */
export function getOwnProfile(viewer: Viewer): Profile {
  return profiles[viewer.handle] ?? profileFor(viewer)
}

/** A public profile by handle; private or unknown handles return undefined (404). */
export function getPublicProfile(handle: string): Profile | undefined {
  let profile = profiles[handle]
  return profile?.isPublic ? profile : undefined
}

/** Journal entries the profile shows before "All →". */
export const RECENT_JOURNAL = 3
