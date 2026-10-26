# Course → `/courses/:course`

Artboard: `docs/design/artboards/Course.dc.html` (1440 × 1800, not interactive). Title "Latent — Tokens & temperature" → **"Tokens & temperature · Bits"**.

Access: public. Syllabus with each lesson's state, outcomes, progress ring and badge preview. Lesson state comes from progress (local for anonymous users → ProgressStore island hydrates node states; server renders "not started" for anonymous visitors or reads synced progress for signed-in users).

## "latent" → "bits"

- `<title>` (line 5); app-bar wordmark (line 32).

## Structure

### 1. AppBar `app` (lines 28–41)

Artboard: `background:rgba(7,8,13,0.82); border-bottom:1px solid rgba(255,255,255,0.07)`, not sticky. Canonical: sticky glass bar (Catalog). Nav: **Courses**, **My learning** (current in artboard — but this page is a course, see README), **Write a course**. Right: AvatarButton **JP** only (`margin-left:auto`). Canonical: XpPill + StreakPill + AvatarButton.

### 2. Hero (lines 44–76)

`<section style="border-bottom:1px solid rgba(255,255,255,0.07); background:repeating-linear-gradient(115deg, rgba(61,227,255,0) 0 22px, rgba(61,227,255,0.06) 22px 23px), #07080D">` — the stripe uses the course colour (ion here).

Inner `max-width:1280px; margin:0 auto; padding:56px 32px 64px; display:flex; flex-wrap:wrap; gap:48px; align-items:center`.

Left (`flex:999 1 560px; min-width:0; flex column; gap:22px`):
1. Breadcrumb: **Courses** / **Foundations** (track colour ion — note the course is Foundations but the course colour is ion; use the *course* colour for consistency with the hero).
2. `<h1>` `display-course` (`clamp(40px, 5.6vw, 76px)`, lh .98, ls -0.045em): **"Tokens &<br>temperature"** (the `<br>` is a design choice for this title; for arbitrary titles use `text-wrap:balance` and no forced break).
3. Lead 19/1.6 `#B4B9CA`, max-width 600: **"Why the same prompt gives different answers — and how to dial randomness up or down on purpose. You'll tokenize sentences, read probability tables and tune a chatbot from boring to unhinged."**
4. MetaTags (`gap:8px; flex-wrap:wrap; font:13px Geist Mono`): **Beginner**, **8 lessons**, **~50 min**, **text + video** (ion variant).
5. Actions (`gap:14px; flex-wrap:wrap; padding-top:6px`): Keycap primary `xl-54` (`padding:0 24px`) **"Resume lesson 6 →"**; ghost-mono link (`min-height:54px; padding:0 20px; border-radius:13px; border:1px solid rgba(255,255,255,0.14); font:15px Geist Mono; gap:10px`) with inline play icon ion **"Watch the 90-second intro"** (only if the course has an intro video; links to lesson 1 `?mode=watch` or a course-level video).

Right (`flex:1 1 320px; display:flex; justify-content:center`): CourseArt (components §9.8): 340px square, radius 28, stripes `rgba(61,227,255,0.28)`, border ion .3, glow; sigil **T°** 128px; chip `5/8 · 62%`.

Primary CTA label by state: not started → **"Start lesson 1 →"**; in progress → **"Resume lesson {n} →"**; complete → **"Review the course →"** (proposed; only the in-progress label is drawn).

### 3. Body (lines 79–178)

`max-width:1280px; margin:0 auto; padding:56px 32px 96px; display:flex; flex-wrap:wrap; gap:40px; align-items:flex-start`.

#### 3a. `<main>` (`flex:999 1 560px; min-width:0; flex column; gap:40px`)

**Outcomes** (`<section>` gap 16): MonoHeading **"By the end you'll be able to"**; grid `repeat(auto-fit, minmax(min(220px, 100%), 1fr)); gap:12px` of OutcomeCards:
- **01** "Predict roughly how many tokens a prompt will cost."
- **02** "Explain why a model “chooses” one word over another."
- **03** "Pick a temperature for a task and defend it."

**Syllabus** (`<section>` gap 8): MonoHeading **"Syllabus"** (`margin:0 0 8px`) + SyllabusModules (components §10.2) with the ResumeCallout under the current lesson. Data (script lines 184–214, verbatim):

