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
  Block,
  CodeBlock,
  CodeBlockFile,
  Inline,
  LessonContent,
  LessonVideo,
  MarkdownBlock,
  OddsBlock,
  Paragraph,
  PromptBlock,
  QuizBlock,
  TerminalBlock,
  TokenizerBlock,
} from '../../actions/courses/lesson/content.ts'
import { approximateTokens } from '../../actions/courses/lesson/public/tokenizer-toy.tsx'
import { temperatureLabel } from '../../actions/courses/lesson/ui/exercise.ts'
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
  stats: { prompts: number; patterns: number; video?: { path: string; found: boolean } }
}

export interface LessonContext {
  /** Every path in the course folder (for video and caption lookups). */
  files: ReadonlyMap<string, SourceFile>
  report: FileReport
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
  let blocks = compileBlocks(body, lines, report, stats)
  if (!meta) return undefined

  let slug = meta.slug ?? lessonSlugFromPath(file.path)
  if (meta.minutes > 15) report.warning(`lesson is ${meta.minutes} min (over 15)`)

  let video: LessonVideo | undefined
  if (meta.video) {
    let path = meta.video.replace(/^\.\//, '')
    let found = context.files.has(path)
    stats.video = { path, found }
    if (!found) report.warning(`video not found: ${path}`)
    let duration = meta.duration === undefined ? undefined : parseClock(meta.duration)
    if (duration === undefined) {
      report.error('video needs a duration (like 4:30) until uploads report one')
    } else {
      let chapters = (meta.chapters ?? []).map((chapter) => ({ at: parseClock(chapter.at) ?? 0, title: chapter.title }))
      for (let chapter of chapters) {
        if (chapter.at > duration) report.error(`chapter “${chapter.title}” starts after the video ends`)
      }
      let captions = context.files.get(path.replace(/\.[^./]+$/, '.vtt'))
      video = {
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

const BLOCK_NAMES = ['prompt', 'code', 'quiz', 'odds', 'tokenizer', 'terminal'] as const

function compileBlocks(nodes: RootContent[], lines: string[], report: FileReport, stats: CompiledLesson['stats']): Block[] {
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
        let block = compileDirective(node, lines, report, stats)
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

function compileDirective(node: Directive, lines: string[], report: FileReport, stats: CompiledLesson['stats']): Block | undefined {
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
      return compileTokenizer(node, body, report)
    case 'terminal':
      return compileTerminal(node, body, report)
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

  if (!checks.length) report.error(':::prompt has no - check lines', line)
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
    xp: attrs.number('xp', 10)!,
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
  let block: QuizBlock = { type: 'quiz', id, xp: attrs.number('xp', 10)!, question, options }
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

function compileTokenizer(node: Directive, raw: RawBody, report: FileReport): TokenizerBlock {
  let attrs = attributes(node, ['sample'], report)
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
  return { type: 'tokenizer', sample, tokens: tokens.length ? tokens : approximateTokens(sample) }
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
