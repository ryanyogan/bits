# Bits components

One section per reusable component. Values are exact from the artboards; token names refer to `tokens.md`. Artboard abbreviations: Main, Auth, System, Catalog, Course, Lesson, Code (CodeLesson), Profile, Authoring.

**Island legend**: `static` = server-rendered HTML + CSS only (hover/focus via CSS); `island` = needs browser JS (hydrated through the app's browser entry); `progressive` = works as a plain form/link without JS, JS enhances it.

**Global rules for every component**

- Real `<button>`, `<a>`, `<input>`, `<label>` elements (handoff).
- Hit area ≥ 44×44px. Where the artboard is smaller this spec says so and gives the fix (usually extend the hit area with padding or a `::before` inset of `-Npx`, keeping the visual size).
- Focus: `:focus-visible` ring from `tokens.md §8` on every interactive element.
- Wordmark text is **`bits`** everywhere the artboards say `latent`.
- All `aria-hidden` decorative SVGs keep `aria-hidden="true"` and `focusable="false"`.

Contents

1. Brand: LogoMark, Wordmark, GeneratedAvatar
2. Icons
3. Navigation: AppBar (marketing, app, lesson, terminal), NavLink, Breadcrumb, Footer, BackButton
4. Pills in the bar: XpPill, StreakPill, AvatarButton
5. Buttons: Keycap (primary, dark, ghost) + sizes, InverseKeycap, ToolButton, ProviderButton, Kbd
6. Selection: SegmentedTabs, Chip family (ChoiceChip, SuggestionChip, FilterPill, MetaTag, FormatTag, CoverTag, DoneTag, YourTurnTag), TemperaturePicker, QuizChoice
7. Inputs: TextField, SearchField, CodeEntry (6-digit), HeroPromptBar, DividerLabel, DropZone, Switch (proposed)
8. Labels and layout: Eyebrow, MonoHeading, SectionCard, GlassCard, StatTile, KeyValueList, EmptyState, LiveDot, ScrollCue
9. Courses: CourseCover + Sigil, CourseCard, WriteCourseCard, ContinueBanner, CourseProgressBar, SegmentedProgress, ProgressRing, CourseArt, CourseRow, OutcomeCard, HowYoullLearn, SourceCard
10. Lessons: LessonNode, SyllabusModule + SyllabusRow, ResumeCallout, OutlineItem, TutorAvatar, TutorMessage, LearnerBubble, ModelOutput, PromptComposer, CheckChip, TokenPill + TokenizerPanel, OddsBars, RewardToast, CodeEditor, TerminalLog (+ TerminalInput, OutputPanel), VideoPlayer, Transcript
11. Progress & identity: HexBadge, BadgeChip, ActivityGrid, JournalEntry
12. Marketing: FeatureRow, TrackCard, ModeCard, LessonPreviewCard, ProgressShowcase, StageHud, NeuralField, BrainCanvas, SessionPanel
13. Authoring: ValidationItem, FileTree, SourceViewer, BlockTable, RepoSyncCard

---

## 1. Brand

### 1.1 LogoMark

Graph-of-nodes mark. Always `aria-hidden="true"` (the link around it carries the name).

```html
<svg width="30" height="30" viewBox="0 0 30 30" fill="none" aria-hidden="true">
  <path d="M7 7 L7 23 L23 23 M7 7 L23 13 L23 23" stroke="#ECEEF5" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" opacity="0.5"></path>
  <circle cx="7" cy="7" r="3" fill="#ECEEF5"></circle>
  <circle cx="7" cy="23" r="3" fill="#ECEEF5"></circle>
  <circle cx="23" cy="13" r="3" fill="#ECEEF5"></circle>
  <circle cx="23" cy="23" r="3.6" fill="#C6FF3D"></circle>
</svg>
```

| Prop | Values |
|---|---|
| `size` | 30 (Main nav), 28 (Auth), 26 (app bar). Footer has no mark |

Static. Used: Main, Auth, Catalog, Course, Profile, Authoring.

### 1.2 Wordmark

`<span>` text **`bits`** (artboards: `latent`). Unbounded 700, ls `-0.02em`, colour `--text`.

| Variant | Size | Where |
|---|---|---|
| `nav` | 20px | Main header |
| `auth` | 19px | Auth left panel |
| `app` | 17px | App bars |
| `footer` | 16px, no letter-spacing | Main footer |

Logo link: `<a href="/" style="display:flex; align-items:center; gap:10px; text-decoration:none; color:#ECEEF5">` + LogoMark + Wordmark. Accessible name comes from the wordmark text ("bits"); consider `aria-label="Bits home"`. Hit area: 26–30px tall visually — add `min-height: 44px` on the link (no visual change since it is flex-centred). Static.

Also the CodeLesson terminal prompt prefix (`<span style="color:#C6FF3D">latent</span>`) → `bits`.

### 1.3 GeneratedAvatar

148×148 SVG avatar, deterministic per user (Profile). Verbatim sample:

```html
<svg width="148" height="148" viewBox="0 0 148 148" role="img" aria-label="Jamie's generated avatar">
  <rect x="1" y="1" width="146" height="146" rx="36" fill="#0E1018" stroke="rgba(198,255,61,0.45)"></rect>
  <g stroke="rgba(236,238,245,0.35)" stroke-width="1.4">
    <path d="M40 46 L74 30 L108 52 L100 98 L64 112 L36 86 Z"></path>
    <path d="M40 46 L74 74 L108 52 M74 74 L100 98 M74 74 L64 112 M74 74 L36 86 M74 30 L74 74"></path>
  </g>
  <circle cx="74" cy="74" r="10" fill="#C6FF3D"></circle>
  <circle cx="40" cy="46" r="6" fill="#ECEEF5"></circle><circle cx="74" cy="30" r="5" fill="#3DE3FF"></circle><circle cx="108" cy="52" r="6" fill="#ECEEF5"></circle>
  <circle cx="100" cy="98" r="5" fill="#9D85FF"></circle><circle cx="64" cy="112" r="6" fill="#ECEEF5"></circle><circle cx="36" cy="86" r="5" fill="#3DE3FF"></circle>
</svg>
```

Note the outer `<path>` has no `fill` attribute → defaults to black fill. Set `fill="none"` on the `<g>` (the design intends outline only; on `#0E1018` a black hexagon is barely visible but is still wrong).

Props: `{ seed: string, name: string }`. Generation (proposed): hash the handle; jitter the six outer vertices ±6px, colour the outer dots from `[#ECEEF5, #3DE3FF, #9D85FF]`, centre always volt r10. Responsive: fixed 148px; at ≤480px scale to 96px. Static (server-rendered SVG).

---

## 2. Icons

All icons are inline SVG, `aria-hidden="true"`, colour via `stroke`/`fill` as given. Copy verbatim.

| Name | SVG | Used |
|---|---|---|
| `github` | `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ECEEF5" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="6" cy="5" r="2.2"></circle><circle cx="6" cy="19" r="2.2"></circle><circle cx="18" cy="8" r="2.2"></circle><path d="M6 7.2 V16.8 M18 10.2 C18 14 12 13 6.5 16.8"></path></svg>` (this is a git-branch glyph used as "GitHub"; Authoring uses it at 22px) | Auth, Authoring |
| `globe` (Google) | `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ECEEF5" stroke-width="1.8" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><path d="M3 12 H21 M12 3 C15 6 15 18 12 21 C9 18 9 6 12 3"></path></svg>` | Auth |
| `key` (passkey) | `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#C6FF3D" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="8" cy="9" r="4"></circle><path d="M11 12 L20 21 M16 17 L18.5 14.5 M18 20 L20 18"></path></svg>` | Auth |
| `mail` | `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#C6FF3D" stroke-width="1.8" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2.5"></rect><path d="M3.5 6.5 L12 13 L20.5 6.5"></path></svg>` | Auth (sent) |
| `search` | `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9AA0B4" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"></circle><path d="M20 20 L16 16"></path></svg>` | Catalog |
| `chevron-left` | `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="#ECEEF5" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M10 3 L5 8 L10 13"></path></svg>` | Lesson, Code |
| `play` (large) | `<svg width="20" height="22" viewBox="0 0 20 22"><path d="M3 2 L18 11 L3 20 Z" fill="#07080D"></path></svg>` (Main 20×22; Lesson 26×30 same viewBox) | Main, Lesson |
| `play` (inline) | `<svg width="12" height="14" viewBox="0 0 12 14" aria-hidden="true"><path d="M1 1 L11 7 L1 13 Z" fill="#3DE3FF"></path></svg>` | Course |
| `pause` | `<svg width="12" height="14" viewBox="0 0 12 14" aria-hidden="true"><rect x="1" y="1" width="3.5" height="12" rx="1" fill="#ECEEF5"></rect><rect x="7.5" y="1" width="3.5" height="12" rx="1" fill="#ECEEF5"></rect></svg>` | Lesson |
| `copy` | `<svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><rect x="4.5" y="4.5" width="8" height="8" rx="1.5"></rect><path d="M9.5 4.5 V2.5 A1 1 0 0 0 8.5 1.5 H2.5 A1 1 0 0 0 1.5 2.5 V8.5 A1 1 0 0 0 2.5 9.5 H4.5"></path></svg>` | Code |
| `check` | `<svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M2.5 7.5 L5.5 10.5 L11.5 3.5" stroke="#0A0C05" stroke-width="2" fill="none" stroke-linecap="round"></path></svg>` (Course: 13×13, stroke-width 2.2; Profile finished row: 26×26, stroke-width 2) | System, Course, Profile |
| `hex` | `<svg width="14" height="14" viewBox="0 0 22 22" aria-hidden="true"><path d="M11 1.5 L19.2 6.25 L19.2 15.75 L11 20.5 L2.8 15.75 L2.8 6.25 Z" fill="#C6FF3D"></path></svg>` (neuron/XP glyph) | Catalog, Lesson |
| `flame` (streak) | `<svg width="14" height="16" viewBox="0 0 14 16" aria-hidden="true"><path d="M7 1 C8 4 12 6 12 10 A5 5 0 0 1 2 10 C2 7.5 4 6.5 4.5 4.5 C5.5 6 6 6.5 7 1 Z" fill="#3DE3FF"></path></svg>` | Catalog |
| `tutor` | `<svg width="18" height="18" viewBox="0 0 18 18" fill="none"><circle cx="4" cy="4" r="2" fill="#0A0C05"></circle><circle cx="14" cy="4" r="2" fill="#0A0C05"></circle><circle cx="9" cy="14" r="2.4" fill="#0A0C05"></circle><path d="M4 4 L9 14 L14 4" stroke="#0A0C05" stroke-width="1.4"></path></svg>` | Main, Lesson |
| `folder-upload` | `<svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#C6FF3D" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 7 A2 2 0 0 1 5 5 H9 L11 7 H19 A2 2 0 0 1 21 9 V17 A2 2 0 0 1 19 19 H5 A2 2 0 0 1 3 17 Z"></path><path d="M12 10 V16 M9.5 12.5 L12 10 L14.5 12.5"></path></svg>` | Authoring |
| `hex-check` (reward) | `<svg width="40" height="40" viewBox="0 0 22 22" aria-hidden="true"><path d="M11 1.5 L19.2 6.25 L19.2 15.75 L11 20.5 L2.8 15.75 L2.8 6.25 Z" fill="#0A0C05"></path><path d="M7 11.5 L10 14 L15 8" stroke="#C6FF3D" stroke-width="1.8" fill="none" stroke-linecap="round"></path></svg>` (System 36px) | System, Lesson |
| Text glyphs | `›` prompt, `▍` caret, `↵` enter, `→` forward, `↗` share, `✓` done, `○` pending check, `◯` quiz option, `◆` tutor/project, `▸` chat, `▶` video/run, `{ }` code, `⌨` type mode, `●` live dot, `⌘K` kbd, `!` warning | everywhere |

Note: there is no real GitHub/Google brand logo in the designs; the glyphs above are abstract. Keep them (brand guidelines allow plain text buttons) or swap for official marks — flagged in README.

---

## 3. Navigation

### 3.1 AppBar

Four variants. All `<header>`; nav is `<nav aria-label="…">`.

**a) `marketing`** (Main)

- Inner: `max-width: 1280px; margin: 0 auto; padding: 22px 32px; display: flex; align-items: center; justify-content: space-between; gap: 20px; flex-wrap: wrap`. Transparent background (sits over the field). Not sticky.
- Left: Logo (mark 30, wordmark 20).
- Centre: `<nav aria-label="Primary" style="display:flex; gap:28px; flex-wrap:wrap; font-size:15px">` NavLinks (marketing colour `#B4B9CA`): "Courses" → `/courses`, "How it works" → `#how`, "The path" → `#path`, "For authors" → `/author`.
- Right: `display:flex; gap:12px; align-items:center` → NavLink "Sign in" (`font-size:15px; padding:12px 8px`) → `/login`; Keycap primary size `nav` "Start free" → lesson 1.
- Signed-in variant (not drawn): replace "Sign in"/"Start free" with XpPill + AvatarButton (as app variant).

**b) `app`** (Catalog, Course, Profile, Authoring)

- Outer `<header>`: Catalog = `position: sticky; top: 0; z-index: 5; background: rgba(7,8,13,0.82); backdrop-filter: blur(14px); border-bottom: 1px solid rgba(255,255,255,0.07)`. Course = same bg + border, not sticky, no blur. Profile/Authoring = border only. **Canonical: Catalog's sticky glass bar on all app pages.**
- Inner: `max-width: 1280px; margin: 0 auto; padding: 14px 32px; display: flex; align-items: center; gap: 28px; flex-wrap: wrap`.
- Logo (mark 26, wordmark 17).
- `<nav aria-label="App" style="display:flex; gap:22px; font-size:15px; flex-wrap:wrap">`: "Courses" `/courses`, "My learning" (Course artboard links it to a course; route it to `/me` or the last course — see README), "Write a course" `/author`. Each link `padding: 10px 0`. Current: `aria-current="page"; color: #ECEEF5; border-bottom: 2px solid #C6FF3D` (no class, so no hover). Others: NavLink app colour.
- Right group `margin-left: auto; display:flex; align-items:center; gap:14px`: XpPill, StreakPill, AvatarButton (Catalog). Course/Profile/Authoring show only AvatarButton (`margin-left:auto`). **Canonical: show XpPill + StreakPill + AvatarButton when signed in**; signed out: NavLink "Sign in" + Keycap `nav` "Start free".
- "Write a course" is shown to everyone in the designs; for learners it can go to `/author` landing (role-gated content) — product decision, see README.

