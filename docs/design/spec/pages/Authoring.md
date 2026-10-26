# Authoring → `/author` and `/author/:course`

Artboard: `docs/design/artboards/Authoring.dc.html` (1440 × 1700, not interactive). Title "Latent — write a course" → **"Write a course · Bits"** (`/author`), **"{course} · Authoring · Bits"** (`/author/:course`).

Access: `author` role (and `admin`). The artboard combines both routes on one screen. Split:

| Route | Sections from the artboard |
|---|---|
| `/author` | Header, Upload (DropZone + RepoSyncCard), **list of the author's courses** (not drawn — see below), Block reference |
| `/author/:course` | Header (course name), Validation report with **Preview draft** + **Publish v{n}**, Source + Preview, Block reference (collapsible) |

## "latent" → "bits"

- `<title>` (line 5); app-bar wordmark (line 31).

## Structure (artboard order)

### 1. AppBar `app` (lines 27–40)

Nav: **Courses**, **My learning**, **Write a course** (current). AvatarButton **JP**.

### 2. `<main>` (line 42)

`max-width:1280px; margin:0 auto; padding:56px 32px 96px; display:flex; flex-direction:column; gap:40px`.

#### 2a. Header (lines 44–50)

`display:flex; justify-content:space-between; align-items:flex-end; gap:32px; flex-wrap:wrap` → `flex column; gap:14px; max-width:720px`:
- Eyebrow volt (no transform, literal caps, 13px ls .14em) **"AUTHORS"**
- `<h1>` `display-l` **"Courses are just markdown."**
- Lead 18/1.6 `#B4B9CA`: **"A folder of <code #ECEEF5>.md</code> files plus a few <code volt>:::blocks</code> for the interactive bits. Push to GitHub or drop the folder here — it's validated, built and published."**

On `/author/:course` replace with: eyebrow "AUTHORS / {course-slug}" and h1 = course title.

#### 2b. Upload (lines 53–72)

Grid `repeat(auto-fit, minmax(min(380px, 100%), 1fr)); gap:16px`:
1. DropZone (components §7.6): **"Drop a course folder or .zip"** / **"markdown + images + videos · videos go to storage, the rest is parsed"**. Uploads to `POST /api/author/upload`; videos request `POST /api/author/video-upload-url` and upload directly (tus > 200MB).
2. RepoSyncCard (components §13.5): **"Or sync a repo"** · **"● connected"** · fields **Repository** `[org]/courses`, **Branch** `main` · **"Every push to <code>main</code> rebuilds changed courses. Pull requests get a preview link."**

#### 2c. Validation report (lines 75–92) — `/author/:course`

SectionCard (24/20, gap 18):
- Header row (`gap:14px; flex-wrap:wrap`): mono 15px `#ECEEF5` **"tokens-temperature/"** · mono 12px `#9AA0B4` **"9 files · last push 4 min ago"** · right (`margin-left:auto; gap:10px`): ghost-mono link (44px, radius 12, 13px) **"Preview draft"** → `/author/:course/preview/:firstLesson`; Keycap primary `m-44` (`padding:0 18px; font:500 13px`) **"Publish v4"**.
- Items grid `repeat(auto-fit, minmax(min(280px, 100%), 1fr)); gap:8px; font:13px Geist Mono` (ValidationItem):
  - ✓ **course.md frontmatter valid**
  - ✓ **8 lessons, order 1–8, no gaps**
  - ✓ **6 prompt blocks, each has a check**
  - ✓ **4 of 5 videos uploaded**
  - ! **07-top-p.md → video not found: top-p.mp4** (warning)
  - ✓ **regex checks compile**

Per handoff: errors block publishing (bad/missing frontmatter, duplicate `order`, `:::prompt` without checks, bad or catastrophic regex, unknown block); warnings don't (missing video, lesson > 15 min, `:::code` without `lang`). Error items (not drawn) use the proposed danger recipe and disable Publish (`aria-disabled="true"`, keep focusable, with text "Fix {n} error(s) to publish" under the button, 12px, danger colour). Build states (not drawn): "building…" LiveDot ion in the header; "build failed" danger item with the parser message.

Publish flow (not drawn): Publish → confirm inline (keycap label becomes "Publish v4 — confirm?" for 4s) or a native `<dialog>`; on success, header shows LiveDot volt "● live · v4" and a "Roll back to v3" ghost link (handoff: rollback = pointer flip).

#### 2d. Source + preview (lines 95–180)

`<section style="display:flex; flex-wrap:wrap; gap:16px; align-items:stretch">`:
1. FileTree (components §13.2), verbatim:

```
courses/
  tokens-temperature/
    course.md                  (ion)
    01-what-is-a-token.md
    02-tokenizers.md
    …
    06-temperature.md          (selected)
    07-top-p.md
    08-checkpoint.md
    assets/                    (#9AA0B4)
      06-temperature.mp4
      cover.svg
```
2. SourceViewer: header **"06-temperature.md"** / **"markdown"**; body verbatim:

