// One lesson file → LessonContent (lesson/content.ts).
//
// The body is markdown parsed with unified + remark (frontmatter, GFM,
// directives). Paragraphs become tutor messages; `:::name{attrs}` blocks
// become the interactive blocks. Bodies that are code or data (`:::code`,
// `:::terminal`, `:::odds`, `:::prompt`) are read from the raw source lines
// between the fences, so markdown never mangles a regex or an indent. Every
// problem is reported with the line it is on.
import type { Paragraph as MdParagraph, PhrasingContent, Root, RootContent } from 'mdast'
import remarkDirective from 'remark-directive'
import remarkFrontmatter from 'remark-frontmatter'
import remarkGfm from 'remark-gfm'
import remarkParse from 'remark-parse'
import { unified } from 'unified'
import type { TerminalPart, TerminalTone } from '@bits/ui/terminal'

import type {
  AttentionBlock,
  Block,
  CodeBlock,
  CodeBlockFile,
  CompareBlock,
  Inline,
  LessonContent,
  LessonVideo,
  MarkdownBlock,
  NextTokenBlock,
  OddsBlock,
  Paragraph,
  PromptBlock,
  QuizBlock,
  RabbitHoleBlock,
  TerminalBlock,
  TokenizerBlock,
  TrainingBlock,
} from '../../actions/courses/lesson/content.ts'
import { approximateTokens } from '../../actions/courses/lesson/public/tokenizer-toy.tsx'
import { temperatureLabel } from '../../actions/courses/lesson/ui/exercise.ts'
import { clampXp, MAX_BLOCK_XP } from '../limits.ts'
import type { LessonKind } from '../types.ts'
import { LessonFrontmatter, parseClock, readFrontmatter } from './frontmatter.ts'
import { highlight, isKnownLanguage, languageOf } from './highlight.ts'
import { checkPattern } from './regex.ts'
import type { FileReport, SourceFile } from './report.ts'

type ContainerDirective = Extract<RootContent, { type: 'containerDirective' }>
type LeafDirective = Extract<RootContent, { type: 'leafDirective' }>
type Directive = ContainerDirective | LeafDirective

const processor = unified().use(remarkParse).use(remarkFrontmatter, ['yaml']).use(remarkGfm).use(remarkDirective)

/** The markdown syntax tree of a file (no transforms run). */
export function parseMarkdown(text: string): Root {
  return processor.parse(text)
}

export type LessonMeta = NonNullable<ReturnType<typeof readLessonFrontmatter>>

function readLessonFrontmatter(yaml: string, firstLine: number, report: FileReport) {
  return readFrontmatter(LessonFrontmatter, yaml, firstLine, report)
}

export interface CompiledLesson {
  meta: LessonMeta
  slug: string
  content: LessonContent
  kinds: LessonKind[]
  /** Number of `:::prompt` blocks and regex checks, for the report summary. */
  stats: { prompts: number; patterns: number; video?: { path: string; found: boolean; duration?: number } }
}

/** An uploaded, ready video a lesson's `video:` path links to (decision 029). */
export interface LinkedVideo {
  /** Where it plays from, e.g. /media/videos/<id>.mp4. */
  src: string
  /** Seconds, as the upload measured it. */
  duration?: number
}

export interface LessonContext {
  /** Every path in the course folder (for caption lookups). */
  files: ReadonlyMap<string, SourceFile>
  report: FileReport
  /** The ready upload for a `video:` path in this course, if there is one. */
  videos?: (path: string) => LinkedVideo | undefined
}