**c) `lesson`** (Lesson)

- `position: sticky; top: 0; z-index: 5; background: rgba(7,8,13,0.88); backdrop-filter: blur(14px); border-bottom: 1px solid rgba(255,255,255,0.07)`.
- Inner full-bleed: `padding: 12px 24px; display: flex; align-items: center; gap: 20px; flex-wrap: wrap`.
- Children in order: BackButton → title block (`flex column; gap 2px; min-width 0`: mono 12px `#9AA0B4` "Tokens & temperature · Lesson 6 of 8"; Unbounded 500 17px ls -0.02em "Temperature & randomness") → SegmentedProgress (`flex: 1 1 160px; max-width: 280px; margin: 0 auto`) → SegmentedTabs `mode` → XpPill.

**d) `terminal`** (Code)

- `border-bottom: 1px solid rgba(255,255,255,0.07)` only (not sticky, no bg).
- Inner `padding: 12px 24px; display:flex; align-items:center; gap:20px; flex-wrap:wrap`: BackButton → title block (12px mono "Your first agent loop · Lesson 4 of 10"; 17px "The loop") → SegmentedTabs `mode` with `margin-left: auto`. No progress, no XpPill. **Canonical: use the lesson variant** (sticky, progress, XpPill) for Terminal mode too.

Responsive (all variants): the artboards just `flex-wrap`. At ≤820px: app nav becomes a horizontally scrollable row (`overflow-x: auto; scrollbar-width: none`) under the logo row, XpPill/StreakPill hide their labels (icon + number stay), keep AvatarButton. At ≤480px: lesson bar shows BackButton + title (truncate with `text-overflow: ellipsis`) + mode tabs on row 1, SegmentedProgress full width on row 2; XpPill moves into row 1 only if space, else hidden (the reward toast still reports neurons). Marketing: at ≤820px hide the centre nav into a `<details>` "Menu" disclosure (static, no JS) or a second scrolling row; keep "Start free".

A11y: one `<header>` landmark; `<nav>` has `aria-label`; current link `aria-current="page"`. Static (no JS). Sticky bars must not cover focused elements: add `scroll-padding-top: 72px` on `html` for app pages.

### 3.2 NavLink

| Variant | Rest | Hover | Size |
|---|---|---|---|
| `marketing` | `color: #B4B9CA` | `#ECEEF5` | 15px Geist; Main header links no padding; "Sign in" `padding: 12px 8px` |
| `app` | `color: #9AA0B4` | `#ECEEF5` | 15px; `padding: 10px 0` |
| `current` | `color: #ECEEF5; border-bottom: 2px solid #C6FF3D` | — | `padding: 10px 0` |
| `footer` | `#B4B9CA` | `#ECEEF5` | 14px |

`text-decoration: none; transition: color .15s`. Hit height: 15px text + 20px padding ≈ 39px → set `min-height: 44px; display: inline-flex; align-items: center` (bottom border still sits at the bottom). Static.

### 3.3 Breadcrumb

`<nav aria-label="Breadcrumb" style="display:flex; gap:10px; font-family: Geist Mono; font-size:13px; color:#9AA0B4">` → `<a href="/courses" style="color:#9AA0B4">Courses</a><span aria-hidden="true">/</span><span style="color:#3DE3FF">Foundations</span>`. The last crumb is the track (colour = track colour); mark it `aria-current="page"` if it is the page, otherwise make it a link to `/courses?track=foundations`. Link hover = global `a:hover{color:#E2FF8F}`. Course only. Static.

### 3.4 BackButton

`<a aria-label="Back to course" style="width:44px; height:44px; border-radius:12px; border:1px solid rgba(255,255,255,0.12); display:grid; place-items:center">` + `chevron-left` icon. Hover (not drawn): `background: rgba(255,255,255,.06)` (ghost hover). Lesson, Code. Static.

### 3.5 Footer

`<footer style="border-top:1px solid rgba(255,255,255,0.08); background:#07080D">` → inner `max-width:1280px; margin:0 auto; padding:36px 32px; display:flex; justify-content:space-between; align-items:center; gap:20px; flex-wrap:wrap`:
- Wordmark footer variant **"bits"**.
- `<nav aria-label="Footer" style="display:flex; gap:24px; flex-wrap:wrap; font-size:14px">` NavLinks: "Courses" `/courses`, "Write a course" `/author`, "Sign in" `/login`, "Profile" `/me`.
- `© 2026 [PLATFORM NAME]` mono 12px `#7A8098` → "© 2026 Bits".

Main only; recommended on all public pages. Static. At 360px items wrap into three rows; set footer nav links `min-height: 44px`.

---

## 4. Bar pills

### 4.1 XpPill (neurons)

`<span style="display:flex; align-items:center; gap:8px; padding:8px 12px; border-radius:999px; background:rgba(198,255,61,0.08); border:1px solid rgba(198,255,61,0.25); font-family:Geist Mono; font-size:13px; color:#E4FF9E">` + `hex` icon 14px (`fill:#C6FF3D`) + value (`1,240`).

Props `{ neurons: number }` (format with `toLocaleString('en-US')`). State: Lesson increments value when exercise passes (`1,240` → `1,280`); animate with a 400ms count-up or swap with `rise`. A11y: give it text for SR: `<span class="sr-only">neurons</span>` or `aria-label="1,240 neurons"` with `role="img"`; announce increase via the RewardToast live region instead. Catalog, Lesson. Static (value updated by the lesson island on pass).

### 4.2 StreakPill

`<span style="display:flex; align-items:center; gap:6px; font-family:Geist Mono; font-size:13px; color:#9AA0B4">` + `flame` icon + number `12`. No border/bg. Add SR text "12-day streak". Catalog. Static.

### 4.3 AvatarButton

`<a href="/me" aria-label="Your profile" style="width:40px; height:40px; border-radius:12px; background:#151826; border:1px solid rgba(255,255,255,0.12); display:grid; place-items:center; font-family:Unbounded; font-weight:700; font-size:13px; color:#C6FF3D">JP</a>`.

| State | Style |
|---|---|
| default | as above |
| current page (Profile) | `aria-current="page"; background:#C6FF3D; color:#0A0C05;` no border |
| hover (proposed) | border `rgba(255,255,255,.22)` |

Size 40px < 44 → extend hit area (`position:relative` + `::before{content:""; position:absolute; inset:-2px}`) or make it 44px. Props `{ initials, href, current }`. Static.

---

## 5. Buttons

### 5.1 Keycap

Base (all variants): `display:inline-flex; align-items:center; justify-content:center; gap:8–10px; box-sizing:border-box; border:0; cursor:pointer; text-decoration:none; font-family:'Geist Mono'; white-space:nowrap; transition: transform .12s ease, box-shadow .12s ease, filter .12s ease`.

**Variant `primary`** (volt): `background:#C6FF3D; color:#0A0C05; font-weight:500`.

**Variant `dark`**: `background:#151826; color:#ECEEF5; border:1px solid rgba(255,255,255,0.12); font-weight:400`.

**Variant `ghost`** (outline): `background:transparent; color:#ECEEF5; border:1px solid rgba(255,255,255,0.14)`; no shadow, no press travel. Two flavours: `ghost-sans` (Geist 15px, 44px, radius 10, padding 0 16px — System "Ghost", Main quiz) and `ghost-mono` (Geist Mono 13–15px — Course "Watch the 90-second intro", Profile "Edit profile", Authoring "Preview draft", Auth "Use another email").

**Sizes** (exact pairs seen):

| Size | min-height | padding | radius | font | primary shadow | dark shadow | Where |
|---|---|---|---|---|---|---|---|
| `xs` | 34px | `0 12px` | 8px | 12px | `0 3px 0 #6E9116` | `0 3px 0 #020305` | Code Copy |
| `s` | 36px | `0 14px` | 9px | 12px | `0 3px 0 #6E9116` | — | Code "▶ Run" |
| `nav` | 44px | `0 18px` | 11px | 14px | `0 4px 0 #6E9116, inset 0 1px 0 rgba(255,255,255,0.55)` | — | Main "Start free" |
| `m-44` | 44px | `0 18px` | 12px | 13px | same as nav | — | Authoring "Publish v4" |
| `m` | 46px | `0 18px` (Profile dark `0 16px`) | 12px | 14px | `0 4px 0 #6E9116, inset …` | `0 4px 0 #020305` | Catalog "Resume →", Course "Pick up here →", Lesson "Run ↵", Profile "Share ↗" |
| `l` | 48px | `0 20px` | 12px | 14px | `0 4px 0 #6E9116, inset …` | `0 4px 0 #020305` | System samples, Main "See a profile →", Lesson "Back to the exercise" (full width), hero "Ask" (48px, radius 11, padding 0 18px) |
| `xl` | 52px | `0 18px` (flex:1) | 13px | 15px | `0 5px 0 #6E9116, inset …` | — | Auth "Verify & continue" |
| `xl-54` | 54px | `0 24px` | 13px | 15px | `0 5px 0 #6E9116, inset …` | — | Auth submit (full width, `margin-top:4px`), Course "Resume lesson 6 →" |
| `cta` | 56px | `0 26px` | 13px | 16px | `0 5px 0 #6E9116, 0 20px 60px rgba(198,255,61,0.22), inset …` | `0 5px 0 #020305` | Main closing CTAs |

**Canonical reduction** (recommended for the component API): `size: 's'(36/9/12px) | 'm'(46/12/14px) | 'l'(48/12/14px) | 'xl'(54/13/15px) | 'cta'(56/13/16px)`, edge 4px for ≤48px, 5px for ≥52px, 3px for ≤36px (no inset highlight). Map nav (44/11) and Publish (44/12/13px) to `m` unless pixel-matching those exact screens.

**States**

| State | primary | dark | ghost |
|---|---|---|---|
| default | as above | as above | as above |
| hover | `transform:translateY(-1px); filter:brightness(1.06)` (System sample instead: bg `#D4FF66`, shadow `0 5px 0 #6E9116, 0 12px 30px rgba(198,255,61,0.25), inset 0 1px 0 rgba(255,255,255,0.55)`, translateY(-1px)) | same `translateY(-1px); brightness(1.06)` | `background: rgba(255,255,255,0.06); border-color: rgba(255,255,255,0.22)` (Auth `.ghost:hover`) |
| active / pressed | `transform:translateY(3px); box-shadow:0 1px 0 #6E9116` | `transform:translateY(3px); box-shadow:0 1px 0 #020305` | none drawn; use `background: rgba(255,255,255,.08)` |
| focus-visible | focus ring (tokens §8) | same | same |
| disabled | not drawn for volt. Use the Code "Copy off" recipe: `background:#1C2030; color:#7A8098; box-shadow:0 3px 0 #020305; cursor:not-allowed; filter:none; transform:none` + `disabled`/`aria-disabled="true"` | `opacity: .5` (proposed) | `color:#7A8098; border-color: rgba(255,255,255,.08)` (proposed) |
| loading (proposed) | keep size, replace label with label + `▍` caret blinking; `aria-busy="true"` | | |

Content conventions: trailing `→` for navigation, `↵` for submit-by-Enter, `↗` external/share, leading `▶` for run. Inner kbd tile in hero "Ask": `<span aria-hidden="true" style="padding:2px 6px; border-radius:5px; background:rgba(10,12,5,0.12); font-size:12px">↵</span>`.