```md
---
title: Temperature & randomness
order: 6
minutes: 7
xp: 40
video: assets/06-temperature.mp4
---

Last lesson you saw that a model never picks
**the** next word. It gives every token
a probability, then rolls a weighted die.

:::odds{prompt="Moon café tagline:" slider}
 Brew   3.1
 One    2.4
 Lunar  1.9
:::

:::prompt{id="moon-tagline" xp=40}
Ask for a **tagline for a coffee shop on
the moon** with a length limit.

- check "Asks for a tagline"   /tagline|slogan/i
- check "Sets a length limit"  /\bwords?\b|under/i
- run   temperature=[0, 1.0]
:::

:::quiz
What does temperature change?
- [ ] How long the answer is
- [x] How spread out the odds are
:::
```
   Colours: `---` `#7A8098`; keys `#3DE3FF`; `**…**` `#ECEEF5` w600; `:::name` and `:::` `#C6FF3D`; `{…}` `#B9A6FF`; `- check`/`- run` `#9D85FF`; rest `#C6CAD6`.
3. Preview pane (`background:#07080D`): header **"Preview"** / **"● live"**; body (gap 16): mini TutorMessage (26px blank volt avatar, 15px/1.65) "Last lesson you saw that a model never picks **the** next word. It gives every token a probability, then rolls a weighted die."; mini OddsBars (`margin-left:38px; padding:14px; radius 14; border rgba(61,227,255,0.28); bg #0E1018; 12px mono`) rows **Brew** 62% ion, **One** 26% ion .45, **Lunar** 12% ion .45 + text **"temperature ━━━━━━○━━━ 0.70"**; mini composer (border volt .4, radius 14, padding 14, gap 10) tag **"Your turn · +40"**, task "Ask for a **tagline for a coffee shop on the moon** with a length limit.", check chips **○ Asks for a tagline**, **○ Sets a length limit**, **○ Run at 0 and 1.0**; quiz card **"What does temperature change?"** · **◯ How long the answer is** · **◯ How spread out the odds are**.

   The preview reuses the real lesson components at a smaller scale (wrap in a container with `font-size` scaling or render the actual Lesson components with a `compact` prop). Source and preview are static (server-rendered from the latest build); "● live" means "latest build", not live editing (no WYSIWYG in v1).

#### 2e. Block reference (lines 183–205)

MonoHeading **"THE BLOCKS"** + BlockTable (components §13.4) with headers **Block / Attributes / Renders as**; rows (script lines 213–221):

```json
[
  { "name": "plain markdown", "attrs": "—", "what": "A tutor message in chat mode, a comment block in terminal mode." },
  { "name": ":::prompt", "attrs": "id, xp, model?, temperature?", "what": "The “Your turn” composer. Each “- check” line is a live goal; “- run” requires specific runs before it passes." },
  { "name": ":::code", "attrs": "file, lang, copy, type-mode, highlight=\"12-32\"", "what": "The editor: tabs, syntax highlighting, copy button, optional retype-it mode." },
  { "name": ":::quiz", "attrs": "id, xp", "what": "Single or multiple choice, marked with [x]. Explanations go under each option." },
  { "name": ":::odds / :::tokenizer", "attrs": "prompt, slider", "what": "Built-in toys: next-token probability bars, live tokenizer." },
  { "name": ":::terminal", "attrs": "cmd", "what": "A scripted run log shown in the output panel." },
  { "name": "video: (frontmatter)", "attrs": "path, chapters?", "what": "Turns on the Watch tab. Lessons without it stay text-only." }
]
```
Handoff lists `:::quiz` attrs as `id, xp, multiple?` and `:::tokenizer` as `sample?` — update the table copy to match the handoff.

## Not drawn: `/author` course list

Between Upload and Block reference, a MonoHeading **"YOUR COURSES"** + list of CourseRow-style links (components §9.9) to `/author/:course`: thumb (cover pattern) · title (16px 600) + meta mono 12px `#9AA0B4` "v4 live · 9 files · last push 4 min ago" · status MetaTag: volt "live", ion "draft", warn "1 warning", danger "2 errors". Empty: EmptyState "No courses yet. Drop a folder above or connect a repo."

## Interactive states

| Element | Trigger | Result |
|---|---|---|
| DropZone | hover / dragover | border `rgba(198,255,61,0.7)`, bg `rgba(198,255,61,0.04)` (.2s) |
| Repo fields | focus | border `rgba(198,255,61,0.7)` (add glow) |
| Publish | hover/active | keycap; disabled when errors |
| Preview draft | hover | ghost hover |

## Responsive

- Upload grid 2-up ≥ 776px, else stacked.
- Source + preview: FileTree (`flex:1 1 240px; max-width:300px`), source and preview (`flex:999 1 420px`) wrap into rows.
- **360px**:
  - Main padding `56px 32px 96px` → `32px 16px 64px`; gap 40 → 28.
  - DropZone `min-height:240px` → 180px, padding 20; drag-and-drop is rare on phones — label copy stays, tapping opens the file picker (`.zip` only; folder pick isn't supported on mobile Safari).
  - Validation header: path + meta on one line each; buttons full width (`flex:1`) on their own row.
  - FileTree `max-width:none`; collapse into `<details>` "Files (9)".
  - Source `<pre>` scrolls horizontally; Preview below it.
  - BlockTable scrolls horizontally inside its rounded wrapper (min-width 760); alternatively render as a definition list at ≤480px.

## Accessibility

- DropZone label includes the input; announce upload/build progress via `aria-live`.
- Validation list: SR prefixes "Passed:", "Warning:", "Error:" (the ✓/! glyphs are not enough).
- `<pre>` and table wrappers `tabindex="0"` with labels for keyboard scrolling.
- Contrast: warn text `#FFD08A` on its tint 11.65:1 — OK; `#B9A6FF` on `#0A0C14` 9.26:1 — OK.
