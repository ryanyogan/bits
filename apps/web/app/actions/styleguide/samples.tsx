import { css } from 'remix/component'
import type { CodeFile, CodeSegment } from '@bits/ui/code-editor'
import type { AttentionLink } from '@bits/ui/attention-map'
import type { FlowItem } from '@bits/ui/flow'
import type { MarbleLane } from '@bits/ui/marbles'
import type { NextTokenStep } from '@bits/ui/next-token'
import type { RabbitHoleLink } from '@bits/ui/rabbit-hole'
import type { Step } from '@bits/ui/steps'
import type { TerminalEntry, TerminalPart } from '@bits/ui/terminal'
import type { TrainingSnapshot } from '@bits/ui/training-scrubber'

// `hex` is the dark value (tokens.css), `light` the paper one (theme-light.css, decision 062).
export const swatches = [
  { name: 'Ink', token: '--ink', hex: '#0F131A', light: '#F5F6F8', use: 'Page ground. Never pure black, never pure white.' },
  { name: 'Surface', token: '--surface', hex: '#171C26', light: '#ECEEF2', use: 'Cards, panels, inputs.' },
  { name: 'Raised', token: '--raised', hex: '#1F2531', light: '#E4E7EC', use: 'Dark keycaps, selected tabs.' },
  { name: 'Text', token: '--text', hex: '#E3E6ED', light: '#141A24', use: 'Headlines and primary copy.' },
  { name: 'Muted', token: '--muted', hex: '#949BAE', light: '#586274', use: 'Body secondary, descriptions.' },
  { name: 'Dim', token: '--dim', hex: '#838A9F', light: '#5F697B', use: 'Hints and meta. Darkest allowed grey (5.4:1 / 5.1:1).' },
  { name: 'Volt', token: '--volt', hex: '#A7CF66', light: '#426E19', use: 'Primary action, your turn, success. Text on it is On volt.' },
  { name: 'Volt edge', token: '--volt-edge', hex: '#66833A', light: '#28400E', use: 'The underline inside a Volt key.' },
  { name: 'Ion', token: '--ion', hex: '#66C4D5', light: '#086678', use: 'Model output, in-progress, video.' },
  { name: 'Synapse', token: '--synapse', hex: '#9D93DE', light: '#5A4EC0', use: '3D field and Tools track only.' },
]

export const extendedSwatches = [
  { name: 'Well', token: '--well', hex: '#12161F', light: '#EFF1F4', use: 'Inputs, composer, editor body, cover base.' },
  { name: 'Terminal', token: '--terminal', hex: '#11151D', light: '#F0F2F5', use: 'Terminal lesson and output panels.' },
  { name: 'Selected', token: '--selected', hex: '#272E3D', light: '#DBDFE6', use: 'Selected tab; disabled keycap face.' },
  { name: 'Bubble', token: '--bubble', hex: '#242B39', light: '#E0E4EA', use: 'Learner bubble.' },
  { name: 'Text body', token: '--text-body', hex: '#CDD1DB', light: '#2A3240', use: 'Lesson body copy, labels.' },
  { name: 'Text quiet', token: '--text-quiet', hex: '#BEC3CF', light: '#3A4352', use: 'Mono values, unselected filters.' },
  { name: 'Text lead', token: '--text-lead', hex: '#ACB2C2', light: '#4A5365', use: 'Lead paragraphs, marketing nav, chips.' },
  { name: 'On volt', token: '--on-volt', hex: '#0C1008', light: '#F5F8EE', use: 'Text and icons on volt fills.' },
  { name: 'Volt hover', token: '--volt-hover', hex: '#B5D97C', light: '#41691A', use: 'Primary keycap hover face.' },
  { name: 'Volt soft', token: '--volt-soft', hex: '#D0E6AC', light: '#375A15', use: 'Text on volt tints.' },
  { name: 'Ion edge', token: '--ion-edge', hex: '#2F8292', light: '#084F5B', use: 'Edge under the “Copied ✓” key.' },
  { name: 'Synapse soft', token: '--synapse-soft', hex: '#B3ABE6', light: '#4E43AE', use: 'Syntax keywords.' },
  { name: 'Warn', token: '--warn', hex: '#F5CF95', light: '#85570A', use: 'Warnings, wrong quiz answer.' },
  { name: 'Danger', token: '--danger', hex: '#F58477', light: '#B3302A', use: 'Errors, delete (provisional, resolutions §1).' },
  { name: 'Key dark edge', token: '--key-dark-edge', hex: '#090C11', light: '#C6CCD6', use: 'Edge under dark keycaps.' },
]

