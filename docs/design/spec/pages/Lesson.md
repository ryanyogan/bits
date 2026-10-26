# Lesson → `/courses/:course/:lesson?mode=read|watch`

Artboard: `docs/design/artboards/Lesson.dc.html` (1440 × 1400, interactive). Title "Latent — Temperature & randomness" → **"Temperature & randomness · Tokens & temperature · Bits"**.

Access: public (lesson 1 needs no account; all lessons are free). Default mode = user's last-used mode. **Watch** tab appears only when the lesson frontmatter has `video`. Terminal mode → see `CodeLesson.md`. `/author/:course/preview/:lesson` renders this page with a "Draft" banner (not drawn — see below).

No wordmark on this page (the lesson bar has no logo). Only the `<title>` changes.

Prototype state (line 224): `{ mode: "read", temp: 70, runTemp: 0, draft: "Write a tagline for a coffee shop on the moon.", runs: [], hot: 0 }`.

## Layout

Root: `min-height:100vh; background:#07080D; color:#ECEEF5; font-family:Geist; display:flex; flex-direction:column`.

1. **Lesson bar** (AppBar `lesson`, lines 38–67).
2. Body (line 69) `flex:1; display:flex; flex-wrap:wrap; align-items:flex-start`:
   - **Outline** `<nav aria-label="Lessons">` (lines 72–80): `flex:1 1 260px; max-width:320px; padding:28px 16px; border-right:1px solid rgba(255,255,255,0.06); align-self:stretch; gap:4px`.
   - **Main** (line 82): `flex:999 1 560px; min-width:0; padding:40px 24px 120px; box-sizing:border-box`.

### 1. Lesson bar

`position:sticky; top:0; z-index:5; background:rgba(7,8,13,0.88); backdrop-filter:blur(14px); border-bottom:1px solid rgba(255,255,255,0.07)` → inner `padding:12px 24px; display:flex; align-items:center; gap:20px; flex-wrap:wrap`:

1. BackButton → `/courses/:course`, `aria-label="Back to course"`.
2. Title block: **"Tokens & temperature · Lesson 6 of 8"** (mono 12px `#9AA0B4`) / **"Temperature & randomness"** (Unbounded 500 17px ls -0.02em).
3. SegmentedProgress (8 segments, `flex:1 1 160px; max-width:280px; margin:0 auto`): 1–5 `#C6FF3D`; 6 = `linear-gradient(90deg, #3DE3FF 50%, rgba(255,255,255,0.1) 50%)` → `#C6FF3D` once passed; 7–8 `rgba(255,255,255,0.1)`.
4. Mode tabs (`mode` flavour, `aria-label="Lesson format"`): **Read** · **Watch** · **Terminal** (Terminal is a link to `?mode=terminal`). Selected `#1C2030/#ECEEF5`, else `transparent/#9AA0B4`. Implement all three as links with `aria-current`.
5. XpPill **1,240** (→ **1,280** after passing).

### 2. Outline

Heading **"IN THIS COURSE"** (mono 12px ls .12em `#7A8098`, `padding:0 12px 10px`). OutlineItems (components §10.4). Data (line 297):

```json
["What is a token?", "Tokenizers are weird", "Counting tokens", "Probabilities, not answers", "Greedy vs. sampled", "Temperature & randomness", "Top-p and friends", "Checkpoint: tune a chatbot"]
```
Index 0–4 done (`✓`, `#9AA0B4`), 5 current (`#ECEEF5`, bg `rgba(61,227,255,0.08)`, ring `2px solid #3DE3FF`, numeral "6"; becomes done/✓ when passed), 6–7 next (`#C6CAD6`, dashed ring, numerals "7", "8"). Note Course calls lesson 3 "Counting tokens (and cost)" — use the frontmatter title in both places.

### 3. Main — Read mode (lines 85–172)

Column `max-width:760px; margin:0 auto; display:flex; flex-direction:column; gap:28px`.

1. **TutorMessage** (17/1.7 `#D5D8E3`, avatar 32px radius 10):
   - p1 (`margin:3px 0 0`): "Last lesson you saw that a model never picks “the” next word. It gives **every possible token a probability**, then rolls a weighted die."
   - p2: "**Temperature** reshapes those odds before the roll. Low temperature sharpens them — the favourite almost always wins. High temperature flattens them — long shots get a real chance. Drag it and watch."
