// The compiled lesson shape. The content pipeline (decision 018,
// app/content/compile/) parses each lesson's markdown with remark and writes
// this JSON to R2. Everything here is plain, serializable data: no HTML strings
// (raw HTML in markdown is rejected at build time), regexes as source/flags,
// and code pre-highlighted into syntax segments.
import type { CodeSegment } from '@bits/ui/code-editor'
import type { TerminalPart } from '@bits/ui/terminal'

/**
 * Inline markdown: text, **strong**, `code`, ==mark== (a highlighted span) and
 * [links](/courses/…). A link's href is a same-origin path or an https URL;
 * the build rejects anything else.
 */
export type Inline = string | { strong: string } | { code: string } | { mark: string } | { link: string; href: string }

/** One markdown paragraph. */
export type Paragraph = Inline[]

/** Plain markdown: a tutor message in Read mode, `◆ tutor` output in Terminal mode. */
export interface MarkdownBlock {
  type: 'markdown'
  paragraphs: Paragraph[]
  /**
   * The learner line that leads into this turn (a scripted question). Read
   * mode shows it as a learner bubble, Terminal mode as `› ask`.
   */
  ask?: string
  /** File name of a `:::code` block whose highlighted range this turn points at. */
  pointsAt?: string
}

export interface PromptCheckSource {
  label: string
  /** `- check "label" /regex/flags`; several lines with one label must all match. */
  patterns: { source: string; flags?: string }[]
}

/** `:::prompt`: the "Your turn" composer with live checks. */
export interface PromptBlock {
  type: 'prompt'
  id: string
  xp: number
  model?: string
  /** The composer label: the task text. */
  task: string
  placeholder?: string
  /** Starting draft shown in the composer. */
  draft?: string
  checks: PromptCheckSource[]
  /** `- run temperature=[0, 1.0]`: one run at each temperature is required. */
  run?: { label: string; temperatures: number[] }
  /** Temperatures offered by the "run at" picker. */
  temperatures: number[]
  /** `- example T=0 "…"`: canned outputs, shown labelled "example output". */
  examples: { temperature: number; text: string }[]
  /** Reward copy when every check passes. */
  success: { message: string; nextLabel?: string }
}

/** One file of a `:::code` group (adjacent blocks become editor tabs). */
export interface CodeBlockFile {
  file: string
  lang: string
  /** Badge before the file name ("TS", "#"). */
  badge: string
  /** Language shown in the status bar. */
  language: string
  copy: boolean
  typeMode: boolean
  /** `highlight="12-32"`; `label` only when the author gave one (the footer already shows the range). */
  highlight?: { from: number; to: number; label?: string }
  focusLine?: number
  /** Highlighted at build time. */
  lines: CodeSegment[][]
}

export interface CodeBlock {
  type: 'code'
  files: CodeBlockFile[]
  /** A `:::terminal` directly after the code group: its Run output panel (with its ask and summary). */
  run?: { cmd: string; lines: TerminalPart[][]; ask?: string; summary?: string }
}

/**
 * A `:::quiz` as builds before decision 052 stored it. The build now
 * compiles `:::quiz` into an `AskBlock` with only choices;
 * `upgradeLessonContent` maps stored ones the same way when they're read.
 */
export interface QuizBlock {
  type: 'quiz'
  id: string
  xp: number
  multiple?: boolean
  question: Paragraph
  options: { key: string; label: string; correct: boolean; explanation: string }[]
}

/** One option of an ask: offered as a chip that fills the answer field. */
export interface AskChoice {
  /** "a", "b", …: a typed letter counts as picking it. */
  key: string
  label: string
  correct: boolean
  /** Shown once it is picked. */
  explanation: string
}

/**
 * `:::ask` (decision 052): a question the learner answers by typing in the
 * prompt window, graded on the server. It passes when the answer picks the
 * right choice(s), or when every `accept` check matches and no `reject`
 * does. Its patterns and explanations never reach the browser: `askProps`
 * sends the question, placeholder, hint and choice labels only.
 */
export interface AskBlock {
  type: 'ask'
  id: string
  xp: number
  /** Gates "Complete lesson" (default true; `gate=false` makes it optional). */
  gate: boolean
  question: Paragraph
  placeholder?: string
  /** Every one must match the answer. */
  accept: PromptCheckSource[]
  /** None may match; each says why the answer misses. */
  reject: (PromptCheckSource & { feedback: string })[]
  /** Shown after a wrong answer that no choice or reject explains. */
  hint?: string
  choices: AskChoice[]
  /** Several choices are right; the answer must name all of them. */
  multiple?: boolean
  /** Shown after a right answer (picked choices' explanations come first). */
  explain?: string
}

/** `:::odds`: next-token probabilities with a temperature slider. */
export interface OddsBlock {
  type: 'odds'
  /** Context before the blank, e.g. "Moon café tagline:". */
  prompt: string
  blank: string
  /** Default slider temperature. */
  slider: number
  candidates: [token: string, logit: number][]
}

