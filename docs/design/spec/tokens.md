# Bits design tokens

Source of truth: `docs/design/artboards/*.dc.html` (inline styles, `<helmet><style>` rules and the `renderVals()` scripts). Every value below was extracted from those files. Where the artboards disagree, the **canonical** value is given first and the variants are listed; the full list of disagreements is in `README.md`.

The system is **dark only** (v1). Put everything in one custom-properties file (e.g. `app/assets/tokens.css`) on `:root`.

Conventions in this file:

- `★` = token from the handoff set (`docs/handoff.md` → Frontend → Tokens).
- `+` = new token introduced by this spec for a recurring value.
- "Used in" lists artboards: Main, Auth, System, Catalog, Course, Lesson, Code (CodeLesson), Profile, Authoring.
- Alpha values are written as in the source (`.12` = `0.12`).

---

## 1. Colour

### 1.1 Ground and surfaces

| Token | Value | Used in | Role |
|---|---|---|---|
| ★ `--ink` | `#07080D` | all | Page ground, `body` background, ink-coloured text on ion/white, sigil chip ring on Main path (`box-shadow: 0 0 0 6px #07080D`), preview pane bg (Authoring), course-hero base. "Never pure black." |
| ★ `--surface` | `#0E1018` | all but Main | Cards, panels, tab-group bg, inputs on Catalog search, terminal input bg, output log inner box |
| `+` `--well` | `#0A0C14` | all | Sunken wells: text inputs (Auth), prompt composer, code editor body, stat tiles (Main), ring-badge row (Course), journal entries, cover-pattern base, validation rows, file tree, markdown source, video placeholder bg, temp value badge |
| `+` `--terminal` | `#090A10` | Code | Terminal lesson panel and output panel |
| ★ `--raised` | `#151826` | Main, System, Catalog, Course, Profile, Authoring | Dark keycap face, avatar button bg |
| `+` `--selected` | `#1C2030` | Auth, Lesson, Code | Selected segmented tab bg (Auth account tabs, Lesson mode tabs, Code "Terminal" tab); disabled "Copy off" keycap face |
| `+` `--bubble` | `#1A1E2D` | Main, Lesson | Learner bubble bg |
| `+` `--glass` | `#0C0E16` = `rgba(12,14,22,α)` | Main, System | Frosted glass panels. α `.78` (default, prompt bar, lesson preview), `.8` (mode cards), `.82` (progress card). System: "glass #0C0E16 @ 78% · blur 14–18" |
| `+` `--glass-well` | `rgba(10,12,20,.78)` (= `--well` @ 78%) | Auth | Auth "session.restore()" panel over the brain canvas |
| `+` `--key-dark-edge` | `#020305` | Main, System, Profile, Code | Shadow edge under dark keycaps and the disabled copy keycap |

### 1.2 Text

| Token | Value | Contrast on `--ink` / `--surface` | Used in | Role |
|---|---|---|---|---|
| ★ `--text` | `#ECEEF5` | 17.26 / 16.3 | all | Headlines, primary copy, active nav, selected filter bg |
| `+` `--text-body` | `#D5D8E3` | 15.6 / 13.35 | all but Catalog, Profile | Lesson body copy (17/1.7), list item copy, form labels, outcome cards, transcript |
| `+` `--text-quiet` | `#C6CAD6` | — / 11.59 | Catalog, Lesson, Code, Profile, Authoring, System | Mono hex values, format tags, unselected filter/temp text, odds % labels, outline "next" items, code punctuation, badge names, file tree |
| `+` `--text-lead` | `#B4B9CA` | 10.23 | Main, Auth, System, Course, Authoring | Lead paragraphs (19–20px), Main nav links, chip text (unselected goal / suggestion chips) |
| ★ `--muted` | `#9AA0B4` | 7.68 / 7.29 | all | Secondary copy, descriptions, app-bar nav links, mono meta, eyebrow headings |
| ★ `--dim` | `#7A8098` | 5.11 / 4.85 | all | Hints, placeholders, meta. **Lightest grey allowed for text** (System: "Smallest allowed grey (4.9:1)") |
| `+` `--on-volt` | `#0A0C05` | 16.65 on volt | all | Text and icons on volt fills (keycaps, "Your turn" tag, toast, lesson-node check). Handoff says text on volt is `--ink`; artboards consistently use `#0A0C05` (see README) |

### 1.3 Accents

| Token | Value | Used in | Role |
|---|---|---|---|
| ★ `--volt` | `#C6FF3D` | all | Primary action, "your turn", success, focus, Foundations + Agents track colour, links (`a{color:#C6FF3D}`) |
| ★ `--volt-edge` | `#6E9116` | all but Profile | Keycap shadow edge under volt only |
| `+` `--volt-hover` | `#D4FF66` | System | Hover face of the primary keycap (System sample). Live CSS uses `filter: brightness(1.06)` instead; both are acceptable, `brightness(1.06)` is what all pages implement |
| `+` `--volt-link-hover` | `#E2FF8F` | all | `a:hover{color:#E2FF8F}` |
| `+` `--volt-soft` | `#E4FF9E` | Main, Auth, System, Catalog, Lesson, Code, Profile | Text on volt tints (selected chips, passed check chips, XP pill, type-mode banner), 4th-stage field colour, "Streak ×7" badge fill |
| ★ `--ion` | `#3DE3FF` | all | Model output, in-progress, video, Prompting track, streak flame, code types/numbers |
| `+` `--ion-edge` | `#1A8FA3` | Code | Keycap edge under an ion face ("Copied ✓" state) |
| ★ `--synapse` | `#9D85FF` | Main, Catalog, Course, Code, Profile, Authoring, System | 3D field, Tools track, `$` shell prompt, `{ } code` / `◆ project` lesson kinds, `- check` directive lines, "Few-shot" badge |
| `+` `--synapse-soft` | `#B9A6FF` | Code, Authoring | Syntax: keywords (editor), directive attribute braces and the blocks-table attribute column |
| `+` `--warn` | `#FFD08A` | Authoring | Warning text (validation warning). Tint base is `rgb(255,184,77)` = `#FFB84D` |

### 1.4 Code / skeleton greys (low-contrast, decorative or flagged)

| Token | Value | Used in | Role | Contrast on `--well` |
|---|---|---|---|---|
| `+` `--code-gutter` | `#4A5068` | Code | Line numbers outside highlighted range | 2.45 (**fails**, see README) |
| `+` `--code-gutter-faint` | `#3B4157` | Main | Line numbers in mini editor; also the locked "Tool wielder" badge fill on Main | 1.93 (**fails**) |
| `+` `--code-comment-main` | `#6B7186` | Main | Comment colour in Main's mini editor | 4.03 (**fails** 4.5) |
| `+` `--skeleton` | `#262B3C` | Main | Skeleton text lines in Read mode card | decorative |
| `+` `--skeleton-bubble` | `#1F2436` | Main | Skeleton learner bubble | decorative |

