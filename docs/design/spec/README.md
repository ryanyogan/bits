# Bits design spec

An implementation spec for building Remix 3 components and pages that match the canvas *"Latent — AI Learning Platform"*. Its sources are the 9 artboards in `docs/design/artboards/` plus `canvas.json`, and the product handoff `docs/handoff.md`. All values come from those files. Where this spec proposes something the artboards don't show, it says "proposed" or "not drawn".

The product name is **Bits**. Every `latent` wordmark, title and prompt in the artboards becomes `bits`.

## Index

| File | Contents |
|---|---|
| [`tokens.md`](tokens.md) | Colour (core, `+` extras, every rgba tint, syntax and field palettes), type roles, spacing, radii, shadows, motion (transitions, keyframes, easings, durations), containers, page paddings, grids, breakpoints, focus |
| [`components.md`](components.md) | 92 components plus an 18-icon set. For each: anatomy, exact styles per variant and state, props and data, responsive rules, a11y, the artboards that use it, and whether it is static or an island. Ends with an island summary |
| [`pages/Main.md`](pages/Main.md) | `/`: the landing page, plus a full port guide for the three.js NeuralField with line ranges |
| [`pages/Auth.md`](pages/Auth.md) | `/login` (sign in, create account) and `/login/check` (check inbox, 6-digit code), plus the BrainCanvas logic |
| [`pages/Catalog.md`](pages/Catalog.md) | `/courses` |
| [`pages/Course.md`](pages/Course.md) | `/courses/:course` |
| [`pages/Lesson.md`](pages/Lesson.md) | `/courses/:course/:lesson?mode=read\|watch` (and the author draft preview) |
| [`pages/CodeLesson.md`](pages/CodeLesson.md) | `/courses/:course/:lesson?mode=terminal` |
| [`pages/Profile.md`](pages/Profile.md) | `/me` and `/u/:handle` |
| [`pages/Authoring.md`](pages/Authoring.md) | `/author` and `/author/:course` |
| [`pages/Settings.md`](pages/Settings.md) | `/settings`. There is no artboard; the layout is proposed and built only from existing components |
| [`pages/System.md`](pages/System.md) | The design-system artboard. It has no product route; a dev-only style guide is suggested |

### Route map

| Route | Artboard | Spec |
|---|---|---|
| `/` | Main | pages/Main.md |
| `/login`, `/login?mode=signup` | Auth | pages/Auth.md (states A, B) |
| `/login/check` | Auth (sent) | pages/Auth.md (state C) |
| `/courses` | Catalog | pages/Catalog.md |
| `/courses/:course` | Course | pages/Course.md |
| `/courses/:course/:lesson?mode=read\|watch` | Lesson | pages/Lesson.md |
| `/courses/:course/:lesson?mode=terminal` | CodeLesson | pages/CodeLesson.md |
| `/me`, `/u/:handle` | Profile | pages/Profile.md |
| `/settings` | none | pages/Settings.md |
| `/author`, `/author/:course` | Authoring | pages/Authoring.md |
| `/author/:course/preview/:lesson` | Lesson + Draft banner | pages/Lesson.md ("Not drawn") |

### "latent" → "bits" occurrences

| File | Line | Text |
|---|---|---|
| canvas.json | 129 | `"title": "Latent — AI Learning Platform"` |
| handoff.md | 3, 30, 34, 852 | `# Latent — Build Handoff…`, canvas link title, "Latent (working name)", open decision "\"latent\" as a placeholder" |
| Main.dc.html | 5, 70, 352, 359 | `<title>Latent — …`, header wordmark, footer wordmark, `© 2026 [PLATFORM NAME]` |
| Auth.dc.html | 5, 40 | title, wordmark |
| System.dc.html | 5, 24 | title, eyebrow `latent / system` |
| Catalog.dc.html | 5, 38 | title, wordmark |
| Course.dc.html | 5, 32 | title, wordmark |
| Lesson.dc.html | 5 | title |
| CodeLesson.dc.html | 5, 54 | title, terminal prompt `latent` |
| Profile.dc.html | 5, 30 | title, wordmark |
| Authoring.dc.html | 5, 31 | title, wordmark |

Other placeholders to fill: `[AUTHOR NAME]` and `[DATE]` (Course line 175), `[org]/courses` (Authoring line 67), and `[PLATFORM NAME]` (Main line 359). Keep the product name in one config constant (handoff).

---

## Inconsistencies and gaps

### A. The same component with different values across artboards

