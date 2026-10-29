# 048. Landing premium pass: air, a visible field, honest "free"

Status: Accepted (2026-10-29). Amends 040 (landing polish) and 047
(squared grid). Overrides parts of `docs/design/spec/pages/Main.md` on the
owner's ask (listed under "Spec overrides").

## Context

The owner asked for a more "premium" landing. Measured on master `bf3f1aa`
(1440×900 and 360×800, dark, Playwright):

- **The field was hidden, not faint.** 14 cells at `--cell-fill` (ink @ 90%)
  covered 40% of the page at 1440 and 61% at 360, exactly where the field
  morphs. Below the hero it showed only through four thin strips. The
  vignette already took the edges to 65–94% ink.
- **Cramped cells.** 64px display h2s sat in 639px cells with a 40px inset;
  the hero paragraph ran 7 lines on a phone; the scroll cue and pause
  toggle were below the fold at 900.
- **Rhythm.** Strips read `02 / How it works`, `03 / The path`, nothing on
  Modes, `04 / You`; mono labels were uppercase and tracked, unlike the app
  pages after 047 phase 3.
- **"Free" five times.** Paid courses are coming; the page promised every
  course free, forever.

## Decision

1. **Two cell fills.** A copy cell (headline + lead) over the field takes
   the new `--cell-fill-veil` (ink @ 55%); an object cell (lesson preview,
   mode art, tracks, progress showcase) keeps `--cell-fill`. `CellGrid`
   gets `fill="veil"`, and `cellInkStyle` / `cellVeilStyle` for a grid that
   mixes both. The veil is the same hue as `--ink`, so text contrast on the
   ground is unchanged; no blur (047).
2. **The field comes up one step.** Vignette `ellipse 85% 75% at 50% 45%`,
   0 → 0.22 at 65% → 0.82 at the edge (was 70% 60%, 0.35 at 60%, 0.94).
   Points `uAlpha` 1.0 (was 0.85) and 17% larger (`42 / -z`, was 36).
   Network lines 0.2 / `0.18 · netAlpha` (was 0.14 / 0.12). Formations,
   palette, morph and HUD are unchanged.
3. **Air inside the cells, not between the bands.** Display-type cells
   inset `--cell-pad-lg` (64px; `--section-pad-x` under 1024px). The
   landing h2 is `--type-h2-landing-size` (56px at 1440, 30 at 360);
   `--type-h2-size` (64) stays for `PageHead`. Leads cap at 52ch.
   `--section-pad-y`, `--frame-max` and `--frame-inset` are unchanged.
4. **One-fold hero, no badge.** `min-height: calc(100svh − --appbar-h)`
   (phones auto), padding 64 / 32 (phones 40 / 32), so the cue and pause
   toggle sit on the fold's bottom edge at 1440×900. The eyebrow badge is
   gone; its fact moved to the note under the bar ("Free to start · no
   account needed · sign in to save progress"). The paragraph is 125
   characters at `--read-width`. On phones the chips are one row that
   scrolls sideways (`tabIndex=0`, named by its `aria-label`), bleeding to
   the rails.
5. **One strip per band, no indices.** "How it works", "The path",
   "Modes", "Progress": labels only. 047 keeps indices for a real sequence;
   the path's tracks and the field's HUD stages are numbered. Modes uses
   the same stacked intro as the other bands. Mono labels, the cue and the
   HUD are sentence case. Keys lose their trailing "→".
6. **Closing CTA at 80px** (`--type-display-cta-size`
   `clamp(38px, 5.6vw, 80px)`): two lines, so the hero stays the largest
   statement. Band 120 / 120 (phones 80 / 64). The certificate page kept
   the old size through its own token, `--type-display-cert-size`.
7. **Course access, not gated.** `access: free | pro` in course
   frontmatter (default `free`, a build error otherwise), on the manifest
   and `CourseInfo` (optional there; the catalog fills `free` for older
   manifests). `CourseCard` takes `access` and `owned`: a pro card shows a
   `Pro` tag unless owned; free cards stay untagged in the catalog. The
   landing path rows (`PathCourse`: title, access, owned) show `Free` or
   `Pro` (`Tag variant="free" | "pro"`), none for an owned pro course.
   Every course is free today, so every row says `Free`. **No price
   anywhere** until there is a real one, and no "N courses · M free" strip
   aside until the rows come from the catalog. Copy says "free to start"
   instead of "every course is free" / "Free forever".

## Final numbers

| Token / value | Final |
|---|---|
| `--cell-fill-veil` | `rgb(7 8 13 / 0.55)` (screenshots: the field reads through without competing with the leads, so it was not raised to 0.65) |
| `--cell-fill` | `rgb(7 8 13 / 0.9)` (unchanged; object cells) |
| `--cell-pad-lg` | `64px`; `--section-pad-x` under 1024px |
| `--type-h2-landing-size` | `clamp(var(--fs-30), 3.9vw, var(--fs-56))` |
| `--type-display-cta-size` | `clamp(38px, 5.6vw, 80px)` |
| `--type-display-cert-size` | `clamp(42px, 7vw, 104px)` (the old CTA size) |
| `--track-cell-min` / `--mode-art-h` | `300px` / `200px` (phones `120px`) |
| vignette | `radial-gradient(ellipse 85% 75% at 50% 45%, rgb(7 8 13 / 0) 0%, rgb(7 8 13 / 0.22) 65%, rgb(7 8 13 / 0.82) 100%)` |
| points | `uAlpha` 1.0, size factor 42 |
| lines | opacity 0.2, per frame `0.18 · netAlpha` |
| hero | padding 64 / 32 (phones 40 / 32), gap 32 (phones 24), cue 24 above, cue line 40 |
| `--hero-min-height` | removed (unused) |

Measured after (1440×900 / 360×800): page 4,649 / 7,038px tall (was
4,825 / 7,532); veil cells 1.02M / 0.35M px², ink cells 1.85M / 1.22M px²
(was 2.75M / 1.66M all ink); no horizontal overflow; CLS 0.

## Spec overrides (Main.md)

The eyebrow badge, the 820px hero cap and 104px top padding, the
uppercase mode eyebrows, the `→` keys, the 104px CTA with 160/140 band
padding, and the `02 / 03 / 04` section indices.

## Consequences

- Adding `access` to the manifest changes every course's build hash once,
  so the next deploy uploads a new version of each course (decision 036).
- A purchase flow, real prices, the strip aside and the catalog's pro tag
  data come later; a pro key on the landing, when it exists, is a
  `Keycap variant="dark"` beside `Start free`, never a second volt key.