/** Compiles one lesson file. Returns undefined when its frontmatter is unusable. */
export function compileLesson(file: SourceFile, context: LessonContext): CompiledLesson | undefined {
  let { report } = context
  let text = normalize(file.text ?? '')
  let tree = parseMarkdown(text)
  let lines = text.split('\n')

  let [first, ...body] = tree.children
  let meta: LessonMeta | undefined
  if (first?.type === 'yaml') {
    meta = readLessonFrontmatter(first.value, (first.position?.start.line ?? 1) + 1, report)
  } else {
    report.error('needs frontmatter first: a --- block with title, order, minutes and xp', 1)
    if (first) body.unshift(first)
  }

  let stats: CompiledLesson['stats'] = { prompts: 0, patterns: 0 }
  let blocks = compileBlocks(body, lines, report, stats, { illustrative: meta?.illustrative === true })
  if (!meta) return undefined

  let slug = meta.slug ?? lessonSlugFromPath(file.path)
  if (meta.minutes > 15) report.warning(`lesson is ${meta.minutes} min (over 15)`)

  let video: LessonVideo | undefined
  if (meta.video) {
    // Videos aren't part of the folder upload: authors upload them on
    // /author, and the next build links the ready ones (decision 029).
    let path = meta.video.replace(/^\.\//, '')
    let linked = context.videos?.(path)
    let declared = meta.duration === undefined ? undefined : parseClock(meta.duration)
    if (meta.duration !== undefined && declared === undefined) report.error(`duration "${meta.duration}" isn't a time like 4:30`)
    let duration = linked?.duration ?? declared
    stats.video = { path, found: Boolean(linked), duration }
    let chapters = (meta.chapters ?? []).map((chapter) => ({ at: parseClock(chapter.at) ?? 0, title: chapter.title }))
    if (duration !== undefined) {
      for (let chapter of chapters) {
        if (chapter.at > duration) report.error(`chapter “${chapter.title}” starts after the video ends`)
      }
    }
    if (!linked) {
      report.warning(`video not uploaded yet: ${path} (the lesson publishes as text-only until it is ready)`)
    } else if (duration === undefined) {
      report.warning(`video ${path} has no duration: set duration: (like 4:30); text-only until then`)
    } else {
      let captions = context.files.get(path.replace(/\.[^./]+$/, '.vtt'))
      video = {
        src: linked.src,
        duration,
        chapters: chapters.sort((a, b) => a.at - b.at),
        cues: captions?.text ? parseVtt(captions.text) : [],
      }
    }
  } else if (meta.chapters || meta.duration !== undefined) {
    report.warning('chapters and duration do nothing without a video')
  }

  let content: LessonContent = {
    title: meta.title,
    order: meta.order,
    minutes: meta.minutes,
    xp: meta.xp,
    blocks,
  }
  if (video) content.video = video
  if (meta.replies) content.replies = meta.replies
  return { meta, slug, content, kinds: kindsOf(content, meta.project === true), stats }
}

/** `06-temperature.md` → `temperature`. */
export function lessonSlugFromPath(path: string): string {
  let name = path.split('/').pop() ?? path
  return name
    .replace(/\.md$/i, '')
    .replace(/^\d+[-_.\s]*/, '')
    .toLowerCase()
}

function kindsOf(content: LessonContent, project: boolean): LessonKind[] {
  let has = (type: Block['type']) => content.blocks.some((block) => block.type === type)
  let kinds: LessonKind[] = []
  if (has('markdown')) kinds.push('chat')
  if (has('prompt')) kinds.push('type')
  if (content.video) kinds.push('video')
  if (has('code') || has('terminal')) kinds.push('code')
  if (project) kinds.push('project')
  return kinds
}

const normalize = (text: string) => text.replace(/\r\n?/g, '\n')

// ---- Blocks -----------------------------------------------------------------

const BLOCK_NAMES = [
  'prompt',
  'code',
  'quiz',
  'odds',
  'tokenizer',
  'terminal',
  'nexttoken',
  'training',
  'attention',
  'compare',
  'rabbithole',
] as const

/** Lesson-wide defaults for blocks (from the frontmatter). */
interface BlockDefaults {
  illustrative: boolean
}

function compileBlocks(
  nodes: RootContent[],
  lines: string[],
  report: FileReport,
  stats: CompiledLesson['stats'],
  defaults: BlockDefaults = { illustrative: false },
): Block[] {
  let blocks: Block[] = []
  let turn: MarkdownBlock | undefined
  let ids = new Map<string, number>()
  let codeFiles = new Set<string>()
  let pointers: { file: string; line: number }[] = []

  let closeTurn = () => {
    if (turn && turn.paragraphs.length) blocks.push(turn)
    else if (turn?.ask) blocks.push(turn)
    turn = undefined
  }
  let claimId = (id: string, line: number) => {
    let seen = ids.get(id)
    if (seen) report.error(`id "${id}" is already used on line ${seen}`, line)
    else ids.set(id, line)
  }

  for (let node of nodes) {
    let line = node.position?.start.line ?? 1
    switch (node.type) {
      case 'paragraph': {
        let paragraph = inline(node.children, report, line)
        if (paragraph.length) (turn ??= { type: 'markdown', paragraphs: [] }).paragraphs.push(paragraph)
        break
      }
      case 'thematicBreak':
        closeTurn()
        break
      case 'leafDirective':
      case 'containerDirective': {
        if (node.name === 'ask' && node.type === 'leafDirective') {
          closeTurn()
          let ask = plainText(node.children).trim()
          if (!ask) report.error('::ask needs the learner’s line: ::ask[why does it stop?]', line)
          turn = { type: 'markdown', paragraphs: [], ask }
          let pointsAt = attributes(node, ['points-at'], report).string('points-at')
          if (pointsAt) {
            turn.pointsAt = pointsAt
            pointers.push({ file: pointsAt, line })
          }
          break
        }
        if (!(BLOCK_NAMES as readonly string[]).includes(node.name)) {
          report.error(`unknown block ${fence(node)}${node.name} (blocks: ${BLOCK_NAMES.map((n) => `:::${n}`).join(', ')}, ::ask)`, line)
          break
        }
        closeTurn()
        let block = compileDirective(node, lines, report, stats, defaults)
        if (!block) break
        if ('id' in block) claimId(block.id, line)
        if (block.type === 'code') {
          for (let file of block.files) codeFiles.add(file.file)
          // Adjacent :::code blocks become one editor with tabs.
          let previous = blocks[blocks.length - 1]
          if (previous?.type === 'code' && !previous.run) {
            previous.files.push(...block.files)
            break
          }
        }
        if (block.type === 'terminal') {
          // A :::terminal right after a code group is its Run output panel.
          let previous = blocks[blocks.length - 1]
          if (previous?.type === 'code' && !previous.run) {
            previous.run = { cmd: block.cmd, lines: block.lines }
            break
          }
        }
        blocks.push(block)
        break
      }
      case 'yaml':
        report.error('only one frontmatter block is allowed, at the top', line)
        break
      case 'html':
        report.error('raw HTML isn’t allowed in lessons', line)
        break
      case 'heading':
        report.error('headings aren’t supported in lessons (the page has its own); write a paragraph', line)
        break
      case 'list':
        report.error('lists aren’t supported in lesson text yet; write paragraphs', line)
        break
      case 'code':
        report.error('use :::code{file="…" lang="…"} for code, not a bare code fence', line)
        break
      default:
        report.error(`${describe(node.type)} isn’t supported in lessons`, line)
    }
  }
  closeTurn()

  for (let pointer of pointers) {
    if (!codeFiles.has(pointer.file)) report.warning(`points-at="${pointer.file}" matches no :::code file`, pointer.line)
  }
  if (!blocks.length) report.error('the lesson has no content')
  return blocks
}

function fence(node: Directive) {
  return node.type === 'containerDirective' ? ':::' : '::'
}

function describe(type: string): string {
  let names: Record<string, string> = {
    blockquote: 'block quotes',
    table: 'tables',
    image: 'images',
    definition: 'link definitions',
    footnoteDefinition: 'footnotes',
  }
  return names[type] ?? `"${type}" markdown`
}

function compileDirective(
  node: Directive,
  lines: string[],
  report: FileReport,
  stats: CompiledLesson['stats'],
  defaults: BlockDefaults,
): Block | undefined {
  let line = node.position?.start.line ?? 1
  let body = node.type === 'containerDirective' ? rawBody(node, lines, report) : { lines: [], first: line + 1 }
  switch (node.name) {
    case 'prompt':
      stats.prompts++
      return compilePrompt(node, body, report, stats)
    case 'code':
      return compileCode(node, body, report)
    case 'quiz':
      return compileQuiz(node, report)
    case 'odds':
      return compileOdds(node, body, report)
    case 'tokenizer':
      return compileTokenizer(node, body, report, defaults)
    case 'terminal':
      return compileTerminal(node, body, report)
    case 'nexttoken':
      return compileNextToken(node, body, report, defaults)
    case 'training':
      return compileTraining(node, body, report, defaults)
    case 'attention':
      return compileAttention(node, body, report, defaults)
    case 'compare':
      return compileCompare(node, body, report, defaults)
    case 'rabbithole':
      return compileRabbitHole(node, body, report)
  }
  return undefined
}

interface RawBody {
  lines: string[]
  /** 1-based source line of `lines[0]`. */
  first: number
}

/** The source lines between a container's fences. */
function rawBody(node: ContainerDirective, lines: string[], report: FileReport): RawBody {
  let start = node.position?.start.line ?? 1
  let end = node.position?.end.line ?? lines.length
  let closing = lines[end - 1]?.trim() ?? ''
  if (end === start || !/^:{3,}$/.test(closing)) {
    report.error(`:::${node.name} is never closed: add a ::: line after it`, start)
    return { lines: lines.slice(start, end), first: start + 1 }
  }
  return { lines: lines.slice(start, end - 1), first: start + 1 }
}

/** Drops a ```fence wrapped around a raw body, and blank edges. */
function unfence(body: RawBody): RawBody & { info?: string } {
  let lines = [...body.lines]
  let first = body.first
  while (lines.length && !lines[0]!.trim()) {
    lines.shift()
    first++
  }
  while (lines.length && !lines[lines.length - 1]!.trim()) lines.pop()
  let open = /^(`{3,}|~{3,})\s*([\w.+-]*)/.exec(lines[0] ?? '')
  if (open && lines.length >= 2 && lines[lines.length - 1]!.trim().startsWith(open[1]!)) {
    return { lines: lines.slice(1, -1), first: first + 1, info: open[2] || undefined }
  }
  return { lines, first }
}

// ---- Attributes ---------------------------------------------------------------

function attributes(node: Directive, allowed: string[], report: FileReport) {
  let line = node.position?.start.line ?? 1
  let attrs = node.attributes ?? {}
  for (let name of Object.keys(attrs)) {
    if (!allowed.includes(name)) {
      report.warning(`${fence(node)}${node.name} has an unknown attribute "${name}" (known: ${allowed.join(', ') || 'none'})`, line)
    }
  }
  return {
    string(name: string): string | undefined {
      let value = attrs[name]
      return value === null || value === undefined || value === '' ? undefined : value
    },
    has(name: string): boolean {
      return name in attrs
    },
    /** Present without a value, or anything but "false". */
    flag(name: string, fallback = false): boolean {
      if (!(name in attrs)) return fallback
      return attrs[name] !== 'false'
    },
    number(name: string, fallback?: number): number | undefined {
      let value = attrs[name]
      if (value === null || value === undefined || value === '') return fallback
      let n = Number(value)
      if (!Number.isFinite(n)) {
        report.error(`${name}="${value}" isn’t a number`, line)
        return fallback
      }
      return n
    },
  }
}

/** A block's xp, reported unless it's a whole number in 0…MAX_BLOCK_XP. */
function blockXp(xp: number, report: FileReport, line: number): number {
  if (!Number.isInteger(xp) || xp < 0 || xp > MAX_BLOCK_XP) {
    report.error(`xp=${xp} is out of range: use a whole number from 0 to ${MAX_BLOCK_XP}`, line)
  }
  return clampXp(xp, MAX_BLOCK_XP)
}

// ---- :::prompt ----------------------------------------------------------------

const QUOTED = String.raw`"((?:[^"\\]|\\.)*)"`
const unquote = (text: string) => text.replace(/\\(.)/g, '$1')