Element: `<a>` for navigation (Start free, Resume, Browse courses), `<button type="submit">` for forms, `<button type="button">` otherwise. Never `<span class="key">` (Catalog's "Resume →" is a span inside a link — keep it a visual span only because the whole banner is the link). Responsive: at ≤480px CTA pairs go `flex: 1 1 100%` (full width), keep heights. Static (CSS only).

Used: everywhere (see each page).

### 5.2 InverseKeycap

Dark button on a volt surface (RewardToast "Next: Top-p →"): `<a style="display:inline-flex; align-items:center; min-height:46px; padding:0 18px; border-radius:12px; background:#0A0C05; color:#C6FF3D; font-family:Geist Mono; font-size:14px; text-decoration:none">`. Hover: `filter: brightness(1.3)` (proposed; not drawn). Lesson. Static.

### 5.3 ToolButton (`.tbtn`)

Mono outline button used in dense tool contexts.

| Instance | Style |
|---|---|
| Type-it toggle | `min-height:34px; padding:0 12px; border-radius:8px; font:12px Geist Mono; border:1px solid {line}; background:{bg}; color:{fg}`; off: `transparent / #C6CAD6 / rgba(255,255,255,0.14)`; on (`aria-pressed="true"`): `rgba(198,255,61,0.14) / #E4FF9E / rgba(198,255,61,0.5)`. Label "⌨ Type it" |
| Terminal quiz options | `min-height:40px; padding:0 12px; border-radius:9px; border:1px solid rgba(255,255,255,0.14); background:transparent; color:#ECEEF5; font: inherit (Geist Mono) 13px` |
| Video controls | `width:40px; height:40px` (or `min-height:40px; padding:0 10px`), `border-radius:10px; border:0; background:rgba(255,255,255,0.08); color:#ECEEF5; font:13px Geist Mono` |

Hover: `background: rgba(255,255,255,0.08)`. Hit sizes 34/40px → extend to 44px with `::before` inset or bump `min-height` to 44px on touch (`@media (pointer: coarse)`). Code, Lesson.

### 5.4 ProviderButton

Full-width auth method button: `<button type="button" class="ghost" style="min-height:50px; display:flex; align-items:center; justify-content:center; gap:12px; border-radius:12px; border:1px solid rgba(255,255,255,0.12); background:#0E1018; color:#ECEEF5; font-family:Geist; font-size:15px; font-weight:500">` + 18px icon + label. Hover: ghost hover (`background: rgba(255,255,255,0.06); border-color: rgba(255,255,255,0.22)`). Labels: "Continue with GitHub", "Continue with Google", "Use a passkey" (passkey icon stroke volt). GitHub/Google should be `<a href="/auth/oauth/github">` (works without JS); passkey is a `<button>` that needs an island (WebAuthn). Loading (proposed): label → "Waiting for passkey…", `aria-busy`. Auth; reused in Settings.

### 5.5 Kbd

`<span aria-hidden="true" style="font-family:Geist Mono; font-size:12px; color:#9AA0B4; padding:4px 8px; border-radius:6px; border:1px solid rgba(255,255,255,0.14); box-shadow:0 2px 0 rgba(255,255,255,0.08)">⌘K</span>` (System writes `⌘ K` with a space). Use `<kbd>` element. Show `Ctrl K` on non-Apple platforms (island-free: render both, hide via a server-side UA hint, or just "/" shortcut). Catalog, System. Static.

---

## 6. Selection controls

### 6.1 SegmentedTabs

Three flavours; all `inline-flex` groups.

| Flavour | Track | Item | Selected | Unselected | Where |
|---|---|---|---|---|---|
| `account` (2-up grid) | `display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:4px; padding:4px; border-radius:13px; background:#0E1018; border:1px solid rgba(255,255,255,0.08)` | `<button role="tab">` `min-height:44px; border:0; border-radius:10px; font:14px Geist Mono` | `background:#1C2030; color:#ECEEF5` | `transparent; #9AA0B4` | Auth |
| `mode` (app) | `display:flex; gap:2px; padding:3px; border-radius:11px; background:#0E1018; border:1px solid rgba(255,255,255,0.08); font:13px Geist Mono` | `min-height:38px; padding:0 14px; border-radius:8px` | `#1C2030 / #ECEEF5` | `transparent / #9AA0B4` | Lesson, Code |
| `mode-static` | `display:inline-flex; gap:2px; padding:3px; border-radius:10px; background:rgba(255,255,255,0.05); font:13px Geist Mono` (Main: radius 9px, 12px font) | `padding:7px 12px` (Main `5px 10px`) radius 7px (Main 6px) | `background:rgba(255,255,255,0.1); color:#ECEEF5` | `#9AA0B4` | System, Main (decorative preview) |

**Canonical selected background: `#1C2030`** (interactive tabs). The handoff says "`--raised` … selected tabs" (`#151826`) — the artboards never use `#151826` for tabs; treat `#1C2030` as `--selected`.

Mode tabs semantics: Read / Watch / Terminal change the URL (`?mode=read|watch|terminal`) — so implement them as **links**, not ARIA tabs: `<nav aria-label="Lesson format">` with `<a aria-current="page">` on the active one (Code artboard already does this for Terminal; Lesson mixes buttons with `role="tab"` and an `<a>` — don't copy that). Watch is omitted when the lesson has no video. Hover (not drawn): unselected `color:#ECEEF5`. Height 38px → raise to 44px or extend hit area.

Account tabs: also URL-backed (`/login` vs `/login?mode=signup`) → links styled as tabs, `aria-current="page"`. If kept as in-page tabs (island), use full ARIA tabs pattern (`role="tablist"`, `role="tab"`, `aria-selected`, `aria-controls`, roving `tabindex`, arrow keys).

Island: none needed if link-based (switching mode keeps the draft via storage in the composer island). Responsive: never wraps; at ≤360px `mode` tabs shrink padding to `0 10px`.

### 6.2 Chip family

**a) ChoiceChip** (Auth goals; toggle). `<button type="button" aria-pressed>` `min-height:44px; padding:0 14px; border-radius:999px; font:14px Geist`.
- off: `border:1px solid rgba(255,255,255,0.14); background:transparent; color:#B4B9CA`
- on: `border:1px solid rgba(198,255,61,0.6); background:rgba(198,255,61,0.12); color:#E4FF9E`
- hover (proposed, mirrors filter): `border-color: rgba(255,255,255,0.3)`.
System's static "Agents/Prompting/Foundations" chips use the same colours with `padding: 9px 14px`. Without JS: render as checkboxes (`<input type="checkbox" name="goals" value="curious">` visually hidden inside a `<label>` styled as the chip, `:has(:checked)` for the on style). Data: `goals = [["curious","Curious about AI"],["work","Use AI at work"],["code","Build with code"],["teach","Teach others"]]`, default `{curious: true}`.

**b) SuggestionChip** (`.chip-link`, Main hero). `<a>` `padding:10px 14px; border-radius:999px; border:1px solid rgba(255,255,255,0.12); background:rgba(7,8,13,0.55); color:#B4B9CA; font-size:14px; text-decoration:none`. Hover: `border-color: rgba(198,255,61,.55); color:#ECEEF5; background: rgba(198,255,61,.06)`; transition `.15s`. Height ≈ 38px → `min-height:44px; display:inline-flex; align-items:center`. Static.

**c) FilterPill** (Catalog). `<button type="button" class="filter" aria-pressed>` `min-height:44px; padding:0 16px; border-radius:999px; font:15px Geist; display:flex; align-items:center; gap:8px` + dot `width:7px; height:7px; border-radius:99px; background:{trackColour}` + label + count (`font:12px Geist Mono; color:#7A8098`).
- off: `border:1px solid rgba(255,255,255,0.14); background:transparent; color:#C6CAD6`
- on: `border:1px solid #ECEEF5; background:#ECEEF5; color:#07080D`
- hover: `border-color: rgba(255,255,255,0.3)`
- Problems in "on": the "All" dot is `#ECEEF5` on `#ECEEF5` (invisible) and the count `#7A8098` on `#ECEEF5` is 3.37:1. Fix: when on, set the count colour to `rgba(7,8,13,.7)` (≈9:1 on `#ECEEF5`) and give the All dot `border:1px solid #07080D` (or `background:#07080D`).
Because filters live in the URL (`?track=agents`), render each pill as `<a href="?track=…" aria-current="true|false">` (progressive; no JS needed). Group: `<div role="group" aria-label="Filter by track">` → with links use `<nav aria-label="Filter by track">`.

**d) MetaTag** (Course hero). `padding:7px 11px; border-radius:8px; border:1px solid rgba(255,255,255,0.12); color:#D5D8E3; font:13px Geist Mono`. Ion variant ("text + video"): `border-color: rgba(61,227,255,0.35); color:#3DE3FF`. Static, non-interactive.

**e) FormatTag** (CourseCard). `padding:4px 8px; border-radius:6px; border:1px solid rgba(255,255,255,0.1); font:11px Geist Mono; color:#C6CAD6`. Values `text`, `video`, `code`. Static.

**f) CoverTag** (track on cover). `position:absolute; top:12px; left:12px; padding:5px 9px; border-radius:7px; background:rgba(7,8,13,0.82); font:11px Geist Mono; letter-spacing:0.08em; color:{courseColour}`; text uppercase track. Static.

**g) DoneTag**. `position:absolute; top:12px; right:12px; display:flex; align-items:center; gap:6px; padding:5px 9px; border-radius:7px; background:#C6FF3D; color:#0A0C05; font:11px Geist Mono` "✓ DONE". Static.

**h) YourTurnTag**. `font:12px Geist Mono; color:#0A0C05; background:#C6FF3D; padding:3px 8px; border-radius:6px` "Your turn". Authoring preview small variant: 11px, `padding:3px 7px; border-radius:5px`, text "Your turn · +40". Static.

**i) RunHint** (static composer, System): `padding:6px 10px; border-radius:8px; background:#C6FF3D; color:#0A0C05` "Run ↵" — visual only; in the real composer use Keycap `m`.

### 6.3 TemperaturePicker ("run at")

`<div role="group" aria-label="Temperature" style="display:flex; gap:6px">` of `<button type="button" aria-pressed>` `min-height:40px; min-width:52px; padding:0 10px; border-radius:9px; font:13px Geist Mono`.
- off: `border:1px solid rgba(255,255,255,0.14); background:transparent; color:#C6CAD6`
- on: `border:1px solid #3DE3FF; background:#3DE3FF; color:#07080D` (13:1)
Options from the exercise's allowed temperatures; sample `[[0,"0"],[70,"0.7"],[100,"1.0"]]`, default `0`. Picking a temp also moves the OddsBars slider (`temp: t[0]`). Prefer `role="radiogroup"` + `role="radio" aria-checked` (single choice). 40px → 44px on touch. Island (part of PromptComposer). Lesson.

### 6.4 QuizChoice

Three renderings exist:
- Main preview: ghost-sans buttons "Same token" / "Different token" (`min-height:44px; padding:0 16px; border-radius:10px; border:1px solid rgba(255,255,255,0.14); font:15px Geist`).
- Code terminal: ToolButton `[a] loops forever`, `[b] crashes`, `[c] works fine`.
- Authoring preview (`:::quiz` render): card `padding:14px; border-radius:14px; background:#0E1018; border:1px solid rgba(255,255,255,0.08); gap:8px; font-size:14px`, question `color:#ECEEF5`, option rows `display:flex; align-items:center; gap:10px; min-height:40px; padding:0 12px; border-radius:10px; border:1px solid rgba(255,255,255,0.1); color:#C6CAD6` prefixed `◯`.

**Canonical `:::quiz` card** = Authoring preview layout, options as `<label>` + `<input type="radio|checkbox">` (multiple → checkbox), `min-height:44px`. States (none drawn; proposed using existing recipes): selected = ChoiceChip on (volt tint); correct after submit = `border: rgba(198,255,61,.45); background: rgba(198,255,61,.12); color:#E4FF9E` + `✓`; incorrect = `border: rgba(255,184,77,.35); background: rgba(255,184,77,.08); color:#FFD08A` + `!` (re-uses warn; there is no error colour), with the explanation revealed below in `body-s`. Submit with Keycap `m` "Check". Island (progressive: a `<form method="post">` works without JS). Lesson (Read), Main (decorative), Code.

---

## 7. Inputs

### 7.1 TextField

`<div style="display:flex; flex-direction:column; gap:8px">` + `<label style="font-size:14px; color:#D5D8E3">` + `<input class="field">`:
- `min-height:50px; padding:0 16px; border-radius:12px; border:1px solid rgba(255,255,255,0.12); background:#0A0C14; color:#ECEEF5; font-size:16px` — sans (name) or Geist Mono 15px (email).
- placeholder `color:#7A8098`.
- focus: `outline:none; border-color: rgba(198,255,61,0.7); box-shadow: 0 0 0 4px rgba(198,255,61,0.12)`.
- Authoring compact variant: `min-height:44px; padding:0 12px; border-radius:10px; font:13px Geist Mono`; label `display:flex; flex-direction:column; gap:6px; font-size:13px; color:#9AA0B4` wraps the input; focus border only (add the glow for consistency).
- Error (not drawn, proposed): add `aria-invalid="true"`, border `rgba(255,122,107,.6)` (proposed danger), message below `font-size:13px` with `id` referenced by `aria-describedby`.
- Hint text: `font-size:13px; color:#7A8098` (as Auth legend aside "— we'll suggest a first course").
Auth, Authoring, Settings. Static.

### 7.2 SearchField

`<label class="search" style="flex:0 1 440px; display:flex; align-items:center; gap:12px; padding:0 14px 0 18px; min-height:56px; border-radius:16px; background:#0E1018; border:1px solid rgba(255,255,255,0.12); transition:border-color .2s, box-shadow .2s">` + `search` icon + visually-hidden text "Search courses" + `<input type="search" placeholder="Search “agents”, “tokens”, “RAG”…" style="flex:1; min-width:0; height:52px; background:transparent; border:0; color:#ECEEF5; font:16px Geist">` + Kbd `⌘K`.
- focus-within: `border-color: rgba(198,255,61,0.6); box-shadow: 0 0 0 4px rgba(198,255,61,0.1)`; input `outline:none`.
- Wrap in `<form method="get" action="/courses" role="search">` with `name="q"`; keep `track` as hidden input. Filtering happens server-side; an island may debounce-submit (250ms) on input.
- ⌘K focuses the field (island, small). Hide the Kbd at ≤480px.
Catalog.

### 7.3 CodeEntry (6-digit)

`<div style="display:grid; grid-template-columns:repeat(6,minmax(0,1fr)); gap:8px">` × 6 `<label style="display:block">` each with a visually hidden "Digit n" and `<input class="field" inputmode="numeric" maxlength="1" style="width:100%; box-sizing:border-box; height:60px; text-align:center; border-radius:12px; border:1px solid rgba(255,255,255,0.14); background:#0A0C14; color:#ECEEF5; font-family:Unbounded; font-size:22px">`. Focus: `.field:focus` recipe.

Spec additions: first input `autocomplete="one-time-code"`; paste of 6 digits fills all; typing advances; Backspace on empty goes back; auto-submit on 6th digit. **Progressive**: render a single `<input name="code" inputmode="numeric" pattern="[0-9]{6}" maxlength="6" autocomplete="one-time-code">` styled with `letter-spacing` when JS is off; the island upgrades to 6 boxes. Wrap in `<fieldset><legend class="sr-only">6-digit code</legend>`. Error state (proposed): all boxes border danger + message "That code didn't match. 4 tries left." (`aria-live="polite"`). At 360px: form width 312px → each box ≈ 45px wide — fine. Auth (sent).

### 7.4 HeroPromptBar

