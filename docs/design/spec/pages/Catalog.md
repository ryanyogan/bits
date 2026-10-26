# Catalog → `/courses`

Artboard: `docs/design/artboards/Catalog.dc.html` (1440 × 1900, interactive). Title "Latent — browse courses" → **"Courses · Bits"**.

Access: public. Filters live in the URL: `?track=foundations|prompting|tools|agents&q=rag`. The Continue banner appears when there is any progress (local or synced). Signed-in users with `users.goals` get a suggested first course (no design — see "Not drawn" below).

## "latent" → "bits"

- `<title>` (line 5); app-bar wordmark (line 38).

## Structure

Root: `min-height:100vh; background:#07080D; color:#ECEEF5; font-family:Geist`.

### 1. AppBar `app` (lines 34–57)

Sticky glass bar (canonical): `position:sticky; top:0; z-index:5; background:rgba(7,8,13,0.82); backdrop-filter:blur(14px); border-bottom:1px solid rgba(255,255,255,0.07)`; inner `max-width:1280px; padding:14px 32px; gap:28px; flex-wrap:wrap`.
- Logo 26 / **"bits"** 17px.
- Nav: **Courses** (current: `#ECEEF5`, `border-bottom:2px solid #C6FF3D`, `aria-current="page"`), **My learning**, **Write a course**.
- Right (`margin-left:auto; gap:14px`): XpPill **1,240** · StreakPill **12** · AvatarButton **JP**. Signed out: "Sign in" NavLink + Keycap nav "Start free".

### 2. `<main>` (line 59)

`max-width:1280px; margin:0 auto; padding:56px 32px 96px; display:flex; flex-direction:column; gap:48px`.

#### 2a. Title + search (lines 62–73)

Row `display:flex; justify-content:space-between; align-items:flex-end; gap:32px; flex-wrap:wrap`:
- Left (`flex column; gap:14px`): Eyebrow volt **"All courses · free"**; `<h1>` `display-l` (`clamp(36px, 5vw, 64px)`, lh 1, ls -0.04em) **"Pick your next<br>rabbit hole."**
- Right: SearchField (`flex:0 1 440px`, 56px, radius 16, `#0E1018`), placeholder **"Search “agents”, “tokens”, “RAG”…"**, sr label **"Search courses"**, Kbd **⌘K**.

#### 2b. ContinueBanner (lines 76–90)

Shown when progress exists. Grid `repeat(auto-fit, minmax(min(320px, 100%), 1fr)); gap:0`, radius 22, border `rgba(61,227,255,0.3)`, bg `#0E1018`. Content:
- Art: `min-height:200px` stripes cover (`repeating-linear-gradient(115deg, rgba(61,227,255,0) 0 12px, rgba(61,227,255,0.3) 12px 13px), #0A0C14`) + sigil **T°** 88px stroke 1.5px ion.
- Body (`padding:28px 32px; gap:14px`): **"CONTINUE · LESSON 6 OF 8"** (12px mono ls .12em ion) · **"Tokens & temperature"** (Unbounded 700 28px ls -0.03em) · **"Up next: <span #ECEEF5>Temperature & randomness</span> · about 7 min"** (16px `#9AA0B4`) · progress row: bar 6px ion at **62%**, **"62%"** mono 13px ion, Keycap `m` **"Resume →"**.
- Links to the current lesson (`/courses/tokens-temperature/temperature-randomness`).

#### 2c. Filters + result count (lines 93–104)

Row `display:flex; justify-content:space-between; align-items:center; gap:16px; flex-wrap:wrap`:
- FilterPills (`gap:8px; flex-wrap:wrap`, group label "Filter by track"). Data:

```json
[["All","#ECEEF5"],["Foundations","#C6FF3D"],["Prompting","#3DE3FF"],["Tools","#9D85FF"],["Agents","#C6FF3D"]]
```
  Each: dot (7px, track colour) + label + count (mono 12px `#7A8098`). Counts in sample: All 8, Foundations 2, Prompting 2, Tools 2, Agents 2. Selected: bg/border `#ECEEF5`, text `#07080D`; unselected: border `rgba(255,255,255,0.14)`, text `#C6CAD6`; hover border `rgba(255,255,255,0.3)`. Implement as links `?track=<slug>` (All = no param), preserving `q`.