Syntax palette used by the CodeEditor (`CodeLesson` script `C` map): `k` keyword `#B9A6FF`, `s` string `#C6FF3D`, `t` type `#3DE3FF`, `f` function `#ECEEF5`, `p` punctuation/plain `#C6CAD6`, `c` comment `#7A8098`, `n` number `#3DE3FF`. Main's static mini editor uses: keyword `#9D85FF`, literal/property `#3DE3FF`, function `#C6FF3D`, plain `#D5D8E3`, comment `#6B7186`, gutter `#3B4157`. Authoring markdown source: frontmatter keys `#3DE3FF`, fences `---` `#7A8098`, directive names/closers `#C6FF3D`, attribute braces `#B9A6FF`, `- check`/`- run` `#9D85FF`, `**bold**` `#ECEEF5` w600, plain `#C6CAD6`.

### 1.5 White alphas (lines, fills)

| Token | Value | Used in | Role |
|---|---|---|---|
| `+` `--line-hair` | `rgba(255,255,255,.06)` | Auth, Catalog, Code, Lesson, Main, System | Swatch/cover bottom borders, auth left divider, outline nav right border, inner dividers in odds/composer, terminal output inner box, Main mode-card wells |
| `+` `--line-bar` | `rgba(255,255,255,.07)` | Catalog, Course, Lesson, Code, Profile, Authoring | App-bar bottom border, section dividers, outcome cards, editor/terminal inner dividers, table row lines, journal border |
| `+` `--line` | `rgba(255,255,255,.08)` | all | **Default card border**, rules between list rows, ring/progress track fill, divider lines |
| `+` `--line-glass` | `rgba(255,255,255,.09)` | Main, Code | Glass card border (path/mode cards), terminal + editor border |
| `+` `--line-panel` | `rgba(255,255,255,.1)` | Main, Lesson, Catalog, Authoring | Lesson preview border, badge chip border, temp value badge border, format tag border, quiz option border |
| `+` `--line-strong` | `rgba(255,255,255,.12)` | all | Inputs, dark keycap border, provider buttons, prompt bar, outline-tag border, avatar button border |
| `+` `--line-control` | `rgba(255,255,255,.14)` | all | Ghost buttons, unselected chips/filters/temps, kbd border, code boxes |
| `+` `--line-dashed` | `rgba(255,255,255,.16)` | Catalog, Course | Dashed empty-state / source card |
| `+` `--line-dashed-strong` | `rgba(255,255,255,.2)` | Catalog, Main | "Write a course" dashed card; video chapter remainder (`.2` Main) |
| `+` `--line-drop` | `rgba(255,255,255,.22)` | Authoring, Auth, Lesson | Drop-zone dashed border (1.5px); ghost hover border (Auth); chapter scrubber remainder (Lesson) |
| `+` `--line-node-next` | `rgba(255,255,255,.3)` | System, Lesson, Catalog | Dashed "next" lesson node border; filter hover border. Course uses `.32` |
| `+` `--fill-row-hover` | `rgba(255,255,255,.03)` | Course | Syllabus row hover |
| `+` `--fill-hover` | `rgba(255,255,255,.04)` | Lesson | Outline link hover |
| `+` `--fill-seg` | `rgba(255,255,255,.05)` | System, Main, Lesson, Profile | Segmented control track (System/Main), odds bar track, heatmap level 0 |
| `+` `--fill-ghost-hover` | `rgba(255,255,255,.06)` | Auth, Lesson | Ghost button hover bg |
| `+` `--fill-btn` | `rgba(255,255,255,.08)` | Code, Lesson, Main | Video control buttons, tool-button hover (`.tbtn:hover`), mini Copy tag, progress tracks |
| `+` `--fill-tab-on` | `rgba(255,255,255,.1)` | System, Main | Selected segment in the *static* mode tabs (System/Main). Interactive tabs use `--selected` |
| `+` `--fill-seg-off` | `rgba(255,255,255,.1)` | Lesson | Unfilled segment in lesson progress bar |
| `+` `--line-codeline-hover` | `rgba(255,255,255,.025)` | Code | `.codeline:hover` bg |
| `+` `--dot-grid` | `rgba(255,255,255,.05)` | Auth, Profile | Dot grid (`radial-gradient(... 1px, transparent 1px)`), 26px (Auth) / 24px (Profile) |
| `+` `--dot-grid-field` | `rgba(255,255,255,.055)` | Main | Dot grid behind the 3D field, 28px, masked |
| `+` `--inset-highlight` | `rgba(255,255,255,.55)` | most | Keycap top highlight `inset 0 1px 0` |
| `+` `--kbd-edge` | `rgba(255,255,255,.08)` | System, Catalog | `box-shadow: 0 2px 0` under kbd hints |
| — | `rgba(154,160,180,.4)` | System | `text-decoration-color` for done lesson strike-through (`--muted` @ .4) |
| — | `rgba(236,238,245,.35)` | Profile | Generated-avatar edge strokes (`--text` @ .35) |
| — | `rgba(10,12,5,.12)` | Main | `↵` key hint tile inside the volt "Ask" keycap (`--on-volt` @ .12) |

### 1.6 Volt alphas