2. **OddsBars** (`:::odds`, components §10.12), `margin-left:46px`: header **"Moon café tagline: <span #ECEEF5>“___</span>"** / **"next-token odds"**; candidates `[[" Brew",3.1],[" One",2.4],[" Lunar",1.9],[" Fly",1.2],[" Zero",0.6]]`; slider `min 0 max 150 step 5`, default 70 → label **"0.70"**; note at 0.70: **"Balanced: plausible variety. Most chat apps live around here."**
3. **TutorMessage**: "Your turn. Write a prompt that asks for a **tagline for a coffee shop on the moon** with a length limit. Run it once at <code>0</code>, then a few times at <code>1.0</code>, and compare."
4. **Runs** (list, initially empty, `.rise` each): LearnerBubble (mono 14px, `max-width:82%`) with the prompt + ModelOutput (`margin-left:46px`) meta **"model · T={t} · {tokens} tokens"** and output 18px. Prototype outputs: T=0 → **"Brewed beyond gravity."**; T>0 cycles **"One small sip for mankind."**, **"Espresso at escape velocity."**, **"Low gravity. High caffeine."**, **"Fly me to the foam."**, **"Lunar roast, zero atmosphere, full flavour."** `t` label `"0.0"` or `(t/100).toFixed(1)`; tokens `max(3, round(out.length/4))`; keep last 4 runs. (Real outputs stream from `/api/run`; these are the canned `- example` outputs.)
5. **RewardToast** (when all checks pass, `.pop`): hex-check 40px · **"+40 neurons"** · **"Same prompt, different answers — and now you know why."** · InverseKeycap **"Next: Top-p →"** (→ lesson 7).
6. **PromptComposer** (components §10.9): YourTurnTag **"Your turn"** + label **"Write the prompt yourself — no pasting the answer"**; textarea placeholder **"Write a tagline for…"**, default draft **"Write a tagline for a coffee shop on the moon."**; CheckChips; footer **"run at"** + TemperaturePicker `0` / `0.7` / `1.0` + **"~{draftTokens} tokens"** + Keycap **"Run ↵"**.

Checks (lines 275–280):

```json
[
  ["Asks for a tagline",  "/tagline|slogan/i"],
  ["Coffee + moon",       "/coffee|caf[eé]/i AND /moon|lunar/i"],
  ["Sets a length limit", "/\\bwords?\\b|\\bshort\\b|\\bunder\\b|\\bmax/i"],
  ["Ran at 0 and 1.0",    "runs include temp 0 AND a run with temp >= 1.0"]
]
```
Passed when all four are true. With the default draft, checks 1 and 2 pass, 3 and 4 are pending.

Temperature picker: `[[0,"0"],[70,"0.7"],[100,"1.0"]]`; picking also sets the OddsBars slider to the same value. Selected = ion fill (`#3DE3FF` bg + border, text `#07080D`).

### 4. Main — Watch mode (lines 175–217)

Column `.rise`, `max-width:1040px; margin:0 auto; flex column; gap:24px`:

1. **VideoPlayer** (components §10.17): 16:9, radius 20; big play button (84px); controls: chapter scrubber (4 chapters, flex 2/3/2/3, chapter 2 at 40%), Pause, **"1:52 / 4:30"**, **"Chapter 2 · Sharpening the odds"**, **"1.25×"**, **"CC"**.
2. Row `display:flex; flex-wrap:wrap; gap:20px`:
   - **Transcript** (`flex:999 1 420px`): **"TRANSCRIPT · FOLLOWS ALONG"**; cues: past `#7A8098` "So the model has a ranked list of candidates for the next token…"; active (bg `rgba(61,227,255,0.08)`, `#ECEEF5`, `padding:10px 12px; radius 10`) "Temperature divides every score before they become probabilities. Divide by a small number and the gaps get huge."; upcoming `#9AA0B4` "Divide by a big number and everything starts to look the same…".
   - **Side card** (`flex:1 1 260px`, SectionCard 22/18, gap 14): 15px lh 1.55 `#D5D8E3` **"Video is optional. The exercise still happens in text, and your draft is waiting."** + Keycap primary `l` full width **"Back to the exercise"** (→ `?mode=read#exercise`).