- Result label mono 13px `#9AA0B4`: **"{n} course(s) · all free"** (`"8 courses · all free"`; singular "1 course · all free"). Put it in `aria-live="polite"`.

#### 2d. Course grid (lines 107–143)

`display:grid; grid-template-columns:repeat(auto-fill, minmax(min(290px, 100%), 1fr)); gap:20px` → CourseCards (components §9.2) + trailing WriteCourseCard (`/author`) **"+ .md"** / **"Write a course"** / **"Courses are plain markdown files with a few special blocks. Drop a folder, get a course."**

Sample data (script lines 162–187, verbatim):

```json
[
  { "title": "What is an LLM, really?", "track": "Foundations", "level": "Beginner", "lessons": 8, "mins": 45, "sigil": "LLM", "color": "#C6FF3D", "formats": ["text","video"], "pct": 100,
    "desc": "What happens between your prompt and the answer — explained with toys, not equations.",
    "cover": "radial-gradient(rgba(198,255,61,0.45) 1.2px, transparent 1.6px) 0 0 / 14px 14px, #0A0C14" },
  { "title": "Tokens & temperature", "track": "Foundations", "level": "Beginner", "lessons": 8, "mins": 50, "sigil": "T°", "color": "#3DE3FF", "formats": ["text","video"], "pct": 62,
    "desc": "Why the same prompt gives different answers, and how to dial randomness up or down.",
    "cover": "repeating-linear-gradient(115deg, rgba(61,227,255,0) 0 12px, rgba(61,227,255,0.3) 12px 13px), #0A0C14" },
  { "title": "Prompting that works", "track": "Prompting", "level": "Beginner", "lessons": 10, "mins": 70, "sigil": "›_", "color": "#C6FF3D", "formats": ["text","video"], "pct": 0,
    "desc": "Roles, examples and structure. Write a prompt, run it, see what each change does.",
    "cover": "linear-gradient(rgba(198,255,61,0.22) 1px, transparent 1px) 0 0 / 100% 18px, #0A0C14" },
  { "title": "Context is everything", "track": "Prompting", "level": "Intermediate", "lessons": 7, "mins": 55, "sigil": "[ctx]", "color": "#3DE3FF", "formats": ["text"], "pct": 0,
    "desc": "What fits in the window, what falls out, and how to pack it so the model notices.",
    "cover": "linear-gradient(90deg, rgba(61,227,255,0.28) 1px, transparent 1px) 0 0 / 22px 100%, linear-gradient(rgba(61,227,255,0.28) 1px, transparent 1px) 0 0 / 100% 22px, #0A0C14" },
  { "title": "Give your model tools", "track": "Tools", "level": "Intermediate", "lessons": 9, "mins": 80, "sigil": "fn()", "color": "#9D85FF", "formats": ["text","code"], "pct": 0,
    "desc": "Describe a function, let the model call it, feed back the result. Build a weather bot.",
    "cover": "repeating-radial-gradient(circle at 85% 110%, transparent 0 14px, rgba(157,133,255,0.42) 14px 15px), #0A0C14" },
  { "title": "Retrieval without tears", "track": "Tools", "level": "Intermediate", "lessons": 8, "mins": 75, "sigil": "RAG", "color": "#9D85FF", "formats": ["text","code","video"], "pct": 0,
    "desc": "Search your own docs, hand the best bits to the model, and cite where they came from.",
    "cover": "radial-gradient(rgba(157,133,255,0.5) 1.4px, transparent 1.8px) 0 0 / 18px 18px, radial-gradient(rgba(157,133,255,0.25) 1px, transparent 1.4px) 9px 9px / 18px 18px, #0A0C14" },
  { "title": "Your first agent loop", "track": "Agents", "level": "Intermediate", "lessons": 10, "mins": 90, "sigil": "loop", "color": "#C6FF3D", "formats": ["text","code","video"], "pct": 10,
    "desc": "Plan, act, observe, repeat. Write the 30 lines of code every agent is built on.",
    "cover": "repeating-conic-gradient(from 0deg at 50% 120%, rgba(198,255,61,0.28) 0 2deg, transparent 2deg 12deg), #0A0C14" },
  { "title": "Ship an agent to the edge", "track": "Agents", "level": "Advanced", "lessons": 8, "mins": 85, "sigil": "edge", "color": "#3DE3FF", "formats": ["text","code"], "pct": 0,
    "desc": "Take your agent from a script to a deployed endpoint with memory, limits and logs.",
    "cover": "repeating-linear-gradient(45deg, rgba(61,227,255,0.22) 0 1px, transparent 1px 16px), repeating-linear-gradient(-45deg, rgba(61,227,255,0.22) 0 1px, transparent 1px 16px), #0A0C14" }
]
```