| Token | Value | Used in | Role |
|---|---|---|---|
| `+` `--volt-a035` | `rgba(198,255,61,.035)` | Code | Highlighted code range bg (lines 12–32) |
| `+` `--volt-a04` | `rgba(198,255,61,.04)` | Authoring | Drop-zone hover bg |
| `+` `--volt-a05` | `rgba(198,255,61,.05)` | Profile | Finished-course row bg |
| `+` `--volt-a06` | `rgba(198,255,61,.06)` | Main | Suggestion chip hover bg |
| `+` `--volt-a08` | `rgba(198,255,61,.08)` | Catalog, Lesson, Code | XP pill bg, type-mode banner bg |
| `+` `--volt-tint` | `rgba(198,255,61,.1)` | Auth, Authoring, Catalog, System, Code(.10) | Focus glow (composer sample, search), Auth envelope tile, file tree selection, focused code line (`.10`) |
| `+` `--volt-tint-on` | `rgba(198,255,61,.12)` | Auth, Lesson, Main, System | Selected chip bg, passed check bg, focus ring glow (`0 0 0 4px`), TokenPill tint 1 |
| `+` `--volt-a14` | `rgba(198,255,61,.14)` | Code | Inline highlight ("line 31"), type-it toggle on bg |
| `+` `--volt-a22` | `rgba(198,255,61,.22)` | Catalog, Main | Cover pattern lines (Prompting that works); CTA glow `0 20px 60px rgba(198,255,61,.22)` |
| `+` `--volt-a25` | `rgba(198,255,61,.25)` | Catalog, Lesson, Code, Profile, System | XP pill border, type banner border, heatmap level 1, toast glow |
| `+` `--volt-a28` | `rgba(198,255,61,.28)` | Main, Catalog | Hero badge border; cover conic lines |
| `+` `--volt-a30` | `rgba(198,255,61,.3)` | Profile | Thumbnail conic lines |
| `+` `--volt-a35` | `rgba(198,255,61,.35)` | Main, Code, Profile, System | Static composer border (Main), code range gutter mark, terminal input border, finished-course border, TokenPill line 1, card-lift hover border |
| `+` `--volt-a40` | `rgba(198,255,61,.4)` | Auth, Authoring, Catalog, Lesson, Main, Profile | Composer border (Lesson), Auth envelope border, Main trace dashed line, certificate button border, card hover border (Catalog) |
| `+` `--volt-a45` | `rgba(198,255,61,.45)` | Catalog, Lesson, Main, Profile | Passed check border, mini composer border (Main mode card), avatar frame stroke, cover dots |
| `+` `--volt-a50` | `rgba(198,255,61,.5)` | System, Code | Focused composer border (System sample), type-it toggle on border |
| `+` `--volt-a55` | `rgba(198,255,61,.55)` | Main, Code, Profile | Track ring border, pulse start, terminal focus border, chip-link hover border, heatmap level 2 |
| `+` `--volt-a60` | `rgba(198,255,61,.6)` | Auth, Catalog, Main, System | Selected chip border, search/prompt-bar focus border |
| `+` `--volt-a70` | `rgba(198,255,61,.7)` | Auth, Authoring | `.field:focus` border, drop-zone hover border |
| `+` `--volt-a75` | `rgba(198,255,61,.75)` | Lesson | `.composer:focus-within` border |

### 1.7 Ion alphas

| Token | Value | Used in | Role |
|---|---|---|---|
| `+` `--ion-a04` | `rgba(61,227,255,.04)` | Main, Lesson | ModelOutput / tokenizer panel bg |
| `+` `--ion-a06` | `rgba(61,227,255,.06)` | Course | Current syllabus row bg; course-hero stripe lines (22px period) |
| `+` `--ion-a08` | `rgba(61,227,255,.08)` | Lesson | Current outline item bg; active transcript paragraph bg |
| `+` `--ion-a12` | `rgba(61,227,255,.12)` | Main, System, Course | TokenPill tint 2; course art glow `0 40px 120px` |
| `+` `--ion-a16` | `rgba(61,227,255,.16)` | Lesson | Video placeholder dot grid (18px) |
| `+` `--ion-a18` | `rgba(61,227,255,.18)` | Main | Watch card dot grid (14px) |
| `+` `--ion-a22` | `rgba(61,227,255,.22)` | Catalog | "edge" cover cross-hatch |
| `+` `--ion-a25` | `rgba(61,227,255,.25)` | Main, Lesson | ModelOutput / tokenizer border |
| `+` `--ion-a28` | `rgba(61,227,255,.28)` | Lesson, Authoring, Catalog, Course | OddsBars panel border; cover lines |
| `+` `--ion-a30` | `rgba(61,227,255,.3)` | Catalog, Course | Continue banner border, course-art border, resume callout border, cover stripes |
| `+` `--ion-a35` | `rgba(61,227,255,.35)` | Main, Course, System, Profile | TokenPill line 2; "text + video" tag border; thumbnail stripes |
| `+` `--ion-a45` | `rgba(61,227,255,.45)` | Lesson, Authoring | Non-top odds bars |
| `+` `--ion-a55` | `rgba(61,227,255,.55)` | Main | Prompting track ring |
| `+` `--ion-a60` | `rgba(61,227,255,.6)` | System, Course | Ion pulse start |
| — | `rgba(61,227,255,0)` | Catalog, Course, Profile, System | Transparent stop in stripe patterns / pulse end |

### 1.8 Synapse alphas

| Token | Value | Used in | Role |
|---|---|---|---|
| `+` `--syn-a14` | `rgba(157,133,255,.14)` | Main, System | TokenPill tint 3 bg |
| `+` `--syn-a25` | `rgba(157,133,255,.25)` | Catalog | RAG cover secondary dots |
| `+` `--syn-a40` | `rgba(157,133,255,.4)` | Main, System | TokenPill tint 3 line |
| `+` `--syn-a42` | `rgba(157,133,255,.42)` | Catalog | fn() cover rings |
| `+` `--syn-a50` | `rgba(157,133,255,.5)` | Catalog | RAG cover primary dots |
| `+` `--syn-a60` | `rgba(157,133,255,.6)` | Main | Tools track ring |

### 1.9 Ink, black and warn alphas

| Token | Value | Used in | Role |
|---|---|---|---|
| `+` `--ink-a55` | `rgba(7,8,13,.55)` | Main | Suggestion chip bg (over field) |
| `+` `--ink-a60` | `rgba(7,8,13,.6)` | Main | Hero badge bg |
| `+` `--ink-a78` | `rgba(7,8,13,.78)` | Lesson | Video control bar bg |
| `+` `--appbar-bg` | `rgba(7,8,13,.82)` | Catalog, Course | App-bar glass bg; cover track tag bg |
| `+` `--ink-a86` | `rgba(7,8,13,.86)` | Course | Progress chip on course art |
| `+` `--lessonbar-bg` | `rgba(7,8,13,.88)` | Lesson | Lesson bar glass bg |
| — | `rgba(7,8,13,0)` → `.35` @60% → `.94` @100% | Main | Field vignette: `radial-gradient(ellipse 70% 60% at 50% 45%, rgba(7,8,13,0) 0%, rgba(7,8,13,0.35) 60%, rgba(7,8,13,0.94) 100%)` |
| `+` `--shadow-a45` | `rgba(0,0,0,.45)` | Code | Editor drop shadow |
| `+` `--shadow-a50` | `rgba(0,0,0,.5)` | Main, Catalog, Lesson | Prompt bar, card hover, play button shadows |
| `+` `--shadow-a55` | `rgba(0,0,0,.55)` | Main | Lesson preview card shadow |
| `+` `--warn-tint` | `rgba(255,184,77,.08)` | Authoring | Warning row bg |
| `+` `--warn-line` | `rgba(255,184,77,.35)` | Authoring | Warning row border |