The outline stays visible in Watch mode.

## Interactive states and triggers

| Element | Trigger | Result |
|---|---|---|
| Mode tabs | click | URL `?mode=`; keeps draft (stored) and video position |
| Outline item | hover | bg `rgba(255,255,255,0.04)` |
| OddsBars slider | input | probabilities recomputed; bars animate width .35s; label + note update |
| Temp picker | click | `aria-pressed`; also moves slider |
| Composer | focus-within | border `rgba(198,255,61,0.75)`, glow `0 0 0 4px rgba(198,255,61,0.12)` |
| Composer | type | live checks re-evaluate; `~N tokens` updates |
| Composer | Enter / Run | appends run (LearnerBubble + ModelOutput streaming); Shift+Enter newline |
| All checks pass | — | RewardToast pops; segment 6 → volt; outline 6 → ✓; XpPill 1,240 → 1,280; `exercise_passed` sent |
| Ghost buttons | hover | bg `rgba(255,255,255,0.06)` |
| Video | play/pause/seek/speed/CC | per components §10.17; transcript follows |

## Not drawn (compose from existing parts)

- **Draft banner** (`/author/:course/preview/:lesson`): full-width strip under the lesson bar, `background:rgba(255,184,77,0.08); border-bottom:1px solid rgba(255,184,77,0.35); color:#FFD08A; font:12px Geist Mono; padding:10px 24px` — "DRAFT · v5 preview — not visible to learners" + link "Back to validation →".
- **Example-output fallback** (rate limit/offline): ModelOutput meta "example output · T=1.0" + MetaTag ion "example output".
- **Signed-out nudge after passing**: a 13px `#9AA0B4` line under the toast "Sign in to keep these neurons →" (link `/login?next=…`).
- **Lesson complete** (all exercises passed, end of lesson): RewardToast with next-lesson keycap is the completion moment; no separate screen.
- **Quiz block** (`:::quiz`): components §6.4.
- **Code block in Read mode** (`:::code`): CodeEditor (components §10.14) at column width.

## Responsive

- Outline + main wrap: below ~840px (260 + 560) the outline goes **above** main as a full-width block — that pushes content down. Spec: below 1100px replace the outline with a `<details>` disclosure at the top of main ("Lesson 6 of 8 · In this course ▾"), closed by default.
- Watch: transcript and side card wrap under 700px.
- **360px**:
  - Lesson bar: row 1 = BackButton + title (truncate) + XpPill (number only); row 2 = mode tabs (left) ; row 3 = SegmentedProgress full width. Or move the progress into the outline disclosure summary. Keep bar sticky but ≤ 112px tall.
  - Main padding `40px 24px 120px` → `24px 16px 96px`; gap 28 → 22.
  - TutorMessage avatar 28px, gap 10; all `margin-left:46px` blocks → `margin-left:0`.
  - OddsBars grid `64px 1fr 44px`, padding 22 → 16; slider row: label + value on one line, range on its own line (`flex-basis:100%`).
  - Composer: footer wraps — row A "run at" + temp chips; row B tokens + Run (full width). Textarea 16px (prevents iOS zoom).
  - LearnerBubble max 90%; ModelOutput full width.
  - RewardToast: icon 32px; text block `min-width:0`; Next keycap full width.
  - Video controls: chapter title on its own line; buttons 44px.

## Accessibility

- `<main>` contains one `<h1>` (lesson title; currently only in the bar as a span → make the bar title the `<h1>` or add one at the top of main).
- Runs list `aria-live="polite"`; checks announce changes politely (debounced 500ms); toast `role="status"`.
- Composer textarea has a visible label (task text). Enter-to-run documented by the "Run ↵" label; add `aria-keyshortcuts="Enter"` on the textarea.
- Slider: `aria-valuetext` "temperature 0.70".
- Video: captions on by default if the user prefers (CC `aria-pressed`), transcript always available.
- Touch targets under 44px: mode tabs 38px, temp chips 40px, video buttons 40px, slider 32px — fix per components.