`<form class="prompt-bar" style="width:100%; max-width:760px; display:flex; align-items:center; gap:12px; padding:10px 10px 10px 22px; box-sizing:border-box; background:rgba(12,14,22,0.78); backdrop-filter:blur(16px); border:1px solid rgba(255,255,255,0.12); border-radius:18px; box-shadow:0 30px 80px rgba(0,0,0,0.5); transition:border-color .2s, box-shadow .2s">`:
- `<span aria-hidden="true" style="font:20px Geist Mono; color:#C6FF3D">›</span>`
- `<label for="hero-prompt" class="sr">Ask your first question</label>`
- `<input id="hero-prompt" type="text" autocomplete="off" style="flex:1; min-width:0; height:52px; background:transparent; border:0; color:#ECEEF5; font:17px Geist Mono">`, placeholder colour `#7A8098`, `outline:none` on focus.
- Keycap primary 48px radius 11 "Ask ↵" (`<button type="submit">`, the artboard uses an `<a>`).
- focus-within: `border-color: rgba(198,255,61,.6); box-shadow: 0 0 0 4px rgba(198,255,61,.12), 0 30px 80px rgba(0,0,0,.5)`.
- Behaviour: `method="get" action="/courses/<lesson-1 course>/<lesson-1>"` with `name="q"` → lesson 1 opens with the typed text prefilled (handoff). Typewriter placeholder (island): cycles `["Explain tokens like I'm ten", "Why do models make things up?", "Write a haiku about gradient descent", "Build me an agent that plans dinner"]`, 55ms/char, deletes 2 chars/tick, holds 34 ticks then 6 ticks, appends `▍`; pauses while focused or non-empty; disabled under reduced motion (show the first prompt statically). Server-render the first prompt as the placeholder.
- 360px: padding `8px 8px 8px 16px`, input font 16px (avoid iOS zoom ≥16), button shows "Ask" only (hide the ↵ tile). Main.

### 7.5 DividerLabel ("or use email")

`<div style="display:flex; align-items:center; gap:14px; font:12px Geist Mono; color:#7A8098"><span style="flex:1; height:1px; background:rgba(255,255,255,0.08)"></span>or use email<span style="flex:1; …"></span></div>`. Decorative lines `aria-hidden`. Auth. Static.

### 7.6 DropZone

`<label class="drop" style="min-height:240px; padding:28px; box-sizing:border-box; border-radius:20px; border:1.5px dashed rgba(255,255,255,0.22); background:#0A0C14; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:14px; text-align:center; cursor:pointer">` + `folder-upload` icon 44px + title (Unbounded 500 19px ls -0.02em) "Drop a course folder or .zip" + hint (14px `#9AA0B4`) "markdown + images + videos · videos go to storage, the rest is parsed" + visually-hidden `<input type="file">` (add `webkitdirectory` for folders and a second input/`accept=".zip"`).
- hover / dragover: `border-color: rgba(198,255,61,0.7); background: rgba(198,255,61,0.04)`.
- focus-within: focus ring on the label.
- States (proposed): uploading → replace hint with CourseProgressBar (volt) + "Uploading 3 of 9 files…"; building → LiveDot ion "building"; done → ValidationItem list refresh. `aria-live="polite"` status line.
Island (drag-and-drop, folder walk, upload progress); progressive fallback = plain file input + submit. Authoring.

### 7.7 Switch (proposed, Settings only)

No toggle exists in the artboards. Use a **two-option SegmentedTabs `account` flavour** ("Public" / "Private") bound to radio inputs, or a ChoiceChip with `aria-pressed`. See `pages/Settings.md`.

---

## 8. Labels and layout

### 8.1 Eyebrow

`<span style="font-family:Geist Mono; font-size:13px; letter-spacing:0.14em; text-transform:uppercase; color:{colour}">`. Colours seen: volt (`All courses · free`, `04 — You`, `latent / system`), ion (`02 — How it works`), synapse (`03 — The path`), muted. Small variant: 12px ls 0.12em (card eyebrows, colour per card). XS: 11px ls 0.14em/0.16em. Authoring `AUTHORS` has no `text-transform` (literal caps). Static.

### 8.2 MonoHeading

Real `<h2>` styled as eyebrow: `margin:0; font-family:Geist Mono; font-weight:500; font-size:13px; letter-spacing:0.14em; text-transform:uppercase; color:#9AA0B4`. Used for "Color/Type/Components" (System), "By the end you'll be able to", "Syllabus" (`margin:0 0 8px`), "ACTIVITY · LAST 26 WEEKS", "COURSES", "PROMPT JOURNAL", "BADGES · 5 OF 12", "ACCOUNT", "THE BLOCKS". Static.

### 8.3 SectionCard

Default panel: `padding:22px–24px; border-radius:18px–20px; background:#0E1018; border:1px solid rgba(255,255,255,0.08); display:flex; flex-direction:column; gap:14–20px`.

| Instance | padding | radius | gap |
|---|---|---|---|
| System component cards | 24 | 18 | 20 |
| Course aside cards | 24 | 20 | 18 / 14 |
| Profile sections, heatmap | 22 | 18 | 16 / 14 |
| Lesson watch transcript/side | 22 | 18 | 10 / 14 |
| Authoring validation | 24 | 20 | 18 |
| Authoring sync card | 28 | 20 | 16 (`min-height:240px`) |

Dashed variant: `border:1px dashed rgba(255,255,255,0.16); background: none` (Course SOURCE, Catalog empty state). Canonical: padding 24, radius 18 (cards) / 20 (page-level panels). Static. At ≤480px reduce padding to 18px.

### 8.4 GlassCard

`background: rgba(12,14,22,.78–.82); backdrop-filter: blur(14–18px); border:1px solid rgba(255,255,255,0.09–0.1)`. Main only (over the field). Radii 18 (path), 20 (mode), 22 (lesson preview), 24 (progress). Static.

### 8.5 StatTile

| Variant | Container | Value | Label |
|---|---|---|---|
| `main` | `padding:14px; border-radius:12px; background:#0A0C14; flex column; gap:4px` | Unbounded 700 24px | 13px `#9AA0B4` |
| `profile` | `padding:18px; border-radius:16px; background:#0E1018; border:1px solid rgba(255,255,255,0.08); gap:6px` | Unbounded 700 30px | 14px `#9AA0B4` |

Value colours: volt (neurons/streak on Main), ion (neurons on Main; streak on Profile), text. Use `<dl>`-like markup: `<div><dt class="sr-only">…</dt><dd>`, or value + label in reading order. Static.

### 8.6 KeyValueList

`<dl style="display:grid; grid-template-columns:auto 1fr; gap:10px 16px; font-size:14px">` term `color:#9AA0B4`, value `#ECEEF5` (email in Geist Mono 13px). Course "How you'll learn" variant: `gap:10px 14px`, term is a mono number in volt/ion/synapse, value `#D5D8E3`. Profile, Course, Settings. Static.

### 8.7 EmptyState

`padding:48px; border-radius:20px; border:1px dashed rgba(255,255,255,0.16); text-align:center; flex column; gap:10px; align-items:center` + title mono 15px `#ECEEF5` (`0 results for “{q}”`) + hint 15px `#9AA0B4` ("Try “agents”, “tokens” or clear the filter."). Add a ghost "Clear filters" link (`/courses`). Wrap result count in `aria-live="polite"`. Catalog; reuse for empty journal/courses on Profile (proposed copy in Profile page spec). Static.

### 8.8 LiveDot

Inline mono 12px: `● connected` (volt), `● live` (volt), `● lines 12–32: the loop` (volt). Pair with text; `●` decorative. Static.

### 8.9 ScrollCue

`<div aria-hidden="true" style="margin-top:auto; padding-top:56px; display:flex; flex-direction:column; align-items:center; gap:12px; font:11px Geist Mono; letter-spacing:0.16em; text-transform:uppercase; color:#7A8098">Scroll — the network rewires itself<span class="scrollcue" style="display:block; width:1px; height:48px; background:#C6FF3D"></span></div>`. Animation `cue 2.4s`. Hidden under reduced motion (animation only). Main. Static.

---

## 9. Course components

### 9.1 CourseCover + Sigil

Cover = CSS pattern on `#0A0C14` + outlined sigil text. Exact patterns (Catalog script, `ink = "#0A0C14"`):

| Course | Sigil | Colour | `background` |
|---|---|---|---|
| What is an LLM, really? | `LLM` | `#C6FF3D` | `radial-gradient(rgba(198,255,61,0.45) 1.2px, transparent 1.6px) 0 0 / 14px 14px, #0A0C14` |
| Tokens & temperature | `T°` | `#3DE3FF` | `repeating-linear-gradient(115deg, rgba(61,227,255,0) 0 12px, rgba(61,227,255,0.3) 12px 13px), #0A0C14` |
| Prompting that works | `›_` | `#C6FF3D` | `linear-gradient(rgba(198,255,61,0.22) 1px, transparent 1px) 0 0 / 100% 18px, #0A0C14` |
| Context is everything | `[ctx]` | `#3DE3FF` | `linear-gradient(90deg, rgba(61,227,255,0.28) 1px, transparent 1px) 0 0 / 22px 100%, linear-gradient(rgba(61,227,255,0.28) 1px, transparent 1px) 0 0 / 100% 22px, #0A0C14` |
| Give your model tools | `fn()` | `#9D85FF` | `repeating-radial-gradient(circle at 85% 110%, transparent 0 14px, rgba(157,133,255,0.42) 14px 15px), #0A0C14` |
| Retrieval without tears | `RAG` | `#9D85FF` | `radial-gradient(rgba(157,133,255,0.5) 1.4px, transparent 1.8px) 0 0 / 18px 18px, radial-gradient(rgba(157,133,255,0.25) 1px, transparent 1.4px) 9px 9px / 18px 18px, #0A0C14` |
| Your first agent loop | `loop` | `#C6FF3D` | `repeating-conic-gradient(from 0deg at 50% 120%, rgba(198,255,61,0.28) 0 2deg, transparent 2deg 12deg), #0A0C14` |
| Ship an agent to the edge | `edge` | `#3DE3FF` | `repeating-linear-gradient(45deg, rgba(61,227,255,0.22) 0 1px, transparent 1px 16px), repeating-linear-gradient(-45deg, rgba(61,227,255,0.22) 0 1px, transparent 1px 16px), #0A0C14` |

Named patterns (for `course.md` `cover: {pattern, sigil}`): `dots`, `stripes-115`, `rules`, `grid`, `rings`, `dots-offset`, `rays`, `crosshatch`; params: colour, alpha, period. Scaled variants: Profile thumbnail stripes use `0 6px … 6px 7px` @ `.35`; rays `0 3deg, transparent 3deg 14deg` @ `.3`. Course hero section bg: `repeating-linear-gradient(115deg, rgba(61,227,255,0) 0 22px, rgba(61,227,255,0.06) 22px 23px), #07080D`.

Sigil: `<span class="sigil" aria-hidden="true" style="font-family:Unbounded; font-weight:800; color:transparent; -webkit-text-stroke:{w} {colour}">`. Sizes: card 52px ls -0.04em stroke 1.4px; continue 88px ls -0.05em stroke 1.5px; course art 128px ls -0.05em stroke 2px; profile thumb 18px (`T°`) / 14px (`loop`) stroke 1px. Fallback where `-webkit-text-stroke` is unsupported: `color: {colour}` at 15% alpha (`@supports not (-webkit-text-stroke: 1px)`). If `cover` is an SVG (frontmatter), render `<img alt="">` instead. Static.

### 9.2 CourseCard

`<a class="card" href="/courses/:course" style="display:flex; flex-direction:column; text-decoration:none; color:#ECEEF5; border-radius:20px; overflow:hidden; background:#0E1018; border:1px solid rgba(255,255,255,0.08)">`

Anatomy:
1. Cover `position:relative; height:170px; background:{cover}; display:grid; place-items:center; overflow:hidden; border-bottom:1px solid rgba(255,255,255,0.06)` → Sigil 52px, CoverTag (top-left), DoneTag (top-right, if `pct >= 100`).
2. Body `flex:1; padding:20px; display:flex; flex-direction:column; gap:12px`:
   - Title Unbounded 500 19px lh 1.2 ls -0.02em (make it the accessible name: wrap in `<h3>`).
   - Desc 14px lh 1.55 `#9AA0B4`.
   - Meta row `margin-top:auto; padding-top:8px; display:flex; align-items:center; gap:10px; flex-wrap:wrap; font:12px Geist Mono; color:#9AA0B4`: `{level}` `·` `{lessons} lessons` `·` `{mins} min` (dots `aria-hidden`).
   - FormatTags row `display:flex; gap:6px; flex-wrap:wrap`.
   - If started (`0 < pct < 100`): CourseProgressBar `card` variant in course colour + `{pct}%` mono 12px course colour.

States: hover `transform: translateY(-6px) rotate(-0.4deg); border-color: rgba(198,255,61,0.4); box-shadow: 0 30px 80px rgba(0,0,0,0.5)`; sigil `scale(1.08) translateY(-4px)` (`.35s cubic-bezier(.2,.8,.2,1)`); transitions `.25s ease`. Focus-visible: same lift + focus ring. Reduced motion: no transform, border change only. Done: DoneTag. Not started: no bar.

Props: `{ slug, title, track, level: 'Beginner'|'Intermediate'|'Advanced', lessons, mins, sigil, color, formats: ('text'|'video'|'code')[], pct, desc, cover }`. Grid: `repeat(auto-fill, minmax(min(290px, 100%), 1fr)); gap:20px`. A11y: whole card is one link; SR text order title → desc → meta; add `aria-label` only if needed. Static. Catalog (Main path cards link to catalog filtered).

### 9.3 WriteCourseCard

`<a href="/author" style="display:flex; flex-direction:column; justify-content:center; gap:14px; min-height:380px; padding:28px; box-sizing:border-box; text-decoration:none; color:#ECEEF5; border-radius:20px; border:1px dashed rgba(255,255,255,0.2)">` + `+ .md` (Geist Mono 28px volt) + "Write a course" (Unbounded 500 19px ls -0.02em) + "Courses are plain markdown files with a few special blocks. Drop a folder, get a course." (14px lh 1.55 `#9AA0B4`). Hover (proposed): `border-color: rgba(198,255,61,.4)`. Static. Catalog (last grid item). At 360px `min-height` → `auto` (padding keeps it reasonable).