### 1.10 Status and semantic aliases (proposed, no new hex)

| Alias | Maps to | Notes |
|---|---|---|
| `--success` | `--volt` | Passed checks, done nodes, ✓ |
| `--progress` / `--info` | `--ion` | In-progress, model, video |
| `--warning` | `--warn` + `--warn-tint` + `--warn-line` | Validation warnings |
| `--danger` | **missing** | No error/destructive colour exists in any artboard. Needed for: validation *errors* (Authoring), wrong code (Auth), delete account (Settings). Proposal: `#FF7A6B` text (7.86:1 on ink, 7.46:1 on surface), tint `rgba(255,122,107,.08)`, line `rgba(255,122,107,.35)`, mirroring the warn recipe. Flag for design sign-off |

### 1.11 Track colours (data, from Catalog `tracks` and Main `tracks`)

| Track | Colour | Ring (Main) | Filter dot |
|---|---|---|---|
| All | — | — | `#ECEEF5` |
| Foundations | `#C6FF3D` | `rgba(198,255,61,0.55)` | `#C6FF3D` |
| Prompting | `#3DE3FF` | `rgba(61,227,255,0.55)` | `#3DE3FF` |
| Tools (Main: "Tools & context") | `#9D85FF` | `rgba(157,133,255,0.6)` | `#9D85FF` |
| Agents | `#C6FF3D` | `rgba(198,255,61,0.55)` | `#C6FF3D` |

Note that a course card's sigil colour is per *course*, not per track (e.g. "Tokens & temperature" is Foundations but ion; "Ship an agent to the edge" is Agents but ion).

### 1.12 3D field colours (Main + Auth scripts)

- Field stage palette `pal` (uC1, uC2): stage 0 `#C6FF3D`/`#3DE3FF`, stage 1 `#3DE3FF`/`#9D85FF`, stage 2 `#9D85FF`/`#C6FF3D`, stage 3 `#E4FF9E`/`#9D85FF`.
- Network edges `LineBasicMaterial` `0xC6FF3D`, opacity `.14` initial, driven to `0.15 * netA`.
- Signals: `mix(vec3(0.78, 1.0, 0.24), vec3(1.0), 0.5)` (volt-ish white).
- Point core highlight: `mix(col, vec3(1.0), smoothstep(0.16, 0.0, d) * 0.55)`.
- Auth brain: `mix(vec3(0.24, 0.89, 1.0) /*ion*/, vec3(0.78, 1.0, 0.24) /*volt*/, smoothstep(-0.2, 0.6, vH))`; orbit ring `PointsMaterial` `0x9D85FF`, size `.045`, opacity `.7`.
- Renderer clear colour `0x000000` alpha 0 (transparent over `--ink`).

---

## 2. Typography

### 2.1 Families

| Token | Stack | Weights loaded (artboards) | Handoff weights |
|---|---|---|---|
| `--font-display` | `'Unbounded', ui-sans-serif, sans-serif` | 400, 500, 700, 800 | 500/700/800 (400 is used by Auth code boxes, see README) |
| `--font-sans` | `'Geist', ui-sans-serif, system-ui, sans-serif` | 400, 500, 600 | 400–600 |
| `--font-mono` | `'Geist Mono', ui-monospace, monospace` | 400, 500 (Code also requests 600, unused) | 400/500 |

Self-host subsets (handoff). Root text: `font-family: var(--font-sans); color: var(--text); background: var(--ink); -webkit-font-smoothing: antialiased`. SVG `<text>` uses `font-family="Unbounded, sans-serif"` / `"Geist Mono, monospace"`.

### 2.2 Type roles

All sizes in px unless clamp. `lh` = line-height (unitless). `ls` = letter-spacing. Default line-height where not set = `normal`.

**Display (Unbounded)**

| Role | Weight | Size | lh | ls | Extras | Where |
|---|---|---|---|---|---|---|
| `display-xl` | 800 | `clamp(46px, 8.4vw, 124px)` | .94 | -0.045em | `text-wrap: balance; max-width: 1100px` | Main hero h1. System sample: 88px / .95 |
| `display-cta` | 800 | `clamp(38px, 5.6vw, 80px)` (decision 048; was `clamp(42px, 7vw, 104px)`) | .96 | -0.045em | `max-width: 1000px; text-wrap: balance` | Main closing CTA h2 (`--type-display-cta-size`) |
| `display-cert` | 800 | `clamp(42px, 7vw, 104px)` | .96 | -0.045em | | Certificate course title (`--type-display-cert-size`, decision 048) |
| `display-course` | 800 | `clamp(40px, 5.6vw, 76px)` | .98 | -0.045em | | Course hero h1 |
| `display-l` | 800 | `clamp(36px, 5vw, 64px)` | 1 | -0.04em | | Catalog h1, Authoring h1 |
| `display-profile` | 800 | `clamp(36px, 4.6vw, 60px)` | 1 | -0.04em | | Profile name h1 |
| `display-auth` | 800 | `clamp(36px, 4.4vw, 60px)` | .98 | -0.04em | | Auth left h2 |
| `display-system` | 800 | 56 | 1 | -0.04em | | System h1 |
| `h2-section` | 700 | `clamp(36px, 4.6vw, 64px)` | 1.02 | -0.035em | `text-wrap: balance` | `PageHead` h1/h2 on app pages (`--type-h2-size`). System sample: 52px |
| `h2-landing` | 700 | `clamp(30px, 3.9vw, 56px)` | 1.02 | -0.035em | `text-wrap: balance` | Main section h2s in a half-width cell (`--type-h2-landing-size`, decision 048) |
| `h1-form` | 700 | 34 | normal | -0.03em | | Auth "Welcome back." / "Make it yours." |
| `h1-form-sent` | 700 | 32 | normal | -0.03em | | Auth "Check your inbox." |
| `title-banner` | 700 | 28 | normal | -0.03em | | Catalog continue banner title |
| `stat-l` | 700 | 30 | normal | — | colour per stat | Profile stat tiles |
| `stat-m` | 700 | 24 | normal | — | | Main stat tiles |
| `toast-title` | 700 | 20 (Lesson) / 18 (System) | normal | — | | RewardToast |
| `track-num` | 700 | 20 | normal | — | | Main path numbered circles |
| `wordmark` | 700 | 20 (Main nav) / 19 (Auth) / 17 (app bar) / 16 (footer, no ls) | normal | -0.02em | | Logo wordmark |
| `avatar-initials` | 700 | 13 | normal | — | | AvatarButton |
| `h3` / `card-title-l` | 500 | 22 | 1.15 | -0.02em | | Main track + mode card titles, System sample. Main progress card title 22 / 1.2 (no ls) |
| `card-title` | 500 | 19 | 1.2 | -0.02em | | CourseCard title; Authoring panel titles and "Write a course" card (lh normal) |
| `module-title` | 500 | 18 | normal | -0.02em | | Course syllabus module titles |
| `lesson-bar-title` | 500 | 17 | normal | -0.02em | | Lesson/Code bar title |
| `code-digit` | 400 | 22 | normal | — | centered | Auth 6-digit code boxes |
| `sigil-*` | 800 | 128 (course art, stroke 2px) / 88 (continue, stroke 1.5px, ls -0.05em) / 52 (card, stroke 1.4px, ls -0.04em) / 18 & 14 (profile thumb, stroke 1px) | normal | see | `color: transparent; -webkit-text-stroke: <w> <colour>` | Sigils |

