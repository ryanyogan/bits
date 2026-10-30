// One lesson file → LessonContent (lesson/content.ts).
//
// The body is markdown parsed with unified + remark (frontmatter, GFM,
// directives). Paragraphs, lists, ``` samples and ### subheadings become
// tutor messages (decision 061); `:::name{attrs}` blocks
// become the interactive blocks. Bodies that are code or data (`:::code`,
// `:::terminal`, `:::odds`, `:::prompt`) are read from the raw source lines
// between the fences, so markdown never mangles a regex or an indent. Every
// problem is reported with the line it is on.
import type { Code, List, Paragraph as MdParagraph, PhrasingContent, Root, RootContent } from 'mdast'
import remarkDirective from 'remark-directive'
import remarkFrontmatter from 'remark-frontmatter'
import remarkGfm from 'remark-gfm'
import remarkParse from 'remark-parse'
import { unified } from 'unified'
import type { TerminalPart, TerminalTone } from '@bits/ui/terminal'

import {
  quizAsAsk,
  type AskBlock,
  type AttentionBlock,
  type Block,
  type CodeBlock,
  type CodeBlockFile,
  type CompareBlock,
  type FlowBlock,
  type Inline,
  depthsOf,
  type LessonContent,
  type LessonDepth,
  type LessonVideo,
  type MarblesBlock,
  type MarkdownBlock,
  type NextTokenBlock,
  type OddsBlock,
  type Paragraph,
  type Prose,
  type ProseFence,
  type ProseList,
  type ProseListItem,
  type PromptBlock,
  type QuizBlock,
  type RabbitHoleBlock,
  type StepsBlock,
  type TerminalBlock,
  type TokenizerBlock,
  type TrainingBlock,
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
  /** Reading minutes at each depth, when the lesson has depth blocks (decision 053). */
  minsByDepth?: Record<LessonDepth, number>
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
  let compiled: CompiledLesson = { meta, slug, content, kinds: kindsOf(content, meta.project === true), stats }
  let byDepth = minsByDepth(content)
  if (byDepth) compiled.minsByDepth = byDepth
  return compiled
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

/** Words a block reads as: its prose, or a flat allowance for a toy, an editor or an exercise. */
const BLOCK_WORDS = 60

function wordsIn(block: Block): number {
  if (block.type !== 'markdown') return BLOCK_WORDS
  let text = block.paragraphs.map(proseText).join(' ')
  return `${block.ask ?? ''} ${text}`.split(/\s+/).filter(Boolean).length
}

const inlineText = (paragraph: Paragraph) =>
  paragraph
    .map((part) => (typeof part === 'string' ? part : 'strong' in part ? part.strong : 'code' in part ? part.code : 'mark' in part ? part.mark : part.link))
    .join(' ')

/** The words of one part of a turn: a paragraph, a subheading, a list or a code sample (decision 061). */
function proseText(part: Prose): string {
  if (Array.isArray(part)) return inlineText(part)
  if ('heading' in part) return inlineText(part.heading)
  if ('sample' in part) return part.sample.map((line) => line.map(([, text]) => text).join('')).join(' ')
  return part.items.map((item) => [...item.paragraphs.map(inlineText), item.list ? proseText(item.list) : ''].join(' ')).join(' ')
}

/**
 * Reading minutes at each depth (decision 053). The frontmatter `minutes`
 * is the longer read; the shorter one scales by its share of the words.
 * Undefined when the lesson has no depth blocks.
 */
function minsByDepth(content: LessonContent): Record<LessonDepth, number> | undefined {
  if (!depthsOf(content.blocks).length) return undefined
  let words = (depth: LessonDepth) =>
    content.blocks.filter((block) => !block.depth || block.depth === depth).reduce((sum, block) => sum + wordsIn(block), 0)
  let counts = { new: words('new'), engineer: words('engineer') }
  let most = Math.max(counts.new, counts.engineer, 1)
  let scale = (n: number) => Math.max(1, Math.round((content.minutes * n) / most))
  return { new: scale(counts.new), engineer: scale(counts.engineer) }
}

const normalize = (text: string) => text.replace(/\r\n?/g, '\n')

// ---- Blocks -----------------------------------------------------------------

const BLOCK_NAMES = [
  'prompt',
  'code',
  'ask',
  'quiz',
  'odds',
  'tokenizer',
  'terminal',
  'nexttoken',
  'training',
  'attention',
  'compare',
  'rabbithole',
  'steps',
  'flow',
  'marbles',
] as const

/** Lesson-wide defaults for blocks (from the frontmatter). */
interface BlockDefaults {
  illustrative: boolean
}

/**
 * Depth blocks (decision 053): `:::new` and `:::engineer` wrap markdown shown
 * at one reading depth. Their children compile as top-level blocks tagged
 * with the depth; no wrapper node is kept.
 */
const DEPTH_NAMES = ['new', 'engineer'] as const satisfies readonly LessonDepth[]

/**
 * Blocks that stay shared by both depths: the graded and stateful ones, so
 * progress never depends on the depth a learner reads at.
 */
const SHARED_ONLY: ReadonlySet<string> = new Set(['prompt', 'ask', 'quiz', 'rabbithole'])

const isDepth = (name: string): name is LessonDepth => (DEPTH_NAMES as readonly string[]).includes(name)

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
  /** The depth block being read, if any. */
  let depth: LessonDepth | undefined

  let push = (block: Block) => {
    if (depth) block.depth = depth
    blocks.push(block)
  }
  /** The line of the `###` that ends the open turn, if one does. */
  let headingAt: number | undefined
  let addProse = (part: Prose) => {
    ;(turn ??= { type: 'markdown', paragraphs: [] }).paragraphs.push(part)
    headingAt = undefined
  }
  let closeTurn = () => {
    if (headingAt !== undefined) report.warning('this ### subheading has nothing under it: put its text before the next block', headingAt)
    headingAt = undefined
    if (turn && turn.paragraphs.length) push(turn)
    else if (turn?.ask) push(turn)
    turn = undefined
  }
  let claimId = (id: string, line: number) => {
    let seen = ids.get(id)
    if (seen) report.error(`id "${id}" is already used on line ${seen}`, line)
    else ids.set(id, line)
  }
  // Code and its Run output join only within one depth (or both shared).
  let previousCode = () => {
    let previous = blocks[blocks.length - 1]
    return previous?.type === 'code' && !previous.run && previous.depth === depth ? previous : undefined
  }

  let visitDepth = (node: ContainerDirective, line: number) => {
    let name = node.name as LessonDepth
    if (depth) {
      report.error(`:::${name} can’t go inside :::${depth}: depth blocks don’t nest, so close :::${depth} first`, line)
      return
    }
    attributes(node, [], report)
    let end = node.position?.end.line ?? line
    let closing = lines[end - 1]?.trim() ?? ''
    let last = node.children[node.children.length - 1]
    if (last?.type === 'containerDirective' && last.position?.end.line === end) {
      // `:::new` … `:::nexttoken` … `:::` … `:::`: the toy's closing line
      // closed both, and the rest of the depth block leaked out as shared.
      report.error(`:::${name} holds :::${last.name}, so it needs a longer fence: write ::::${name} … :::: around it`, line)
    } else if (end === line || !/^:{3,}$/.test(closing)) {
      report.error(`:::${name} is never closed: add a ::: line after it`, line)
    }
    if (!node.children.length) report.warning(`:::${name} is empty`, line)
    closeTurn()
    depth = name
    for (let child of node.children) visit(child)
    closeTurn()
    depth = undefined
  }

  let visit = (node: RootContent) => {
    let line = node.position?.start.line ?? 1
    switch (node.type) {
      case 'paragraph': {
        let paragraph = inline(node.children, report, line)
        if (paragraph.length) addProse(paragraph)
        break
      }
      // Lists, ``` samples and ### subheadings (decision 061) are parts of a
      // tutor turn, like paragraphs; a subheading starts a new turn.
      case 'list': {
        let list = proseList(node, report, false)
        if (list) addProse(list)
        break
      }
      case 'code': {
        let sample = proseFence(node, lines, report, depth)
        if (sample) addProse(sample)
        break
      }
      case 'heading': {
        if (node.depth !== 3) {
          report.error(
            `${'#'.repeat(node.depth)} headings aren’t supported in lessons (the lesson title is the page’s heading): use ### for a subheading`,
            line,
          )
          break
        }
        let heading = inline(node.children, report, line)
        if (!heading.length) {
          report.error('### needs its text, like: ### Why it works', line)
          break
        }
        // An ::ask line keeps its turn: the subheading opens the answer.
        if (turn?.paragraphs.length) closeTurn()
        addProse({ heading })
        headingAt = line
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
        if (node.type === 'containerDirective' && isDepth(node.name)) {
          visitDepth(node, line)
          break
        }
        if (!(BLOCK_NAMES as readonly string[]).includes(node.name)) {
          let known = [...BLOCK_NAMES, ...DEPTH_NAMES].map((n) => `:::${n}`).join(', ')
          report.error(`unknown block ${fence(node)}${node.name} (blocks: ${known}, ::ask)`, line)
          break
        }
        if (depth && SHARED_ONLY.has(node.name)) {
          report.error(
            `:::${node.name} can’t go inside :::${depth}: prompts, quick checks and rabbit holes are shared by both depths, so progress never depends on depth; move it outside`,
            line,
          )
          break
        }
        closeTurn()
        let block = compileDirective(node, lines, report, stats, defaults)
        if (!block) break
        if ('id' in block) claimId(block.id, line)
        if (block.type === 'code') {
          for (let file of block.files) codeFiles.add(file.file)
          // Adjacent :::code blocks become one editor with tabs.
          let previous = previousCode()
          if (previous) {
            previous.files.push(...block.files)
            break
          }
        }
        if (block.type === 'terminal') {
          // A :::terminal right after a code group is its Run output panel.
          let previous = previousCode()
          if (previous) {
            previous.run = { cmd: block.cmd, lines: block.lines }
            if (block.ask) previous.run.ask = block.ask
            if (block.summary) previous.run.summary = block.summary
            break
          }
        }
        push(block)
        break
      }
      case 'yaml':
        report.error('only one frontmatter block is allowed, at the top', line)
        break
      case 'html':
        report.error('raw HTML isn’t allowed in lessons', line)
        break
      default:
        report.error(`${describe(node.type)} isn’t supported in lessons`, line)
    }
  }

  for (let node of nodes) visit(node)
  closeTurn()

  for (let pointer of pointers) {
    if (!codeFiles.has(pointer.file)) report.warning(`points-at="${pointer.file}" matches no :::code file`, pointer.line)
  }
  if (!blocks.length) report.error('the lesson has no content')
  let present = depthsOf(blocks)
  if (present.length === 1) {
    let other: LessonDepth = present[0] === 'new' ? 'engineer' : 'new'
    report.warning(`the lesson has :::${present[0]} but no :::${other}, so the ${other} depth shows only the shared text`)
  }
  return blocks
}

