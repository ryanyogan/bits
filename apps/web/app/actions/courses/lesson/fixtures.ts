// Page-local lesson content, in the compiled JSON shape of content.ts, until
// the content pipeline writes real lessons to R2. Three lessons are written
// out: Temperature (the Lesson artboard: Read + Watch), The loop (the
// CodeLesson artboard: Terminal + code editor) and What is a token? (the
// tokenizer toy and a quiz). Every other lesson gets a short stub.
import type { CodeSegment } from '@bits/ui/code-editor'
import type { TerminalPart } from '@bits/ui/terminal'

import type { CodeBlockFile, LessonContent } from './content.ts'

// ---- Tokens & temperature · 6. Temperature & randomness --------------------

const hotTaglines = [
  'One small sip for mankind.',
  'Espresso at escape velocity.',
  'Low gravity. High caffeine.',
  'Fly me to the foam.',
  'Lunar roast, zero atmosphere, full flavour.',
]

const temperature: LessonContent = {
  title: 'Temperature & randomness',
  order: 6,
  minutes: 7,
  xp: 40,
  video: {
    duration: 270,
    chapters: [
      { at: 0, title: 'A ranked list' },
      { at: 54, title: 'Sharpening the odds' },
      { at: 135, title: 'Flattening the odds' },
      { at: 189, title: 'Picking a temperature' },
    ],
    cues: [
      { start: 84, text: 'So the model has a ranked list of candidates for the next token…' },
      {
        start: 100,
        text: 'Temperature divides every score before they become probabilities. Divide by a small number and the gaps get huge.',
      },
      { start: 124, text: 'Divide by a big number and everything starts to look the same…' },
    ],
  },
  blocks: [
    {
      type: 'markdown',
      paragraphs: [
        [
          'Last lesson you saw that a model never picks “the” next word. It gives ',
          { strong: 'every possible token a probability' },
          ', then rolls a weighted die.',
        ],
        [
          { strong: 'Temperature' },
          ' reshapes those odds before the roll. Low temperature sharpens them — the favourite almost always wins. High temperature flattens them — long shots get a real chance. Drag it and watch.',
        ],
      ],
    },
    {
      type: 'odds',
      prompt: 'Moon café tagline:',
      blank: '“___',
      slider: 0.7,
      candidates: [
        [' Brew', 3.1],
        [' One', 2.4],
        [' Lunar', 1.9],
        [' Fly', 1.2],
        [' Zero', 0.6],
      ],
    },
    {
      type: 'markdown',
      paragraphs: [
        [
          'Your turn. Write a prompt that asks for a ',
          { strong: 'tagline for a coffee shop on the moon' },
          ' with a length limit. Run it once at ',
          { code: '0' },
          ', then a few times at ',
          { code: '1.0' },
          ', and compare.',
        ],
      ],
    },
    {
      type: 'prompt',
      id: 'moon-tagline',
      xp: 40,
      task: 'Write the prompt yourself — no pasting the answer',
      placeholder: 'Write a tagline for…',
      draft: 'Write a tagline for a coffee shop on the moon.',
      checks: [
        { label: 'Asks for a tagline', patterns: [{ source: 'tagline|slogan', flags: 'i' }] },
        {
          label: 'Coffee + moon',
          patterns: [
            { source: 'coffee|caf[eé]', flags: 'i' },
            { source: 'moon|lunar', flags: 'i' },
          ],
        },
        { label: 'Sets a length limit', patterns: [{ source: '\\bwords?\\b|\\bshort\\b|\\bunder\\b|\\bmax', flags: 'i' }] },
      ],
      run: { label: 'Ran at 0 and 1.0', temperatures: [0, 1] },
      temperatures: [0, 0.7, 1],
      examples: [
        { temperature: 0, text: 'Brewed beyond gravity.' },
        ...hotTaglines.map((text) => ({ temperature: 0.7, text })),
        ...hotTaglines.map((text) => ({ temperature: 1, text })),
      ],
      success: { message: 'Same prompt, different answers — and now you know why.', nextLabel: 'Next: Top-p →' },
    },
  ],
}

// ---- Tokens & temperature · 1. What is a token? ----------------------------