**Text (Geist)**

| Role | Weight | Size | lh | Colour | Where |
|---|---|---|---|---|---|
| `lead-xl` | 400 | 20 | 1.55 | `--text-lead` | Main hero sub (`max-width: 640px; text-wrap: pretty`) |
| `lead` | 400 | 19 | 1.6 | `--text-lead` | Main section paragraphs (max 520 / none), Course hero (max 600) |
| `lead-s` | 400 | 18 | 1.6 | `--text-lead` | Authoring intro |
| `model-out` | 400 | 18 | 1.5 | `--text` | Run output text |
| `body-lesson` | 400 | 17 | 1.7 | `--text-body` | Tutor copy in Lesson. System: "max 68ch" |
| `body-l` | 400 | 17 | 1.5 | `--text-body` | Main feature rows; 17/1.6 `--text-lead` (Main "Read it" para, max 380) |
| `body` | 400 | 16 | 1.6 | `--text-body` | Tutor copy in Main preview; Auth sub 16/1.55 `--muted`; transcript 16/1.7; Catalog banner sub 16; Profile handle line 16 |
| `body-strong` | 600 | 16 | normal | | Course ring "5 of 8 lessons", Profile course row titles; syllabus row title 16 w400/600 |
| `ui` | 400 | 15 | normal | | Nav links, Main "Same token" ghost, quiz options, empty state |
| `ui-medium` | 500 | 15 | normal | | OAuth provider buttons |
| `ui-strong` | 600 | 15 | normal | | System swatch names, current lesson node label |
| `body-s` | 400 | 15 | 1.55 | `--muted` | Main track/mode card desc, Lesson watch side card (`--text-body`); outcome cards 15/1.5 |
| `small` | 400 | 14 | 1.55 | `--muted` | CourseCard desc, Catalog dashed card, sync note; 14 labels (Auth), chips, check chips 13 |
| `small-strong` | 600 | 14 | normal | | Badge preview title (Course) |
| `caption` | 400 | 13 | 1.45 / 1.5 | `--muted` / `--dim` | Swatch use text (1.45), auth note (1.5), stat labels, badge chips |
| `micro` | 400 | 12 | 1.5 / 1.3 | `--dim` / `--text-quiet` | Legal line (1.5), badge names (1.3) |

**Mono (Geist Mono)**

| Role | Weight | Size | lh | ls | Case | Where |
|---|---|---|---|---|---|---|
| `eyebrow` | 400 | 13 | normal | 0.14em | uppercase | Page/section eyebrows ("02 — How it works", "All courses · free", "latent / system") — colour varies |
| `eyebrow-heading` | 500 | 13 | normal | 0.14em | uppercase (or literal caps) | Mono `<h2>` section headings (System, Course, Profile, Authoring), colour `--muted` |
| `eyebrow-s` | 400 | 12 | normal | 0.12em | literal caps | Card eyebrows ("TEXT · ALWAYS", "CONTINUE · LESSON 6 OF 8", "HOW YOU'LL LEARN", "IN THIS COURSE", track names uppercase) |
| `eyebrow-xs` | 400 | 11 | normal | 0.14em (HUD) / 0.16em (scroll cue) | uppercase | Field stage HUD, scroll cue |
| `tag-xs` | 400 | 11 | normal | 0.08em | caps | Cover track tag; "✓ DONE" (no ls); "IN PROGRESS"; format tags (no ls) |
| `mono-input-xl` | 400 | 17 | normal | — | | Hero prompt input |
| `mono-input-l` | 400 | 16 | 1.6 | — | | Composer textarea |
| `mono-input` | 400 | 15 | normal (System: 1.75) | — | | Email input, typed sample, tokens, static composer text |
| `mono-code` | 400 | 14 | 1.75 | — | | CodeEditor |
| `mono-terminal` | 400 | 14 | 1.7 | — | | Terminal lesson panel |
| `mono-code-s` | 400 | 13 | 1.75 / 1.8 (output) / 2 (file tree) | — | | Markdown source, output log, file tree |
| `mono-code-xs` | 400 | 12 | 1.75 | — | | Main mini editor |
| `mono-tab` | 400 | 13 / 12 | normal | — | | Segmented tabs (13 app, 12 Main preview), editor file tabs 13 |
| `key-xl` | 500 | 16 | normal | — | | CTA keycaps (56px) |
| `key-l` | 500 | 15 | normal | — | | 52–54px keycaps |
| `key` | 500 | 14 | normal | — | | 44–48px keycaps; dark keycap and ghost-mono buttons use 400 |
| `key-s` | 500 | 13 / 12 | normal | — | | 44px Publish (13), 36px Run / 34px Copy (12) |
| `meta` | 400 | 12 / 13 | normal | — | | Meta rows, counts, labels, kbd |
| `token-id` | 400 | 10 | normal | — | | Token ids under TokenPills; outline node numerals |

Text-transform is applied only where noted; many "caps" strings are written in caps in the source (e.g. "TEXT · ALWAYS") — reproduce them as literal uppercase **or** use `text-transform: uppercase` on sentence-case strings; screen readers read both fine, but prefer CSS uppercase on real sentences.

---

## 3. Spacing

System sheet: "4-pt; sections 120 / cards 24". Values actually used (px):

`2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 18, 20, 22, 24, 26, 28, 30, 32, 36, 40, 44, 46, 48, 56, 64, 72, 80, 96, 104, 120, 140, 160`.

Proposed scale (round odd one-offs to the nearest step only where noted in component specs; keep exact values for pixel-perfect pages):