function fence(node: Directive) {
  return node.type === 'containerDirective' ? ':::' : '::'
}

// ---- Lists and code samples in prose (decision 061) ---------------------------

/**
 * A `-` / `*` / `1.` list: items hold inline text (several paragraphs when
 * the list is loose) and at most one nested list, one level deep.
 */
function proseList(node: List, report: FileReport, nested: boolean): ProseList | undefined {
  let line = node.position?.start.line ?? 1
  let items: ProseListItem[] = []
  for (let item of node.children) {
    let at = item.position?.start.line ?? line
    if (item.checked !== null && item.checked !== undefined) {
      report.error('- [ ] task items are :::quiz options; in lesson text, write a plain - item', at)
      continue
    }
    let entry: ProseListItem = { paragraphs: [] }
    for (let child of item.children) {
      let childAt = child.position?.start.line ?? at
      if (child.type === 'paragraph') {
        let paragraph = inline(child.children, report, childAt)
        if (paragraph.length) entry.paragraphs.push(paragraph)
      } else if (child.type === 'list') {
        if (nested) report.error('lists nest one level deep: move this item up a level, or make it its own list', childAt)
        else if (entry.list) report.error('a list item holds one nested list: keep one marker (-) for all of its items', childAt)
        else entry.list = proseList(child, report, true)
      } else {
        let what = child.type === 'code' ? 'a ``` code sample' : child.type === 'heading' ? 'a heading' : describe(child.type)
        report.error(`${what} can’t go inside a list item (items hold text and one nested list): put it after the list`, childAt)
      }
    }
    if (!entry.paragraphs.length) {
      report.error(entry.list ? 'a list item needs its own text before a nested list' : 'this list item is empty', at)
      continue
    }
    if (!entry.list) delete entry.list
    items.push(entry)
  }
  if (!items.length) return undefined
  let list: ProseList = { list: node.ordered ? 'ordered' : 'bullet', items }
  if (node.ordered && typeof node.start === 'number' && node.start !== 1) list.start = node.start
  return list
}