```json
{
  "kinds": {
    "chat":    { "t": "▸ chat",    "c": "#9AA0B4" },
    "type":    { "t": "› type",    "c": "#C6FF3D" },
    "video":   { "t": "▶ video",   "c": "#3DE3FF" },
    "code":    { "t": "{ } code",  "c": "#9D85FF" },
    "project": { "t": "◆ project", "c": "#9D85FF" }
  },
  "modules": [
    { "n": "M1", "title": "How text becomes numbers", "trace": "#C6FF3D", "lessons": [
      [1, "What is a token?", "done", 6, 30, ["chat","type","video"]],
      [2, "Tokenizers are weird", "done", 5, 30, ["chat","type"]],
      [3, "Counting tokens (and cost)", "done", 6, 40, ["chat","type","video"]] ] },
    { "n": "M2", "title": "Picking the next word", "trace": "linear-gradient(#C6FF3D 55%, rgba(255,255,255,0.12) 55%)", "lessons": [
      [4, "Probabilities, not answers", "done", 7, 40, ["chat","video"]],
      [5, "Greedy vs. sampled", "done", 6, 40, ["chat","type"]],
      [6, "Temperature & randomness", "current", 7, 40, ["chat","type","video"]] ] },
    { "n": "M3", "title": "Putting it together", "trace": "rgba(255,255,255,0.12)", "lessons": [
      [7, "Top-p and friends", "next", 6, 40, ["chat","type","video"]],
      [8, "Checkpoint: tune a chatbot", "next", 10, 60, ["project","code"]] ] }
  ]
}
```
Lesson tuple = `[n, title, state, mins, xp, kinds]`. Derived per row: `fg = done ? "#9AA0B4" : "#ECEEF5"`, `weight = current ? 600 : 400`, `rowBg = current ? "rgba(61,227,255,0.06)" : "transparent"`. Row text: `"{n}. {title}"` and `"{mins} min · +{xp}"`.

Modules are not in the course frontmatter spec (handoff lists only `order`). Either add an optional `module` field to lesson frontmatter or render a single flat list (one module, no header) when absent — flag for product.

ResumeCallout copy: **"You stopped at the exercise: <span #ECEEF5>make the model write the same tagline at temperature 0 and 1, then explain the difference.</span>"** · Keycap `m` **"Pick up here →"** · **"your draft prompt is saved"**.

#### 3b. `<aside>` (`flex:1 1 300px; min-width:0; flex column; gap:16px`)

1. Progress card (SectionCard 24/20, gap 18):
   - Row `gap:18px`: ProgressRing 96 ion **62%** (`aria-label="62 percent complete"`) + text (gap 4): **"5 of 8 lessons"** (16px 600) / **"about 20 min to go"** (14px `#9AA0B4`).
   - Badge preview row (`gap:12px; padding:14px; border-radius:14px; background:#0A0C14`): HexBadge `preview` 40px **T°** + **"Temperature tamer"** (14px 600) / **"badge + 320 neurons on finish"** (13px `#9AA0B4`).
2. HowYoullLearn: **"HOW YOU'LL LEARN"**; `8` volt "chat lessons — every one"; `6` volt "typed prompt exercises"; `5` ion "optional videos"; `1` synapse "checkpoint project".
3. SourceCard (dashed): **"SOURCE"** / **"This course is 9 markdown files. Spot a typo? Fix it in one pull request."** / link **"courses/tokens-temperature/ →"** (→ repo URL or `/author/:course` for owners) / **"Written by [AUTHOR NAME] · updated [DATE]"** (fill from `authors[]` and the published version date).

## Interactive states

| Element | Trigger | Result |
|---|---|---|
| SyllabusRow | hover | bg `rgba(255,255,255,0.03)` (.15s) |
| Current node | always | ion pulse (`0 0 0 0 → 9px`, 2s). Canonical 8px |
| Keycaps | hover/active | standard |
| Ghost link | hover | (proposed) ghost hover |
| Breadcrumb/source links | hover | `#E2FF8F` |

## Responsive

- Hero wraps: art drops below the text at < ~930px (560 + 48 + 320).
- Body wraps: aside drops below main at < ~900px.
- **360px**:
  - Hero padding `56px 32px 64px` → `32px 16px 40px`; gap 48 → 28; h1 clamps to 40px; lead 19 → 17px; MetaTags wrap; both CTAs full width.
  - CourseArt: `width:100%` (328px), sigil `clamp(88px, 30vw, 128px)`; put it **above** the text (`order:-1`) or hide it and rely on the ring in the aside — recommended: keep it below, max 240px square, centred.
  - Body padding `56px 32px 96px` → `32px 16px 64px`; gap 40 → 28.
  - Outcomes 1-up.
  - Syllabus row: node slot 40 + gap 16; title wraps; the `mins · +xp` column moves under the kinds row (`flex-wrap:wrap` on the row, xp `flex-basis:100%; padding-left:56px`). Trace line stays at `left:19px`.
  - ResumeCallout `margin-left:0`; keycap full width.
  - Aside cards full width; progress card row stays horizontal (96px ring + text).

## Accessibility

- `<h1>` course title; MonoHeadings are `<h2>`; module titles `<h3>`.
- Each module list `<ol>`; current row `aria-current="step"`; node state text for SR ("completed", "in progress", "not started").
- Ring has `role="img"` + label; trace lines `aria-hidden`.
- Pulse stops under reduced motion.
- Muted rows (`#9AA0B4` done titles) 7.7:1 — OK.
