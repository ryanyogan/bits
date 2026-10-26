# 021. Lesson toys: nexttoken, training, attention, compare, rabbithole

Status: Accepted (2026-10-26)

## Context

The entry course ("What is an LLM, really?") needs small interactive
pictures of how a model works, plus a short "go deeper" list per lesson.
They must follow the existing block pattern (decision 018): authored as
markdown directives with plain-line bodies, validated with file:line
errors, rendered on the server, and enhanced with small islands.

## Decision

Five new blocks, each with a `LessonContent` type (`lesson/content.ts`), a
compiler case (`content/compile/lesson.ts`), Read-mode and Terminal-mode
rendering, a component in `packages/ui`, a styleguide entry (`#sg-toys`)
and tests.

| Directive | Body | Component | Kind |
|---|---|---|---|
| `:::nexttoken{prompt="…"}` | one line per step: `" Paris" 0.92 \| " the":0.03 " a":0.02` | `NextTokenPlayer` (`next-token.tsx`) | island |
| `:::training{prompt="…"}` | `- step 500 loss=6.1 "output"` | `TrainingScrubber` (`training-scrubber.tsx`) | island |
| `:::attention{caption="…"}` | a `tokens "The" " cat" …` line, then `- from=7 to=1 w=0.62` | `AttentionMap` (`attention-map.tsx`) | island |
| `:::compare{left="…" right="…"}` | `- prompt "…"`, `- left "…"`, `- right "…"` | `ComparePanel` (`compare-panel.tsx`) | static |
| `:::rabbithole` | `- video "Title" by="…" mins=8 url="https://…"`, `- read …`, `deep` | `RabbitHole` (`rabbit-hole.tsx`) | static |

Shared rules:

- **Quoted strings** take `\"`, `\\` and `\n` (a line break). In
  `:::compare` a quoted string may also run over several source lines.
- **`illustrative`**: a bare attribute on `nexttoken`, `training`,
  `attention`, `compare` and `tokenizer`, or `illustrative: true` in the
  lesson frontmatter for every toy in the lesson (a block can opt out with
  `illustrative=false`). It shows an "illustrative" tag, so made-up numbers
  are never passed off as a real model's.
- **No-JS fallback** is the island's server render: the final sentence and
  a steps table (nexttoken), an ordered list of snapshots (training), a
  from → to (weight) table (attention). The island switches to the
  interactive view in its first client task.
- **Motion**: nexttoken autoplays once when 60% of it is on screen; under
  `prefers-reduced-motion` there is no Play button and no autoplay, only
  the step buttons. All transitions and the caret switch off too.
- **Per-lesson reset**: the islands sit inside the lesson `<main
  data-rmx-key={view.key}>` (decision 020), so client navigation to
  another lesson starts them fresh.
- **Shared visuals**: `OddsList` (`odds-list.tsx`) is the bar list
  `OddsBars` already drew, now shared with `NextTokenPlayer`. `ToyPanel`
  (`toy-panel.tsx`) is the odds panel frame plus the `IllustrativeTag`.

Validation (all errors with the source line): nexttoken odds in 0–1, each
line's total at most 1, no duplicate tokens, at most 60 steps; training
steps increasing, loss ≥ 0, 2–20 snapshots; attention indexes 0-based and
in range, `to ≤ from` (a token only looks back), weights in 0–1, no
duplicate pairs, at most 40 tokens (a warning when one token's weights add
up past 1); compare needs both labels and a left and right per row, at most
4 rows; rabbithole `https:` URLs only (no credentials), a title, an author,
`video` or `read`, at most 3 links. A link over 30 minutes is a deep dive
even without the `deep` flag.

Rabbit-hole links are plain links, not embeds: the CSP stays as it is and
no third-party JS loads. They open in a new tab with
`rel="noopener noreferrer"` and `data-rmx-document`.

## Consequences

- No attention arcs. At 360px the chips wrap onto several rows, where
  arcs between rows stop being legible, so the weight shows as a tint and
  a percentage on each chip instead.
- Browser JS per island (minified, gzip): next-token 2.2 KB, training
  1.9 KB, attention 2.0 KB, plus shared modules already mostly loaded on a
  lesson page (odds-list 1.0, toy-panel 1.0, tool-button 1.0, icon 1.5).
  No new dependencies.
- Fixtures: `content/fixtures/toys/` (every block, builds clean) and
  `content/fixtures/broken-toys/` (each block's validation errors), both
  covered by `compile/build.test.ts`.