| Token | px | Typical use |
|---|---|---|
| `--s-0_5` | 2 | Segmented control gap, tab gutter, stack gap in toast |
| `--s-1` | 4 | Progress segment gap, chart gaps, tight stacks |
| `--s-1_5` | 6 | Chip-row gap, token gap |
| `--s-2` | 8 | Chip/filter gap, label→input gap |
| `--s-2_5` | 10 | Button groups, swatch row gap |
| `--s-3` | 12 | Inline groups, card grids (outcomes, stats) |
| `--s-3_5` | 14 | Card-swatch grid, icon-text gap in tutor message, keycap row gap |
| `--s-4` | 16 | Component grids, panel padding |
| `--s-4_5` | 18 | Outcome card padding, row padding |
| `--s-5` | 20 | Card grids (Main, Catalog), card body padding |
| `--s-5_5` | 22 | Auth stacks, heading groups, panel padding |
| `--s-6` | 24 | Card padding (System: cards 24), section gap |
| `--s-7` | 28 | Nav link gap, column gap, card padding (progress card, dashed card) |
| `--s-8` | 32 | Page side gutter (desktop), header gap |
| `--s-9` | 36 | Profile identity gap, CTA stack |
| `--s-10` | 40 | Course body column gap, lesson main top pad |
| `--s-12` | 48 | Catalog main gap, Course hero gap |
| `--s-14` | 56 | Page top padding (app pages), section internal gap (Main) |
| `--s-16` | 64 | Main two-column gap, System section gap |
| `--s-24` | 96 | App page bottom padding |
| `--s-30` | 120 | Main section vertical padding |

## 4. Radii

System: "8 · 11 · 14 · 18 · 22 · pill". Handoff: 8, 11, 14, 18, 22 and pill. **Actually used**: 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 16, 18, 20, 22, 24, 28, 36 (SVG rx), 99, 999.

| Token | px | Canonical use | Other values seen and where |
|---|---|---|---|
| `--r-xs` | 6 | Kbd, "Your turn" tag, format tags, code-box hints, odds bars | 2 (thin bars, Main chapter bars), 3 (progress bars, heatmap cells, lesson segments), 4 (skeleton, inline highlight), 5 (Main kbd tile in Ask, Authoring tag), 7 (TokenPill, cover tag, Main Copy tag, System tab inner) |
| `--r-sm` | 8 | Copy/Type tool buttons, meta tags (Course hero), lesson tabs inner, check chips, run chip | 9 (Main tutor avatar, Main tab track, temp chips, terminal options, Run 36px), 10 (ghost 44px buttons, outline links, inputs Authoring, Auth tab inner, video controls, transcript highlight, validation rows, Lesson tutor avatar) |
| `--r-md` | 11 | Nav keycap 44px, hero Ask keycap, lesson tab track | 12 (keycaps 46–48px, inputs Auth, provider buttons, avatar button, back button, Code terminal input, stat tiles Main, cover wells), 13 (keycaps 52–54px, Auth tab track) |
| `--r-lg` | 14 | Outcome cards, tokenizer panel, model output, journal entries, swatch cards, progress chip, profile thumbs | 16 (search field, composer System sample, stat tiles Profile, resume callout, profile course rows, toast System, learner bubble outer corners) |
| `--r-xl` | 18 | Component cards (System), composer (Lesson), hero prompt bar, terminal/editor panels, OddsBars panel, Profile sections, toast (Lesson), path cards | 20 (CourseCard, Course aside cards, mode cards, Catalog dashed card, video player, Authoring panels) |
| `--r-2xl` | 22 | Continue banner, Main lesson preview card | 24 (Main progress card), 28 (Course art), 36 (generated avatar SVG rect) |
| `--r-pill` | 999px | Chips, filters, pills, nodes, dots | `99px` on small dots (identical in effect) |

Learner bubble corner set: `16px 16px 4px 16px` (Main/Lesson); skeleton bubble `10px 10px 3px 10px`.

## 5. Elevation and shadows

| Token | Value | Use |
|---|---|---|
| `--key-volt` | `0 4px 0 #6E9116, inset 0 1px 0 rgba(255,255,255,0.55)` | Primary keycap, 44–48px |
| `--key-volt-l` | `0 5px 0 #6E9116, inset 0 1px 0 rgba(255,255,255,0.55)` | Primary keycap, 52–54px (Auth submit, Course resume) |
| `--key-volt-cta` | `0 5px 0 #6E9116, 0 20px 60px rgba(198,255,61,0.22), inset 0 1px 0 rgba(255,255,255,0.55)` | Main closing CTA (56px) |
| `--key-volt-hover` (System) | `0 5px 0 #6E9116, 0 12px 30px rgba(198,255,61,0.25), inset 0 1px 0 rgba(255,255,255,0.55)` + `transform: translateY(-1px)` + bg `#D4FF66` | System hover sample |
| `--key-volt-pressed` | `0 1px 0 #6E9116` + `transform: translateY(3px)` | `:active` |
| `--key-volt-s` | `0 3px 0 #6E9116` | Small keycaps (Run 36px, Copy 34px) — no inset highlight |
| `--key-ion-s` | `0 3px 0 #1A8FA3` | Copy keycap "Copied ✓" state |
| `--key-dark` | `0 4px 0 #020305` | Dark keycap 46–48px (and `0 5px 0 #020305` at 56px) |
| `--key-dark-pressed` | `0 1px 0 #020305` + `translateY(3px)` | `.key-dark:active` |
| `--key-dark-s` | `0 3px 0 #020305` | Disabled copy keycap |
| `--kbd` | `0 2px 0 rgba(255,255,255,0.08)` | Kbd hints |
| `--focus-ring` | `0 0 0 4px rgba(198,255,61,0.12)` | Focus glow (inputs, composer, prompt bar). Variant `.1` on search and System composer |
| `--shadow-prompt-bar` | `0 30px 80px rgba(0,0,0,0.5)`; focused: `0 0 0 4px rgba(198,255,61,.12), 0 30px 80px rgba(0,0,0,.5)` | Hero prompt bar |
| `--shadow-float` | `0 40px 120px rgba(0,0,0,0.55)` | Main lesson preview card; progress card uses `.5` |
| `--shadow-editor` | `0 30px 90px rgba(0,0,0,0.45)` | CodeEditor |
| `--shadow-card-hover` | `0 30px 80px rgba(0,0,0,0.5)` | CourseCard hover |
| `--shadow-play` | `0 20px 60px rgba(0,0,0,0.5)` | Video play button |
| `--glow-toast` | `0 24px 70px rgba(198,255,61,0.25)` (Lesson) / `0 20px 60px rgba(198,255,61,0.25)` (System) | RewardToast |
| `--glow-ion-art` | `0 40px 120px rgba(61,227,255,0.12)` | Course hero art |
| `--ring-sigil` | `0 0 0 6px #07080D` | Track number circle (masks the dashed trace) |
| `--tab-active-top` | `inset 0 2px 0 #C6FF3D` | Active editor file tab |