Derived: `trackUp = track.toUpperCase()`, `done = pct >= 100` (DoneTag), `started = 0 < pct < 100` (progress bar), `pctW = pct + "%"`.

Filtering (prototype logic, do it server-side): track equality; query = case-insensitive substring of `title + " " + desc + " " + track + " " + sigil`.

#### 2e. Empty state (lines 145–150)

When no course matches: EmptyState (`padding:48px; border-radius:20px; border:1px dashed rgba(255,255,255,0.16)`) — **"0 results for “{q}”"** (mono 15px `#ECEEF5`) + **"Try “agents”, “tokens” or clear the filter."** (15px `#9AA0B4`). In the artboard the grid still renders the WriteCourseCard above it; keep that (an empty search is a nice moment to suggest authoring). Add a ghost link "Clear filters" → `/courses`.

## Interactive states

| Element | Trigger | Result |
|---|---|---|
| SearchField | focus-within | border `rgba(198,255,61,0.6)`, glow `0 0 0 4px rgba(198,255,61,0.1)` |
| SearchField | typing | server filter via GET (debounced auto-submit island optional); `⌘K`/`Ctrl K` focuses |
| FilterPill | click | navigates to `?track=`; selected style |
| FilterPill | hover | border `rgba(255,255,255,0.3)` |
| CourseCard | hover/focus | lift 6px, rotate -0.4deg, border volt .4, shadow; sigil scales 1.08 and rises 4px |
| ContinueBanner | hover | (proposed) border `rgba(61,227,255,.5)` + keycap lift |
| Keycap in banner | — | decorative span; the banner is the link |

## Not drawn (compose from existing parts)

- **Suggested first course** (from sign-up goals): a CourseCard variant pinned first with a MetaTag volt "Suggested for you", or a ContinueBanner variant with eyebrow "START HERE · BASED ON YOUR GOALS" and keycap "Start →". Show only when there is no progress (otherwise the Continue banner wins).
- **Signed-out with local progress**: same Continue banner, filled by the ProgressStore island from localStorage; server renders nothing (avoid layout shift by reserving no space; it's acceptable for the banner to appear after hydration — or render a skeleton only if a `has_progress` cookie hint exists).

## Responsive

- Grids are intrinsic: cards go 4-up at 1280, 1-up below ≈ 650px (`min(290px,100%)`).
- **360px**:
  - Main padding `56px 32px 96px` → `32px 16px 64px`; gap 48 → 32.
  - Title row stacks: h1 clamps to 36px ("Pick your next / rabbit hole." on 2–3 lines); SearchField full width (`flex:1 1 100%`), Kbd hidden.
  - ContinueBanner: art `min-height:200px` → 140px with sigil 64px; body padding `20px`; title 22px; progress row wraps — bar full width, then % + keycap on the next line (keycap `margin-left:auto`).
  - Filters: horizontally scrollable single row (`flex-wrap:nowrap; overflow-x:auto; scroll-snap-type:x proximity; margin:0 -16px; padding:0 16px`) instead of wrapping into 3 rows; result label below on its own line.
  - CourseCard: full width (328px), cover 170 → 150px.
  - WriteCourseCard: `min-height:auto`.
  - EmptyState padding 48 → 28px.
  - App bar: per components §3.1 (nav scrolls under logo row; XpPill/StreakPill keep numbers).

## Accessibility

- `<h1>` "Pick your next rabbit hole."; each card title `<h2>` or `<h3>` (add a visually hidden `<h2>Courses</h2>` before the grid).
- Search inside `<form role="search">`.
- Filter links: `aria-current="true"` on the active one; the count inside each pill needs SR context ("8 courses").
- Cover sigils and patterns are `aria-hidden`.
- Contrast: selected FilterPill count `#7A8098` on `#ECEEF5` = 3.37:1 (fails) and the "All" dot is invisible when selected — fix per components §6.2c.