const whatIsAToken: LessonContent = {
  title: 'What is a token?',
  order: 1,
  minutes: 6,
  xp: 30,
  video: {
    duration: 192,
    chapters: [
      { at: 0, title: 'Text in, numbers out' },
      { at: 70, title: 'Pieces of words' },
      { at: 130, title: 'Why it matters' },
    ],
    cues: [
      { start: 0, text: 'A model never sees letters. Before it reads anything, your text is chopped into pieces.' },
      { start: 70, text: 'Common words get one piece. Rare words get split into chunks the model has seen before.' },
      { start: 130, text: 'You pay per token, and the context window is counted in tokens, so it pays to know them.' },
    ],
  },
  blocks: [
    {
      type: 'markdown',
      paragraphs: [
        [
          'A model doesn’t read letters or words. Before it sees your prompt, a ',
          { strong: 'tokenizer' },
          ' chops the text into pieces called tokens, and each piece becomes a number.',
        ],
        ['Type anything below and watch where the cuts land. Spaces usually stick to the start of the next word.'],
      ],
    },
    {
      type: 'tokenizer',
      sample: 'Unbelievably, the cat fetched.',
      tokens: [
        ['Un', '1844'],
        ['believ', '31141'],
        ['ably', '2915'],
        [',', '11'],
        [' the', '279'],
        [' cat', '8415'],
        [' fetched', '42118'],
        ['.', '13'],
      ],
    },
    {
      type: 'markdown',
      paragraphs: [[{ strong: 'Unbelievably' }, ' became three tokens, but ', { code: ' the' }, ' is just one. Common words are cheap; rare ones get split.']],
    },
    {
      type: 'quiz',
      id: 'common-words',
      xp: 10,
      question: ['Which of these is most likely a single token?'],
      options: [
        { key: 'a', label: '“ the”', correct: true, explanation: 'Right. Very common words, with their leading space, get a token of their own.' },
        { key: 'b', label: '“Unbelievably”', correct: false, explanation: 'Not quite. Rare, long words get split into several familiar pieces.' },
        { key: 'c', label: '“fetched.”', correct: false, explanation: 'Not quite. Punctuation usually gets its own token, so this is at least two.' },
      ],
    },
  ],
}

// ---- Your first agent loop · 4. The loop -----------------------------------

const k = (t: string): CodeSegment => ['keyword', t]
const s = (t: string): CodeSegment => ['string', t]
const ty = (t: string): CodeSegment => ['type', t]
const f = (t: string): CodeSegment => ['function', t]
const p = (t: string): CodeSegment => ['plain', t]
const c = (t: string): CodeSegment => ['comment', t]
const n = (t: string): CodeSegment => ['number', t]

const agentTs: CodeBlockFile = {
  file: 'agent.ts',
  lang: 'ts',
  badge: 'TS',
  language: 'TypeScript',
  copy: true,
  typeMode: true,
  highlight: { from: 12, to: 32, label: 'the loop' },
  focusLine: 31,
  lines: [
    [k('import'), p(' Anthropic '), k('from'), s(' "@anthropic-ai/sdk"'), p(';')],
    [k('import'), p(' { tools, runTool } '), k('from'), s(' "./tools"'), p(';')],
    [],
    [k('const'), p(' client = '), k('new'), ty(' Anthropic'), p('();')],
    [],
    [k('type'), ty(' Msg'), p(' = '), ty('Anthropic.MessageParam'), p(';')],
    [],
    [k('export async function'), f(' agent'), p('(task: '), ty('string'), p(') {')],
    [k('  const'), p(' messages: '), ty('Msg'), p('[] = [{ role: '), s('"user"'), p(', content: task }];')],
    [],
    [c('  // the loop: think → act → observe → repeat')],
    [k('  while'), p(' ('), k('true'), p(') {')],
    [k('    const'), p(' res = '), k('await'), p(' client.messages.'), f('create'), p('({')],
    [p('      model: '), s('"claude-sonnet-5-5"'), p(',')],
    [p('      max_tokens: '), n('1024'), p(',')],
    [p('      tools,')],
    [p('      messages,')],
    [p('    });')],
    [],
    [p('    messages.'), f('push'), p('({ role: '), s('"assistant"'), p(', content: res.content });')],
    [],
    [k('    if'), p(' (res.stop_reason !== '), s('"tool_use"'), p(') {')],
    [k('      return'), p(' res; '), c('// the model is done talking')],
    [p('    }')],
    [],
    [k('    const'), p(' results = '), k('await'), ty(' Promise'), p('.'), f('all'), p('(')],
    [p('      res.content')],
    [p('        .'), f('filter'), p('((b) => b.type === '), s('"tool_use"'), p(')')],
    [p('        .'), f('map'), p('(runTool),')],
    [p('    );')],
    [p('    messages.'), f('push'), p('({ role: '), s('"user"'), p(', content: results });')],
    [p('  }')],
    [p('}')],
  ],
}

const toolsTs: CodeBlockFile = {
  file: 'tools.ts',
  lang: 'ts',
  badge: 'TS',
  language: 'TypeScript',
  copy: true,
  typeMode: false,
  lines: [
    [k('import'), k(' type'), p(' Anthropic '), k('from'), s(' "@anthropic-ai/sdk"'), p(';')],
    [],
    [k('export const'), p(' tools: '), ty('Anthropic.Tool'), p('[] = [{')],
    [p('  name: '), s('"get_weather"'), p(',')],
    [p('  description: '), s('"Current weather for a city"'), p(',')],
    [p('  input_schema: {')],
    [p('    type: '), s('"object"'), p(',')],
    [p('    properties: { city: { type: '), s('"string"'), p(' } },')],
    [p('    required: ['), s('"city"'), p('],')],
    [p('  },')],
    [p('}];')],
    [],
    [k('export async function'), f(' runTool'), p('(block: '), ty('Anthropic.ToolUseBlock'), p(') {')],
    [k('  const'), p(' { city } = block.input '), k('as'), p(' { city: '), ty('string'), p(' };')],
    [k('  const'), p(' weather = { temp_f: '), n('41'), p(', sky: '), s('"overcast"'), p(', city };')],
    [k('  return'), p(' { type: '), s('"tool_result"'), k(' as const'), p(', tool_use_id: block.id, content: '), ty('JSON'), p('.'), f('stringify'), p('(weather) };')],
    [p('}')],
  ],
}