Glass recipe: `background: rgba(12,14,22,.78); backdrop-filter: blur(16px)` (prompt bar); blur 18px (lesson preview), 14px (path/mode cards, app bar), 16px (progress card), 12px (Auth panel), 10px (hero badge). Always pair `-webkit-backdrop-filter`.

## 6. Motion

### 6.1 Transitions

| Name | Declaration | Where |
|---|---|---|
| keycap | `transition: transform .12s ease, box-shadow .12s ease, filter .12s ease` · hover `transform: translateY(-1px); filter: brightness(1.06)` · active `transform: translateY(3px); box-shadow: 0 1px 0 <edge> !important` | `.key` everywhere. Handoff: press 120ms, 3px travel. Code's `.key:active` is `translateY(2px)` without shadow change (inconsistent) |
| ghost | `transition: background .15s, border-color .15s` · hover `background: rgba(255,255,255,.06); border-color: rgba(255,255,255,.22)` | Auth `.ghost` (Lesson omits border change) |
| navlink | `transition: color .15s` · hover `color: #ECEEF5` | `.navlink` |
| chip-link | `transition: border-color .15s, color .15s, background .15s` · hover `border-color: rgba(198,255,61,.55); color: #ECEEF5; background: rgba(198,255,61,.06)` | Main suggestion chips |
| filter | `transition: background .15s, border-color .15s, color .15s` · hover `border-color: rgba(255,255,255,.3)` | Catalog filters |
| tbtn | `transition: background .15s, border-color .15s, color .15s` · hover `background: rgba(255,255,255,.08)` | Code tool buttons, terminal quiz options |
| row | `transition: background .15s` · hover `background: rgba(255,255,255,.03)` | Course syllabus rows |
| olink | `transition: background .15s` · hover `background: rgba(255,255,255,.04)` | Lesson outline |
| card-lift | `transition: transform .25s ease, border-color .25s ease` · hover `transform: translateY(-4px); border-color: rgba(198,255,61,.35)` | Main path cards |
| card | `transition: transform .25s ease, border-color .25s ease, box-shadow .25s ease` · hover `transform: translateY(-6px) rotate(-0.4deg); border-color: rgba(198,255,61,0.4); box-shadow: 0 30px 80px rgba(0,0,0,0.5)` | CourseCard |
| sigil | `transition: transform .35s cubic-bezier(.2,.8,.2,1)` · card hover → `transform: scale(1.08) translateY(-4px)` | CourseCard sigil |
| badge | `transition: transform .25s cubic-bezier(.2,1.4,.4,1)` · hover `transform: translateY(-4px) rotate(-3deg)` | Profile HexBadge grid |
| focus-field | `transition: border-color .2s, box-shadow .2s` | Search, prompt bar, composer |
| term | `transition: border-color .2s` · `:focus-within` border `rgba(198,255,61,0.55)` | Terminal panel |
| drop | `transition: border-color .2s, background .2s` · hover `border-color: rgba(198,255,61,0.7); background: rgba(198,255,61,0.04)` | Drop zone |
| odds-bar | `transition: width .35s cubic-bezier(.2,.8,.2,1)` | OddsBars `.bar` |
| hud | `transition: color .4s` (label), `transition: width .5s ease, background .5s` (bar) | Field HUD |
| codeline | hover `background: rgba(255,255,255,0.025)` (no transition) | Code lines |
| heat cell | hover `outline: 1px solid #ECEEF5` (no transition) | Activity grid |

### 6.2 Keyframes

```css
@keyframes blink { 0% { opacity: 1 } 50% { opacity: 0 } }
.caret { animation: blink 1.05s steps(1) infinite }

/* Volt pulse (Main hero badge dot) */
@keyframes pulse-volt { 0%,100% { box-shadow: 0 0 0 0 rgba(198,255,61,.55) } 50% { box-shadow: 0 0 0 6px rgba(198,255,61,0) } }
/* Ion pulse (current lesson node). System = 8px, Course = 9px; use 8px */
@keyframes pulse-ion  { 0%,100% { box-shadow: 0 0 0 0 rgba(61,227,255,.6) }  50% { box-shadow: 0 0 0 8px rgba(61,227,255,0) } }
.pulse { animation: pulse 2s ease-in-out infinite }

/* Scroll cue line */
@keyframes cue { 0% { transform: scaleY(0); transform-origin: top } 45% { transform: scaleY(1); transform-origin: top }
                 55% { transform: scaleY(1); transform-origin: bottom } 100% { transform: scaleY(0); transform-origin: bottom } }
.scrollcue { animation: cue 2.4s ease-in-out infinite }

/* Reveal. Canonical (handoff + Auth): 400ms ease, 8px rise */
@keyframes rise { from { opacity: 0; transform: translateY(8px) } to { opacity: 1; transform: none } }
.rise { animation: rise .4s ease both }
/* Variants: Lesson .45s cubic-bezier(.2,.8,.2,1) 10px; Code .35s ease 6px */

/* Reward pop */
@keyframes pop { 0% { opacity: 0; transform: translateY(20px) scale(.9) } 100% { opacity: 1; transform: none } }
.pop { animation: pop .6s cubic-bezier(.2,1.4,.4,1) both }
```

### 6.3 Easings

| Token | Value |
|---|---|
| `--ease` | `ease` |
| `--ease-out-expo` | `cubic-bezier(.2,.8,.2,1)` (sigil, odds bars, Lesson rise) |
| `--ease-spring` | `cubic-bezier(.2,1.4,.4,1)` (pop, badge hover) |

### 6.4 Durations

`120ms` keycap · `150ms` hover colours · `200ms` focus · `250ms` card lift · `350ms` sigil/odds · `400ms` reveal, HUD colour · `500ms` HUD bar · `600ms` pop · `1.05s` caret · `2s` pulse · `2.4s` scroll cue.

Scripted timing: hero placeholder typewriter ticks every `55ms` (types 1 char/tick, deletes 2 chars/tick, holds 34 ticks ≈ 1.87s at full prompt, 6 ticks ≈ 330ms between prompts; pauses while input focused or non-empty). Copy-confirm resets after `1600ms`. Field morph eases `0.055` per frame; mouse parallax eases `0.04` per frame.

