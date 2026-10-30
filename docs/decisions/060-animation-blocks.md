# 060. Animation blocks: `:::steps`, `:::flow` and `:::marbles`

Status: Accepted (2026-10-29). Extends 021 (lesson toys) and follows 023
(layout stability), 053 (depth blocks) and 058 (the bit cell).

## Context

The toys of decision 021 show a model's numbers: odds, loss, attention.
Several ideas in the courses are not numbers but **sequences**: the five
moves of one reply, text arriving into a context window until something
has to leave, the order of events in one agent turn. Lessons told these in
prose, sometimes as "Read, score, odds, draw, append" in one sentence,
and the engineer depth had nothing to hold on to. The owner asked for
animation blocks after the two-depth work (handoff 2026-10-29).

## Decision

Three blocks, each an island with a server-rendered first state and a
no-JS fallback, following the 021 pattern (a `LessonContent` type, a
compiler case with line-numbered errors, a `packages/ui` component, a
styleguide specimen, fixtures and tests).

| Directive | Body | Component |
|---|---|---|
| `:::steps{title="…" loop illustrative}` | 3–8 lines: `- "Read" "Everything so far, your prompt included."` | `StepsPlayer` (`steps.tsx`) |
| `:::flow{capacity=12 unit="tokens" title="…" illustrative}` | 2–16 lines: `- "system prompt" 3` | `FlowWindow` (`flow.tsx`) |
| `:::marbles{duration=8 unit="s" title="…" illustrative}` | 1–5 lanes: `- "Claude" 1.2 "tool call" 6.5 "answer"` (up to 12 events each) | `MarblesTimeline` (`marbles.tsx`) |

**Steps** is a chain of numbered nodes. The current one is lit (volt
frame and tint, its number a filled cell), the ones before it keep a
filled number, the ones after an empty one, and a bit row under the
controls counts the steps. The current step's caption reads out under the
chain. Every node is a button that jumps to its step; `loop` draws a `↺`
after the last node and says "then back to 1" in the status.

**Flow** is one track of chips, one per item in arrival order: empty until
the item arrives, lit while it is in the window, dashed and struck once it
has fallen out. The fill is a `BitCells` row with one cell per unit of
capacity (ion when full). The caption says what each arrival did ("The
window is full, so “system prompt” falls out"). The state at any point is
`flowAt(items, capacity, arrived)`, a pure function the fallback table
uses too. Capacity is 2–32 so the row fits a phone; an item bigger than
the window is a build error, and a list that never fills it is a warning.

**Marbles** is a marble diagram: lane names down the left, a hairline track
per lane, each event a bit cell at its time with its label under it. A
volt play head sweeps the timeline once (the diagram's own duration,
kept between 2.5 and 8 real seconds), lighting events as it passes, and a
range slider scrubs it (`aria-valuetext` is the time). Without a
`duration` the timeline ends at the last event, rounded up.

Shared rules:

- **Plays once, in view.** Like `:::nexttoken`, each starts when 60% of
  it is on screen, once, then stays where it ended. Prev / Play / Next /
  Restart (steps, flow) or Play / Restart / scrub (marbles).
- **Reduced motion.** No autoplay and no Play button (hidden in CSS);
  the step buttons and slider remain. Marbles starts at the end, so the
  whole diagram is lit.
- **No layout shift.** The server renders the first state the client
  starts in (step 1, the first arrival, the head at 0). The chain and
  the track never change size; captions and status lines sit on a
  `Ghost` of the longest one (decision 023). Markers and chips change
  colour only.
- **Announcements.** The caption is `aria-live="polite"` while not
  playing (nothing is announced mid-animation); the controls are named
  buttons; the chain is an `<ol>` with `aria-current="step"`; marbles'
  fill row is an image named with the amount.
- **Without JS** the chain, track and controls hide (`scripting: none`)
  and a `<noscript>` holds the steps as an ordered list, the arrivals as a
  table (arrives, size, used, falls out) and the events as a table in
  time order.
- **Bits (058).** Progress and fill are bit rows; the step numbers and
  the event markers are bit cells, empty ahead and filled once reached.
- **Depth (053).** The blocks may sit inside `:::new` / `:::engineer`
  (with a longer fence) and are never required to be shared: they hold
  no state that progress depends on.
- **`illustrative`** works as on the toys, by attribute or frontmatter.

First uses, in *What is an LLM, really?*: lesson 2 plays the five-move
loop (`:::steps`, `loop`), and lesson 6 plays a tiny context window
filling up (`:::flow`, capacity 12, illustrative). `:::marbles` has no
honest use in that course: its lessons have no tool calls and no timing
worth plotting, and a token stream is already `:::nexttoken`. It waits
for the agent courses (one agent turn: prompt, tool call, result,
answer), which is the styleguide's specimen.

## Rejected

- **An SVG for marbles.** Text in a scaled SVG is unreadable at 360px.
  HTML with percent positions keeps the labels at a real size; the
  trade is that the author keeps events apart (12 per lane at most).
- **A ghost of every window state in flow.** The window as a separate
  box, with items moving in and out, needs a ghost of the largest
  subset. One track with a state per chip never changes size.
- **Live announcements while playing.** Reading a caption every 1.5 s
  (or every frame for marbles) drowns a screen reader; the caption is
  live only once the animation has stopped, as the toys do.
- **Autoplay under reduced motion, slowed down.** Reduced motion means
  no motion the reader did not ask for; the controls give the same
  content at the reader's pace.

## Consequences

- Browser JS per island (minified, gzip): steps 2.1 KB, flow 2.3 KB,
  marbles 2.4 KB, on modules the lesson page already loads (toy-panel,
  tool-button, icon, bit-cells, stable). Worker startup unchanged: the
  islands load with the lesson chunk (decision 052).
- Fixtures: `content/fixtures/toys/04-animation.md` builds clean;
  `content/fixtures/broken-toys/08-steps.md`, `09-flow.md` and
  `10-marbles.md` hold each block's errors, pinned in
  `compile/build.test.ts`.
- `app/a11y.test.e2e.ts` audits lessons 2 and 6 at rest and the three
  blocks in a chosen state (a step picked, a full window, the timeline at
  its end).
- The `/author` block reference lists the three blocks.