/** Longer than this, a sample is better as a `:::code` editor. */
const MAX_SAMPLE_LINES = 40

/**
 * A bare ``` fence: a static, highlighted sample. An indented code block
 * (four spaces) is still an error, since it is nearly always an accident.
 */
function proseFence(node: Code, lines: string[], report: FileReport, depth?: LessonDepth): ProseFence | undefined {
  let line = node.position?.start.line ?? 1
  let end = node.position?.end.line ?? line
  let open = /^\s*(`{3,}|~{3,})/.exec(lines[line - 1] ?? '')
  if (!open) {
    report.error('indented code isn’t supported in lessons: put the code between ``` lines', line)
    return undefined
  }
  let marker = open[1]!
  let closing = (lines[end - 1] ?? '').trim()
  if (end === line || !(closing.startsWith(marker) && /^(`+|~+)$/.test(closing) && closing[0] === marker[0])) {
    // remark runs an unclosed fence to the end of its container, so a depth
    // block's ::: (or the rest of the file) would end up inside the sample.
    if (depth && /^:{3,}$/.test(closing)) {
      report.error(
        `this ${marker} code sample has a ${closing} line in it, which closes :::${depth}: write ::::${depth} … :::: around the depth block`,
        line,
      )
    } else {
      report.error(`this ${marker} code sample is never closed: add a ${marker} line after the code`, line)
    }
    return undefined
  }
  if (node.meta) report.warning(`a code sample takes only a language after the fence: “${node.meta}” is ignored`, line)
  let lang = node.lang ?? 'text'
  if (node.lang && !isKnownLanguage(lang)) report.warning(`\`\`\`${lang} isn’t highlighted (known: ts, js, py, sh, json, env)`, line)
  let source = node.value.replace(/\s+$/, '')
  if (!source.trim()) {
    report.error('this code sample is empty', line)
    return undefined
  }
  let count = source.split('\n').length
  if (count > MAX_SAMPLE_LINES) report.warning(`this code sample is ${count} lines; over ${MAX_SAMPLE_LINES}, a :::code editor reads better`, line)
  return { sample: highlight(source, lang), lang, language: languageOf(lang).name }
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
    case 'ask':
      return compileAsk(node, body, report, stats)
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
    case 'steps':
      return compileSteps(node, body, report, defaults)
    case 'flow':
      return compileFlow(node, body, report, defaults)
    case 'marbles':
      return compileMarbles(node, body, report, defaults)
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
  // A block inside a raw body means this one was never closed: its `:::`
  // went missing and the next block's closing line ended both.
  let nested = node.children.find(
    (child): child is Directive =>
      (child.type === 'containerDirective' || child.type === 'leafDirective') &&
      ((BLOCK_NAMES as readonly string[]).includes(child.name) || child.name === 'ask' || isDepth(child.name)),
  )
  if (nested) {
    let at = nested.position?.start.line ?? start
    report.error(`:::${node.name} is never closed: add a ::: line before ${fence(nested)}${nested.name} on line ${at}`, start)
    return { lines: lines.slice(start, at - 1), first: start + 1 }
  }
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
// draft, placeholder and example strings take \n for a line break, like the
// toys' strings (decisions 018, 021); labels and messages stay one line.

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
        examples.push({ temperature, text: unescapeText(match[2]!) })
        return
      }
      case 'draft':
      case 'placeholder': {
        let match = new RegExp(`^${QUOTED}$`).exec(rest)
        if (!match) {
          report.error(`${keyword} lines look like: - ${keyword} "Write a tagline for…"`, at)
          return
        }
        if (keyword === 'draft') draft = unescapeText(match[1]!)
        else placeholder = unescapeText(match[1]!)
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
      // The editor footer already says "lines X–Y"; the label is what they are.
      let label = attrs.string('label')
      codeFile.highlight = label ? { from, to, label } : { from, to }
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

// A `:::quiz` compiles to an ask with only choices (decision 052): the
// learner types an answer, or taps an option chip to fill it in, and a typed
// letter or option text counts as picking that option.
function compileQuiz(node: Directive, report: FileReport): AskBlock | undefined {
  let line = node.position?.start.line ?? 1
  let attrs = attributes(node, ['id', 'xp', 'multiple', 'gate'], report)
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
  if (options.length > MAX_CHOICES) report.error(`:::quiz has ${options.length} options: ${MAX_CHOICES} at most`, line)
  if (!id) return undefined
  let block: QuizBlock = { type: 'quiz', id, xp: blockXp(attrs.number('xp', 10)!, report, line), question, options }
  if (multiple) block.multiple = true
  let ask = quizAsAsk(block)
  ask.gate = attrs.flag('gate', true)
  return ask
}

// ---- :::ask ------------------------------------------------------------------

const MAX_CHOICES = 10

/**
 * `:::ask{id xp gate multiple}`: the question as paragraphs, then item
 * lines read from the raw source (so regexes stay as written):
 * placeholder, accept, reject, hint, choice and explain.
 */
function compileAsk(node: Directive, body: RawBody, report: FileReport, stats: CompiledLesson['stats']): AskBlock | undefined {
  let line = node.position?.start.line ?? 1
  let attrs = attributes(node, ['id', 'xp', 'gate', 'multiple'], report)
  let id = attrs.string('id')
  if (!id) report.error(':::ask needs an id, like :::ask{id="strawberry" xp=20}', line)
  else if (!/^[a-z0-9][a-z0-9-]*$/.test(id)) report.error(`id "${id}" should be lowercase letters, digits and dashes`, line)
  let multiple = attrs.flag('multiple')

  let question: Paragraph = []
  if (node.type === 'containerDirective') {
    let listSeen = false
    for (let child of node.children) {
      let at = child.position?.start.line ?? line
      if (child.type === 'list') listSeen = true
      else if (child.type === 'paragraph' && !listSeen) {
        if (question.length) question.push(' ')
        question.push(...inline(child.children, report, at))
      } else if (child.type === 'paragraph') {
        report.error('the question goes first, before the - lines', at)
      }
    }
  }

  let accept: AskBlock['accept'] = []
  let reject: AskBlock['reject'] = []
  let choices: AskBlock['choices'] = []
  let placeholder: string | undefined
  let hint: string | undefined
  let explain: string | undefined
  let quoted = (rest: string) => new RegExp(`^${QUOTED}$`).exec(rest)?.[1]

  body.lines.forEach((raw, i) => {
    let at = body.first + i
    let item = /^[-*]\s+(\w+)\b\s*(.*)$/.exec(raw.trim())
    if (!item) return // question text (read above) or a blank line
    let [, keyword, rest = ''] = item
    switch (keyword) {
      case 'accept':
      case 'reject': {
        let match =
          keyword === 'accept'
            ? new RegExp(`^${QUOTED}\\s+\\/(.*)\\/([a-z]*)$`).exec(rest)
            : new RegExp(`^${QUOTED}\\s+\\/(.*?)\\/([a-z]*)\\s+${QUOTED}$`).exec(rest)
        if (!match) {
          report.error(
            keyword === 'accept'
              ? 'accept lines look like: - accept "Mentions tokens" /token|chunk/i'
              : 'reject lines look like: - reject "Not about memory" /never seen/i "It has seen it often. What does it get instead?"',
            at,
          )
          return
        }
        let [, label = '', source = '', flags = '', feedback = ''] = match
        stats.patterns++
        let problem = checkPattern(source, flags)
        if (problem) {
          report.error(`${keyword} “${unquote(label)}”: /${source}/ ${problem}`, at)
          return
        }
        let pattern = flags ? { source, flags } : { source }
        if (keyword === 'accept') {
          let existing = accept.find((check) => check.label === unquote(label))
          if (existing) existing.patterns.push(pattern)
          else accept.push({ label: unquote(label), patterns: [pattern] })
        } else {
          let existing = reject.find((check) => check.label === unquote(label))
          if (existing) existing.patterns.push(pattern)
          else reject.push({ label: unquote(label), patterns: [pattern], feedback: unquote(feedback) })
        }
        return
      }
      case 'choice': {
        let match = new RegExp(`^${QUOTED}(\\s+correct)?(?:\\s+${QUOTED})?$`).exec(rest)
        if (!match || !unquote(match[1]!).trim()) {
          report.error('choice lines look like: - choice "It sees chunks, not letters" correct "Why it’s right (optional)"', at)
          return
        }
        let label = unquote(match[1]!).trim()
        if (choices.some((choice) => choice.label === label)) report.error(`choice “${label}” is listed twice`, at)
        choices.push({
          key: String.fromCharCode(97 + choices.length),
          label,
          correct: Boolean(match[2]),
          explanation: match[3] ? unquote(match[3]) : '',
        })
        return
      }
      case 'placeholder':
      case 'hint':
      case 'explain': {
        let text = quoted(rest)
        if (text === undefined) {
          report.error(`${keyword} lines look like: - ${keyword} "…"`, at)
          return
        }
        if (keyword === 'placeholder') placeholder = unquote(text)
        else if (keyword === 'hint') hint = unquote(text)
        else explain = unquote(text)
        return
      }
      default:
        report.error(`unknown ask line "- ${keyword}" (use accept, reject, choice, hint, explain or placeholder)`, at)
    }
  })

  if (!question.length) report.error(':::ask needs the question before its - lines', line)
  let correct = choices.filter((choice) => choice.correct).length
  if (!accept.length && !correct) report.error(':::ask needs an accept line or a correct choice', line)
  if (choices.length === 1 && !accept.length) report.error(':::ask needs at least two choices (or an accept line)', line)
  if (choices.length > MAX_CHOICES) report.error(`:::ask has ${choices.length} choices: ${MAX_CHOICES} at most`, line)
  if (correct > 1 && !multiple) report.error(`:::ask has ${correct} right choices: add multiple to allow several`, line)
  if (multiple && accept.length) report.error(':::ask multiple grades choices only: drop the accept lines or multiple', line)
  if (!id) return undefined
  let block: AskBlock = {
    type: 'ask',
    id,
    xp: blockXp(attrs.number('xp', 10)!, report, line),
    gate: attrs.flag('gate', true),
    question,
    accept,
    reject,
    choices,
  }
  if (multiple) block.multiple = true
  if (placeholder) block.placeholder = placeholder
  if (hint) block.hint = hint
  if (explain) block.explain = explain
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

// ---- Animation blocks: :::steps, :::flow, :::marbles (decision 060). Plain
// lines like the toys; the islands play them one move at a time.

export const STEPS_RANGE = [3, 8] as const
const MAX_STEP_LABEL = 24

function compileSteps(node: Directive, raw: RawBody, report: FileReport, defaults: BlockDefaults): StepsBlock | undefined {
  let line = node.position?.start.line ?? 1
  let attrs = attributes(node, ['title', 'loop', 'illustrative'], report)
  let steps: StepsBlock['steps'] = []
  let shape = new RegExp(`^[-*]\\s+${QUOTED}\\s+${QUOTED}$`)
  for (let { text, at } of bodyItems(raw)) {
    let match = shape.exec(text)
    if (!match) {
      report.error('steps lines are a label, then a caption: - "Read" "Everything so far, your prompt included."', at)
      continue
    }
    let label = unescapeText(match[1]!).trim()
    let caption = unescapeText(match[2]!).trim()
    if (!label) report.error('a step needs a label', at)
    else if (label.length > MAX_STEP_LABEL) report.error(`step label “${label}” is ${label.length} characters; keep it to ${MAX_STEP_LABEL}`, at)
    if (!caption) report.error(`step “${label}” needs a caption`, at)
    if (steps.some((step) => step.label === label)) report.error(`step “${label}” is listed twice`, at)
    steps.push({ label, caption })
  }
  let [min, max] = STEPS_RANGE
  if (steps.length < min) report.error(`:::steps needs ${min} to ${max} - "label" "caption" lines (got ${steps.length})`, line)
  if (steps.length > max) report.error(`:::steps has ${steps.length} steps; keep it to ${max}, or split the sequence`, line)
  if (steps.length < min) return undefined
  let block: StepsBlock = { type: 'steps', steps: steps.slice(0, max) }
  let title = attrs.string('title')
  if (title) block.title = title
  if (attrs.flag('loop')) block.loop = true
  if (illustrativeOf(attrs, defaults)) block.illustrative = true
  return block
}

export const FLOW_CAPACITY_RANGE = [2, 32] as const
export const FLOW_ITEMS_RANGE = [2, 16] as const

function compileFlow(node: Directive, raw: RawBody, report: FileReport, defaults: BlockDefaults): FlowBlock | undefined {
  let line = node.position?.start.line ?? 1
  let attrs = attributes(node, ['capacity', 'unit', 'title', 'illustrative'], report)
  let [minCap, maxCap] = FLOW_CAPACITY_RANGE
  let capacity = attrs.number('capacity')
  if (capacity === undefined) report.error(`:::flow needs a capacity, like :::flow{capacity=12} (${minCap}–${maxCap} ${attrs.string('unit') ?? 'tokens'})`, line)
  else if (!Number.isInteger(capacity) || capacity < minCap || capacity > maxCap) {
    report.error(`capacity=${capacity} is out of range: use a whole number from ${minCap} to ${maxCap}`, line)
    capacity = undefined
  }
  let items: FlowBlock['items'] = []
  let shape = new RegExp(`^[-*]\\s+${QUOTED}\\s+(\\d+)$`)
  for (let { text, at } of bodyItems(raw)) {
    let match = shape.exec(text)
    if (!match) {
      report.error('flow lines are a name, then its size: - "system prompt" 3', at)
      continue
    }
    let name = unescapeText(match[1]!).trim()
    let size = Number(match[2])
    if (!name) report.error('a flow item needs a name', at)
    if (size < 1) report.error(`“${name}” has size 0; every item takes at least 1`, at)
    else if (capacity !== undefined && size > capacity) report.error(`“${name}” is ${size}, bigger than the window (capacity=${capacity}): it could never fit`, at)
    items.push({ name, size })
  }
  let [minItems, maxItems] = FLOW_ITEMS_RANGE
  if (items.length < minItems) report.error(`:::flow needs ${minItems} to ${maxItems} - "name" size lines (got ${items.length})`, line)
  if (items.length > maxItems) report.error(`:::flow has ${items.length} items; keep it to ${maxItems}`, line)
  if (capacity !== undefined && items.reduce((sum, item) => sum + item.size, 0) <= capacity) {
    report.warning(`every item fits in the window at once (${capacity}); nothing ever falls out, so :::flow shows no flow`, line)
  }
  if (capacity === undefined || items.length < minItems) return undefined
  let block: FlowBlock = { type: 'flow', capacity, unit: attrs.string('unit') ?? 'tokens', items: items.slice(0, maxItems) }
  let title = attrs.string('title')
  if (title) block.title = title
  if (illustrativeOf(attrs, defaults)) block.illustrative = true
  return block
}

export const MARBLES_LANES_RANGE = [1, 5] as const
export const MAX_MARBLE_EVENTS = 12
const MAX_MARBLES_DURATION = 3600

function compileMarbles(node: Directive, raw: RawBody, report: FileReport, defaults: BlockDefaults): MarblesBlock | undefined {
  let line = node.position?.start.line ?? 1
  let attrs = attributes(node, ['duration', 'unit', 'title', 'illustrative'], report)
  let duration = attrs.number('duration')
  if (duration !== undefined && !(duration > 0 && duration <= MAX_MARBLES_DURATION)) {
    report.error(`duration=${duration} is out of range: use a number above 0 and up to ${MAX_MARBLES_DURATION}`, line)
    duration = undefined
  }
  let lanes: MarblesBlock['lanes'] = []
  let head = new RegExp(`^[-*]\\s+${QUOTED}\\s+(.*)$`)
  let event = new RegExp(`\\s*${NUMBER}\\s+${QUOTED}`, 'y')
  let example = 'marbles lines are a lane, then time and event pairs: - "Claude" 1.2 "tool call" 6.5 "answer"'
  let latest = 0
  for (let { text, at } of bodyItems(raw)) {
    let match = head.exec(text)
    if (!match) {
      report.error(example, at)
      continue
    }
    let name = unescapeText(match[1]!).trim()
    let rest = match[2]!.trimEnd()
    let events: MarblesBlock['lanes'][number]['events'] = []
    // A failed sticky exec resets lastIndex, so keep the consumed length here.
    let consumed = 0
    while (consumed < rest.length) {
      event.lastIndex = consumed
      let pair = event.exec(rest)
      if (!pair) break
      consumed = event.lastIndex
      events.push({ at: Number(pair[1]), label: unescapeText(pair[2]!).trim() })
    }
    if (consumed < rest.length) {
      report.error(`couldn’t read “${rest.slice(consumed).trim()}”: ${example}`, at)
      continue
    }
    if (!name) report.error('a marbles lane needs a name', at)
    if (!events.length) report.error(`lane “${name}” needs at least one time "event" pair`, at)
    if (events.length > MAX_MARBLE_EVENTS) report.error(`lane “${name}” has ${events.length} events; keep it to ${MAX_MARBLE_EVENTS}`, at)
    let bad = events.find((e) => !(e.at >= 0))
    if (bad) report.error(`time ${bad.at} is negative`, at)
    let out = events.find((e, i) => i > 0 && e.at < events[i - 1]!.at)
    if (out) report.error(`lane “${name}”: events must be in time order (${out.at} comes after ${events[events.indexOf(out) - 1]!.at})`, at)
    if (events.some((e) => !e.label)) report.error(`lane “${name}” has an event with no label`, at)
    if (lanes.some((lane) => lane.name === name)) report.error(`lane “${name}” is listed twice`, at)
    for (let e of events) latest = Math.max(latest, e.at)
    lanes.push({ name, events })
  }
  let [minLanes, maxLanes] = MARBLES_LANES_RANGE
  if (lanes.length < minLanes) report.error(`:::marbles needs at least one - "lane" time "event" line`, line)
  if (lanes.length > maxLanes) report.error(`:::marbles has ${lanes.length} lanes; keep it to ${maxLanes}`, line)
  if (duration !== undefined && latest > duration) report.error(`an event is at ${latest}, past duration=${duration}`, line)
  if (lanes.length < minLanes) return undefined
  let block: MarblesBlock = {
    type: 'marbles',
    duration: duration ?? Math.max(1, Math.ceil(latest)),
    unit: attrs.string('unit') ?? 's',
    lanes: lanes.slice(0, maxLanes),
  }
  let title = attrs.string('title')
  if (title) block.title = title
  if (illustrativeOf(attrs, defaults)) block.illustrative = true
  return block
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
      case 'link': {
        let text = plainText(node.children).replace(/\s*\n\s*/g, ' ').trim()
        let problem = linkProblem(node.url)
        if (problem) report.error(`link “${text || node.url}” ${problem}`, at)
        else if (!text) report.error(`link to ${node.url} has no text: write [text](${node.url})`, at)
        else out.push({ link: text, href: node.url })
        if (problem && text) pushText(text)
        break
      }
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

/**
 * Why a prose link's URL isn't allowed, or undefined when it is: a path on
 * this site (`/courses/…`) or an https URL. Not `//host` or `/\\host` (both
 * leave the origin), and no other scheme (javascript:, data:, http:, mailto:).
 */
export function linkProblem(url: string): string | undefined {
  if (/[\s\\]/.test(url) || /[\u0000-\u001f\u007f]/.test(url)) return `has a URL with spaces, control characters or a backslash`
  if (url.startsWith('/')) {
    return url.startsWith('//') ? `points at “${url}”, which leaves the site: write https://… for other sites` : undefined
  }
  if (isHttpsUrl(url)) return undefined
  return `points at “${url}”: links must be a path on this site (/courses/…) or an https:// URL`
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