### 6.5 Reduced motion

`@media (prefers-reduced-motion: reduce) { .caret, .pulse, .scrollcue { animation: none } }` (Main). Extend to **all** pages and to `.rise`, `.pop`, card hover transforms, `.sigil`, `.badge` (not done in artboards). The 3D field runs at `0.25×` time (`time += dt * (reduce ? 0.25 : 1)`). Auth brain has no reduced-motion handling (gap).

## 7. Layout

### 7.1 Containers

| Token | Value | Use |
|---|---|---|
| `--container` | `max-width: 1280px; margin: 0 auto` | Main sections, app-bar inner, Catalog/Course/Profile/Authoring main, System, footer |
| `--gutter` | `32px` (desktop horizontal padding) | All 1280 containers. Lesson/Code bars and lesson main use `24px`; Code workspace `16px`; Auth form column `24px` |
| `--gutter-mobile` | `16px` (proposed ≤ 480px) | Not in artboards; required to fit 360px (see page specs) |
| `--read-width` | `760px` | Lesson read column; hero prompt bar; Main path intro; suggestions row |
| `--watch-width` | `1040px` | Lesson watch column |
| `--form-width` | `420px` | Auth form |
| `--measure` | `68ch` | Lesson body max (System) |

### 7.2 Page paddings

| Page | Padding |
|---|---|
| Main nav | `22px 32px` |
| Main hero | `64px --section-pad-x 32px`, `min-height: calc(100svh - --appbar-h)` (one fold; phones `40px … 32px`, auto height). Decision 048 replaced `104px 32px 72px` / 820px |
| Main sections | `--section-pad-y` bands; display-type cells inset `--cell-pad-lg`; closing CTA `120px` top and bottom (phones `80px / 64px`; decision 048, was `160px 32px 140px`) |
| Main footer | `36px 32px` |
| App bar inner (Catalog/Course/Profile/Authoring) | `14px 32px` |
| Lesson/Code bar inner | `12px 24px` |
| Catalog / Authoring main | `56px 32px 96px` |
| Course hero / body | `56px 32px 64px` / `56px 32px 96px` |
| Profile identity / body | `56px 32px 48px` / `40px 32px 96px` |
| Lesson outline / main | `28px 16px` / `40px 24px 120px` |
| Code workspace | `16px` |
| Auth left / right | `32px` / `48px 24px` |
| System | `64px 32px 80px` |

### 7.2a Landing grid tokens (decision 048)

| Token | Value | Use |
|---|---|---|
| `--cell-fill-veil` | `rgb(7 8 13 / 0.55)` | A copy cell over the field (headline + lead); `--cell-fill` (0.9) stays for object cells (preview card, mode art, tracks, showcase). `CellGrid fill="veil"`, or `cellVeilStyle` / `cellInkStyle` per cell |
| `--cell-pad-lg` | `64px`; `--section-pad-x` under 1024px | Inset of a cell that holds display type |
| `--track-cell-min` | `300px` | A landing path track cell's height from 760px |
| `--mode-art-h` | `200px`; phones `120px` | A landing mode card's art well |
| `--section-gap` | `80px`; 481–1023px `56px`; phones `40px` | The stripe of ground between two framed sections, and under the last one (decision 050) |

### 7.3 Grids in use

| Pattern | Declaration |
|---|---|
| Main how-it-works / progress | `grid-template-columns: repeat(auto-fit, minmax(min(500px, 100%), 1fr)); gap: 64px` (progress: `min(480px, 100%)`) |
| Main path | `repeat(auto-fit, minmax(min(260px, 100%), 1fr)); gap: 20px` |
| Main modes | `repeat(auto-fit, minmax(min(340px, 100%), 1fr)); gap: 20px` |
| Catalog cards | `repeat(auto-fill, minmax(min(290px, 100%), 1fr)); gap: 20px` |
| Catalog continue | `repeat(auto-fit, minmax(min(320px, 100%), 1fr)); gap: 0` |
| Course outcomes | `repeat(auto-fit, minmax(min(220px, 100%), 1fr)); gap: 12px` |
| Profile stats | `repeat(auto-fit, minmax(min(160px, 100%), 1fr)); gap: 12px` |
| Profile badges | `repeat(3, minmax(0, 1fr)); gap: 14px 10px` |
| Authoring upload | `repeat(auto-fit, minmax(min(380px, 100%), 1fr)); gap: 16px` |
| Authoring repo fields | `repeat(auto-fit, minmax(min(150px, 100%), 1fr)); gap: 10px` |
| Authoring validation | `repeat(auto-fit, minmax(min(280px, 100%), 1fr)); gap: 8px` |
| System swatches / type rows / components | `minmax(min(180px,100%),1fr)` gap 14 / `minmax(min(220px,100%),1fr)` gap 24 / `minmax(min(380px,100%),1fr)` gap 16 |
| Two-pane flex (Course, Profile, Lesson, Authoring) | main `flex: 999 1 <560–600px>; min-width: 0` + aside `flex: 1 1 <300–320px>` with `flex-wrap: wrap` → stacks when it can't fit |

### 7.4 Breakpoints

The designs are intrinsic (flex-wrap + auto-fit). Explicit breakpoints:

- `@media (max-width: 820px) { .hud, .trace { display: none } }` (Main).
- 3D field: `w < 760` → camera z 25 (vs 16); handoff: drop to ~1,500 points under 760px.
- Proposed (this spec, for 360px support): `--bp-sm: 480px` (gutters 16px, stack button groups full-width), `--bp-md: 820px` (hide HUD/trace; collapse app-bar nav into a scrollable row), `--bp-lg: 1100px` (lesson outline becomes a disclosure).

### 7.5 Z-index

Main field layer `z-index: 0`, content `1`; sticky app bar / lesson bar `z-index: 5`.

## 8. Focus

Handoff: "The focus ring is a 4 px volt glow." Implement once:

```css
:focus-visible { outline: none; box-shadow: 0 0 0 1px rgba(198,255,61,.7), 0 0 0 4px rgba(198,255,61,.12); }
```

The artboards only style focus for inputs (`border-color: rgba(198,255,61,.7)` + `0 0 0 4px rgba(198,255,61,.12)`), the search (`.6` + `.1` glow), the hero prompt bar (`.6` + `.12`), the composer (`.75` + `.12`) and the terminal panel (`.55`, no glow). The `.12` glow alone is ~1.3:1 against ink, which fails WCAG 2.2 focus-appearance; the extra 1px `.7` volt ring (6.3:1) is a spec addition — see README.