1. **Text on volt.** The handoff says `--ink` (`#07080D`), but every artboard uses `#0A0C05`. Text on ion uses `#07080D`. Both pass contrast. The spec keeps `#0A0C05` as `--on-volt`.
2. **Selected tab background.** The handoff and System say `--raised #151826` is for selected tabs. The interactive tabs (Auth, Lesson, Code) use `#1C2030`, and the static tabs (System, Main) use `rgba(255,255,255,.1)`. The spec makes `#1C2030` canonical as `--selected`.
3. **Keycap geometry.** Radii are 11px (nav, hero Ask), 12px (46–48px buttons) and 13px (52–56px buttons). The edge is 3, 4 or 5px. The System "hover" sample swaps the background to `#D4FF66` with a glow, but the live CSS uses `filter: brightness(1.06)`. In Code, `.key:active` travels 2px and keeps the edge, where every other artboard uses 3px and `0 1px 0`. Profile has no `:active` rule. None of 11, 12 or 13px is on the documented radius scale (8/11/14/18/22) except 11. Canonical sizes are in components §5.1.
4. **Lesson node.** It is 32px with a 14px check at stroke 2 in System, 30px in a 40px slot with a 13px check at stroke 2.2 in Course, and 20px with text glyphs in the Lesson outline. The dashed "next" border is `.3` in System and Lesson, `.32` in Course. The ion pulse spreads 8px (System) or 9px (Course); the volt pulse on Main spreads 6px. In the Lesson outline the current and next numerals are `#0A0C05` on a transparent dot, which makes them invisible.
5. **AppBar.** Catalog's bar is sticky glass with blur. Course has the background but isn't sticky. Profile and Authoring have only a border. XP and streak pills appear only on Catalog. NavLink colour is `#B4B9CA` on Main and `#9AA0B4` in the app. Course marks "My learning" as current on a course page. The Terminal-mode bar drops the progress segments, the XP pill and the sticky behaviour that Lesson has.
6. **Reveal and focus recipes.** `rise` runs at 400ms / 8px (Auth, handoff), 450ms / 10px with a cubic easing (Lesson), and 350ms / 6px (Code). The focus border is `.6`, `.7` or `.75` volt, the glow is `.1` or `.12`, and the terminal panel has a border only. Authoring `.field:focus` has no glow. Ghost hover changes the border on Auth but not on Lesson. Card hover lifts 4px on Main and 6px with a rotate and shadow on Catalog.
7. **Copy and data mismatches.** "Tools & context" (Main) vs "Tools" (Catalog). "Counting tokens (and cost)" (Course) vs "Counting tokens" (Lesson). The Main preview "Lesson 2 · Tokens, not words" vs Course lesson 2 "Tokenizers are weird". The course says "~50 min" but its lessons add up to 53. "BADGES · 5 OF 12" but only 9 badges are defined. The Authoring blocks table omits `:::quiz multiple?` and `:::tokenizer sample?`, which the handoff includes. The System colour grid hints 11 swatches but defines 10. The System eyebrow label says weight 500 but renders 400.
8. **Synapse usage.** The handoff limits synapse to "the 3D field and the Tools track only". The artboards also use it for the `$` shell prompt, the `{ } code` and `◆ project` kinds, `- check` syntax, the code keyword family (`#B9A6FF`), the "03 — The path" eyebrow, the Few-shot badge, avatar nodes and token pills. Either relax the rule or recolour.
9. **Fonts.** The artboards load Unbounded 400, which the Auth code boxes use (the handoff lists 500/700/800 only). CodeLesson also requests Geist Mono 600, which nothing uses.

### B. Missing states and screens

10. **No danger or error colour exists.** It is needed for validation errors, a wrong 6-digit code, delete account and quiz "incorrect". The spec proposes `#FF7A6B` (7.86:1 on ink) and needs design sign-off.
11. **States not drawn.** Disabled volt keycap. Form errors (invalid email, wrong or expired code, resend). Composer running and streaming. The "example output" fallback for rate limits. Quiz selected, correct and incorrect. Video loading, buffering and captions-off. The upload and build progress. The publish confirmation and rollback. Empty states for Profile, the journal and the author's course list. The suggested-first-course card on Catalog. The Draft banner. The `/author` course list. The private-profile 404. Each is composed from existing parts in the page specs.
12. **No mobile layouts are drawn at all.** There is no nav collapse; app-bar links just wrap. Lesson's 320px outline stacks above the content, and Auth's brain panel pushes the form below the fold. The 360px rules in each page spec are proposals.
13. **Modules aren't in the handoff's frontmatter.** Course groups lessons into M1–M3, but the lesson frontmatter has only `order`. Add `module`, or render a flat list. The handoff also doesn't name a route for the full prompt journal ("All 37 →").
14. **Tab semantics are mixed.** In Lesson, `role="tablist"` contains buttons with `role="tab"` plus a plain `<a>` (Terminal). CodeLesson uses `aria-current`, and its file tabs are `<span role="tab">` with no keyboard support. Auth "Verify & continue" is an `<a>`, not a submit. Mode tabs and filters are URL state, so the spec makes them links.