/** `:::tokenizer`: the live tokenizer toy, with a build-time tokenized sample. */
export interface TokenizerBlock {
  type: 'tokenizer'
  sample: string
  tokens: [text: string, id: string][]
  /** The ids (and splits) are made up to teach, not a real tokenizer's. */
  illustrative?: boolean
}

/** `:::terminal`: a scripted command log. */
export interface TerminalBlock {
  type: 'terminal'
  cmd: string
  /** Learner line leading into the command in Terminal mode ("run it"). */
  ask?: string
  lines: TerminalPart[][]
  summary?: string
}

// ---- Lesson toys (decision 021) ----
// `illustrative` (block attribute, or `illustrative: true` in the lesson
// frontmatter) labels made-up numbers as such.

/** `:::nexttoken`: a reply forming one token at a time, with each step's odds. */
export interface NextTokenBlock {
  type: 'nexttoken'
  prompt: string
  /** One per generated token: the pick, its probability (0–1) and the runners-up. */
  steps: { token: string; p: number; alternatives: [token: string, p: number][] }[]
  illustrative?: boolean
}

/** `:::training`: what a model writes for one prompt at points in training. */
export interface TrainingBlock {
  type: 'training'
  prompt: string
  /** In step order. */
  snapshots: { step: number; loss: number; text: string }[]
  illustrative?: boolean
}

/** `:::attention`: which earlier tokens each token attends to (0-based indexes). */
export interface AttentionBlock {
  type: 'attention'
  caption?: string
  tokens: string[]
  links: { from: number; to: number; weight: number }[]
  illustrative?: boolean
}

/** `:::compare`: the same prompt answered two ways (static). */
export interface CompareBlock {
  type: 'compare'
  left: string
  right: string
  rows: { prompt?: string; left: string; right: string }[]
  illustrative?: boolean
}

/** `:::rabbithole`: up to three links to the best sources (static, https only). */
export interface RabbitHoleBlock {
  type: 'rabbithole'
  links: { kind: 'video' | 'read'; title: string; by: string; url: string; mins?: number; deep?: boolean }[]
}

export type ToyBlock = NextTokenBlock | TrainingBlock | AttentionBlock | CompareBlock | RabbitHoleBlock

export type Block = MarkdownBlock | PromptBlock | CodeBlock | AskBlock | QuizBlock | OddsBlock | TokenizerBlock | TerminalBlock | ToyBlock

export interface LessonVideo {
  /** The uploaded MP4 (/media/videos/:id.mp4), linked by the build once it is ready (decision 029). */
  src: string
  /** Seconds. */
  duration: number
  /** Frontmatter `chapters[] {at, title}`. */
  chapters: { at: number; title: string }[]
  /** From the caption track. */
  cues: { start: number; text: string }[]
}

export interface LessonContent {
  title: string
  order: number
  minutes: number
  xp: number
  video?: LessonVideo
  blocks: Block[]
  /**
   * Terminal mode's input when the lesson has nothing to answer: `hint` is
   * the authored reply to “hint”. A `fallback` stored by older builds is
   * never shown: a canned reply to a typed answer faked a result (052).
   */
  replies?: { hint: string; fallback?: string }
}

/**
 * The lesson has a playable video. Builds before decision 029 stored a
 * `video` without `src` (a simulated player); those are text-only now.
 */
export function hasVideo(content: LessonContent): content is LessonContent & { video: LessonVideo } {
  return typeof content.video?.src === 'string'
}

/** Lesson exercises that gate "lesson complete". */
export function exercisesOf(content: LessonContent): PromptBlock[] {
  return content.blocks.filter((block): block is PromptBlock => block.type === 'prompt')
}

/** The lesson's asks (stored `:::quiz` blocks included, upgraded). */
export function asksOf(content: LessonContent): AskBlock[] {
  return upgradeLessonContent(content).blocks.filter((block): block is AskBlock => block.type === 'ask')
}

/** Asks that must be answered before "Complete lesson" opens. */
export function gatingAsksOf(content: LessonContent): AskBlock[] {
  return asksOf(content).filter((ask) => ask.gate)
}

/** A stored `:::quiz` as the ask the build now makes of it: choices only. */
export function quizAsAsk(block: QuizBlock): AskBlock {
  let ask: AskBlock = {
    type: 'ask',
    id: block.id,
    xp: block.xp,
    gate: true,
    question: block.question,
    accept: [],
    reject: [],
    choices: block.options.map((option) => ({ ...option })),
  }
  if (block.multiple) ask.multiple = true
  return ask
}

/**
 * Content as this code reads it: `quiz` blocks stored by builds before
 * decision 052 become asks. Returns the same object when there are none.
 */
export function upgradeLessonContent(content: LessonContent): LessonContent {
  if (!content.blocks.some((block) => block.type === 'quiz')) return content
  return { ...content, blocks: content.blocks.map((block) => (block.type === 'quiz' ? quizAsAsk(block) : block)) }
}

export function hasCode(content: LessonContent): boolean {
  return content.blocks.some((block) => block.type === 'code')
}
