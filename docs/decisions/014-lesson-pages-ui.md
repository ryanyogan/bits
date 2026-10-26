# 014. Lesson pages: Read, Watch, Terminal and the author preview (UI build)

Status: Accepted (2026-10-26)

## Decision

- **One lesson page, three modes.** `/courses/:course/:lesson?mode=read|watch|terminal`
  renders `actions/courses/lesson/lesson-page.tsx`. Modes are links (no JS);
  Watch is offered only when the lesson has a video and `?mode=watch` falls
  back to Read otherwise. `/author/:course/preview/:lesson` renders the same
  `LessonPage` with a Draft banner ("DRAFT · vN preview — not visible to
  learners"); signed-out visitors are redirected to log in.
- **Content is a typed block list.** `lesson/content.ts` mirrors the compiled
  lesson JSON from the content pipeline (markdown, prompt, code, quiz, odds,
  tokenizer, terminal blocks); `lesson/fixtures.ts` holds the Temperature,
  What is a token and The loop lessons until the pipeline lands. Each mode
  renders the same blocks: Read chat-style, Terminal as a CLI log.
- **Page overrides live in the `app` layer.** Each `css()` mixin gets its own
  `rmx` sublayer, so a page mixin can't restyle another component's markup
  (decision 007). The lesson page ships a small static `@layer app` `<style>`
  (via `unsafeHTML`, since `<style>{text}</style>` escapes `>`) for the volt
  progress segment and for laying out the VideoPlayer's player + transcript
  in the Watch row (`display: contents`).
- **"Passed" is a CSS marker, not a DOM write.** Hydration resets attributes on
  server-rendered `<html>`, so `LessonComplete` renders a hidden
  `[data-lesson-passed]` span once the checks pass, and static parts (outline
  node, progress segment) restyle via `:root:has([data-lesson-passed])`.
  Passes are remembered per course+lesson in localStorage
  (`bits:passed:<course>/<lesson>`) until progress is saved server-side.
- **Quizzes in Read mode are GET forms** (`?quiz-<id>=<key>`), so they work
  without JS; Terminal mode's quiz is a TerminalLog entry with option buttons.
- **Shared component changes (backward compatible).** `LessonBar`: `titleAs`
  (`h1` on lesson pages), an `xp` slot, and a two-row ≤480px layout (back +
  title, then tabs + progress; 111px tall at 360px). `PromptComposer`:
  `defaultDraft`, and no focus glow on the inner textarea. `TerminalLog`:
  `quiz` entries, optional `replies`, and a `prompt` exercise (live checks,
  temperature chips, canned example output, reward) sharing the composer's
  `bits:draft:<id>` draft so switching modes keeps it.

## Consequences

- When compiled lesson JSON exists, swap `getLessonContent()` for the real
  loader; the block types are the contract.
- "Lesson complete" is client-only for now; without JS a gated lesson stays
  disabled (the checks need JS anyway).
