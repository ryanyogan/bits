# 061. Lists, ``` samples and ### subheadings in lesson prose

Status: Accepted (2026-10-29). Amends 018 (content pipeline) and 053
(lesson depth: what a depth block holds, and when it needs `::::`).

## Context

Lesson prose took paragraphs and inline markdown only. Lists, headings and
bare code fences were build errors (018), so the engineer depth (053) had
no way to list steps or show a three-line sample. The one code construct,
`:::code`, is the full editor (tabs, drafts, type mode), and inside a depth
block it needs the longer `::::engineer … ::::` fence, which authors trip
over. Most engineer explanations want a short, static sample next to the
text, not an editor.

## Decision

Three markdown constructs become parts of a tutor turn, in source order next
to its paragraphs. The compiled `MarkdownBlock.paragraphs` is now `Prose[]`
(`lesson/content.ts`): a paragraph (`Inline[]`, as before), `{ heading }`,
`{ list, start?, items }` or `{ sample, lang, language }`. Paragraph-only
builds stored before this are the same JSON, so they still read; no
migration.

**Lists.** `-`/`*` and `1.` lists, with the inline markdown prose already
supports (strong, code, ==mark==, links under the same link rule) in each
item. An item holds paragraphs and at most one nested list, one level deep.
Errors at the item's line: a task item (`- [ ]`, which is `:::quiz`
syntax), a third level, an empty item, and anything else inside an item (a
``` sample, a heading, a quote): put it after the list. An ordered list
keeps its first number (`start`). Rendered as `<ul>`/`<ol>` in the tutor
column at the prose measure, with square markers (decision 047) in `--dim`
and mono numbers in `--muted`.

**``` samples.** A bare fenced block is a static, read-only sample: the
build highlights it with the same lexer as `:::code` (`compile/highlight.ts`)
and the page draws it with the editor's syntax colours (now shared as
`syntaxStyle` in `@bits/ui/lib/syntax`). `CodeSample` (`@bits/ui/code-sample`)
is a `<figure>`: a mono strip with the language name and a Copy key, then a
`<pre role="region" tabindex="0">` named "<Language> sample" that scrolls
sideways. The only JS is `CopyButton`, a small island (disabled until
hydrated, a status region for "Copied"). No tabs, drafts, type mode or Run
output: that stays `:::code`. Errors: an unclosed fence (remark would run it
to the end of the file or of its depth block), an empty one, and an
indented (four-space) code block, which is nearly always an accident.
Warnings: a language the highlighter doesn't know (plain text), text after
the language, and a sample over 40 lines (an editor reads better).

**Depth blocks.** A sample is markdown, not a directive, so `:::engineer`
holding prose, lists and samples needs only `:::`. The one exception is a
sample with a `:::` line in it (say, a sample of lesson markdown): remark
closes the depth block there, and the build says so at the sample's line
and asks for `::::engineer … ::::`. `:::code` and the toys inside a depth
block still need the longer fence (053).

**### subheadings.** Allowed, because lessons have no in-page outline or
heading anchors to disturb: the outline lists the course's lessons, and
nothing links into a lesson by heading. Only `###`; `#`, `##` and `####`
stay errors ("the lesson title is the page's heading"). A subheading ends
the current tutor turn and opens the next (an `::ask` line keeps its turn:
the subheading opens the answer). It renders as an `<h2>`, not an `<h3>`:
the page's `<h1>` is the lesson title, the rabbit hole and the outline are
`<h2>`s, so a lesson's own sections sit at that level; an `<h3>` would read
as a child of the outline's "Lessons" heading. Authors write `###` because
it reads as "a minor heading" in markdown and keeps `#`/`##` clearly
reserved. A subheading with nothing under it before the next block is a
warning.

**Reading time.** List items, subheadings and samples count their words
toward `minsByDepth` (053), so an engineer depth full of lists and samples
reads as longer.

Kept as they were: unknown directives, an unclosed `:::code`, prose links
other than `/courses/…` or `https`, raw HTML, tables, quotes, images and
footnotes, and every depth rule. Fixtures: `content/fixtures/prose/`
(valid, both depths) and `content/fixtures/broken-prose/` (one case per
error); the test-only `plain-course` lesson 2 uses them on a real page for
the controller and axe tests. The block reference on `/author` has a row
for each construct.

## Consequences

- Authors can write steps, options and short samples in prose, at either
  depth, without the `::::` fence.
- Every consumer of `MarkdownBlock.paragraphs` must handle the four part
  kinds (`Array.isArray(part)` is a paragraph). Today that is the Read
  renderer (`lesson/ui/prose.tsx`) and the reading-time count in the build.
- A copied sample is the build's text exactly; samples are never run.