### 9.4 ContinueBanner

`<a href="{resumeUrl}" style="display:grid; grid-template-columns:repeat(auto-fit, minmax(min(320px,100%),1fr)); gap:0; text-decoration:none; color:#ECEEF5; border-radius:22px; overflow:hidden; border:1px solid rgba(61,227,255,0.3); background:#0E1018">`
1. Art: `position:relative; min-height:200px; background:{cover}; display:grid; place-items:center; overflow:hidden` + Sigil 88px stroke 1.5px.
2. Body `padding:28px 32px; flex column; gap:14px; justify-content:center`:
   - eyebrow-s ion `CONTINUE · LESSON 6 OF 8`
   - Unbounded 700 28px ls -0.03em course title
   - 16px `#9AA0B4` "Up next: <span #ECEEF5>Temperature & randomness</span> · about 7 min"
   - Row `display:flex; align-items:center; gap:14px; flex-wrap:wrap`: CourseProgressBar `banner` (`flex:1; min-width:160px; height:6px; radius 3px`, fill `#3DE3FF` radius 3) + `62%` mono 13px ion + Keycap `m` "Resume →" (visual `<span>`).
Hover (not drawn): border `rgba(61,227,255,.5)`; keycap hover via `.card:hover .key` → translateY(-1px). Shown only when there is any progress (local or synced) — requires an island to read localStorage for anonymous users (render server-side for signed-in users; for anonymous, hydrate a placeholder that fills from storage). Catalog.

### 9.5 CourseProgressBar

Track + fill. Variants:

| Variant | Track | Fill | Where |
|---|---|---|---|
| `card` | `flex:1; height:4px; border-radius:2px; background:rgba(255,255,255,0.08); overflow:hidden` | `height:100%; width:{pct}%; background:{colour}` (no radius) | CourseCard |
| `banner` | `height:6px; border-radius:3px` | radius 3px | ContinueBanner |
| `art` | `flex:1; height:6px; border-radius:3px` | no radius | Course art chip |
| `row` | `height:5px; border-radius:3px` | no radius | Profile course rows |
| `level` | `height:8px; border-radius:4px` | volt | Profile level bar (`max-width:420px`) |

Use `role="progressbar" aria-valuenow aria-valuemin="0" aria-valuemax="100" aria-label="Course progress"` or render the % text adjacent and mark the bar `aria-hidden`. Static.

### 9.6 SegmentedProgress (lesson bar)

`<div style="display:flex; gap:4px">` one `<span style="flex:1; height:5px; border-radius:3px">` per lesson: done `#C6FF3D`, current `linear-gradient(90deg, #3DE3FF 50%, rgba(255,255,255,0.1) 50%)` (becomes `#C6FF3D` when passed), upcoming `rgba(255,255,255,0.1)`. The artboard puts `aria-label="Course progress"` on a plain div (no role) — use `role="img" aria-label="Lesson 6 of 8, 5 complete"`. Static, updated by the lesson island on pass. Lesson (and Terminal mode, canonical).

### 9.7 ProgressRing

SVG ring. Two instances:

```html
<!-- Course aside, 96px, ion -->
<svg width="96" height="96" viewBox="0 0 96 96" role="img" aria-label="62 percent complete">
  <circle cx="48" cy="48" r="40" stroke="rgba(255,255,255,0.08)" stroke-width="8" fill="none"></circle>
  <circle cx="48" cy="48" r="40" stroke="#3DE3FF" stroke-width="8" fill="none" stroke-linecap="round" stroke-dasharray="156 251" transform="rotate(-90 48 48)"></circle>
  <text x="48" y="54" text-anchor="middle" font-family="Unbounded, sans-serif" font-weight="700" font-size="20" fill="#ECEEF5">62%</text>
</svg>
<!-- Main showcase, 132px, volt, with caption -->
<svg width="132" height="132" viewBox="0 0 132 132" role="img" aria-label="Context window 62 percent full">
  <circle cx="66" cy="66" r="56" stroke="rgba(255,255,255,0.08)" stroke-width="10" fill="none"></circle>
  <circle cx="66" cy="66" r="56" stroke="#C6FF3D" stroke-width="10" fill="none" stroke-linecap="round" stroke-dasharray="218 352" transform="rotate(-90 66 66)"></circle>
  <text x="66" y="66" text-anchor="middle" font-family="Unbounded, sans-serif" font-weight="700" font-size="28" fill="#ECEEF5">62%</text>
  <text x="66" y="88" text-anchor="middle" font-family="Geist Mono, monospace" font-size="10" fill="#9AA0B4">CONTEXT</text>
</svg>
```

Formula: `C = 2πr`; dasharray = `${C*pct} ${C}` (r40 → 251.3, r56 → 351.9). Props `{ pct, size: 96|132, stroke: 8|10, colour, caption? }`. Colour: ion for in-progress, volt when 100% (proposed). Edge case `pct = 0` → omit fill circle (round cap would draw a dot). Static.

### 9.8 CourseArt (Course hero)

`position:relative; width:340px; max-width:100%; aspect-ratio:1; border-radius:28px; background:repeating-linear-gradient(115deg, rgba(61,227,255,0) 0 12px, rgba(61,227,255,0.28) 12px 13px), #0A0C14; border:1px solid rgba(61,227,255,0.3); display:grid; place-items:center; box-shadow:0 40px 120px rgba(61,227,255,0.12)` + Sigil 128px stroke 2px + progress chip `position:absolute; left:20px; right:20px; bottom:20px; display:flex; align-items:center; gap:12px; padding:12px 14px; border-radius:14px; background:rgba(7,8,13,0.86); border:1px solid rgba(255,255,255,0.08)` containing CourseProgressBar `art` + `5/8 · 62%` mono 13px ion. Not-started variant: hide the chip. Static. Course. At 360px: width 100% (328px), sigil scales `font-size: clamp(88px, 30vw, 128px)`.

### 9.9 CourseRow (Profile)

`<a href="/courses/:course" style="display:flex; align-items:center; gap:18px; padding:16px; border-radius:16px; background:#0E1018; border:1px solid rgba(255,255,255,0.08); text-decoration:none; color:#ECEEF5; flex-wrap:wrap">` + thumb `64×64; border-radius:14px; {cover}; Sigil 18/14px stroke 1px` + body `flex:1 1 200px; flex column; gap:8px` (title 16px 600; CourseProgressBar `row` + `{pct}%` mono 12px colour) + "Resume →" mono 13px volt.

Finished variant: `<div>` (not a link) `border:1px solid rgba(198,255,61,0.35); background:rgba(198,255,61,0.05)`, thumb solid `#C6FF3D` with check 26px, body gap 4px: title + "Finished · certificate ready" 14px `#9AA0B4`, action `<a href="#certificate" style="display:inline-flex; align-items:center; min-height:44px; padding:0 14px; border-radius:10px; border:1px solid rgba(198,255,61,0.4); font:13px Geist Mono">View certificate</a>` (link colour volt). Hover (proposed): link rows border `rgba(255,255,255,.14)`. Static. Profile.

### 9.10 OutcomeCard

`padding:18px; border-radius:14px; background:#0E1018; border:1px solid rgba(255,255,255,0.07); font-size:15px; line-height:1.5; color:#D5D8E3` + leading `<span style="display:block; font:12px Geist Mono; color:#C6FF3D; margin-bottom:8px">01</span>`. Render as `<ol>` items. Grid `auto-fit minmax(min(220px,100%),1fr)` gap 12. Course. Static.

### 9.11 HowYoullLearn

SectionCard (padding 24, radius 20, gap 14) + eyebrow-s `HOW YOU'LL LEARN` (`#9AA0B4`) + KeyValueList course variant: `8` volt "chat lessons — every one", `6` volt "typed prompt exercises", `5` ion "optional videos", `1` synapse "checkpoint project". Derived from the compiled course. Course. Static.

### 9.12 SourceCard

Dashed SectionCard (padding 24, radius 20, `border:1px dashed rgba(255,255,255,0.16)`, gap 10): eyebrow-s `SOURCE` · 14px lh 1.55 `#D5D8E3` "This course is 9 markdown files. Spot a typo? Fix it in one pull request." · mono 13px link "courses/tokens-temperature/ →" · 13px `#7A8098` "Written by [AUTHOR NAME] · updated [DATE]". Course. Static.

---

## 10. Lesson components

### 10.1 LessonNode

Three states. Canonical (System) 32px; Course syllabus 30px inside a 40px slot; Lesson outline 20px mini.

| State | System 32px | Course 30px (in 40×40 slot) | Outline 20px |
|---|---|---|---|
| `done` | `width:32px; height:32px; border-radius:999px; background:#C6FF3D; display:grid; place-items:center` + check 14px stroke 2 `#0A0C05` | 30px, check 13px stroke 2.2 | `background:#C6FF3D; border:0; color:#0A0C05` text `✓` (10px mono) |
| `current` | `box-sizing:border-box; border:2px solid #3DE3FF` + inner dot `10×10 #3DE3FF` + `.pulse` (ion 8px) | same at 30px with `background:#07080D`, pulse 9px | `border:2px solid #3DE3FF; background:transparent; color:#0A0C05` + numeral (the numeral is `#0A0C05` on dark → invisible; fix: `color:#3DE3FF`) |
| `next` | `border:1px dashed rgba(255,255,255,0.3)`, empty | `border:1px dashed rgba(255,255,255,0.32); background:#07080D` | `border:1px dashed rgba(255,255,255,0.3)` + numeral (same invisible-colour bug → use `#C6CAD6`) |

Label beside node (System): done 15px `#9AA0B4` `text-decoration:line-through; text-decoration-color: rgba(154,160,180,0.4)`; current 15px 600 `#ECEEF5` + right-aligned `IN PROGRESS` mono 11px ion; next 15px `#D5D8E3`. Rows `display:flex; align-items:center; gap:14px; padding:10px 0`.

A11y: node is decorative (`aria-hidden`), state conveyed in text: append visually hidden "— completed" / "— in progress" / "— not started". Pulse off under reduced motion. Static.

### 10.2 SyllabusModule + SyllabusRow (Course)

Module: `position:relative; display:flex; flex-direction:column; padding-bottom:20px` → header `display:flex; align-items:baseline; gap:14px; padding:14px 0 10px` (`M1` mono 12px `#7A8098`, title Unbounded 500 18px ls -0.02em) → list `position:relative; flex column` with trace `position:absolute; left:19px; top:22px; bottom:22px; width:2px; background:{trace}` (`aria-hidden`). Trace values: all done `#C6FF3D`; partial `linear-gradient(#C6FF3D 55%, rgba(255,255,255,0.12) 55%)`; none `rgba(255,255,255,0.12)`. Compute the stop from (done lessons − 0.5)/ (lessons − 1) or keep 55% for a 3-lesson module with the current at the end.

Row: `<a class="row" href="/courses/:course/:lesson" style="display:flex; align-items:center; gap:16px; padding:10px 12px 10px 0; border-radius:12px; text-decoration:none; color:#ECEEF5; background:{rowBg}">` → LessonNode (40px slot) → body `flex:1; min-width:0; flex column; gap:4px` (title 16px, weight 600 current / 400 else, colour `#9AA0B4` done / `#ECEEF5` else, text `"{n}. {title}"`; kinds row `display:flex; gap:12px; flex-wrap:wrap; font:12px Geist Mono`) → `{mins} min · +{xp}` mono 12px `#9AA0B4` nowrap.

Kinds: `chat` "▸ chat" `#9AA0B4`; `type` "› type" `#C6FF3D`; `video` "▶ video" `#3DE3FF`; `code` "{ } code" `#9D85FF`; `project` "◆ project" `#9D85FF`.

States: current row bg `rgba(61,227,255,0.06)`; hover `rgba(255,255,255,0.03)`; `aria-current="step"` on current. Render as `<ol>` per module. 360px: the mins/xp column wraps under the title (`flex-wrap:wrap` on row, xp `margin-left:56px`). Static.

### 10.3 ResumeCallout

Under the current SyllabusRow: `margin:6px 0 14px 56px; padding:18px; border-radius:16px; background:#0E1018; border:1px solid rgba(61,227,255,0.3); flex column; gap:14px` → 15px lh 1.55 `#D5D8E3` "You stopped at the exercise: <span #ECEEF5>make the model write the same tagline at temperature 0 and 1, then explain the difference.</span>" → row `gap:12px; flex-wrap:wrap; align-items:center`: Keycap `m` "Pick up here →" + mono 12px `#9AA0B4` "your draft prompt is saved". At ≤480px margin-left 0. Static (copy from progress data). Course.

### 10.4 OutlineItem (Lesson outline)

`<nav aria-label="Lessons" style="flex:1 1 260px; max-width:320px; padding:28px 16px; box-sizing:border-box; display:flex; flex-direction:column; gap:4px; border-right:1px solid rgba(255,255,255,0.06); align-self:stretch">` + heading `padding:0 12px 10px; font:12px Geist Mono; letter-spacing:0.12em; color:#7A8098` "IN THIS COURSE".

Item `<a class="olink" style="display:flex; align-items:center; gap:12px; min-height:44px; padding:6px 12px; border-radius:10px; text-decoration:none; color:{fg}; background:{bg}; font-size:14px">` + 20px node (`flex:none; width:20px; height:20px; border-radius:99px; display:grid; place-items:center; font:10px Geist Mono; background:{dotBg}; color:#0A0C05; border:{dotLine}`) + title.

| State | fg | bg | dotBg | dotLine | mark |
|---|---|---|---|---|---|
| done | `#9AA0B4` | transparent | `#C6FF3D` | `0` | `✓` |
| current | `#ECEEF5` | `rgba(61,227,255,0.08)` | transparent (or volt if passed) | `2px solid #3DE3FF` | numeral (`✓` once passed) |
| next | `#C6CAD6` | transparent | transparent | `1px dashed rgba(255,255,255,0.3)` | numeral |