function compilePrompt(node: Directive, body: RawBody, report: FileReport, stats: CompiledLesson['stats']): PromptBlock | undefined {
  let line = node.position?.start.line ?? 1
  let attrs = attributes(node, ['id', 'xp', 'model', 'temperature', 'temperatures'], report)
  let id = attrs.string('id')
  if (!id) report.error(':::prompt needs an id, like :::prompt{id="moon-tagline" xp=40}', line)
  else if (!/^[a-z0-9][a-z0-9-]*$/.test(id)) report.error(`id "${id}" should be lowercase letters, digits and dashes`, line)

  let task: string[] = []
  let checks: PromptBlock['checks'] = []
  // `- check` lines seen, valid or not (a rejected one is its own error).
  let checkLines = 0
  let examples: PromptBlock['examples'] = []
  let run: PromptBlock['run']
  let draft: string | undefined
  let placeholder: string | undefined
  let success: PromptBlock['success'] = { message: 'Every check passes. Nice work.' }

  body.lines.forEach((raw, i) => {
    let at = body.first + i
    let text = raw.trim()
    if (!text) return
    let item = /^[-*]\s+(\w+)\b\s*(.*)$/.exec(text)
    if (!item) {
      task.push(text)
      return
    }
    let [, keyword, rest = ''] = item
    switch (keyword) {
      case 'check': {
        let match = new RegExp(`^${QUOTED}\\s+\\/(.*)\\/([a-z]*)$`).exec(rest)
        if (!match) {
          report.error('check lines look like: - check "Asks for a tagline" /tagline|slogan/i', at)
          return
        }
        let [, label = '', source = '', flags = ''] = match
        stats.patterns++
        checkLines++
        let problem = checkPattern(source, flags)
        if (problem) {
          report.error(`check “${unquote(label)}”: /${source}/ ${problem}`, at)
          return
        }
        let pattern = flags ? { source, flags } : { source }
        let existing = checks.find((check) => check.label === unquote(label))
        if (existing) existing.patterns.push(pattern)
        else checks.push({ label: unquote(label), patterns: [pattern] })
        return
      }
      case 'run': {
        let match = /temperatures?\s*=\s*\[([^\]]*)\]/.exec(rest)
        let temperatures = match ? parseTemperatures(match[1]!) : undefined
        if (!temperatures?.length) {
          report.error('run lines look like: - run temperature=[0, 1.0]', at)
          return
        }
        let label = new RegExp(QUOTED).exec(rest.replace(match![0], ''))?.[1]
        run = {
          label: label ? unquote(label) : `Ran at ${temperatures.map(temperatureLabel).join(' and ')}`,
          temperatures,
        }
        return
      }
      case 'example': {
        let match = new RegExp(`^T\\s*=\\s*([\\d.]+)\\s+${QUOTED}$`).exec(rest)
        let temperature = match ? Number(match[1]) : NaN
        if (!match || !validTemperature(temperature)) {
          report.error('example lines look like: - example T=0 "Brewed beyond gravity."', at)
          return
        }
        examples.push({ temperature, text: unquote(match[2]!) })
        return
      }
      case 'draft':
      case 'placeholder': {
        let match = new RegExp(`^${QUOTED}$`).exec(rest)
        if (!match) {
          report.error(`${keyword} lines look like: - ${keyword} "Write a tagline for…"`, at)
          return
        }
        if (keyword === 'draft') draft = unquote(match[1]!)
        else placeholder = unquote(match[1]!)
        return
      }
      case 'success': {
        let match = new RegExp(`^${QUOTED}(?:\\s+next=${QUOTED})?$`).exec(rest)
        if (!match) {
          report.error('success lines look like: - success "Same prompt, different answers." next="Next: Top-p →"', at)
          return
        }
        success = { message: unquote(match[1]!) }
        if (match[2]) success.nextLabel = unquote(match[2])
        return
      }
      default:
        report.error(`unknown prompt line "- ${keyword}" (use check, run, example, draft, placeholder or success)`, at)
    }
  })

  if (!checkLines) report.error(':::prompt has no - check lines', line)
  let taskText = stripMarkdown(task.join(' '))
  if (!taskText) report.error(':::prompt needs the task text (what the learner should write)', line)

  let temperature = attrs.number('temperature')
  if (temperature !== undefined && !validTemperature(temperature)) report.error(`temperature=${temperature} is outside 0–2`, line)
  let offered = attrs.string('temperatures')
  let temperatures = offered
    ? parseTemperatures(offered)
    : [...new Set([...(run?.temperatures ?? []), ...examples.map((e) => e.temperature), ...(temperature === undefined ? [] : [temperature])])]
  if (!temperatures?.length) temperatures = [temperature ?? 0.7]
  temperatures.sort((a, b) => a - b)
  for (let t of run?.temperatures ?? []) {
    if (!temperatures.includes(t)) report.error(`run needs T=${temperatureLabel(t)}, which temperatures="${offered}" doesn’t offer`, line)
  }

  if (!id) return undefined
  let block: PromptBlock = {
    type: 'prompt',
    id,
    xp: blockXp(attrs.number('xp', 10)!, report, line),
    task: taskText,
    checks,
    temperatures,
    examples,
    success,
  }
  let model = attrs.string('model')
  if (model) block.model = model
  if (placeholder) block.placeholder = placeholder
  if (draft) block.draft = draft
  if (run) block.run = run
  return block
}

