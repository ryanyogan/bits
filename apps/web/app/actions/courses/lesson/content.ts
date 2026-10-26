// The compiled lesson shape. The content pipeline (decision 018,
// app/content/compile/) parses each lesson's markdown with remark and writes
// this JSON to R2. Everything here is plain, serializable data: no HTML strings
// (raw HTML in markdown is rejected at build time), regexes as source/flags,
// and code pre-highlighted into syntax segments.
import type { CodeSegment } from '@bits/ui/code-editor'
import type { TerminalPart } from '@bits/ui/terminal'

/** Inline markdown: text, **strong**, `code`, ==mark== (a highlighted span). */
export type Inline = string | { strong: string } | { code: string } | { mark: string }

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
  highlight?: { from: number; to: number; label: string }
  focusLine?: number
  /** Highlighted at build time. */
  lines: CodeSegment[][]
}

export interface CodeBlock {
  type: 'code'
  files: CodeBlockFile[]
  /** A `:::terminal` directly after the code group: its Run output panel. */
  run?: { cmd: string; lines: TerminalPart[][] }
}

export interface QuizBlock {
  type: 'quiz'
  id: string
  xp: number
  multiple?: boolean
  question: Paragraph
  options: { key: string; label: string; correct: boolean; explanation: string }[]
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

export type Block = MarkdownBlock | PromptBlock | CodeBlock | QuizBlock | OddsBlock | TokenizerBlock | TerminalBlock

export interface LessonVideo {
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
  /** Canned replies for the Terminal-mode input until the tutor model is wired up. */
  replies?: { hint: string; fallback: string }
}

/** Lesson exercises that gate "lesson complete". */
export function exercisesOf(content: LessonContent): PromptBlock[] {
  return content.blocks.filter((block): block is PromptBlock => block.type === 'prompt')
}

export function hasCode(content: LessonContent): boolean {
  return content.blocks.some((block) => block.type === 'code')
}