### C. Contrast against 4.5:1

| Where | Pair | Ratio | Fix in spec |
|---|---|---|---|
| Code gutter, lines outside the range (Code) | `#4A5068` on `#0A0C14` | 2.45 | `#7A8098` (4.99) |
| Mini editor gutter (Main) | `#3B4157` on `#0A0C14` | 1.93 | decorative (`aria-hidden`); or `#7A8098` |
| Mini editor comment (Main) | `#6B7186` on `#0A0C14` | 4.03 | `#7A8098` |
| Selected FilterPill count (Catalog) | `#7A8098` on `#ECEEF5` | 3.37 | `rgba(7,8,13,.7)` |
| Selected "All" filter dot (Catalog) | `#ECEEF5` on `#ECEEF5` | 1.0 | ink dot |
| Locked badges at opacity .45 (Profile) | name ≈3.22, glyph ≈1.91 | fail | full opacity, muted colours |
| "Copy off" disabled keycap (Code) | `#7A8098` on `#1C2030` | 4.13 | exempt as disabled; prefer `#9AA0B4` (6.21) |
| Type-mode ghost lines (Code) | opacity .28 ≈ 1.9–2.2 | fail | intentional; the same text is readable with type mode off |
| Outline current/next numerals (Lesson) | `#0A0C05` on dark | ≈1.0 | `#3DE3FF` / `#C6CAD6` |
| Focus glow alone | `rgba(198,255,61,.12)` ring | ≈1.3 | add a 1px `.7` volt ring (tokens §8) |
| Non-text control borders | `rgba(255,255,255,.12–.14)` on ink | 1.3–1.4 | below the 3:1 non-text guideline. Inputs still read through their label and fill; consider `.22` for text-field borders |

`--dim #7A8098` passes on every ground: 5.11 on ink, 4.85 on surface, 4.99 on the well, 5.05 on the terminal, and 4.51 on raised (just above 4.5). It fails on `#1C2030` (4.13). Don't use dim text on selected tabs.

### D. Touch targets under 44px

| Control | Size | Artboards |
|---|---|---|
| Mode tabs (Read/Watch/Terminal) | 38px tall | Lesson, Code |
| Copy / Type it buttons | 34px | Code |
| "▶ Run" (output) | 36px | Code |
| Terminal quiz options, temperature chips, video controls | 40px | Code, Lesson |
| AvatarButton | 40×40 | app bars |
| Account links (Download my data, Sign out) | 40px | Profile |
| App NavLinks (`padding:10px 0`, 15px) | ≈39px | app bars |
| Hero suggestion chips (`padding:10px 14px`, 14px) | ≈38px | Main |
| Footer links, breadcrumb, inline text links ("All 37 →", "courses/…/ →", Terms/Privacy) | text height | Main, Course, Profile, Auth |
| Range slider | 32px | Lesson |
| File-tree rows | 26px | Authoring |
| Logo link | 26–30px | all |

The spec fixes these with `min-height:44px` or a hit-area extension, so the visuals stay as drawn.

### E. Other notes for builders

- The GeneratedAvatar's outer `<path>` has no `fill`, so it fills black. Set `fill="none"`.
- In Main, the `.card-lift:hover` border colour targets an `<a>` that has no border. Apply it to the glass body.
- The System type-row samples use `grid-column: span 3` inside an auto-fit grid, which overflows when the grid is narrow.
- There are no real GitHub or Google logos. The "GitHub" icon is a git-branch glyph.
- The Auth BrainCanvas has no reduced-motion handling and no pause when the tab is hidden. The NeuralField eases at 0.055 per frame, which depends on frame rate. The spec gives a `dt`-based formula.
- Main's sticky field height is `min(100vh, 960px)`; the handoff says `100vh`. The spec keeps the artboard value.