Hover `background: rgba(255,255,255,0.04)`. `aria-current="page"` on current. Use an `<ol>`. Responsive: below ~1100px collapse into `<details><summary>Lesson 6 of 8 · In this course</summary>` above the content (static, no JS). Lesson.

### 10.5 TutorAvatar

`<span aria-hidden="true" style="flex:none; width:32px; height:32px; border-radius:10px; background:#C6FF3D; display:grid; place-items:center">` + `tutor` icon 18px. Main preview: 30px, radius 9px. Authoring preview: 26px radius 8px, empty (no icon). Static.

### 10.6 TutorMessage

`<div style="display:flex; gap:14px; align-items:flex-start">` + TutorAvatar + content `flex column; gap:14px; font-size:17px; line-height:1.7; color:#D5D8E3` with first `<p style="margin:3px 0 0">`. `<strong style="color:#ECEEF5">`, inline code `font-family:Geist Mono; color:#3DE3FF` (rendered as `<code>`). Main preview uses 16px/1.6, gap 14. Attached blocks (OddsBars, Tokenizer, quiz) indent `margin-left:46px` (avatar 32 + gap 14). Max width 760 (column). A11y: wrap in `<article>` or `<section>`; add `<span class="sr-only">Tutor:</span>`. Static (server-rendered lesson text — must work with JS off). Lesson, Main, Authoring preview. 360px: avatar 28px, gap 10, attached block margin-left 0.

### 10.7 LearnerBubble

`align-self:flex-end; max-width:82% (Lesson) / 80% (Main); padding:12px 16px; border-radius:16px 16px 4px 16px; background:#1A1E2D; color:#ECEEF5`. Prompt variant (Lesson runs): Geist Mono 14px lh 1.55 `white-space:pre-wrap`. Plain variant (Main): Geist 16px. SR prefix "You:". At 360px max-width 90%. Static (runs are appended by the composer island).

### 10.8 ModelOutput

`margin-left:46px; padding:14px 16px; border-radius:14px; border:1px solid rgba(61,227,255,0.25); background:rgba(61,227,255,0.04); flex column; gap:8px` → meta mono 12px ion `model · T={t} · {tokens} tokens` → output 18px lh 1.5 `#ECEEF5`.

States (proposed, none drawn): streaming = output text with trailing `▍` caret (ion), meta `model · T=1.0 · streaming…`, container `aria-busy="true"`; example fallback (rate limit / offline) = meta `example output · T=1.0` and a MetaTag ion "example output" (handoff: label it "example output"); error = warn recipe "Couldn't reach the model — showing the example output." Wrap the runs list in `aria-live="polite"` (announce on completion, not per token). Island (streaming). Lesson. Main's tokenizer panel uses the same container recipe.

### 10.9 PromptComposer

The most important input. `<form class="composer" style="display:flex; flex-direction:column; gap:12px; padding:16px; border-radius:18px; background:#0A0C14; border:1px solid rgba(198,255,61,0.4); transition:border-color .2s, box-shadow .2s">`

1. Header `display:flex; align-items:center; gap:10px; flex-wrap:wrap`: YourTurnTag + `<label for="prompt" style="font-size:14px; color:#9AA0B4">` task text ("Write the prompt yourself — no pasting the answer").
2. `<textarea id="prompt" rows="3" placeholder="Write a tagline for…" style="resize:vertical; min-height:84px; background:transparent; border:0; color:#ECEEF5; font:16px/1.6 Geist Mono">`; placeholder `#7A8098`; `outline:none` (container shows focus).
3. CheckChip row `display:flex; flex-wrap:wrap; gap:8px`.
4. Footer `display:flex; align-items:center; gap:10px; flex-wrap:wrap; padding-top:4px; border-top:1px solid rgba(255,255,255,0.06)`: "run at" mono 12px `#7A8098` (`padding-top:10px`) → TemperaturePicker (`padding-top:10px`) → `margin-left:auto` `~{draftTokens} tokens` mono 12px `#7A8098` → Keycap `m` primary `<button type="submit">` "Run ↵" (`margin-top:10px`).

States:
- default border `rgba(198,255,61,0.4)`.
- focus-within `border-color: rgba(198,255,61,0.75); box-shadow: 0 0 0 4px rgba(198,255,61,0.12)`.
- System sample "focused": `border:1px solid rgba(198,255,61,0.5); box-shadow:0 0 0 4px rgba(198,255,61,0.1)`, radius 16, padding 14, gap 10, footer text `8 tokens · temp 0.7`.
- running (proposed): Run keycap disabled + label "Running…", textarea `readonly`.
- passed: RewardToast appears above the composer; composer stays usable.
- empty draft: Run does nothing (script returns early) → set `aria-disabled` when empty.

Behaviour: Enter runs, Shift+Enter newline (handoff). `draftTokens = max(1, round(len/4))`. Live checks evaluated on every input (regex from `:::prompt`). Runs keep last 4. Draft persisted (localStorage / `draft_saved`) so mode switches keep it. With JS off the lesson text still renders; show the composer with Run disabled and a note "Turn on JavaScript to run prompts". Island. Lesson. Static decorative variants: Main preview composer (`padding:12px 14px; border-radius:14px; background:#0A0C14; border:1px solid rgba(198,255,61,0.35)` single row: YourTurnTag + placeholder `Type a sentence to tokenize▍` 15px mono `#7A8098` + `↵ run` 12px `#7A8098`), Main mode-card skeleton composer (`height:34px; border-radius:9px; border:1px solid rgba(198,255,61,0.45)` "› your prompt here▍" 12px volt), Authoring preview (border `.4`, radius 14, padding 14, gap 10, task 14px).

360px: footer wraps into two rows (run-at + temps / tokens + Run); Run keycap full width on ≤360px.

### 10.10 CheckChip

`<span style="display:flex; align-items:center; gap:8px; padding:6px 10px; border-radius:8px; font-size:13px; background:{bg}; color:{fg}; border:1px solid {line}">` + `<span aria-hidden="true" style="font-family:Geist Mono">{mark}</span>{label}`.

| State | mark | bg | line | fg |
|---|---|---|---|---|
| pending | `○` | transparent | `rgba(255,255,255,0.12)` | `#9AA0B4` |
| passed | `✓` | `rgba(198,255,61,0.12)` | `rgba(198,255,61,0.45)` | `#E4FF9E` |

Authoring preview: `padding:4px 8px; border-radius:6px; font-size:12px`. Render the list as `<ul aria-label="Checks">` with SR text "passed"/"not yet" per item; announce changes politely (debounced). Checks from the sample: "Asks for a tagline" `/tagline|slogan/i`; "Coffee + moon" `/coffee|caf[eé]/i` && `/moon|lunar/i`; "Sets a length limit" `/\bwords?\b|\bshort\b|\bunder\b|\bmax/i`; "Ran at 0 and 1.0" (a run at T=0 and one at T≥1.0). Island (part of composer). Lesson, Authoring.

### 10.11 TokenPill + TokenizerPanel

TokenPill: `padding:6px 8px; border-radius:7px; font:15px Geist Mono; white-space:pre; color:#ECEEF5; background:{tint}; border:1px solid {line}`. Tints cycle by index `i % 3`: volt `rgba(198,255,61,0.12)`/`rgba(198,255,61,0.35)`; ion `rgba(61,227,255,0.12)`/`rgba(61,227,255,0.35)`; synapse `rgba(157,133,255,0.14)`/`rgba(157,133,255,0.4)`. With id: wrapper `display:flex; flex-direction:column; align-items:center; gap:4px` + id mono 10px `#7A8098`. Leading spaces are significant: keep `white-space:pre` and render the raw space (the design shows no space marker).

TokenizerPanel (`:::tokenizer`): `border:1px solid rgba(61,227,255,0.25); background:rgba(61,227,255,0.04); border-radius:14px; padding:16px; flex column; gap:12px` → header `display:flex; justify-content:space-between; font:12px Geist Mono; color:#3DE3FF` "tokenizer" / "8 tokens · 31 characters" → pills `display:flex; flex-wrap:wrap; gap:6px`. Sample tokens: `[["Un","1844"],["believ","31141"],["ably","2915"],[",","11"],[" the","279"],[" cat","8415"],[" fetched","42118"],[".","13"]]`. A11y: list (`<ol aria-label="Tokens">`), each `<li>` with `aria-label="Un, token 1844"`. Island when live (typing re-tokenizes); static for fixed samples. Main, System, Lesson (block).

### 10.12 OddsBars (`:::odds`)

Panel `margin-left:46px; padding:22px; border-radius:18px; background:#0E1018; border:1px solid rgba(61,227,255,0.28); flex column; gap:18px`:
1. Header `display:flex; justify-content:space-between; align-items:baseline; gap:12px; flex-wrap:wrap`: mono 13px `#9AA0B4` "Moon café tagline: <span #ECEEF5>“___</span>" + mono 12px ion "next-token odds".
2. Bars `flex column; gap:10px`; each row `display:grid; grid-template-columns:88px 1fr 56px; gap:12px; align-items:center`: token mono 15px `white-space:pre` `#ECEEF5` · track `height:22px; border-radius:6px; background:rgba(255,255,255,0.05); overflow:hidden` with fill `.bar` `height:100%; width:{w}; background:{c}; border-radius:6px; transition: width .35s cubic-bezier(.2,.8,.2,1)` · % mono 13px `#C6CAD6` right-aligned. Top candidate fill `#3DE3FF`, others `rgba(61,227,255,0.45)`. `w = max(1, p*100).toFixed(1)%`.
3. Slider row `display:flex; align-items:center; gap:16px; flex-wrap:wrap; padding-top:4px; border-top:1px solid rgba(255,255,255,0.06)`: `<label for="temp">` mono 13px `#9AA0B4` "temperature" (`padding-top:12px`) · `<input type="range" min="0" max="150" step="5">` `flex:1; min-width:180px; height:32px; margin-top:12px; accent-color:#C6FF3D` · value badge `padding:6px 10px; margin-top:12px; border-radius:8px; background:#0A0C14; border:1px solid rgba(255,255,255,0.1); font:14px Geist Mono; color:#C6FF3D; min-width:44px; text-align:center` (`T.toFixed(2)`, e.g. `0.70`).
4. Note 14px lh 1.5 `#9AA0B4` (`tempNote`).

Maths: `cands = [[" Brew",3.1],[" One",2.4],[" Lunar",1.9],[" Fly",1.2],[" Zero",0.6]]`; `T = slider/100`; if `T < 0.05` → one-hot on first; else softmax(`logit/T`). Notes: `T<0.05` "At 0 the favourite wins every time. Same prompt → same answer." · `T<0.6` "Sharp: the top token dominates, but a runner-up sneaks in now and then." · `T<1.05` "Balanced: plausible variety. Most chat apps live around here." · else "Flat: long shots get real odds. Creative — and occasionally unhinged." Default slider 70.

A11y: bars as `<table>` or `<ul>` with text %; slider `aria-valuetext="0.70"`; note `aria-live="polite"`. Reduced motion: no width transition. Island (static render at default T for no-JS). 360px: grid `64px 1fr 44px`, margin-left 0, slider `min-width:0; flex-basis:100%`. Lesson; Authoring preview mini (`grid 56px 1fr; gap 10px; bar height 14px radius 4px`, slider drawn as text `temperature ━━━━━━○━━━ 0.70`).

### 10.13 RewardToast

Lesson (inline, after runs): `class="pop"` `display:flex; align-items:center; gap:16px; flex-wrap:wrap; padding:16px 20px; border-radius:18px; background:#C6FF3D; color:#0A0C05; box-shadow:0 24px 70px rgba(198,255,61,0.25)` → `hex-check` 40px → text `flex:1; min-width:200px; flex column; gap:2px` (Unbounded 700 20px "+40 neurons"; 15px "Same prompt, different answers — and now you know why.") → InverseKeycap "Next: Top-p →".
System: `gap:14px; padding:14px 18px; border-radius:16px; box-shadow:0 20px 60px rgba(198,255,61,0.25)`; icon 36px; title 18px "+40 neurons"; body 14px "Prompt passed all 3 checks"; no action.

Props `{ xp, message, next?: {href, label} }`. Animation `pop .6s cubic-bezier(.2,1.4,.4,1) both` (none under reduced motion). A11y: `role="status"` (polite) container present before insertion; move focus to the Next link only if the learner isn't typing. Island-inserted (appears when checks pass). Lesson, System.

### 10.14 CodeEditor (`:::code`)

Container `flex:1; display:flex; flex-direction:column; border-radius:18px; background:#0A0C14; border:1px solid rgba(255,255,255,0.09); overflow:hidden; box-shadow:0 30px 90px rgba(0,0,0,0.45)`.

1. **Toolbar** `display:flex; align-items:stretch; border-bottom:1px solid rgba(255,255,255,0.07); background:#07080D; flex-wrap:wrap`:
   - File tabs `role="tablist" aria-label="Files"; display:flex; font:13px Geist Mono`. Tab: `display:flex; align-items:center; gap:8px; padding:0 16px; min-height:46px; border-right:1px solid rgba(255,255,255,0.07)` + lang badge (`TS` ion, `#` `#9AA0B4`) + filename. Selected: `background:#0A0C14; color:#ECEEF5; box-shadow:inset 0 2px 0 #C6FF3D`. Unselected: `color:#9AA0B4`, no bg. Last tab has no right border. Must be `<button role="tab" aria-selected aria-controls>` with arrow-key roving (artboard uses spans). Hover (proposed): `color:#ECEEF5`.
   - Actions `margin-left:auto; display:flex; align-items:center; gap:8px; padding:6px 10px`: ToolButton "⌨ Type it" (`aria-pressed`) + Copy keycap `xs`.