function validTemperature(t: number) {
  return Number.isFinite(t) && t >= 0 && t <= 2
}

function parseTemperatures(text: string): number[] | undefined {
  let values = text
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .map(Number)
  return values.every(validTemperature) ? [...new Set(values)] : undefined
}

function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*|__|`/g, '')
    .replace(/(^|\s)[*_](\S)/g, '$1$2')
    .replace(/(\S)[*_](\s|$)/g, '$1$2')
    .replace(/\s+/g, ' ')
    .trim()
}

// ---- :::code -----------------------------------------------------------------

function compileCode(node: Directive, raw: RawBody, report: FileReport): CodeBlock | undefined {
  let line = node.position?.start.line ?? 1
  let attrs = attributes(node, ['file', 'lang', 'copy', 'type-mode', 'highlight', 'label', 'focus'], report)
  let file = attrs.string('file')
  if (!file) {
    report.error(':::code needs a file name, like :::code{file="agent.ts" lang="ts"}', line)
    return undefined
  }
  let body = unfence(raw)
  let lang = attrs.string('lang')
  if (!lang) {
    report.warning(':::code has no lang', line)
    lang = body.info ?? file.split('.').pop() ?? 'text'
  } else if (!isKnownLanguage(lang)) {
    report.warning(`:::code lang="${lang}" isn’t highlighted (known: ts, js, py, sh, json, env)`, line)
  }
  if (!body.lines.length) report.error(`:::code ${file} is empty`, line)
  let language = languageOf(lang)
  let codeFile: CodeBlockFile = {
    file,
    lang,
    badge: language.badge,
    language: language.name,
    copy: attrs.flag('copy', true),
    typeMode: attrs.flag('type-mode'),
    lines: highlight(body.lines.join('\n'), lang),
  }
  let range = attrs.string('highlight')
  if (range) {
    let match = /^(\d+)(?:-(\d+))?$/.exec(range)
    let from = Number(match?.[1])
    let to = Number(match?.[2] ?? match?.[1])
    if (!match || from < 1 || to < from || to > body.lines.length) {
      report.error(`highlight="${range}" should be a line range inside the ${body.lines.length} lines, like "12-32"`, line)
    } else {
      codeFile.highlight = { from, to, label: attrs.string('label') ?? `lines ${from}–${to}` }
    }
  }
  let focus = attrs.number('focus')
  if (focus !== undefined) {
    if (focus < 1 || focus > body.lines.length) report.error(`focus=${focus} is outside the code`, line)
    else codeFile.focusLine = focus
  }
  return { type: 'code', files: [codeFile] }
}

// ---- :::quiz -----------------------------------------------------------------

function compileQuiz(node: Directive, report: FileReport): QuizBlock | undefined {
  let line = node.position?.start.line ?? 1
  let attrs = attributes(node, ['id', 'xp', 'multiple'], report)
  let id = attrs.string('id')
  if (!id) report.error(':::quiz needs an id, like :::quiz{id="common-words" xp=10}', line)
  let multiple = attrs.flag('multiple')
  let question: Paragraph = []
  let options: QuizBlock['options'] = []
  let listSeen = false

  for (let child of node.children) {
    let at = child.position?.start.line ?? line
    if (child.type === 'paragraph' && !listSeen) {
      if (question.length) question.push(' ')
      question.push(...inline(child.children, report, at))
    } else if (child.type === 'list') {
      listSeen = true
      for (let item of child.children) {
        let itemLine = item.position?.start.line ?? at
        if (item.checked === null || item.checked === undefined) {
          report.error('quiz options are task items: - [ ] wrong or - [x] right', itemLine)
          continue
        }
        let text = item.children
          .map((part) => (part.type === 'paragraph' ? plainText(part.children) : ''))
          .join('\n')
          .trim()
        let [label = '', ...rest] = text.split('\n')
        if (!label.trim()) report.error('quiz option has no text', itemLine)
        options.push({
          key: String.fromCharCode(97 + options.length),
          label: label.trim(),
          correct: item.checked,
          explanation: rest.join(' ').replace(/\s+/g, ' ').trim(),
        })
      }
    } else {
      report.error('a quiz is a question paragraph, then - [ ] / - [x] options', at)
    }
  }
  if (!question.length) report.error(':::quiz needs a question before its options', line)
  if (options.length < 2) report.error(':::quiz needs at least two options', line)
  let correct = options.filter((option) => option.correct).length
  if (options.length >= 2 && correct === 0) report.error(':::quiz has no right answer: mark it - [x]', line)
  if (correct > 1 && !multiple) report.error(`:::quiz has ${correct} right answers: add multiple to allow several`, line)
  if (!id) return undefined
  let block: QuizBlock = { type: 'quiz', id, xp: blockXp(attrs.number('xp', 10)!, report, line), question, options }
  if (multiple) block.multiple = true
  return block
}

// ---- :::odds, :::tokenizer, :::terminal ---------------------------------------

function compileOdds(node: Directive, raw: RawBody, report: FileReport): OddsBlock | undefined {
  let line = node.position?.start.line ?? 1
  let attrs = attributes(node, ['prompt', 'blank', 'slider'], report)
  let prompt = attrs.string('prompt')
  if (!prompt) report.error(':::odds needs a prompt, like :::odds{prompt="Moon café tagline:"}', line)
  let candidates: OddsBlock['candidates'] = []
  raw.lines.forEach((text, i) => {
    if (!text.trim()) return
    let match = new RegExp(`^\\s*${QUOTED}\\s+(-?\\d+(?:\\.\\d+)?)\\s*$`).exec(text) ?? /^(.*?\S)\s+(-?\d+(?:\.\d+)?)\s*$/.exec(text)
    if (!match) {
      report.error('odds lines are a token and its score, like: " Brew" 3.1', raw.first + i)
      return
    }
    candidates.push([match[0].trimStart().startsWith('"') ? unquote(match[1]!) : match[1]!, Number(match[2])])
  })
  if (candidates.length < 2) report.error(':::odds needs at least two token lines', line)
  let slider = attrs.has('slider') && !attrs.string('slider') ? 0.7 : attrs.number('slider', 0.7)!
  if (!validTemperature(slider)) report.error(`slider=${slider} is outside 0–2`, line)
  if (!prompt) return undefined
  return { type: 'odds', prompt, blank: attrs.string('blank') ?? '“___', slider, candidates }
}

function compileTokenizer(node: Directive, raw: RawBody, report: FileReport, defaults: BlockDefaults): TokenizerBlock {
  let attrs = attributes(node, ['sample', 'illustrative'], report)
  let sample = attrs.string('sample') ?? 'Unbelievably, the cat fetched.'
  let tokens: [string, string][] = []
  raw.lines.forEach((text, i) => {
    if (!text.trim()) return
    let match = new RegExp(`^\\s*${QUOTED}\\s+(\\d+)\\s*$`).exec(text)
    if (!match) {
      report.error('tokenizer lines are a token and its id, like: "Un" 1844', raw.first + i)
      return
    }
    tokens.push([unquote(match[1]!), match[2]!])
  })
  if (tokens.length && tokens.map(([t]) => t).join('') !== sample) {
    report.error('the tokenizer lines don’t join up to the sample text', node.position?.start.line)
  }
  let block: TokenizerBlock = { type: 'tokenizer', sample, tokens: tokens.length ? tokens : approximateTokens(sample) }
  if (attrs.flag('illustrative', defaults.illustrative)) block.illustrative = true
  return block
}

const TONES: TerminalTone[] = ['text', 'muted', 'quiet', 'ion', 'volt', 'synapse']
const toneMarker = new RegExp(`\\[(${TONES.join('|')})\\]`, 'g')

function compileTerminal(node: Directive, raw: RawBody, report: FileReport): TerminalBlock | undefined {
  let line = node.position?.start.line ?? 1
  let attrs = attributes(node, ['cmd', 'ask', 'summary'], report)
  let cmd = attrs.string('cmd')
  if (!cmd) report.error(':::terminal needs the command, like :::terminal{cmd="npx tsx agent.ts"}', line)
  let body = unfence(raw)
  if (!body.lines.length) report.error(':::terminal has no output lines', line)
  if (!cmd) return undefined
  let block: TerminalBlock = { type: 'terminal', cmd, lines: body.lines.map(terminalLine) }
  let ask = attrs.string('ask')
  let summary = attrs.string('summary')
  if (ask) block.ask = ask
  if (summary) block.summary = summary
  return block
}

/** `[ion]turn 1[quiet] stop_reason=` → coloured parts; text before any marker is plain. */
export function terminalLine(text: string): TerminalPart[] {
  let parts: TerminalPart[] = []
  let tone: TerminalTone = 'text'
  let last = 0
  for (let match of text.matchAll(toneMarker)) {
    if (match.index > last) parts.push([tone, text.slice(last, match.index)])
    tone = match[1] as TerminalTone
    last = match.index + match[0].length
  }
  if (last < text.length) parts.push([tone, text.slice(last)])
  return parts
}

// ---- Lesson toys: :::nexttoken, :::training, :::attention, :::compare, :::rabbithole
// (decision 021). Bodies are plain lines, like :::odds. Quoted strings take
// \" and \\ escapes, and \n for a line break.

const NUMBER = String.raw`(-?\d+(?:\.\d+)?|-?\.\d+)`
const unescapeText = (text: string) => text.replace(/\\(.)/g, (_, c: string) => (c === 'n' ? '\n' : c))
const EPSILON = 0.005

function illustrativeOf(attrs: ReturnType<typeof attributes>, defaults: BlockDefaults): boolean {
  return attrs.flag('illustrative', defaults.illustrative)
}

/** Non-blank body lines with their source line numbers. */
function bodyLines(raw: RawBody): { text: string; at: number }[] {
  return raw.lines.map((text, i) => ({ text: text.trim(), at: raw.first + i })).filter((line) => line.text)
}

const MAX_STEPS = 60

function compileNextToken(node: Directive, raw: RawBody, report: FileReport, defaults: BlockDefaults): NextTokenBlock | undefined {
  let line = node.position?.start.line ?? 1
  let attrs = attributes(node, ['prompt', 'illustrative'], report)
  let prompt = attrs.string('prompt')
  if (!prompt) report.error(':::nexttoken needs a prompt, like :::nexttoken{prompt="The capital of France is"}', line)
  let steps: NextTokenBlock['steps'] = []
  let shape = new RegExp(`^${QUOTED}\\s+${NUMBER}\\s*(?:\\|\\s*(.*))?$`)
  let alternative = new RegExp(`\\s*${QUOTED}\\s*:\\s*${NUMBER}`, 'y')
  for (let { text, at } of bodyLines(raw)) {
    let match = shape.exec(text)
    if (!match) {
      report.error('nexttoken lines are the picked token, its odds, then | and the runners-up, like: " Paris" 0.92 | " the":0.03 " a":0.02', at)
      continue
    }
    let token = unescapeText(match[1]!)
    let p = Number(match[2])
    let alternatives: [string, number][] = []
    let rest = (match[3] ?? '').trimEnd()
    alternative.lastIndex = 0
    let alt: RegExpExecArray | null
    while (rest && alternative.lastIndex < rest.length && (alt = alternative.exec(rest))) {
      alternatives.push([unescapeText(alt[1]!), Number(alt[2])])
    }
    if (rest && alternative.lastIndex < rest.length) {
      report.error(`runners-up look like " the":0.03 " a":0.02 (couldn’t read “${rest.slice(alternative.lastIndex).trim()}”)`, at)
      continue
    }
    let all: [string, number][] = [[token, p], ...alternatives]
    let bad = all.find(([, odds]) => !(odds >= 0 && odds <= 1))
    if (bad) {
      report.error(`odds ${bad[1]} for "${bad[0]}" are outside 0–1`, at)
      continue
    }
    let sum = all.reduce((total, [, odds]) => total + odds, 0)
    if (sum > 1 + EPSILON) report.error(`the odds on this line add up to ${sum.toFixed(2)}, more than 1`, at)
    let tokens = all.map(([t]) => t)
    let duplicate = tokens.find((t, i) => tokens.indexOf(t) !== i)
    if (duplicate !== undefined) report.error(`"${duplicate}" is listed twice on this line`, at)
    if (!token) report.error('the picked token is empty', at)
    steps.push({ token, p, alternatives })
  }
  if (!steps.length) report.error(':::nexttoken needs at least one step line', line)
  if (steps.length > MAX_STEPS) report.error(`:::nexttoken has ${steps.length} steps; keep it to ${MAX_STEPS}`, line)
  if (!prompt || !steps.length) return undefined
  let block: NextTokenBlock = { type: 'nexttoken', prompt, steps }
  if (illustrativeOf(attrs, defaults)) block.illustrative = true
  return block
}

const MAX_SNAPSHOTS = 20

function compileTraining(node: Directive, raw: RawBody, report: FileReport, defaults: BlockDefaults): TrainingBlock | undefined {
  let line = node.position?.start.line ?? 1
  let attrs = attributes(node, ['prompt', 'illustrative'], report)
  let prompt = attrs.string('prompt')
  if (!prompt) report.error(':::training needs a prompt, like :::training{prompt="Once upon a"}', line)
  let snapshots: TrainingBlock['snapshots'] = []
  let shape = new RegExp(`^[-*]\\s+step\\s+([\\d,_]+)\\s+loss\\s*=\\s*${NUMBER}\\s+${QUOTED}$`)
  for (let { text, at } of bodyLines(raw)) {
    let match = shape.exec(text)
    if (!match) {
      report.error('training lines look like: - step 500 loss=6.1 "the model’s output at that step"', at)
      continue
    }
    let step = Number(match[1]!.replace(/[,_]/g, ''))
    let loss = Number(match[2])
    if (!Number.isSafeInteger(step)) {
      report.error(`step ${match[1]} isn’t a whole number`, at)
      continue
    }
    if (!(loss >= 0)) {
      report.error(`loss=${match[2]} can’t be negative`, at)
      continue
    }
    let previous = snapshots[snapshots.length - 1]
    if (previous && step <= previous.step) report.error(`step ${step} comes after step ${previous.step}: list steps in increasing order`, at)
    snapshots.push({ step, loss, text: unescapeText(match[3]!) })
  }
  if (snapshots.length < 2) report.error(':::training needs at least two - step lines', line)
  if (snapshots.length > MAX_SNAPSHOTS) report.error(`:::training has ${snapshots.length} snapshots; keep it to ${MAX_SNAPSHOTS}`, line)
  if (!prompt || snapshots.length < 2) return undefined
  let block: TrainingBlock = { type: 'training', prompt, snapshots }
  if (illustrativeOf(attrs, defaults)) block.illustrative = true
  return block
}

const MAX_ATTENTION_TOKENS = 40

function compileAttention(node: Directive, raw: RawBody, report: FileReport, defaults: BlockDefaults): AttentionBlock | undefined {
  let line = node.position?.start.line ?? 1
  let attrs = attributes(node, ['caption', 'illustrative'], report)
  let tokens: string[] | undefined
  let links: AttentionBlock['links'] = []
  let seen = new Set<string>()
  let token = new RegExp(`\\s*${QUOTED}`, 'y')
  let linkShape = new RegExp(`^[-*]\\s+from\\s*=\\s*(\\S+)\\s+to\\s*=\\s*(\\S+)\\s+w\\s*=\\s*(\\S+)$`)
  for (let { text, at } of bodyLines(raw)) {
    let row = /^(?:[-*]\s+)?tokens\s+(.*)$/.exec(text)
    if (row) {
      if (tokens) {
        report.error(':::attention has more than one tokens line', at)
        continue
      }
      let rest = row[1]!.trimEnd()
      let list: string[] = []
      token.lastIndex = 0
      let match: RegExpExecArray | null
      while (token.lastIndex < rest.length && (match = token.exec(rest))) list.push(unescapeText(match[1]!))
      if (token.lastIndex < rest.length || !list.length) {
        report.error('the tokens line is quoted tokens, like: tokens "The" " animal" " was" " tired"', at)
        continue
      }
      tokens = list
      if (list.length < 2) report.error(':::attention needs at least two tokens', at)
      if (list.length > MAX_ATTENTION_TOKENS) report.error(`:::attention has ${list.length} tokens; keep it to ${MAX_ATTENTION_TOKENS}`, at)
      continue
    }
    let match = linkShape.exec(text)
    if (!match) {
      report.error('attention lines look like: - from=7 to=1 w=0.62 (after a tokens "…" "…" line)', at)
      continue
    }
    if (!tokens) {
      report.error('put the tokens line before the - from= lines', at)
      continue
    }
    let [from, to, weight] = [Number(match[1]), Number(match[2]), Number(match[3])]
    let count = tokens.length
    let index = (value: number) => Number.isInteger(value) && value >= 0 && value < count
    if (!index(from) || !index(to)) {
      report.error(`from=${match[1]} to=${match[2]}: indexes count from 0 and must be below ${count} (the number of tokens)`, at)
      continue
    }
    if (to > from) {
      report.error(`from=${from} to=${to}: a token only attends to itself and earlier tokens (to ≤ from)`, at)
      continue
    }
    if (!(weight >= 0 && weight <= 1)) {
      report.error(`w=${match[3]} is outside 0–1`, at)
      continue
    }
    let key = `${from}:${to}`
    if (seen.has(key)) {
      report.error(`from=${from} to=${to} is listed twice`, at)
      continue
    }
    seen.add(key)
    links.push({ from, to, weight })
  }
  if (!tokens) report.error(':::attention needs a tokens line, like: tokens "The" " animal" " was" " tired"', line)
  else if (!links.length) report.error(':::attention needs at least one - from=… to=… w=… line', line)
  let sums = new Map<number, number>()
  for (let link of links) sums.set(link.from, (sums.get(link.from) ?? 0) + link.weight)
  for (let [from, sum] of sums) {
    if (sum > 1 + EPSILON) report.warning(`the weights from token ${from} add up to ${sum.toFixed(2)}; attention weights sum to at most 1`, line)
  }
  if (!tokens || !links.length) return undefined
  let block: AttentionBlock = { type: 'attention', tokens, links }
  let caption = attrs.string('caption')
  if (caption) block.caption = caption
  if (illustrativeOf(attrs, defaults)) block.illustrative = true
  return block
}

const MAX_COMPARE_ROWS = 4

/** Body items that start with `- `; following lines continue a quoted string. */
function bodyItems(raw: RawBody): { text: string; at: number }[] {
  let items: { text: string; at: number }[] = []
  let open = false
  raw.lines.forEach((source, i) => {
    let text = source.trim()
    let current = items[items.length - 1]
    if (open && current) {
      current.text += `\n${text}`
    } else if (!text) {
      return
    } else {
      items.push({ text, at: raw.first + i })
      current = items[items.length - 1]!
    }
    // Inside a quoted string when the unescaped quotes so far are odd.
    open = ((current.text.replace(/\\./g, '').match(/"/g) ?? []).length & 1) === 1
  })
  return items
}

function compileCompare(node: Directive, raw: RawBody, report: FileReport, defaults: BlockDefaults): CompareBlock | undefined {
  let line = node.position?.start.line ?? 1
  let attrs = attributes(node, ['left', 'right', 'illustrative'], report)
  let left = attrs.string('left')
  let right = attrs.string('right')
  if (!left || !right) report.error(':::compare needs both labels, like :::compare{left="Base model" right="Assistant"}', line)
  let rows: (Partial<CompareBlock['rows'][number]> & { at: number })[] = []
  let shape = new RegExp(`^[-*]\\s+(prompt|left|right)\\s+${QUOTED}$`)
  for (let { text, at } of bodyItems(raw)) {
    let match = shape.exec(text)
    if (!match) {
      report.error('compare lines look like: - prompt "…", - left "…" or - right "…" (a string can run over several lines)', at)
      continue
    }
    let key = match[1] as 'prompt' | 'left' | 'right'
    let value = unescapeText(match[2]!).trim()
    let row = rows[rows.length - 1]
    // A prompt starts a row; so does a second left or right.
    if (!row || key === 'prompt' || row[key] !== undefined) rows.push((row = { at }))
    if (!value) report.error(`- ${key} is empty`, at)
    row![key] = value
  }
  let complete: CompareBlock['rows'] = []
  for (let row of rows) {
    if (row.left === undefined || row.right === undefined) {
      report.error('each compare row needs a - left and a - right line', row.at)
      continue
    }
    complete.push(row.prompt ? { prompt: row.prompt, left: row.left, right: row.right } : { left: row.left, right: row.right })
  }
  if (!rows.length) report.error(':::compare needs - left "…" and - right "…" lines', line)
  if (rows.length > MAX_COMPARE_ROWS) report.error(`:::compare has ${rows.length} rows; keep it to ${MAX_COMPARE_ROWS}`, line)
  if (!left || !right || !complete.length) return undefined
  let block: CompareBlock = { type: 'compare', left, right, rows: complete }
  if (illustrativeOf(attrs, defaults)) block.illustrative = true
  return block
}

export const MAX_RABBIT_HOLES = 3
/** Longer than this is a deep dive, flag or not. */
const DEEP_MINUTES = 30

function compileRabbitHole(node: Directive, raw: RawBody, report: FileReport): RabbitHoleBlock | undefined {
  let line = node.position?.start.line ?? 1
  attributes(node, [], report)
  let links: RabbitHoleBlock['links'] = []
  let head = new RegExp(`^[-*]\\s+(\\w+)\\s+${QUOTED}(.*)$`)
  let field = new RegExp(`\\s*([a-z]+)(?:\\s*=\\s*(?:${QUOTED}|([^\\s"]+)))?`, 'y')
  let example = 'rabbit hole lines look like: - video "Title" by="3Blue1Brown" mins=8 url="https://…" (or - read …; add deep for long pieces)'
  for (let { text, at } of bodyLines(raw)) {
    let match = head.exec(text)
    if (!match) {
      report.error(example, at)
      continue
    }
    let kind = match[1]!
    if (kind !== 'video' && kind !== 'read') {
      report.error(`unknown rabbit hole kind "${kind}" (use video or read)`, at)
      continue
    }
    let title = unescapeText(match[2]!).trim()
    let rest = match[3]!.trimEnd()
    let fields = new Map<string, string | true>()
    field.lastIndex = 0
    let f: RegExpExecArray | null
    while (field.lastIndex < rest.length && (f = field.exec(rest))) {
      fields.set(f[1]!, f[2] !== undefined ? unescapeText(f[2]) : (f[3] ?? true))
    }
    if (field.lastIndex < rest.length) {
      report.error(`couldn’t read “${rest.slice(field.lastIndex).trim()}”: ${example}`, at)
      continue
    }
    for (let name of fields.keys()) {
      if (!['by', 'mins', 'url', 'deep'].includes(name)) report.warning(`unknown rabbit hole field "${name}" (known: by, mins, url, deep)`, at)
    }
    let by = fields.get('by')
    let url = fields.get('url')
    let mins = fields.get('mins')
    let ok = true
    if (!title) {
      report.error('a rabbit hole needs a title', at)
      ok = false
    }
    if (typeof by !== 'string' || !by.trim()) {
      report.error('a rabbit hole needs its author: by="3Blue1Brown"', at)
      ok = false
    }
    if (typeof url !== 'string' || !isHttpsUrl(url)) {
      report.error(`a rabbit hole needs an https link: url="https://…"${typeof url === 'string' ? ` (got “${url}”)` : ''}`, at)
      ok = false
    }
    let minutes: number | undefined
    if (mins !== undefined) {
      minutes = Number(mins)
      if (mins === true || !Number.isFinite(minutes) || minutes <= 0 || minutes > 600) {
        report.error(`mins=${mins === true ? '' : mins} should be the length in minutes, like mins=8`, at)
        ok = false
      }
    }
    if (!ok) continue
    let link: RabbitHoleBlock['links'][number] = { kind, title, by: (by as string).trim(), url: url as string }
    if (minutes !== undefined) link.mins = Math.round(minutes)
    let deep = fields.get('deep')
    if ((deep !== undefined && deep !== 'false') || (minutes ?? 0) > DEEP_MINUTES) link.deep = true
    if (links.some((other) => other.url === link.url)) report.warning('this link is already in the list', at)
    links.push(link)
  }
  if (!links.length && !bodyLines(raw).length) report.error(':::rabbithole needs at least one - video or - read line', line)
  if (links.length > MAX_RABBIT_HOLES) report.error(`:::rabbithole has ${links.length} links; pick the best ${MAX_RABBIT_HOLES}`, line)
  if (!links.length) return undefined
  return { type: 'rabbithole', links: links.slice(0, MAX_RABBIT_HOLES) }
}

function isHttpsUrl(text: string): boolean {
  try {
    let url = new URL(text)
    return url.protocol === 'https:' && Boolean(url.hostname) && !url.username && !url.password
  } catch {
    return false
  }
}

// ---- Inline markdown -----------------------------------------------------------

/** Phrasing content → the lesson's Inline runs (text, strong, code, ==mark==). */
function inline(nodes: PhrasingContent[], report: FileReport, line: number): Paragraph {
  let out: Inline[] = []
  let pushText = (raw: string) => {
    // Soft line breaks in the source are spaces on the page.
    let text = raw.replace(/[ \t]*\n[ \t]*/g, ' ')
    for (let [i, part] of text.split(/==([^=]+)==/).entries()) {
      if (!part) continue
      if (i % 2) out.push({ mark: part })
      else if (typeof out[out.length - 1] === 'string') out[out.length - 1] += part
      else out.push(part)
    }
  }
  for (let node of nodes) {
    let at = node.position?.start.line ?? line
    switch (node.type) {
      case 'text':
        pushText(node.value)
        break
      case 'break':
        pushText(' ')
        break
      case 'strong':
        out.push({ strong: plainText(node.children).replace(/\s*\n\s*/g, ' ') })
        break
      case 'inlineCode':
        out.push({ code: node.value })
        break
      case 'emphasis':
        report.warning('*emphasis* shows as plain text; use **strong**', at)
        pushText(plainText(node.children))
        break
      case 'delete':
        pushText(plainText(node.children))
        break
      case 'link':
        report.warning('links show as plain text for now', at)
        pushText(plainText(node.children))
        break
      case 'textDirective':
        // `word:thing` in prose parses as a directive; put the text back.
        pushText(`:${node.name}${node.children.length ? plainText(node.children) : ''}`)
        break
      case 'html':
        report.error('raw HTML isn’t allowed in lessons', at)
        break
      default:
        report.error(`${describe(node.type)} aren’t supported in lesson text`, at)
    }
  }
  // Trim the paragraph's outer whitespace.
  if (typeof out[0] === 'string') out[0] = out[0].trimStart()
  let end = out.length - 1
  if (typeof out[end] === 'string') out[end] = (out[end] as string).trimEnd()
  return out.filter((part) => part !== '')
}

function plainText(nodes: readonly (PhrasingContent | MdParagraph)[]): string {
  return nodes
    .map((node) => {
      if ('value' in node && typeof node.value === 'string') return node.value
      if (node.type === 'break') return '\n'
      if ('children' in node) return plainText(node.children as PhrasingContent[])
      return ''
    })
    .join('')
}

// ---- Captions ----------------------------------------------------------------

/** WebVTT → transcript cues (start seconds + text). */
export function parseVtt(text: string): LessonVideo['cues'] {
  let cues: LessonVideo['cues'] = []
  for (let block of normalize(text).split(/\n{2,}/)) {
    let lines = block.split('\n')
    let timing = lines.findIndex((l) => l.includes('-->'))
    if (timing < 0) continue
    let start = parseClock(lines[timing]!.split('-->')[0]!.trim().replace(/\.\d+$/, ''))
    let cue = lines
      .slice(timing + 1)
      .join(' ')
      .replace(/<[^>]+>/g, '')
      .trim()
    if (start !== undefined && cue) cues.push({ start, text: cue })
  }
  return cues
}