const display = css({
  fontFamily: 'var(--font-display)',
  fontWeight: 800,
  fontSize: 'clamp(46px, 8.4vw, 88px)',
  lineHeight: 0.95,
  letterSpacing: 'var(--tracking-display)',
})
const h2 = css({
  fontFamily: 'var(--font-display)',
  fontWeight: 700,
  fontSize: 'clamp(30px, 6vw, 52px)',
  lineHeight: 1.02,
  letterSpacing: '-0.035em',
})
const h3 = css({ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 'var(--fs-22)', letterSpacing: 'var(--tracking-title)' })
const body = css({ maxWidth: '68ch', fontSize: 'var(--fs-17)', lineHeight: 1.7, color: 'var(--text-body)' })
const mono = css({ fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-15)', lineHeight: 1.75 })
const volt = css({ color: 'var(--volt)' })
const eyebrow = css({
  fontFamily: 'var(--font-mono)',
  fontSize: 'var(--fs-13)',
  letterSpacing: 'var(--tracking-eyebrow)',
  textTransform: 'uppercase',
  color: 'var(--ion)',
})

export const typeRows = [
  { label: 'display-xl · Unbounded 800 · clamp(46–124) · −0.045em', sample: <span mix={display}>Learn AI</span> },
  { label: 'h2 · Unbounded 700 · 64 / 1.02 · −0.035em', sample: <span mix={h2}>Every lesson is a conversation.</span> },
  { label: 'h3 / card title · Unbounded 500 · 22 / 1.15 · −0.02em', sample: <span mix={h3}>Give your model tools</span> },
  {
    label: 'body / lesson · Geist 400 · 17 / 1.7 · max 68ch',
    sample: (
      <p mix={[body, css({ margin: 0 })]}>
        A model never sees your sentence. It sees a list of numbers, one per token, and guesses which number should come
        next — then does it again.
      </p>
    ),
  },
  {
    label: 'mono / input + code · Geist Mono 400 · 15 / 1.75',
    sample: (
      <span mix={mono}>
        <span mix={volt}>›</span> You are a pirate. Answer in exactly 3 bullet points.
      </span>
    ),
  },
  { label: 'eyebrow · Geist Mono 500 · 12–13 · +0.14em · caps', sample: <span mix={eyebrow}>02 — How it works</span> },
]

// ---- Code editor sample (agent.ts) ---------------------------------------

const k = (t: string): CodeSegment => ['keyword', t]
const s = (t: string): CodeSegment => ['string', t]
const ty = (t: string): CodeSegment => ['type', t]
const f = (t: string): CodeSegment => ['function', t]
const p = (t: string): CodeSegment => ['punct', t]
const c = (t: string): CodeSegment => ['comment', t]
const n = (t: string): CodeSegment => ['number', t]

export const agentFile: CodeFile = {
  name: 'agent.ts',
  badge: 'TS',
  badgeTone: 'ion',
  language: 'TypeScript',
  lines: [
    [k('import'), p(' Anthropic '), k('from'), p(' '), s('"@anthropic-ai/sdk"'), p(';')],
    [k('import'), p(' { '), f('getWeather'), p(' } '), k('from'), p(' '), s('"./tools"'), p(';')],
    [],
    [k('const'), p(' client = '), k('new'), p(' '), ty('Anthropic'), p('();')],
    [c('// The loop: ask, run tools, feed results back, repeat.')],
    [k('export async function'), p(' '), f('run'), p('(prompt: '), ty('string'), p(') {')],
    [p('  '), k('const'), p(' messages = [{ role: '), s('"user"'), p(', content: prompt }];')],
    [p('  '), k('for'), p(' ('), k('let'), p(' turn = '), n('0'), p('; turn < '), n('5'), p('; turn++) {')],
    [p('    '), k('const'), p(' res = '), k('await'), p(' client.messages.'), f('create'), p('({ messages });')],
    [p('    '), k('if'), p(' (res.stop_reason !== '), s('"tool_use"'), p(') '), k('return'), p(' res;')],
    [p('    '), k('const'), p(' result = '), k('await'), p(' '), f('getWeather'), p('(res);')],
    [p('    messages.'), f('push'), p('({ role: '), s('"user"'), p(', content: result });')],
    [p('  }')],
    [p('}')],
  ],
}

export const toolsFile: CodeFile = {
  name: 'tools.ts',
  badge: 'TS',
  badgeTone: 'ion',
  language: 'TypeScript',
  lines: [
    [k('export async function'), p(' '), f('getWeather'), p('(res: '), ty('unknown'), p(') {')],
    [p('  '), k('return'), p(' { type: '), s('"tool_result"'), p(', temp: '), n('21'), p(' };')],
    [p('}')],
  ],
}

export const readmeFile: CodeFile = {
  name: 'README.md',
  badge: '#',
  badgeTone: 'muted',
  language: 'Markdown',
  lines: [[p('# First agent loop')], [], [p('Run '), s('npx tsx agent.ts "Weather in Chicago?"'), p('.')]],
}

// ---- Terminal sample -----------------------------------------------------

const out = (...parts: TerminalPart[]) => parts

export const terminalEntries: TerminalEntry[] = [
  { kind: 'learner', text: 'why does the loop stop?' },
  {
    kind: 'tutor',
    body: (
      <>
        It stops when the model answers with <code>"end_turn"</code> instead of <code>"tool_use"</code>. Look at{' '}
        <mark>line 10</mark>.
      </>
    ),
    pointer: (
      <>
        ↳ highlighted <strong>agent.ts</strong> lines 6–13
      </>
    ),
  },
  {
    kind: 'command',
    command: 'npx tsx agent.ts "Weather in Chicago?"',
    output: [
      out(['ion', '→ tool_use   '], ['quiet', 'get_weather({ city: "Chicago" })']),
      out(['volt', '← tool_result'], ['quiet', ' { temp: 21 }']),
      out(['ion', '→ end_turn   '], ['text', '“It’s 21° in Chicago.”']),
    ],
    summary: '✓ 2 turns · 1 tool call · 1.8s',
  },
  {
    // A quick check (decision 052), answered, so the input stays free for “hint”.
    kind: 'ask',
    ask: {
      id: 'sg-terminal-ask',
      label: 'What ends the loop?',
      choices: [
        { key: 'a', label: 'The model answers with "end_turn"' },
        { key: 'b', label: 'The tool returns nothing' },
      ],
      xp: 10,
      passed: true,
    },
  },
]

/** Options for the AskPanel specimens. */
export const sgAskChoices = [
  { key: 'a', label: '“ the”' },
  { key: 'b', label: '“Unbelievably”' },
  { key: 'c', label: '“fetched.”' },
]

export const outputLines: TerminalPart[][] = [
  [['ion', 'turn 1 '], ['quiet', 'stop_reason='], ['volt', '"tool_use"'], ['quiet', ' → get_weather']],
  [['ion', 'turn 2 '], ['quiet', 'stop_reason='], ['volt', '"end_turn"']],
  [['text', 'It’s 21° and clear in Chicago.']],
]

export const chapters = [
  { title: 'Ranked candidates', start: 0 },
  { title: 'Sharpening the odds', start: 54 },
  { title: 'Flattening them', start: 135 },
  { title: 'Picking a setting', start: 189 },
]

export const cues = [
  { start: 0, text: 'So the model has a ranked list of candidates for the next token…' },
  {
    start: 100,
    text: 'Temperature divides every score before they become probabilities. Divide by a small number and the gaps get huge.',
  },
  { start: 150, text: 'Divide by a big number and everything starts to look the same…' },
]

export const tokens: [string, string][] = [
  ['Un', '1844'],
  ['believ', '31141'],
  ['ably', '2915'],
  [',', '11'],
  [' the', '279'],
  [' cat', '8415'],
  [' fetched', '42118'],
  ['.', '13'],
]

export const oddsCandidates: [string, number][] = [
  [' Brew', 3.1],
  [' One', 2.4],
  [' Lunar', 1.9],
  [' Fly', 1.2],
  [' Zero', 0.6],
]

// Lesson toys (decision 021). Illustrative numbers, as the specimens say.
export const nextTokenSteps: NextTokenStep[] = [
  { token: ' Paris', p: 0.92, alternatives: [[' the', 0.03], [' a', 0.02], [' located', 0.01]] },
  { token: '.', p: 0.71, alternatives: [[',', 0.2], [' and', 0.05]] },
  { token: ' It', p: 0.38, alternatives: [[' The', 0.31], [' Paris', 0.12]] },
  { token: ' is', p: 0.55, alternatives: [["'s", 0.25], [' has', 0.1]] },
  { token: ' known', p: 0.3, alternatives: [[' also', 0.22], [' the', 0.2]] },
  { token: ' for', p: 0.86, alternatives: [[' as', 0.11]] },
  { token: ' its', p: 0.41, alternatives: [[' the', 0.37], [' art', 0.04]] },
  { token: ' café', p: 0.09, alternatives: [[' art', 0.28], [' food', 0.2], [' museums', 0.14]] },
  { token: 's', p: 0.97, alternatives: [[' culture', 0.01]] },
  { token: '.', p: 0.8, alternatives: [[' and', 0.15]] },
]

export const trainingSnapshots: TrainingSnapshot[] = [
  { step: 0, loss: 10.8, text: 'qz# lorp vv kk ~e' },
  { step: 200, loss: 7.9, text: 'e e the t th a' },
  { step: 1000, loss: 5.6, text: 'the the was a of of' },
  { step: 5000, loss: 3.4, text: 'time there was a a little' },
  { step: 20000, loss: 2.3, text: 'time, there was a little fox who' },
  { step: 100000, loss: 1.7, text: 'time, there lived a small fox who loved the snow.' },
]

export const attentionTokens = ['The', ' animal', " didn't", ' cross', ' the', ' street', ' because', ' it', ' was', ' tired']
export const attentionLinks: AttentionLink[] = [
  { from: 7, to: 1, weight: 0.62 },
  { from: 7, to: 5, weight: 0.18 },
  { from: 7, to: 7, weight: 0.1 },
  { from: 9, to: 1, weight: 0.45 },
  { from: 9, to: 7, weight: 0.35 },
  { from: 3, to: 1, weight: 0.5 },
  { from: 3, to: 0, weight: 0.2 },
  { from: 5, to: 4, weight: 0.55 },
  { from: 5, to: 3, weight: 0.3 },
]

// Animation blocks (decision 060).
export const loopSteps: Step[] = [
  { label: 'Read', caption: 'Everything so far, your prompt included.' },
  { label: 'Score', caption: 'One number for every token it knows, tens of thousands of them.' },
  { label: 'Odds', caption: 'The scores become odds that add up to 100%.' },
  { label: 'Draw', caption: 'One token is sampled from those odds.' },
  { label: 'Append', caption: 'It joins the text, and the loop starts again.' },
]

export const windowItems: FlowItem[] = [
  { name: 'system prompt', size: 3 },
  { name: 'Hi, I’m Sam.', size: 2 },
  { name: 'Hi Sam! What can I do for you?', size: 3 },
  { name: 'What’s my name?', size: 2 },
  { name: 'Sam.', size: 1 },
  { name: 'Tell me a joke about rain.', size: 3 },
  { name: 'Why did the cloud…', size: 4 },
]

export const agentLanes: MarbleLane[] = [
  { name: 'You', events: [{ at: 0, label: 'prompt' }] },
  { name: 'Claude', events: [{ at: 0.8, label: 'tool call' }, { at: 4.6, label: 'answer' }] },
  { name: 'Tool', events: [{ at: 1.2, label: 'running' }, { at: 3.9, label: 'result' }] },
]

export const rabbitHoleLinks: RabbitHoleLink[] = [
  { kind: 'video', title: 'But what is a GPT? Visual intro to transformers', by: '3Blue1Brown', mins: 27, url: 'https://www.youtube.com/watch?v=wjZofJX0v4M' },
  { kind: 'video', title: 'Intro to Large Language Models', by: 'Andrej Karpathy', mins: 60, url: 'https://www.youtube.com/watch?v=zjkBMFhNj_g', deep: true },
  { kind: 'read', title: 'Tracing the thoughts of a large language model', by: 'Anthropic', url: 'https://www.anthropic.com/research/tracing-thoughts-language-model' },
]