2. **Type-mode banner** (when on, `.rise`): `display:flex; align-items:center; gap:12px; flex-wrap:wrap; padding:10px 16px; background:rgba(198,255,61,0.08); border-bottom:1px solid rgba(198,255,61,0.25); font:12px Geist Mono; color:#E4FF9E` "Type mode — retype the loop from memory. Copy is off." + `margin-left:auto; color:#ECEEF5` "142 / 486 chars · 97% accurate".
3. **Code area** `flex:1; overflow-x:auto; padding:14px 0 18px` → inner `min-width:560px; font:14px/1.75 Geist Mono`. Line `.codeline` `display:flex; background:{bg}; opacity:{op}` → marker `flex:none; width:4px; background:{mark}` → gutter `aria-hidden; flex:none; width:44px; padding-right:16px; text-align:right; color:{numC}; user-select:none` → code `white-space:pre` of coloured segments (+ blinking `▍` volt caret at the type cursor).

   | Line state | bg | mark | numC |
   |---|---|---|---|
   | normal | transparent | transparent | `#4A5068` |
   | in highlight range (`highlight="12-32"`) | `rgba(198,255,61,0.035)` | `rgba(198,255,61,0.35)` | `#9AA0B4` |
   | focus line (31) | `rgba(198,255,61,0.10)` | `#C6FF3D` | `#C6FF3D` |
   | type mode, not yet typed (n > cursor line) | — | — | — + `opacity:0.28` |
   | hover | `rgba(255,255,255,0.025)` | | |

   Syntax colours: tokens.md §1.4 (build-time highlighting per handoff — map Shiki scopes to these 7 colours).
4. **Status bar** `display:flex; align-items:center; gap:16px; padding:8px 16px; border-top:1px solid rgba(255,255,255,0.07); background:#07080D; font:12px Geist Mono; color:#9AA0B4; flex-wrap:wrap`: "TypeScript" · "UTF-8" · "Ln 31, Col 5" · `margin-left:auto; color:#C6FF3D` "● lines 12–32: the loop".

Copy keycap states: default `bg #C6FF3D / fg #0A0C05 / edge #6E9116` "Copy"; copied (1600ms) `#3DE3FF / #07080D / #1A8FA3` "Copied ✓"; type mode `#1C2030 / #7A8098 / #020305` "Copy off" (disabled). `box-shadow: 0 3px 0 {edge}`; Code's `.key:active{transform:translateY(2px)}` (canonical 3px + `0 1px 0` edge).

Type mode (proposed mechanics; artboard is static): hidden textarea captures keys; typed chars render over the ghosted source; mismatches tinted (use warn colour); accuracy and char count update; `aria-pressed` on toggle; announce "Type mode on. Copy is off." Copy uses `navigator.clipboard.writeText`. A11y: code region `role="region" aria-label="agent.ts"`; keep code selectable (except gutter); type-mode banner `aria-live="polite"`.

Responsive: the code area scrolls horizontally (`min-width:560px` inner); at ≤480px font 13px, gutter 36px; toolbar wraps tabs above actions. Island (tabs, copy, type mode); first file renders statically with JS off (Copy hidden without JS). CodeLesson; Main static mini (`height:200px; background:#0A0C14; border:1px solid rgba(255,255,255,0.06); border-radius:12px; padding:16px 16px 16px 0; font:12px/1.75 Geist Mono; grid 36px 1fr`, Copy tag `top:12px; right:12px; padding:5px 9px; border-radius:7px; background:rgba(255,255,255,0.08); font-size:11px`).

### 10.15 TerminalLog (Terminal mode lesson)

`<section aria-label="Lesson" class="term" style="flex:1 1 460px; min-width:0; display:flex; flex-direction:column; border-radius:18px; background:#090A10; border:1px solid rgba(255,255,255,0.09); overflow:hidden; font:14px/1.7 Geist Mono; transition:border-color .2s">`; `:focus-within` border `rgba(198,255,61,0.55)`.

1. Title row `display:flex; align-items:center; gap:12px; padding:12px 16px; border-bottom:1px solid rgba(255,255,255,0.07); font-size:12px; color:#9AA0B4`: `bits` (volt) · `~/first-agent-loop` · `margin-left:auto` "lesson 4/10 · 18% →".
2. Log `flex:1; padding:20px 20px 8px; flex column; gap:18px; color:#C6CAD6`. Entry types:
   - learner line: `<span volt>› </span><span #ECEEF5>{text}</span>`
   - tutor: `flex column; gap:6px` → `◆ tutor` volt → body `padding-left:18px; white-space:pre-wrap; color:#D5D8E3` (inline ion `"tool_use"`; inline highlight `color:#ECEEF5; background:rgba(198,255,61,0.14); padding:0 4px; border-radius:4px`) → optional pointer `padding-left:18px; color:#9AA0B4` "↳ highlighted <span #ECEEF5>agent.ts</span> lines 12–32" (should be a button that scrolls/focuses the editor range).
   - command: `<span synapse>$ </span><span #ECEEF5>npx tsx agent.ts "Weather in Chicago?"</span>` + output box `margin-left:18px; padding:12px 14px; border-radius:10px; background:#0E1018; border:1px solid rgba(255,255,255,0.06); flex column; gap:2px; font-size:13px` (rows: `→ tool_use   ` ion, `← tool_result` volt, `→ end_turn   ` ion; summary `margin-top:6px; color:#9AA0B4` "✓ 2 turns · 1 tool call · 1.8s").
   - quiz: tutor + ToolButton options row `padding-left:18px; display:flex; gap:8px; flex-wrap:wrap`.
   - appended log entries animate `.rise` (.35s ease 6px); keep last 3 (prototype).
3. TerminalInput `<form style="display:flex; align-items:center; gap:10px; margin:12px; padding:0 8px 0 14px; border-radius:12px; background:#0E1018; border:1px solid rgba(198,255,61,0.35)">` → `›` volt (`aria-hidden`) → visually hidden label "Answer or ask the tutor" → `<input placeholder="answer, ask, or type “hint”" autocomplete="off" style="flex:1; min-width:0; height:50px; background:transparent; border:0; color:#ECEEF5; font:14px Geist Mono">` → `↵` 12px `#7A8098`. Replies: contains "hint" → "Look at what the API requires after a tool_use block. What's missing if line 31 is gone?"; else "Good guess. Now delete line 31, hit Run, and read the first line of the error out loud."

A11y: log `role="log" aria-live="polite"`; each tutor block readable in order with JS off (server-rendered). Island (input + appends). CodeLesson; also renders non-code lessons in Terminal mode (plain markdown → tutor blocks, `:::prompt` → the composer re-skinned as TerminalInput + CheckChips).

### 10.16 OutputPanel (`:::terminal`)

`border-radius:18px; background:#090A10; border:1px solid rgba(255,255,255,0.09); overflow:hidden` → header `display:flex; align-items:center; justify-content:space-between; gap:12px; padding:10px 16px; border-bottom:1px solid rgba(255,255,255,0.07)`: "OUTPUT" mono 12px `#9AA0B4` + Keycap `s` "▶ Run" (`min-height:36px; padding:0 14px; border-radius:9px; font:500 12px Geist Mono; box-shadow:0 3px 0 #6E9116`) → body `padding:14px 16px; font:13px/1.8 Geist Mono; color:#C6CAD6`: `$` synapse + command; `turn 1` ion `stop_reason=` + volt `"tool_use"` `→ get_weather`; `turn 2 stop_reason="end_turn"`; final line `#ECEEF5`. `aria-live="polite"` on body. Island (Run replays the scripted log line by line, 120ms/line, respecting reduced motion → instant). CodeLesson.

### 10.17 VideoPlayer

