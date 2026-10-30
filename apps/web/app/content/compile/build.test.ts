import * as path from 'node:path'

import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import { coursesDir, listCourseFolders, readCourseFolder } from '../../../scripts/lib/content-folder.ts'
import { exercisesOf } from '../../actions/courses/lesson/content.ts'
import { buildCourse, formatItem, type SourceFile } from './index.ts'
import { checkPattern, MAX_OPTIONALS } from './regex.ts'

const course = `---
title: Test
track: foundations
level: beginner
summary: A test course.
outcomes: [Pass]
cover: { pattern: dots, sigil: T }
badge: { name: Test, glyph: T }
---
`

function lesson(body: string, frontmatter = 'title: One\norder: 1\nminutes: 5\nxp: 10') {
  return `---\n${frontmatter}\n---\n\n${body}\n`
}

function build(files: Record<string, string>) {
  let sources: SourceFile[] = Object.entries({ 'course.md': course, ...files }).map(([p, text]) => ({ path: p, text, size: text.length }))
  return buildCourse(sources, { folder: 'test' })
}

const errors = (result: ReturnType<typeof build>) => result.report.filter((item) => item.level === 'error').map(formatItem)

describe('content build', () => {
  it('builds the repo courses into the lesson shapes', async () => {
    let dir = path.join(coursesDir, 'tokens-and-temperature')
    let videos = (slug: string, file: string) =>
      slug === 'tokens-and-temperature' && file === 'assets/06-temperature.mp4' ? { src: '/media/videos/t.mp4' } : undefined
    let result = buildCourse(await readCourseFolder(dir), { folder: 'tokens-and-temperature', videos })
    assert.equal(result.errors, 0)
    assert.equal(result.manifest?.lessons, 8)
    assert.deepEqual(result.manifest?.modules.map((m) => m.title), ['How text becomes numbers', 'Picking the next word', 'Putting it together'])
    let temperature = result.lessons!.get('temperature')!
    let [exercise] = exercisesOf(temperature)
    assert.equal(exercise?.id, 'moon-tagline')
    assert.deepEqual(exercise?.checks[1]?.patterns, [
      { source: 'coffee|caf[eé]', flags: 'i' },
      { source: 'moon|lunar', flags: 'i' },
    ])
    assert.deepEqual(exercise?.run, { label: 'Ran at 0 and 1.0', temperatures: [0, 1] })
    assert.deepEqual(exercise?.temperatures, [0, 0.7, 1])
    // Linked to the upload; the duration falls back to frontmatter.
    assert.equal(temperature.video?.src, '/media/videos/t.mp4')
    assert.equal(temperature.video?.duration, 270)
    // Lesson 1's video isn't uploaded: text-only.
    assert.equal(result.lessons!.get('what-is-a-token')!.video, undefined)
    assert.equal(temperature.video?.cues.length, 3)
    let odds = temperature.blocks.find((block) => block.type === 'odds')
    assert.deepEqual(odds?.type === 'odds' && odds.candidates[0], [' Brew', 3.1])
  })

  it('links ready video uploads; a lesson without one publishes text-only (decision 029)', () => {
    let files = (video: string): SourceFile[] =>
      Object.entries({
        'course.md': course,
        '01-one.md': lesson('Hello.', `title: One\norder: 1\nminutes: 5\nxp: 10\nvideo: ${video}\nchapters:\n  - { at: 0:00, title: "Start" }`),
        'assets/01-one.vtt': 'WEBVTT\n\n00:00.000 --> 00:02.000\nHi.\n',
      }).map(([p, text]) => ({ path: p, text, size: text.length }))
    let videos = (slug: string, file: string) =>
      slug === 'test' && file === 'assets/01-one.mp4' ? { src: '/media/videos/x.mp4', duration: 61 } : undefined

    let linked = buildCourse(files('assets/01-one.mp4'), { folder: 'test', videos })
    assert.deepEqual(errors(linked), [])
    let video = linked.lessons?.get('one')?.video
    assert.equal(video?.src, '/media/videos/x.mp4')
    assert.equal(video?.duration, 61)
    assert.equal(video?.cues.length, 1)
    assert.deepEqual(linked.manifest?.formats, ['text', 'video'])
    assert.equal(linked.manifest?.videos?.[0]?.found, true)

    let missing = buildCourse(files('assets/02-other.mp4'), { folder: 'test', videos })
    assert.deepEqual(errors(missing), [])
    assert.equal(missing.lessons?.get('one')?.video, undefined)
    assert.deepEqual(missing.manifest?.formats, ['text'])
    assert.equal(missing.manifest?.videos?.[0]?.found, false)
    assert.ok(missing.report.map(formatItem).some((text) => /video not uploaded yet: assets\/02-other\.mp4/.test(text)))

    // A chapter past the end is still an error once the length is known.
    let late = buildCourse(
      files('assets/01-one.mp4').map((file) =>
        file.path === '01-one.md' ? { ...file, text: file.text!.replace('at: 0:00', 'at: 1:30') } : file,
      ),
      { folder: 'test', videos },
    )
    assert.ok(errors(late).some((text) => /starts after the video ends/.test(text)))
  })

  it('turns paragraphs, ::ask and ==marks== into tutor turns', () => {
    let result = build({
      '01-one.md': lesson('Hello **there**, `code`\nand ==this==.\n\n---\n\n::ask[why?]\n\nBecause.'),
    })
    assert.deepEqual(errors(result), [])
    assert.deepEqual(result.lessons?.get('one')?.blocks, [
      { type: 'markdown', paragraphs: [['Hello ', { strong: 'there' }, ', ', { code: 'code' }, ' and ', { mark: 'this' }, '.']] },
      { type: 'markdown', paragraphs: [['Because.']], ask: 'why?' },
    ])
  })

  it('groups adjacent :::code blocks and takes the next :::terminal as Run output', () => {
    let result = build({
      '01-one.md': lesson(
        ':::code{file="a.ts" lang="ts" highlight="1"}\nconst a = 1 // one\n:::\n\n:::code{file="b.sh" lang="sh"}\necho hi\n:::\n\n:::terminal{cmd="run" ask="run it" summary="✓ 1 turn"}\n[ion]ok[quiet] done\n:::',
      ),
    })
    assert.deepEqual(errors(result), [])
    let [code] = result.lessons!.get('one')!.blocks
    assert.equal(code?.type, 'code')
    if (code?.type !== 'code') return
    assert.deepEqual(code.files.map((f) => f.file), ['a.ts', 'b.sh'])
    assert.deepEqual(code.files[0]?.lines[0], [['keyword', 'const'], ['plain', ' a = '], ['number', '1'], ['plain', ' '], ['comment', '// one']])
    // The terminal's ask and summary come along with its output.
    assert.deepEqual(code.run, { cmd: 'run', lines: [[['ion', 'ok'], ['quiet', ' done']]], ask: 'run it', summary: '✓ 1 turn' })
    // No label: the footer already shows the range, so none is invented.
    assert.deepEqual(code.files[0]?.highlight, { from: 1, to: 1 })
  })

  it('reports an unclosed :::code at its line instead of swallowing the next block', () => {
    let result = build({
      '01-one.md': lesson(':::code{file="a.ts" lang="ts"}\n```ts\nconst a = 1\n```\n\n:::terminal{cmd="run"}\nok\n:::\n\nAfter.'),
    })
    assert.deepEqual(errors(result), ['01-one.md:8 → :::code is never closed: add a ::: line before :::terminal on line 13'])
  })

  it('turns prose links into links: site paths and https only', () => {
    let ok = build({
      '01-one.md': lesson('See [the loop](/courses/first-agent-loop/the-loop) and [the docs](https://docs.anthropic.com/en/docs).'),
    })
    assert.deepEqual(errors(ok), [])
    assert.deepEqual(ok.lessons?.get('one')?.blocks, [
      {
        type: 'markdown',
        paragraphs: [
          [
            'See ',
            { link: 'the loop', href: '/courses/first-agent-loop/the-loop' },
            ' and ',
            { link: 'the docs', href: 'https://docs.anthropic.com/en/docs' },
            '.',
          ],
        ],
      },
    ])

    let bad = build({
      '01-one.md': lesson(
        [
          '[a](javascript:alert(1))',
          '',
          '[b](data:text/html,hi)',
          '',
          '[c](http://example.com)',
          '',
          '[d](//evil.example)',
          '',
          '[e](mailto:x@example.com)',
          '',
          '[f](JavaScript:alert(1))',
        ].join('\n'),
      ),
    })
    assert.deepEqual(errors(bad), [
      '01-one.md:8 → link “a” points at “javascript:alert(1)”: links must be a path on this site (/courses/…) or an https:// URL',
      '01-one.md:10 → link “b” points at “data:text/html,hi”: links must be a path on this site (/courses/…) or an https:// URL',
      '01-one.md:12 → link “c” points at “http://example.com”: links must be a path on this site (/courses/…) or an https:// URL',
      '01-one.md:14 → link “d” points at “//evil.example”, which leaves the site: write https://… for other sites',
      '01-one.md:16 → link “e” points at “mailto:x@example.com”: links must be a path on this site (/courses/…) or an https:// URL',
      '01-one.md:18 → link “f” points at “JavaScript:alert(1)”: links must be a path on this site (/courses/…) or an https:// URL',
    ])
  })

  it('reads \\n in :::prompt draft, placeholder and example strings as a line break', () => {
    let result = build({
      '01-one.md': lesson(
        [
          ':::prompt{id="p"}',
          'Write a system prompt.',
          '- check "Has a role" /you are/i',
          '- draft "You are a tutor.\\nRules:\\n- be brief"',
          '- placeholder "Role\\nRules"',
          '- example T=0 "Line one.\\nLine \\"two\\"."',
          ':::',
        ].join('\n'),
      ),
    })
    assert.deepEqual(errors(result), [])
    let [exercise] = exercisesOf(result.lessons!.get('one')!)
    assert.equal(exercise?.draft, 'You are a tutor.\nRules:\n- be brief')
    assert.equal(exercise?.placeholder, 'Role\nRules')
    assert.deepEqual(exercise?.examples, [{ temperature: 0, text: 'Line one.\nLine "two".' }])
  })

  it('reads a course’s access: free by default, pro when it says so, nothing else (decision 048)', () => {
    let one = { '01-one.md': lesson('Hi') }
    assert.equal(build(one).manifest?.access, 'free')
    let sources = (frontmatter: string) =>
      Object.entries({ 'course.md': course.replace('level: beginner', `level: beginner\n${frontmatter}`), ...one }).map(
        ([p, text]) => ({ path: p, text, size: text.length }),
      )
    assert.equal(buildCourse(sources('access: pro'), { folder: 'test' }).manifest?.access, 'pro')
    assert.equal(buildCourse(sources('access: free'), { folder: 'test' }).manifest?.access, 'free')
    let paid = buildCourse(sources('access: paid'), { folder: 'test' })
    assert.equal(paid.manifest, undefined)
    assert.match(errors(paid).join('\n'), /^course\.md:5 → access: /)
  })

  it('reports problems with file and line', () => {
    let result = build({
      '01-one.md': lesson(':::prompt{id="p"}\nDo it.\n- check "bad" /(a+)+/\n:::\n\n# Heading\n\n<b>hi</b>'),
      '02-two.md': lesson(':::quiz{id="q"}\nPick one\n- [x] a\n- [x] b\n:::\n\n:::code{file="x"}\nx\n', 'title: Two\norder: 1\nminutes: 5\nxp: 10'),
      '03-three.md': lesson('Hi', 'title: Three\norder: 3\nminutes: lots\nxp: 10'),
    })
    assert.deepEqual(errors(result), [
      '01-one.md → duplicate order: 1 (also in 02-two.md)',
      '01-one.md:10 → check “bad”: /(a+)+/ uses repetition (*, + or {n}), which isn’t allowed in checks; list the alternatives instead, like /words?|short/',
      '01-one.md:13 → headings aren’t supported in lessons (the page has its own); write a paragraph',
      '01-one.md:15 → raw HTML isn’t allowed in lessons',
      '02-two.md:8 → :::quiz has 2 right answers: add multiple to allow several',
      '02-two.md:14 → :::code is never closed: add a ::: line after it',
      '03-three.md:4 → minutes: Expected number',
    ])
    assert.equal(result.manifest, undefined)
  })

  it('accepts only the check grammar: no repetition, few optionals, few paths', () => {
    let rejected: [string, RegExp][] = [
      // Classic exponential shapes.
      ['(a+)+$', /repetition/],
      ['(a|a)*', /repetition/],
      ['(?:\\w*)*', /repetition/],
      ['a*b*c*', /repetition/],
      [`${'a?'.repeat(MAX_OPTIONALS + 1)}${'a'.repeat(MAX_OPTIONALS + 1)}`, /more than 4 optional parts/],
      // The reviewer's bypasses of the old analyzer.
      ['[]a+]+', /empty character class/], // a class starting with ]
      ['[^]a]', /empty character class/],
      ['(a|ab){1,20}', /repetition/], // bounded repeats skipped the overlap check
      ['(a|a){2,9}c', /repetition/],
      ['\\w{1,99}\\s{1,99}x', /repetition/], // {n,m} wasn't counted as unbounded
      ['x{3}', /repetition/],
      ['a}', /repetition/],
      // Without repetition, alternatives still multiply: cap the paths.
      ['(?:a|a)(?:a|a)(?:a|a)(?:a|a)(?:a|a)(?:a|a)(?:a|a)x', /more than 64 ways/],
      // Groups and escapes outside the grammar.
      ['(?=moon)', /\(\?…\) group/],
      ['(?<!x)moon', /\(\?…\) group/],
      ['(?<w>a)', /\(\?…\) group/],
      ['(a)\\1', /backreference/],
      ['\\k<w>', /backreference/],
      ['\\p{L}', /uses \\p/],
      ['\\x41', /uses \\x/],
      ['a]', /unescaped \]/],
      ['[a[b]]', /nested classes/],
      ['^?a', /doesn't compile|\? that doesn’t follow/],
      ['a??', /\? that doesn’t follow/],
      // The basics stay.
      ['a'.repeat(201), /201 characters long/],
      ['(', /doesn't compile/],
    ]
    for (let [source, problem] of rejected) {
      assert.match(checkPattern(source, 'i') ?? 'accepted', problem, source)
    }
    assert.match(checkPattern('moon', 'g') ?? 'accepted', /flags "g"/)

    let accepted = [
      'tagline|slogan',
      'coffee|caf[eé]',
      '\\bwords?\\b|\\bshort\\b|\\bunder\\b|\\bmax',
      '^(?:cat|dog)s?$',
      '[a-z0-9_\\-]',
      '[^\\s\\]]x',
      '\\.\\(\\)\\[\\]\\{\\}\\*\\+\\?\\|\\^\\$\\\\\\/',
      'colou?r',
      '.',
    ]
    for (let source of accepted) assert.equal(checkPattern(source, 'iu'), null, source)
  })

  it('accepts every check in the real courses', async () => {
    let checked = 0
    for (let dir of await listCourseFolders()) {
      let result = buildCourse(await readCourseFolder(dir), { folder: path.basename(dir) })
      assert.deepEqual(errors(result), [], dir)
      for (let content of result.lessons?.values() ?? []) {
        for (let block of exercisesOf(content)) {
          for (let check of block.checks) {
            for (let pattern of check.patterns) {
              assert.equal(checkPattern(pattern.source, pattern.flags), null, pattern.source)
              checked++
            }
          }
        }
      }
    }
    assert.ok(checked >= 4, `found ${checked} patterns`)
  })

  it('reports a bad check as a build error at its line', () => {
    let result = build({ '01-one.md': lesson(':::prompt{id="p"}\nDo it.\n- check "slow" /(a|a)*b/\n:::') })
    assert.deepEqual(errors(result), [
      '01-one.md:10 → check “slow”: /(a|a)*b/ uses repetition (*, + or {n}), which isn’t allowed in checks; list the alternatives instead, like /words?|short/',
    ])
  })

  it('rejects xp outside 0–100 per block and 0–500 per lesson', () => {
    let result = build({
      '01-one.md': lesson(
        ':::prompt{id="p" xp=1000000}\nDo it.\n- check "any" /./\n:::\n\n:::quiz{id="q" xp=-5}\nPick\n- [x] a\n- [ ] b\n:::',
        'title: One\norder: 1\nminutes: 5\nxp: 999999',
      ),
    })
    assert.deepEqual(errors(result), [
      '01-one.md:5 → xp: Expected number less than or equal to 500',
      '01-one.md:8 → xp=1000000 is out of range: use a whole number from 0 to 100',
      '01-one.md:13 → xp=-5 is out of range: use a whole number from 0 to 100',
    ])
  })

  it('builds every lesson toy from the toys fixture', async () => {
    let dir = path.join(coursesDir, '../fixtures/toys')
    let result = buildCourse(await readCourseFolder(dir), { folder: 'toys' })
    assert.deepEqual(result.report.filter((item) => item.level !== 'ok').map(formatItem), [])
    let blocks = result.lessons!.get('every-toy')!.blocks.filter((block) => block.type !== 'markdown')
    assert.deepEqual(blocks.map((block) => block.type), ['nexttoken', 'training', 'attention', 'compare', 'rabbithole'])
    let [nexttoken, training, attention, compare, rabbithole] = blocks
    assert.deepEqual(nexttoken, {
      type: 'nexttoken',
      prompt: 'The capital of France is',
      steps: [
        { token: ' Paris', p: 0.92, alternatives: [[' the', 0.03], [' a', 0.02]] },
        { token: '.', p: 0.71, alternatives: [[',', 0.2], [' and', 0.05]] },
        { token: ' It', p: 0.4, alternatives: [[' The', 0.3], ['\n', 0.1]] },
      ],
      illustrative: true,
    })
    assert.deepEqual(training?.type === 'training' && training.snapshots.map((s) => [s.step, s.loss]), [
      [0, 10.8],
      [500, 6.1],
      [5000, 3.2],
      [50000, 1.9],
    ])
    assert.equal(attention?.type === 'attention' && attention.tokens.length, 10)
    assert.deepEqual(attention?.type === 'attention' && attention.links[0], { from: 7, to: 1, weight: 0.62 })
    assert.equal(attention?.type === 'attention' && attention.caption, 'What does “it” refer to?')
    // illustrative=false on the block beats the frontmatter; strings can span lines.
    assert.deepEqual(compare, {
      type: 'compare',
      left: 'Base model',
      right: 'Assistant',
      rows: [
        {
          prompt: 'What is the capital of France?',
          left: 'What is the capital of Germany?\nWhat is the capital of Spain?',
          right: 'The capital of France is Paris.',
        },
      ],
    })
    assert.deepEqual(
      rabbithole?.type === 'rabbithole' && rabbithole.links.map((link) => [link.kind, link.by, link.mins, link.deep]),
      [
        ['video', '3Blue1Brown', 27, undefined],
        ['video', 'Andrej Karpathy', 116, true],
        ['read', 'Anthropic', undefined, undefined],
      ],
    )
  })

  it('builds the animation blocks from the toys fixture (decision 060)', async () => {
    let dir = path.join(coursesDir, '../fixtures/toys')
    let result = buildCourse(await readCourseFolder(dir), { folder: 'toys' })
    assert.deepEqual(result.report.filter((item) => item.level !== 'ok').map(formatItem), [])
    let blocks = result.lessons!.get('animation')!.blocks.filter((block) => block.type !== 'markdown')
    assert.deepEqual(blocks.map((block) => block.type), ['steps', 'flow', 'marbles'])
    let [steps, flow, marbles] = blocks
    assert.deepEqual(steps, {
      type: 'steps',
      title: 'One reply, five moves',
      loop: true,
      steps: [
        { label: 'Read', caption: 'Everything so far, your prompt included.' },
        { label: 'Score', caption: 'One number for every token it knows.' },
        { label: 'Odds', caption: 'The scores become odds that add up to 100%.' },
        { label: 'Draw', caption: 'One token is sampled from those odds.' },
        { label: 'Append', caption: 'It joins the text, and the loop starts again.' },
      ],
      illustrative: true,
    })
    assert.deepEqual(flow, {
      type: 'flow',
      capacity: 8,
      unit: 'tokens',
      title: 'A window of 8 tokens',
      items: [
        { name: 'system prompt', size: 3 },
        { name: "Hi, I'm Sam.", size: 2 },
        { name: 'Hi Sam!', size: 2 },
        { name: "What's my name?", size: 2 },
        { name: 'Sam.', size: 1 },
      ],
      illustrative: true,
    })
    // illustrative=false on the block beats the frontmatter.
    assert.deepEqual(marbles, {
      type: 'marbles',
      duration: 5,
      unit: 's',
      title: 'One agent turn',
      lanes: [
        { name: 'You', events: [{ at: 0, label: 'prompt' }] },
        { name: 'Claude', events: [{ at: 0.8, label: 'tool call' }, { at: 4.6, label: 'answer' }] },
        { name: 'Tool', events: [{ at: 1.2, label: 'running' }, { at: 3.9, label: 'result' }] },
      ],
    })
  })

  it('a :::marbles without a duration ends at its last event, rounded up; a :::flow nothing leaves warns', () => {
    let result = build({
      '01-one.md': lesson(
        [
          ':::marbles',
          '- "Tokens" 0.3 "The" 0.5 " cat" 0.7 " sat"',
          ':::',
          '',
          ':::flow{capacity=32}',
          '- "a" 1',
          '- "b" 1',
          ':::',
        ].join('\n'),
      ),
    })
    assert.equal(errors(result).join('\n'), '')
    let marbles = result.lessons!.get('one')!.blocks.find((block) => block.type === 'marbles')
    assert.equal(marbles?.type === 'marbles' && marbles.duration, 1)
    assert.equal(
      result.report.filter((item) => item.level === 'warning').map(formatItem).join('\n'),
      '01-one.md:12 → every item fits in the window at once (32); nothing ever falls out, so :::flow shows no flow',
    )
  })

  it('reports each toy’s validation errors at their lines (broken-toys fixture)', async () => {
    let dir = path.join(coursesDir, '../fixtures/broken-toys')
    let result = buildCourse(await readCourseFolder(dir), { folder: 'broken-toys' })
    assert.deepEqual(errors(result), [
      '01-nexttoken.md:10 → :::nexttoken needs a prompt, like :::nexttoken{prompt="The capital of France is"}',
      '01-nexttoken.md:11 → odds 1.4 for " Paris" are outside 0–1',
      '01-nexttoken.md:12 → the odds on this line add up to 1.20, more than 1',
      '01-nexttoken.md:13 → runners-up look like " the":0.03 " a":0.02 (couldn’t read “" the" 0.3”)',
      '01-nexttoken.md:14 → nexttoken lines are the picked token, its odds, then | and the runners-up, like: " Paris" 0.92 | " the":0.03 " a":0.02',
      '02-training.md:12 → step 100 comes after step 500: list steps in increasing order',
      '02-training.md:13 → training lines look like: - step 500 loss=6.1 "the model’s output at that step"',
      '03-attention.md:12 → from=4 to=1: indexes count from 0 and must be below 4 (the number of tokens)',
      '03-attention.md:13 → from=1 to=3: a token only attends to itself and earlier tokens (to ≤ from)',
      '03-attention.md:14 → w=1.5 is outside 0–1',
      '03-attention.md:16 → from=3 to=1 is listed twice',
      '04-compare.md:10 → :::compare needs both labels, like :::compare{left="Base model" right="Assistant"}',
      '04-compare.md:11 → each compare row needs a - left and a - right line',
      '04-compare.md:13 → compare lines look like: - prompt "…", - left "…" or - right "…" (a string can run over several lines)',
      '05-rabbithole.md:10 → :::rabbithole has 4 links; pick the best 3',
      '05-rabbithole.md:11 → a rabbit hole needs an https link: url="https://…" (got “http://example.com/video”)',
      '05-rabbithole.md:12 → a rabbit hole needs its author: by="3Blue1Brown"',
      '05-rabbithole.md:13 → a rabbit hole needs a title',
      '05-rabbithole.md:14 → unknown rabbit hole kind "podcast" (use video or read)',
      '06-ask.md:10 → :::ask needs an accept line or a correct choice',
      '06-ask.md:16 → :::ask needs an accept line or a correct choice',
      '06-ask.md:18 → accept “Repeats”: /a+/ uses repetition (*, + or {n}), which isn’t allowed in checks; list the alternatives instead, like /words?|short/',
      '06-ask.md:19 → reject lines look like: - reject "Not about memory" /never seen/i "It has seen it often. What does it get instead?"',
      '06-ask.md:20 → unknown ask line "- banana" (use accept, reject, choice, hint, explain or placeholder)',
      '06-ask.md:23 → :::ask has 2 right choices: add multiple to allow several',
      '07-depth.md:13 → :::prompt can’t go inside :::new: prompts, quick checks and rabbit holes are shared by both depths, so progress never depends on depth; move it outside',
      '07-depth.md:20 → :::new can’t go inside :::engineer: depth blocks don’t nest, so close :::engineer first',
      '07-depth.md:25 → :::new holds :::nexttoken, so it needs a longer fence: write ::::new … :::: around it',
      '07-depth.md:36 → :::rabbithole can’t go inside :::engineer: prompts, quick checks and rabbit holes are shared by both depths, so progress never depends on depth; move it outside',
      '08-steps.md:12 → steps lines are a label, then a caption: - "Read" "Everything so far, your prompt included."',
      '08-steps.md:13 → step label “A label that runs far too long” is 30 characters; keep it to 24',
      '08-steps.md:14 → step “Draw” needs a caption',
      '08-steps.md:15 → step “Read” is listed twice',
      '08-steps.md:18 → :::steps needs 3 to 8 - "label" "caption" lines (got 2)',
      '09-flow.md:10 → :::flow needs a capacity, like :::flow{capacity=12} (2–32 tokens)',
      '09-flow.md:16 → “a long document” is 9, bigger than the window (capacity=4): it could never fit',
      '09-flow.md:17 → “nothing” has size 0; every item takes at least 1',
      '09-flow.md:18 → flow lines are a name, then its size: - "system prompt" 3',
      '09-flow.md:22 → capacity=99 is out of range: use a whole number from 2 to 32',
      '10-marbles.md:10 → an event is at 6, past duration=4',
      '10-marbles.md:11 → lane “Claude”: events must be in time order (1 comes after 2)',
      '10-marbles.md:13 → marbles lines are a lane, then time and event pairs: - "Claude" 1.2 "tool call" 6.5 "answer"',
      '10-marbles.md:14 → couldn’t read “oops”: marbles lines are a lane, then time and event pairs: - "Claude" 1.2 "tool call" 6.5 "answer"',
      '10-marbles.md:17 → duration=0 is out of range: use a number above 0 and up to 3600',
      '10-marbles.md:17 → :::marbles needs at least one - "lane" time "event" line',
    ])
  })

  it('tags :::new and :::engineer blocks with their depth and keeps graded blocks shared (decision 053)', async () => {
    let dir = path.join(coursesDir, '../fixtures/toys')
    let result = buildCourse(await readCourseFolder(dir), { folder: 'toys' })
    let blocks = result.lessons!.get('depth')!.blocks
    assert.deepEqual(
      blocks.map((block) => [block.type, block.depth ?? 'shared']),
      [
        ['markdown', 'shared'],
        ['markdown', 'new'],
        ['markdown', 'engineer'],
        ['nexttoken', 'engineer'],
        ['markdown', 'engineer'],
        ['ask', 'shared'],
        ['markdown', 'shared'],
      ],
    )
    // The frontmatter's illustrative reaches a toy inside a depth block.
    assert.equal(blocks[3]?.type === 'nexttoken' && blocks[3].illustrative, true)
    let info = result.manifest!.modules.flatMap((m) => m.lessons).find((l) => l.slug === 'depth')!
    assert.equal(info.mins, 6)
    assert.equal(info.minsByDepth?.engineer, 6)
    assert.ok(info.minsByDepth!.new >= 1 && info.minsByDepth!.new <= 6)
    // A lesson without depth blocks carries no minsByDepth.
    let plain = result.manifest!.modules.flatMap((m) => m.lessons).find((l) => l.slug === 'ask')!
    assert.equal(plain.minsByDepth, undefined)
  })

  it('checks depth blocks: one depth warns, an unclosed one errors, code joins only within a depth', () => {
    let oneDepth = build({ '01-one.md': lesson('Shared.\n\n:::engineer\nThe mechanism.\n:::') })
    assert.deepEqual(errors(oneDepth), [])
    assert.deepEqual(
      oneDepth.report.filter((item) => item.level === 'warning').map(formatItem),
      ['01-one.md → the lesson has :::engineer but no :::new, so the new depth shows only the shared text'],
    )
    let unclosed = build({ '01-one.md': lesson('Shared.\n\n:::new\nNever closed.') })
    assert.deepEqual(errors(unclosed), ['01-one.md:10 → :::new is never closed: add a ::: line after it'])
    let quiz = build({
      '01-one.md': lesson('::::new\n:::quiz{id="q" xp=5}\nPick.\n- [x] A\n- [ ] B\n:::\n::::\n\n:::engineer\nE.\n:::'),
    })
    assert.deepEqual(errors(quiz), [
      '01-one.md:9 → :::quiz can’t go inside :::new: prompts, quick checks and rabbit holes are shared by both depths, so progress never depends on depth; move it outside',
    ])
    let code = build({
      '01-one.md': lesson(
        [
          '::::new',
          ':::code{file="a.ts" lang="ts"}',
          'let a = 1',
          ':::',
          '::::',
          '',
          ':::code{file="b.ts" lang="ts"}',
          'let b = 2',
          ':::',
          '',
          ':::engineer',
          'E.',
          ':::',
        ].join('\n'),
      ),
    })
    assert.deepEqual(errors(code), [])
    let editors = code.lessons!.get('one')!.blocks.filter((block) => block.type === 'code')
    assert.deepEqual(
      editors.map((block) => block.type === 'code' && [block.depth ?? 'shared', block.files.map((f) => f.file)]),
      [
        ['new', ['a.ts']],
        ['shared', ['b.ts']],
      ],
    )
  })

  it('builds quick checks: typed, picked, and a legacy quiz as an ask (decision 052)', async () => {
    let dir = path.join(coursesDir, '../fixtures/toys')
    let result = buildCourse(await readCourseFolder(dir), { folder: 'toys' })
    let asks = result.lessons!.get('ask')!.blocks.filter((block) => block.type === 'ask')
    assert.deepEqual(
      asks.map((ask) => ask.type === 'ask' && [ask.id, ask.xp, ask.gate, ask.multiple ?? false]),
      [
        ['typed', 10, true, false],
        ['picked', 10, false, false],
        ['legacy', 10, true, true],
      ],
    )
    let [typed, picked, legacy] = asks
    assert.ok(typed?.type === 'ask')
    assert.equal(typed.placeholder, 'In a sentence')
    assert.deepEqual(typed.accept, [{ label: 'Mentions tokens', patterns: [{ source: 'token|chunk|piece', flags: 'i' }] }])
    assert.deepEqual(typed.reject, [
      {
        label: 'Blames memory',
        patterns: [{ source: 'memor', flags: 'i' }],
        feedback: 'It isn’t a memory problem. What does it see instead of letters?',
      },
    ])
    assert.equal(typed.hint, 'Think about what the model reads.')
    assert.ok(picked?.type === 'ask')
    assert.deepEqual(
      picked.choices.map((choice) => [choice.key, choice.correct]),
      [
        ['a', true],
        ['b', false],
        ['c', false],
      ],
    )
    assert.equal(picked.choices[1]?.explanation, 'Rare words split into pieces.')
    assert.ok(legacy?.type === 'ask')
    assert.deepEqual(legacy.choices.filter((choice) => choice.correct).map((choice) => choice.key), ['a', 'b'])
    assert.deepEqual(legacy.accept, [])
  })

  it('checks the toy bodies: missing lines, javascript: links, weights that add up past 1', () => {
    let result = build({
      '01-one.md': lesson(
        [
          ':::training{prompt="x"}',
          '- step 0 loss=9 "a"',
          ':::',
          '',
          ':::attention',
          'tokens "a" "b"',
          '- from=1 to=0 w=0.8',
          '- from=1 to=1 w=0.7',
          ':::',
          '',
          ':::rabbithole',
          '- read "Bad" by="X" url="javascript:alert(1)"',
          ':::',
          '',
          ':::compare{left="A" right="B"}',
          '- left "one \\"quoted\\"\\nline"',
          '- right "two"',
          ':::',
        ].join('\n'),
      ),
    })
    assert.deepEqual(errors(result), [
      '01-one.md:8 → :::training needs at least two - step lines',
      '01-one.md:19 → a rabbit hole needs an https link: url="https://…" (got “javascript:alert(1)”)',
    ])
    assert.deepEqual(
      result.report.filter((item) => item.level === 'warning').map(formatItem),
      ['01-one.md:12 → the weights from token 1 add up to 1.50; attention weights sum to at most 1'],
    )
    let ok = build({ '01-one.md': lesson(':::compare{left="A" right="B"}\n- left "one \\"quoted\\"\\nline"\n- right "two"\n:::') })
    let compare = ok.lessons?.get('one')?.blocks.find((block) => block.type === 'compare')
    assert.deepEqual(compare?.type === 'compare' && compare.rows, [{ left: 'one "quoted"\nline', right: 'two' }])
  })
})