const envExample: CodeBlockFile = {
  file: '.env.example',
  lang: 'sh',
  badge: '#',
  language: 'Properties',
  copy: true,
  typeMode: false,
  lines: [[c('# Get a key at console.anthropic.com')], [p('ANTHROPIC_API_KEY='), s('sk-ant-…')]],
}

const ion = (t: string): TerminalPart => ['ion', t]
const volt = (t: string): TerminalPart => ['volt', t]
const quiet = (t: string): TerminalPart => ['quiet', t]
const text = (t: string): TerminalPart => ['text', t]

const theLoop: LessonContent = {
  title: 'The loop',
  order: 4,
  minutes: 10,
  xp: 60,
  replies: {
    hint: 'Look at what the API requires after a tool_use block. What’s missing if line 31 is gone?',
    fallback: 'Good guess. Now delete line 31, hit Run, and read the first line of the error out loud.',
  },
  blocks: [
    {
      type: 'markdown',
      ask: 'why does the loop check stop_reason?',
      pointsAt: 'agent.ts',
      paragraphs: [
        [
          'Every reply comes with a reason the model stopped talking. If it’s ',
          { code: '"tool_use"' },
          ', it wants you to run a tool and hand back the result. Anything else means it’s finished.',
        ],
      ],
    },
    {
      type: 'code',
      files: [agentTs, toolsTs, envExample],
      run: {
        cmd: 'npx tsx agent.ts "Weather in Chicago?"',
        lines: [
          [ion('turn 1'), quiet(' stop_reason='), volt('"tool_use"'), quiet(' → get_weather')],
          [ion('turn 2'), quiet(' stop_reason='), volt('"end_turn"')],
          [text('41°F and overcast in Chicago.')],
        ],
      },
    },
    {
      type: 'terminal',
      ask: 'run it',
      cmd: 'npx tsx agent.ts "Weather in Chicago?"',
      lines: [
        [ion('→ tool_use    '), quiet('get_weather({ city: "Chicago" })')],
        [volt('← tool_result '), quiet('{ temp_f: 41, sky: "overcast" }')],
        [ion('→ end_turn    '), quiet('"41°F and overcast in Chicago."')],
      ],
      summary: '✓ 2 turns · 1 tool call · 1.8s',
    },
    {
      type: 'markdown',
      paragraphs: [
        [
          'Two turns: one to ask for the weather, one to answer. Now break it on purpose. Delete ',
          { mark: 'line 31' },
          ' and run it again.',
        ],
      ],
    },
    {
      type: 'quiz',
      id: 'break-the-loop',
      xp: 10,
      question: ['Predict first — does it loop forever, or crash?'],
      options: [
        {
          key: 'a',
          label: 'loops forever',
          correct: false,
          explanation: 'Close, but the API stops it first: a tool_use turn must be answered with a tool_result, so the next request is rejected.',
        },
        {
          key: 'b',
          label: 'crashes',
          correct: true,
          explanation: 'Right. The next request ends on a tool_use with no tool_result, so the API rejects it before the loop can spin.',
        },
        {
          key: 'c',
          label: 'works fine',
          correct: false,
          explanation: 'Not quite. Without line 31 the tool result never goes back, and the API refuses the next request.',
        },
      ],
    },
  ],
}

const lessons: Record<string, LessonContent> = {
  'tokens-and-temperature/temperature': temperature,
  'tokens-and-temperature/what-is-a-token': whatIsAToken,
  'first-agent-loop/the-loop': theLoop,
}

/** Where the learner left off in Watch mode (seconds); later from `lesson_progress`. */
export const resumeAt: Record<string, number> = {
  'tokens-and-temperature/temperature': 112,
}

/** Compiled content for a lesson, or a short stub for lessons not written yet. */
export function getLessonContent(course: string, lesson: { slug: string; title: string; n: number; mins: number; xp: number; kinds: string[] }): LessonContent {
  let written = lessons[`${course}/${lesson.slug}`]
  if (written) return written
  return {
    title: lesson.title,
    order: lesson.n,
    minutes: lesson.mins,
    xp: lesson.xp,
    blocks: [
      {
        type: 'markdown',
        paragraphs: [
          [{ strong: lesson.title }, ' is still being written. The finished lesson walks through it with a tutor, a toy to poke at and a prompt you write yourself.'],
          ['Until then, skim the outline and pick up where the course is ready.'],
        ],
      },
    ],
  }
}