Container `position:relative; aspect-ratio:16/9; border-radius:20px; overflow:hidden; background:#0A0C14; border:1px solid rgba(255,255,255,0.08)`.
- Poster placeholder (design): dot grid `radial-gradient(rgba(61,227,255,0.16) 1px, transparent 1px) 18px` + four ion bars (`height:26px; border-radius:6px`, widths 78/44/26/12%, opacity .85/.6/.45/.3) at `left:12%; right:12%; top:22%; gap:12px`. Real player: `<video>` fills container (`object-fit:cover`), poster = Stream thumbnail.
- Big play `<button aria-label="Play video" style="position:absolute; left:50%; top:50%; transform:translate(-50%,-50%); width:84px; height:84px; border-radius:999px; border:0; background:#ECEEF5; display:grid; place-items:center; box-shadow:0 20px 60px rgba(0,0,0,0.5)">` + play icon 26×30 `#07080D`. Hidden while playing.
- Control bar `position:absolute; left:0; right:0; bottom:0; padding:16px 18px; flex column; gap:12px; background:rgba(7,8,13,0.78)`:
  - Chapter scrubber `aria-label="Chapters"` `display:flex; gap:4px`; segment per chapter `flex:{duration weight}; height:5px; border-radius:3px`: played `#3DE3FF`; partially played `linear-gradient(90deg, #3DE3FF 40%, rgba(255,255,255,0.22) 40%)`; unplayed `rgba(255,255,255,0.22)`. Sample flex 2/3/2/3. Implement as `<input type="range">` overlay for keyboard seeking (`aria-valuetext="1:52 of 4:30, Chapter 2: Sharpening the odds"`), segments are visual.
  - Row `display:flex; align-items:center; gap:8px; font:13px Geist Mono; color:#D5D8E3`: Play/Pause ToolButton 40×40 (pause icon) · "1:52 / 4:30" · `margin-left:auto; color:#9AA0B4` "Chapter 2 · Sharpening the odds" · speed ToolButton "1.25×" (cycles 1, 1.25, 1.5, 2, 0.75) · CC ToolButton (`aria-pressed`, label "Captions"; the artboard's `aria-label="Captions on"` should be `aria-pressed="true"` + label "Captions").
- Keyboard: Space/K play-pause, ←/→ 5s, J/L 10s, C captions, chapters via [ ].
- Main ModeCard thumb variant: `height:200px; border-radius:12px; background:#0A0C14; border:1px solid rgba(255,255,255,0.06)`, dots `rgba(61,227,255,0.18)` 14px, 60px play disc `#ECEEF5`, bars `left/right/bottom:14px; gap:4px; height:4px; radius 2px` flex 3/2/4/2 (first ion, rest `rgba(255,255,255,0.2)`).

360px: control row wraps: chapter title drops to its own line (`flex-basis:100%; order:3`), buttons 44px. Island (hls.js, dynamic import). Lesson (Watch).

### 10.18 Transcript

SectionCard (padding 22, radius 18, gap 10, `flex:999 1 420px; min-width:0`) + eyebrow-s `TRANSCRIPT · FOLLOWS ALONG` (`#9AA0B4`) + cue paragraphs 16px/1.7: past `#7A8098`, active `padding:10px 12px; border-radius:10px; background:rgba(61,227,255,0.08); color:#ECEEF5`, upcoming `#9AA0B4`. Each cue is a `<button>`/link that seeks (`aria-current="true"` on active). Auto-scroll within a `max-height` (proposed 320px) container, paused while the user scrolls. Sample cues: "So the model has a ranked list of candidates for the next token…" / "Temperature divides every score before they become probabilities. Divide by a small number and the gaps get huge." / "Divide by a big number and everything starts to look the same…". Island (sync); static full transcript with JS off. Lesson (Watch).

---

## 11. Progress and identity

### 11.1 HexBadge

Base path `M11 1.5 L19.2 6.25 L19.2 15.75 L11 20.5 L2.8 15.75 L2.8 6.25 Z` in a `0 0 22 22` viewBox.

| Variant | Markup | Where |
|---|---|---|
| `earned` (grid, 56px) | `<svg width="56" height="56" viewBox="0 0 22 22" role="img" aria-label="{name}"><path d="…" fill="{fill}" stroke="{fill}" stroke-width="0.6" stroke-dasharray="0"></path><text x="11" y="13.2" text-anchor="middle" font-family="Unbounded, sans-serif" font-size="5" font-weight="700" fill="#07080D">{g}</text></svg>` | Profile |
| `locked` (grid) | same with `fill="transparent" stroke="#7A8098" stroke-dasharray="1 1"`, text fill `#7A8098`, wrapper `opacity:0.45` | Profile |
| `preview` (40px) | `<svg width="40" height="40" viewBox="0 0 22 22" aria-hidden="true"><path d="…" fill="none" stroke="#3DE3FF" stroke-width="1.2" stroke-dasharray="2 2"></path><text x="11" y="14" text-anchor="middle" font-family="Unbounded, sans-serif" font-size="6" font-weight="700" fill="#3DE3FF">T°</text></svg>` | Course |
| `chip` (22px) | `<path … fill="{fill}"><circle cx="11" cy="11" r="3" fill="#07080D">` | Main BadgeChip |
| `reward` | hex-check icon | Toast |

Grid item (`.badge`): `display:flex; flex-direction:column; align-items:center; gap:8px; text-align:center; opacity:{1|.45}` + name 12px lh 1.3 `#C6CAD6`. Hover `translateY(-4px) rotate(-3deg)` (.25s spring). Grid `repeat(3, minmax(0,1fr)); gap:14px 10px`. Locked a11y: aria-label "{name} — locked". **Contrast**: locked at `.45` opacity gives 1.9–3.2:1 → use opacity 1 with `#7A8098` stroke and `#9AA0B4` name instead (see README).

Badge data (Profile): `First token` `1st` `#C6FF3D` earned; `Few-shot` `×3` `#9D85FF`; `Streak ×7` `7d` `#E4FF9E`; `Temperature tamer` `T°` `#3DE3FF`; `Graduate` `LLM` `#C6FF3D`; locked: `Tool wielder` `fn`, `Loop closer` `∞`, `Streak ×30` `30d`, `Shipped` `↗`. Heading says "5 of 12" but 9 are drawn — show all defined badges. Badge preview row (Course): `display:flex; align-items:center; gap:12px; padding:14px; border-radius:14px; background:#0A0C14` + preview hex + "Temperature tamer" 14px 600 + "badge + 320 neurons on finish" 13px `#9AA0B4`. Static.

### 11.2 BadgeChip

`<span style="display:flex; align-items:center; gap:8px; padding:8px 12px 8px 8px; border-radius:999px; border:1px solid rgba(255,255,255,0.1); background:#0A0C14; font-size:13px; color:#D5D8E3">` + chip hex 22px + name. Main data: First token `#C6FF3D`, Temperature tamer `#3DE3FF`, Few-shot `#9D85FF`, Streak ×7 `#E4FF9E`, Tool wielder `#3B4157`. Static.

### 11.3 ActivityGrid

SectionCard (22/18/16) → header `display:flex; justify-content:space-between; gap:12px; flex-wrap:wrap`: MonoHeading "ACTIVITY · LAST 26 WEEKS" (no text-transform, literal caps) + legend `display:flex; align-items:center; gap:6px; font:11px Geist Mono; color:#9AA0B4` "less" + 4 swatches (`12×12; border-radius:3px`) + "more".
Grid wrapper `overflow-x:auto` → `<div role="img" aria-label="…" style="display:grid; grid-template-columns:repeat(26,14px); grid-template-rows:repeat(7,14px); grid-auto-flow:column; gap:4px; min-width:max-content">` 182 cells `<span class="cell" style="border-radius:3px; background:{level}">`.
Levels: 0 `rgba(255,255,255,0.05)`, 1 `rgba(198,255,61,0.25)`, 2 `rgba(198,255,61,0.55)`, 3 `#C6FF3D`. Hover `outline:1px solid #ECEEF5`. Columns = weeks (oldest left), rows = days (Mon→Sun by user timezone). Level thresholds (proposed): 0 none; 1 = 1 event; 2 = 2–4; 3 = ≥5 (events = lesson completions + exercise passes).
A11y: `role="img"` + summary label ("Activity heatmap: active 41 of the last 182 days; current streak 12 days") plus a visually hidden `<table>` or per-cell `title` on hover. Sample generation: seeded PRNG seed 42, `i>168 → lvl 2|3`, else probability `0.15 + (i/182)*0.55`. 360px: grid 26×14 + 25×4 = 464px → horizontal scroll inside the card (already `overflow-x:auto`); scroll to the right end on load (most recent). Static.

### 11.4 JournalEntry

`padding:16px 18px; border-radius:14px; background:#0A0C14; border:1px solid rgba(255,255,255,0.07); flex column; gap:10px` → prompt mono 14px lh 1.6 `#ECEEF5` with `›` volt prefix → meta `display:flex; gap:12px; flex-wrap:wrap; font:12px Geist Mono; color:#9AA0B4`: lesson ref + result (volt for passed, ion for runs). Never shown on the public profile. Static.

---

## 12. Marketing (Main) and canvases

### 12.1 FeatureRow

List `flex column; gap:2px; border-top:1px solid rgba(255,255,255,0.08)`; row `display:flex; gap:20px; padding:18px 0; border-bottom:1px solid rgba(255,255,255,0.08); align-items:baseline` → key mono 13px volt `width:56px; flex:none` (`READ`/`TYPE`/`RUN`) → text 17px lh 1.5 `#D5D8E3`. Use `<dl>`. Static.

### 12.2 TrackCard

`<a class="card-lift" style="display:flex; flex-direction:column; gap:18px; text-decoration:none; color:#ECEEF5">` → number disc `width:72px; height:72px; border-radius:999px; display:grid; place-items:center; background:#07080D; border:1px solid {ring}; font:700 20px Unbounded; color:{colour}; box-shadow:0 0 0 6px #07080D` → glass body `flex column; gap:14px; padding:24px; border-radius:18px; background:rgba(12,14,22,0.78); backdrop-filter:blur(14px); border:1px solid rgba(255,255,255,0.09); min-height:260px; box-sizing:border-box`: eyebrow-s track (uppercase, colour) → title Unbounded 500 22px lh 1.15 ls -0.02em → desc 15px lh 1.55 `#9AA0B4` → courses `margin-top:auto; flex column; gap:6px` each `display:flex; align-items:center; gap:8px; font-size:14px; color:#D5D8E3` with 5px dot in track colour. Hover `.card-lift`: `translateY(-4px); border-color: rgba(198,255,61,.35)` — note the hover border targets the `<a>`, which has no border; apply it to the glass body. Trace line behind discs: `.trace` `position:absolute; left:36px; right:36px; top:35px; height:0; border-top:1px dashed rgba(198,255,61,0.4)`, hidden ≤820px. Links to `/courses?track=…`. Static.

### 12.3 ModeCard

Glass `flex column; gap:20px; padding:24px; border-radius:20px; background:rgba(12,14,22,0.8); backdrop-filter:blur(14px); border:1px solid rgba(255,255,255,0.09)` → 200px illustration well (`aria-hidden`) → text `flex column; gap:8px`: eyebrow-s (no transform; literal caps) coloured, title Unbounded 500 22px ls -0.02em, desc 15px lh 1.55 `#9AA0B4`. Three illustrations: Read skeleton (bars `#262B3C` 8px radius 4 at 82/64/74%, bubble `#1F2436` 28px radius `10px 10px 3px 10px` width 46%, composer 34px volt line), Watch (VideoPlayer thumb), Run (static CodeEditor mini). Static.

### 12.4 LessonPreviewCard

Glass `background:rgba(12,14,22,0.78); backdrop-filter:blur(18px); border:1px solid rgba(255,255,255,0.1); border-radius:22px; overflow:hidden; box-shadow:0 40px 120px rgba(0,0,0,0.55)` → header (`padding:16px 20px; border-bottom; space-between; flex-wrap`) mono 12px `#9AA0B4` "Lesson 2 · Tokens, not words" + SegmentedTabs `mode-static` → body `padding:26px 24px; flex column; gap:20px` (TutorMessage, LearnerBubble, TokenizerPanel, TutorMessage + QuizChoice) → footer `padding:14px; border-top` static composer. Decorative: buttons inside are fake → render them as non-interactive spans or make the whole card `inert`/`aria-hidden` and provide a text summary; otherwise focus lands on fake controls. Static.

### 12.5 ProgressShowcase

Glass `padding:28px; border-radius:24px; background:rgba(12,14,22,0.82); backdrop-filter:blur(16px); border:1px solid rgba(255,255,255,0.1); flex column; gap:24px; box-shadow:0 40px 120px rgba(0,0,0,0.5)` → row (ProgressRing 132 + text `flex:1; min-width:200px; gap:6px`: mono 12px `#9AA0B4` "Your context window", Unbounded 500 22px lh 1.2 "Foundations track, 5 of 8 lessons", 15px `#9AA0B4` "Up next: Temperature & randomness") → StatTile `main` ×3 (`grid repeat(3, minmax(0,1fr)); gap:10px`) → BadgeChip row (`flex; gap:10px; wrap`). 360px: stat grid stays 3-up (each ~90px; value 24px fits "1,240") or switch to `repeat(auto-fit, minmax(90px,1fr))`. Static.

### 12.6 StageHud

`.hud` `position:absolute; right:32px; top:50%; transform:translateY(-50%); flex column; gap:16px; align-items:flex-end` inside the sticky field layer. Item `display:flex; align-items:center; gap:12px; font:11px Geist Mono; letter-spacing:0.14em; text-transform:uppercase; color:{on ? #C6FF3D : #7A8098}; transition:color .4s` → "{n} · {label}" + bar `display:block; height:2px; width:{on ? 36px : 12px}; background:{on ? #C6FF3D : rgba(255,255,255,0.2)}; transition: width .5s ease, background .5s`. Stages `01 Neurons`, `02 Tokens`, `03 Agents`, `04 You`. Hidden ≤820px. `aria-hidden` (whole field layer). Updated only when the stage index changes. Island (part of NeuralField).

### 12.7 NeuralField

See `pages/Main.md §NeuralField` for the full port guide. Island, client-only, dynamic `import('three')` after first paint; `aria-hidden`; static fallback = dot grid + vignette.

### 12.8 BrainCanvas (Auth)

Left panel canvas (`position:absolute; inset:0`). Fibonacci sphere, 2,800 points radius 3, breathing vertex displacement, ion→volt colour by displacement; orbit ring of 900 synapse points at r≈4.4. Details in `pages/Auth.md`. Island, client-only; fallback = dot grid only.

### 12.9 SessionPanel (Auth)

`padding:16px 18px; border-radius:14px; background:rgba(10,12,20,0.78); backdrop-filter:blur(12px); border:1px solid rgba(255,255,255,0.08); font:13px/1.9 Geist Mono; color:#9AA0B4` with lines: `› session.restore()` (`›` volt), `✓ 5 lessons · 12-day streak · 1,240 neurons` (`✓` ion), `✓ resuming “Temperature & randomness”▍` (caret volt, blinking). Decorative → `aria-hidden` or real data for returning users. Static.

---

## 13. Authoring

### 13.1 ValidationItem

`padding:10px 12px; border-radius:10px; font:13px Geist Mono`:
- ok: `background:#0A0C14; color:#D5D8E3` + `✓` volt.
- warning: `background:rgba(255,184,77,0.08); border:1px solid rgba(255,184,77,0.35); color:#FFD08A` + `!`.
- error (proposed): danger recipe, `✕`, blocks Publish (disable keycap, `aria-disabled`, tooltip text "Fix 1 error to publish").
Grid `repeat(auto-fit, minmax(min(280px,100%),1fr)); gap:8px`. Render as `<ul>`; prefix SR text "OK:", "Warning:", "Error:". Static.

### 13.2 FileTree

`flex:1 1 240px; max-width:300px; padding:20px; border-radius:18px; background:#0A0C14; border:1px solid rgba(255,255,255,0.08); font:13px/2 Geist Mono; color:#C6CAD6`. Indent 14px per level (`padding-left:14/28/42px`); folders `#9AA0B4`; `course.md` ion; selected file `padding-left:22px; margin-left:6px; border-radius:6px; background:rgba(198,255,61,0.1); color:#ECEEF5`. Use nested `<ul role="tree">` only if interactive; otherwise plain nested lists, selected item `aria-current="true"`. Items should be links/buttons (≥44px tall on touch: line-height 2 × 13px = 26px → add padding on coarse pointers). Static (or island if file switching).

### 13.3 SourceViewer

`flex:999 1 420px; min-width:0; border-radius:18px; background:#0A0C14; border:1px solid rgba(255,255,255,0.08); overflow:hidden; flex column` → header `display:flex; align-items:center; justify-content:space-between; padding:12px 16px; border-bottom:1px solid rgba(255,255,255,0.07); font:12px Geist Mono; color:#9AA0B4` (filename `#ECEEF5` / "markdown") → `<pre style="margin:0; padding:18px; overflow-x:auto; font:13px/1.75 Geist Mono; color:#C6CAD6">` (colours in tokens §1.4). Preview pane: same shell with `background:#07080D`, header "Preview" / "● live" volt, body `padding:20px; flex column; gap:16px`. `<pre>` needs `tabindex="0"` (scrollable region). Static.

### 13.4 BlockTable

`overflow-x:auto; border-radius:18px; border:1px solid rgba(255,255,255,0.08)` → `<table style="width:100%; min-width:760px; border-collapse:collapse; font-size:14px">`; thead row `background:#0E1018; text-align:left`, `th scope="col"` `padding:14px 18px; font:500 12px Geist Mono; color:#9AA0B4`; body rows `border-top:1px solid rgba(255,255,255,0.07)`; cells `padding:14px 18px`: name mono volt nowrap, attrs mono 13px `#B9A6FF`, description `#D5D8E3` lh 1.5. Wrapper needs `tabindex="0" role="region" aria-label="Block reference"` for keyboard scrolling. 360px: scrolls horizontally (min-width 760). Static.

### 13.5 RepoSyncCard

SectionCard (28/20/16, `min-height:240px`) → header `display:flex; align-items:center; gap:12px`: github icon 22px + Unbounded 500 19px "Or sync a repo" + `margin-left:auto` LiveDot volt "● connected" → fields grid (`auto-fit minmax(min(150px,100%),1fr); gap:10px`): TextField compact "Repository" (`[org]/courses`), "Branch" (`main`) → note 14px lh 1.55 `#9AA0B4` "Every push to <code #ECEEF5>main</code> rebuilds changed courses. Pull requests get a preview link." Disconnected state (proposed): LiveDot `#7A8098` "● not connected" + Keycap dark `m` "Connect GitHub". Progressive form (`method="post"`). Authoring.

---

## Island summary

| Island | Components inside | Trigger to load |
|---|---|---|
| NeuralField | field canvas, StageHud | idle after hero paint, `/` only |
| BrainCanvas | Auth canvas | idle, `/login*` |
| HeroPrompt | typewriter placeholder (the form itself works without JS) | idle |
| PromptComposer | textarea, CheckChips, TemperaturePicker, runs (LearnerBubble + ModelOutput streaming), RewardToast, XpPill/SegmentedProgress update | visible |
| OddsBars | slider + bars | visible |
| Tokenizer | live tokenization | visible |
| Quiz | choice + feedback | visible (progressive form) |
| CodeEditor | tabs, copy, type mode | visible |
| TerminalLesson | TerminalInput, appended log, OutputPanel Run | visible |
| VideoPlayer + Transcript | hls.js, controls, cue sync | Watch mode only |
| CodeEntry | 6-box OTP (progressive single input) | `/login/check` |
| Passkey | WebAuthn ceremony button | `/login`, `/settings` |
| ProgressStore | localStorage queue, ContinueBanner for anonymous users, `/api/progress` replay | app pages |
| DropZone | upload + build status | `/author` |
| SearchShortcut | ⌘K focus, debounced search | `/courses` |

Everything else is static server HTML + CSS. Component count: **92 components** (each chip variant counted separately: brand 3, navigation 5, bar pills 3, buttons 5, selection 12, inputs 7, layout 9, course 12, lesson 18, progress 4, marketing 9, authoring 5) **plus an 18-icon set**.
