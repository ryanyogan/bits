# Main → `/` (landing)

Artboard: `docs/design/artboards/Main.dc.html` (1440 × 5400, interactive). Title tag in artboard: "Latent — learn AI by typing to it" → **"Bits — learn AI by typing to it"**.

Access: public. All sections server-rendered; the 3D field and the typewriter placeholder are client islands. Text must read with JS off.

## "latent" → "bits" on this page

- `<title>` (line 5).
- Header wordmark `latent` (line 70).
- Footer wordmark `latent` (line 352).
- Footer `© 2026 [PLATFORM NAME]` (line 359) → `© 2026 Bits`.

## Page shell

```
<div root style="position:relative; background:#07080D; color:#ECEEF5; font-family:Geist; overflow-x:clip; -webkit-font-smoothing:antialiased" onPointerMove>
  [sticky field layer, z 0]   (aria-hidden)
  <div style="position:relative; z-index:1">
    header · hero · #how · #path · three-ways · progress · cta · footer
  </div>
</div>
```

Sticky field layer (lines 44–56): `position:sticky; top:0; height:min(100vh, 960px); margin-bottom:calc(-1 * min(100vh, 960px)); z-index:0; pointer-events:none; overflow:hidden` containing:
1. `<canvas data-field>` `position:absolute; inset:0; width:100%; height:100%; display:block`.
2. Dot grid: `position:absolute; inset:0; background-image:radial-gradient(rgba(255,255,255,0.055) 1px, transparent 1px); background-size:28px 28px; mask-image:radial-gradient(ellipse at 50% 40%, #000 0%, transparent 75%)` (+ `-webkit-mask-image`).
3. Vignette: `position:absolute; inset:0; background:radial-gradient(ellipse 70% 60% at 50% 45%, rgba(7,8,13,0) 0%, rgba(7,8,13,0.35) 60%, rgba(7,8,13,0.94) 100%)`.
4. StageHud (`.hud`, see components §12.6).

Handoff says `height: 100vh`; artboard caps at 960px. **Use `min(100vh, 960px)`** (matches the design on tall screens) — or `100svh` on mobile to avoid URL-bar jumps.

## Sections, top to bottom

### 1. Header (AppBar `marketing`) — lines 61–82

`max-width:1280px; margin:0 auto; padding:22px 32px; display:flex; align-items:center; justify-content:space-between; gap:20px; flex-wrap:wrap`.

- Logo: mark 30px, wordmark 20px **"bits"** → `/`.
- `<nav aria-label="Primary">` gap 28px, 15px, NavLink marketing (`#B4B9CA` → hover `#ECEEF5`): **Courses** (`/courses`), **How it works** (`#how`), **The path** (`#path`), **For authors** (`/author`).
- Right (gap 12px): **Sign in** NavLink (`padding:12px 8px`) → `/login`; Keycap primary nav (44px, `padding:0 18px`, radius 11, 14px/500 mono, `box-shadow:0 4px 0 #6E9116, inset 0 1px 0 rgba(255,255,255,0.55)`) **Start free** → lesson 1 (`/courses/<first-course>/<first-lesson>`).

### 2. Hero — lines 85–112

`<section style="max-width:1280px; margin:0 auto; padding:104px 32px 72px; min-height:820px; box-sizing:border-box; display:flex; flex-direction:column; align-items:center; text-align:center; gap:30px">`

1. **Badge pill**: `display:inline-flex; align-items:center; gap:10px; padding:8px 16px 8px 12px; border:1px solid rgba(198,255,61,0.28); border-radius:999px; background:rgba(7,8,13,0.6); backdrop-filter:blur(10px); font:13px Geist Mono; color:#C6FF3D` + pulsing 8px volt dot (`.pulse`, volt keyframes 6px) + text **"Free courses · from zero to your first agent"**.
2. **H1** `display-xl`: `margin:0; font:800 clamp(46px, 8.4vw, 124px)/0.94 Unbounded; letter-spacing:-0.045em; text-wrap:balance; max-width:1100px`. Copy: **"Learn AI by <span volt>typing</span> to it."** + block caret `<span class="caret" style="display:inline-block; width:0.09em; height:0.82em; margin-left:0.06em; background:#C6FF3D; vertical-align:-0.04em">` (aria-hidden; hidden under reduced motion — handoff says hide the caret, the artboard only stops the blink).
3. **Sub** `lead-xl`: `max-width:640px; font-size:20px; line-height:1.55; color:#B4B9CA; text-wrap:pretty`: **"Free, hands-on courses that take you from “what's a token?” to shipping your first agent. Every lesson is a conversation — you write the prompts, run the code, and watch the model think."**
4. **HeroPromptBar** (components §7.4), max-width 760. Label (sr-only) "Ask your first question". Button **"Ask ↵"**. Submits to lesson 1 with `?q=` prefill.
5. **Suggestion chips** row `display:flex; gap:10px; flex-wrap:wrap; justify-content:center; max-width:760px`: **"Explain tokens like I'm ten"** → lesson 1, **"Why do models make things up?"** → lesson 1, **"Build me a tiny agent"** → the agent-loop lesson in Terminal mode (CodeLesson). Chips should prefill the prompt (`?q=<chip text>`).
6. **Note**: `margin:6px 0 0; font:13px Geist Mono; color:#7A8098` **"No account needed to start · sign in to save progress"**.
7. **ScrollCue** (`margin-top:auto; padding-top:56px`) **"Scroll — the network rewires itself"** + 48px volt line animated `cue 2.4s`.

Typewriter placeholder prompts (lines 390–395, island): `["Explain tokens like I'm ten", "Why do models make things up?", "Write a haiku about gradient descent", "Build me an agent that plans dinner"]` — 55ms tick, +1 char typing, −2 chars deleting, hold 34 ticks at full, 6 ticks between prompts, appends `▍`, pauses when focused or non-empty.

### 3. "02 — How it works" (`id="how"`) — lines 115–190

`<section id="how" style="max-width:1280px; margin:0 auto; padding:120px 32px; box-sizing:border-box">` → grid `repeat(auto-fit, minmax(min(500px, 100%), 1fr)); gap:64px; align-items:center`.

Left column (`flex column; gap:28px`):
- Eyebrow ion **"02 — How it works"**.
- H2 `h2-section` **"Every lesson is a conversation."**
- Lead (19/1.6, `#B4B9CA`, max-width 520, `text-wrap:pretty`): **"No 40-minute lectures. A tutor explains one idea, then hands you the keyboard. You type the prompt, the model answers, and the lesson checks what you actually did."**
- FeatureRow list:
  - **READ** — "Chat-style lessons you can skim, or switch to terminal mode if that's more your speed."
  - **TYPE** — "Prompt exercises with live checks — you can't skip ahead by scrolling."
  - **RUN** — "Real code in a real editor. Copy it, change it, break it on purpose."

Right column: LessonPreviewCard (components §12.4):
- Header: **"Lesson 2 · Tokens, not words"** + static tabs Read (selected) / Watch / Terminal.
- Tutor: "Models don't read words — they read **tokens**. Type any sentence and I'll split it the way the model sees it."
- Learner bubble (16px, max-width 80%): **"Unbelievably, the cat fetched."**
- TokenizerPanel: header **"tokenizer"** / **"8 tokens · 31 characters"**; tokens (verbatim, tints by `i % 3` volt/ion/synapse):

```json
[["Un","1844"],["believ","31141"],["ably","2915"],[",","11"],[" the","279"],[" cat","8415"],[" fetched","42118"],[".","13"]]
```

- Tutor: "See how <code>“ cat”</code> carries its leading space? Quick check — is it the same token as <code>“cat”</code>?" + ghost buttons **"Same token"**, **"Different token"**.
- Footer composer (static): YourTurnTag **"Your turn"** · **"Type a sentence to tokenize"** + blinking caret · **"↵ run"**.

Make the preview card non-interactive (`inert` + the fake buttons as spans) — it is a picture of a lesson.

### 4. "03 — The path" (`id="path"`) — lines 193–219

`<section id="path" style="max-width:1280px; margin:0 auto; padding:120px 32px; box-sizing:border-box; display:flex; flex-direction:column; gap:56px">`

- Intro (`flex column; gap:24px; max-width:760px`): eyebrow synapse **"03 — The path"**; H2 **"From one prompt to a team of agents."**; lead **"Four tracks, each one building on the last. Start at the beginning or jump to wherever you're curious — every course is free."**
- Cards: `position:relative` wrapper with `.trace` dashed line (`left:36px; right:36px; top:35px; border-top:1px dashed rgba(198,255,61,0.4)`, hidden ≤820px) + grid `repeat(auto-fit, minmax(min(260px, 100%), 1fr)); gap:20px` of TrackCards (components §12.2). Data (lines 703–708):

```json
[
  { "n": "01", "track": "Foundations", "title": "How LLMs think", "desc": "Tokens, next-word prediction, temperature and the context window — no math degree required.", "color": "#C6FF3D", "ring": "rgba(198,255,61,0.55)", "courses": ["What is an LLM, really?", "Tokens & temperature"] },
  { "n": "02", "track": "Prompting", "title": "Talk like you mean it", "desc": "Roles, examples, structure and how to tell if a prompt actually got better.", "color": "#3DE3FF", "ring": "rgba(61,227,255,0.55)", "courses": ["Prompting that works", "Context is everything"] },
  { "n": "03", "track": "Tools & context", "title": "Give the model hands", "desc": "Tool calls, retrieval and memory — the pieces every agent is built from.", "color": "#9D85FF", "ring": "rgba(157,133,255,0.6)", "courses": ["Give your model tools", "Retrieval without tears"] },
  { "n": "04", "track": "Agents", "title": "Close the loop", "desc": "Plan, act, observe, repeat. Then ship your agent to the edge.", "color": "#C6FF3D", "ring": "rgba(198,255,61,0.55)", "courses": ["Your first agent loop", "Ship an agent to the edge"] }
]
```

Each card links to `/courses?track=<foundations|prompting|tools|agents>`.

### 5. "Read it. Watch it. Run it." — lines 222–287

`<section style="max-width:1280px; margin:0 auto; padding:120px 32px; box-sizing:border-box; display:flex; flex-direction:column; gap:56px">`

- Header row `display:flex; justify-content:space-between; align-items:flex-end; gap:32px; flex-wrap:wrap`: H2 (`h2-section`, max-width 720, no text-wrap) **"Read it. Watch it. <span volt>Run it.</span>"** + paragraph (17/1.6, `#B4B9CA`, max-width 380) **"Every lesson works as text. Some come with a video. The coding ones hand you a real editor."**
- Grid `repeat(auto-fit, minmax(min(340px, 100%), 1fr)); gap:20px` of 3 ModeCards:
  1. Read: eyebrow volt **"TEXT · ALWAYS"**, title **"Chat or terminal"**, desc **"Read the lesson as a conversation with a tutor, or flip to terminal mode for a CLI feel. Either way, you type to move forward."** Illustration: skeleton (lines 230–236), composer text **"› your prompt here▍"**.
  2. Watch: eyebrow ion **"VIDEO · OPTIONAL"**, title **"Watch when it helps"**, desc **"Chaptered videos with a synced transcript. Jump back to text any time — your place is kept in both."** Illustration lines 245–256.
  3. Run: eyebrow volt **"CODE · WHEN IT MATTERS"**, title **"A real editor"**, desc **"Syntax-highlighted, one-click copy, and a “type it yourself” mode for the moments muscle memory matters."** Illustration: mini editor lines 265–279, code verbatim:

```
while (true) {
  const res = await think(msgs)
  if (!res.toolUse) break
  msgs.push(await act(res))
}
// observe → repeat
```
Colours: `while/const/await/if/break` `#9D85FF`; `true`, `toolUse` `#3DE3FF`; `think`, `push`, `act` `#C6FF3D`; plain `#D5D8E3`; comment `#6B7186`; gutter `1–6` `#3B4157` right-aligned `padding-right:12px`; "Copy" tag top-right.

### 6. "04 — You" (progress) — lines 290–338

`<section style="max-width:1280px; margin:0 auto; padding:120px 32px; box-sizing:border-box">` → grid `repeat(auto-fit, minmax(min(480px, 100%), 1fr)); gap:64px; align-items:center`.

Left: ProgressShowcase (components §12.5):
- ProgressRing 132 volt `62%` + caption **"CONTEXT"**, `aria-label="Context window 62 percent full"`.
- **"Your context window"** / **"Foundations track, 5 of 8 lessons"** / **"Up next: Temperature & randomness"**.
- StatTiles: **12** (volt) "day streak" · **1,240** (ion) "neurons earned" · **37** (`#ECEEF5`) "prompts written".
- BadgeChips (lines 709–715):

```json
[{"name":"First token","fill":"#C6FF3D"},{"name":"Temperature tamer","fill":"#3DE3FF"},{"name":"Few-shot","fill":"#9D85FF"},{"name":"Streak ×7","fill":"#E4FF9E"},{"name":"Tool wielder","fill":"#3B4157"}]
```

Right (`flex column; gap:24px`): eyebrow volt **"04 — You"**; H2 **"Progress you can feel."**; lead **"Sign in once and every prompt you write, every lesson you finish and every badge you earn follows you to any device. Free — no card, no trial, no catch."**; Keycap dark `l` (48px, `padding:0 20px`, radius 12, 14px mono, `box-shadow:0 4px 0 #020305`, `.key.key-dark`) **"See a profile →"** → a sample public profile (`/u/<demo-handle>`).

This is sample data on a marketing page. Do not personalise it.

### 7. Closing CTA — lines 341–348

`<section style="max-width:1280px; margin:0 auto; padding:160px 32px 140px; box-sizing:border-box; display:flex; flex-direction:column; align-items:center; text-align:center; gap:36px">`
- H2 `display-cta` **"Your first prompt is waiting."**
- Buttons (`display:flex; gap:14px; flex-wrap:wrap; justify-content:center`): Keycap primary `cta` **"Start lesson 1 →"** (→ lesson 1); Keycap dark `cta` (56px, `padding:0 26px`, radius 13, 16px, `box-shadow:0 5px 0 #020305`) **"Browse courses"** → `/courses`.
- Note mono 13px `#7A8098` **"Free forever · progress saves when you sign in"**.

### 8. Footer — lines 350–361

See components §3.5. Links: **Courses**, **Write a course**, **Sign in**, **Profile**; **© 2026 Bits**.

## Interactive states

| Element | Trigger | Result |
|---|---|---|
| NavLinks | hover | `#B4B9CA` → `#ECEEF5` (.15s) |
| Keycaps | hover / active | lift 1px + brightness 1.06 / press 3px, edge 1px |
| Prompt bar | focus-within | border `rgba(198,255,61,.6)`, glow `0 0 0 4px rgba(198,255,61,.12)` + base shadow |
| Prompt input | idle, empty, unfocused | typewriter placeholder cycles |
| Suggestion chips | hover | border volt .55, text `#ECEEF5`, bg volt .06 |
| Track cards | hover | lift 4px, border volt .35 (apply to glass body) |
| Field | scroll | morphs through 4 formations; HUD label switches |
| Field | pointer move | parallax (rotation y ±0.35 rad, x ±0.18 rad, eased .04) |

## Responsive

The artboard is intrinsic. Rules from the artboard: `.hud` and `.trace` hidden ≤820px; field camera pulls back (`z = 25`) under 760px.

Additional rules for 360px (not shown in the design):

- **Gutters**: all `padding: X 32px` → `X 16px` at ≤480px.
- **Header**: logo row + right group on one line (Logo · Start free); the four nav links go to a second row as a horizontally scrollable strip (`overflow-x:auto; gap:20px; white-space:nowrap`) or into a `<details>` menu. Move "Sign in" into that row and keep only "Start free" top-right.
- **Hero**: `padding: 64px 16px 48px; min-height: auto` (820px is too tall for phones; let content define height, keep the scroll cue). H1 clamps to 46px (`8.4vw` = 30px < 46px min) → at 360px the 46px min with `-0.045em` fits "Learn AI by / typing to it." in 3 lines; keep `text-wrap: balance`. Sub 20px → 17px at ≤480px.
- **Prompt bar**: see components §7.4 (padding 8/8/8/16, input 16px, hide ↵ tile). Suggestion chips wrap, each `min-height:44px`.
- **Sections**: vertical padding 120 → 72px; CTA 160/140 → 96/80. Two-column grids already collapse (minmax `min(500px,100%)`). Gap 64 → 40.
- **Lesson preview card**: body padding 26/24 → 20/16; token pills wrap; learner bubble max 90%.
- **Track cards**: single column; number disc stays; `min-height:260px` → auto.
- **Mode cards**: `minmax(min(340px,100%),1fr)` → single column at 360 (328px content). The Run mini editor overflows: add `overflow-x:auto` to the code span.
- **Progress card**: padding 28 → 20; ring 132 → 112 (scale SVG via width attr); stat tiles stay 3-up (≈92px each) with value 20px.
- **CTA buttons**: stack full width (`flex: 1 1 100%`).
- **Field**: ~1,500 points under 760px (handoff); pixel ratio cap 2.

## Accessibility notes

- Field layer `aria-hidden="true"`, `pointer-events:none`.
- One `<h1>` (hero). Section h2s in order. The eyebrows "02 — …", "03 — …", "04 — You" are decorative numbering (Read-it section has none) — keep them as `<p>` / `<span>`.
- The hero badge pulse and caret stop under reduced motion; hide the caret entirely (handoff).
- Prompt bar label exists (`.sr`). Submit must be a `<button>`.
- Lesson preview card: `inert` + `aria-label="Example lesson"` with a short description, so fake controls are not tabbable.

---

## NeuralField (port guide)

> **Addendum (decision 057, 2026-10-29).** The field now draws *bits*: square
> cells that read 0 (outline) or 1 (fill), in four formations: bit-planes →
> tapes of bytes → a graph of chips → a galaxy of bits, coloured from the
> CSS tokens at run time. The scroll mapping, holds, easing, HUD mechanics
> and pause control below still apply; the formations, sprite, palette
> source and point counts are as `docs/decisions/057-bits-in-motion.md`
> records, and `apps/web/app/actions/home/public/field-scene.ts` is the
> source of truth. The rest of this section describes the artboard's port.


Client-only island. Handoff: `three` as a dependency, dynamically imported after the hero paints; ~3,400 points, single `ShaderMaterial`, 4 formations blended by `uMorph` 0–3; edges + signals fade during the first morph; scroll → `uMorph` with holds, eased 0.055/frame; per-stage palette; cursor parallax; stage label re-rendered only on change; DPR cap 2; ~1,500 points under 760px; pause when hidden/off-screen; reduced motion → ¼ speed + no caret; WebGL failure → static dot grid, no error.

### Source map (Main.dc.html line ranges)

| Lines | What |
|---|---|
| 14–39 | Helmet CSS: keyframes, `.hud`/`.trace` media query (36), reduced motion (37) |
| 41 | Root element with `onPointerMove` (parallax input) |
| 43–56 | Sticky field layer markup (canvas, dot grid, vignette, HUD) |
| 366–383 | State `{ stage, typed, focused, query }`, `setCanvas`, `onMove` (normalises pointer to −1..1 → `mouse.tx/ty`) |
| 385–405 | `componentDidMount`: init GL + typewriter timer (390–404) |
| 407–413 | Teardown: clear timer, cancel RAF, dispose renderer + geometries/materials |
| 415–429 | Renderer: retry until THREE + canvas exist (40 × 100ms), `WebGLRenderer({antialias:true, alpha:true, powerPreference:"high-performance"})` in try/catch (fail → return silently), DPR `min(devicePixelRatio, 2)`, clear `0x000000` α0, reduced-motion query |
| 431–435 | `Scene`, `PerspectiveCamera(50, 1, 0.1, 200)` at z 16, one `Group` |
| 437–439 | Seeded PRNG (Park–Miller, seed 11) + Box–Muller `gauss()` — keep for deterministic shapes |
| 441–443 | `N = 3400`; Float32Arrays A,B,C,D (xyz) + R (random 0–1) + S (size) |
| 445–469 | **Formation A — network**: layers `[5, 9, 13, 13, 9, 5]` spaced 2.7 on x, 0.92 on y, z jitter ±0.7; edges between consecutive layers with p=0.5; first 58% of points cluster on nodes (σ .08, size 1.1–2.0), rest sit along random edges (size .45–.8) |
| 471–488 | **Formation B — token ribbon**: 26 blocks 0.78×0.52 spaced 1.0 on x; 72% on block outlines, 28% inside; ribbon y `+ sin(cx*0.42)*1.7`, z `cos(cx*0.3)*2.4` |
| 490–503 | **Formation C — agent loop**: 74% on a (2,3) torus knot `r = cos(3t)+2.4`, scaled 1.5, σ .1; 26% on a core sphere r≈1.05 |
| 505–512 | **Formation D — galaxy**: 3 arms, `r = rnd^0.62 * 8.2`, angle `arm*2π/3 + r*0.55 + gauss*0.2`, thickness `gauss*0.16*(1.3 − r/9)`, tilted −1.0 rad about x |
| 514–520 | BufferGeometry: `position`=A, `aB`, `aC`, `aD` (vec3), `aR`, `aS` (float) |
| 522–561 | ShaderMaterial (see below), `transparent`, `depthWrite:false`, `AdditiveBlending`; uniforms `uMorph, uTime, uPx, uC1, uC2, uAlpha` |
| 562–564 | `Points`, `frustumCulled = false` |
| 566–576 | Network edges `LineSegments`, `LineBasicMaterial(0xC6FF3D, opacity .14, additive)` |
| 578–614 | 170 signal points travelling along random edges: `t = fract(uTime*0.3 + aOff)`, size `64/-mv.z`, alpha `sin(t·π)·uAlpha`, colour `mix(volt, white, .5)` |
| 616 | Disposables list |
| 618–625 | Stage palette + `smooth()` helper |
| 627–684 | Frame loop (below) |
| 687–693 | HUD stage data (`01 Neurons`, `02 Tokens`, `03 Agents`, `04 You`; on → volt, 36px bar; off → `#7A8098`, 12px bar `rgba(255,255,255,0.2)`) |

### Shader approach

Vertex (529–548): pick the pair for the current segment — `[0,1)` A→B, `[1,2)` B→C, `[2,3]` C→D; local `f = uMorph − segment`. Stagger per point: `f = clamp((f − aR*0.35) / 0.65, 0, 1)` then smoothstep `f*f*(3−2f)`. Position `mix(from, to, f)`, plus a mid-flight swirl `vec3(sin(uTime*0.6 + aR*43), cos(uTime*0.5 + aR*31), sin(uTime*0.7 + aR*17)) * (0.03 + sin(f·π)*1.1)` (points scatter while travelling, settle when held). Twinkle `0.7 + 0.3*sin(uTime*2.2 + aR*60)`; `gl_PointSize = aS * tw * uPx * (36 / −mv.z)`.

Fragment (549–560): round sprite (`discard` outside r .5), alpha `smoothstep(.5, 0, d)^2`; colour `mix(uC1, uC2, smoothstep(.15, .85, vR))`, white core `mix(col, 1, smoothstep(.16, 0, d)*.55)`; final alpha `a * uAlpha * (0.5 + vR*0.5)`.

### Scroll → morph mapping (644–657)

```
p      = clamp(-root.top / max(1, root.height − innerHeight), 0, 1)   // page scroll progress through the root
m      = min(3, p * 3.5)
base   = floor(m)
target = min(3, base + smooth(0.3, 0.85, m − base))                  // smoothstep holds
morph += (target − morph) * 0.055                                     // per frame
```

Resulting holds by page scroll %: Network 0–8.6% · morph → Tokens 8.6–24.3% · hold Tokens 24.3–37.1% · morph → Agents 37.1–52.9% · hold Agents 52.9–65.7% · morph → Galaxy ("You") 65.7–81.4% · hold 81.4–100%. With no scrollable page (canvas preview) it auto-cycles: `cyc = (time*0.11) % 6`, triangle 0→3→0, `smooth(0.45, 1.0)`. In production, drive from the document scroll (root = page wrapper) and keep the auto-cycle only as a fallback when the page cannot scroll.

Make the mapping frame-rate independent when porting: `morph += (target − morph) * (1 − Math.pow(1 − 0.055, dt * 60))`.

### Per-frame (627–684)

- `dt = min(0.05, Δs)`; `time += dt * (reduce ? 0.25 : 1)`.
- Resize when canvas client size changes (`setSize(w, h, false)`, aspect, projection).
- Palette: `si = min(2, floor(morph))`, `sf = morph − si`; `uC1 = lerp(pal[si][0], pal[si+1][0], sf)`, `uC2` likewise. Palette per stage: 0 `#C6FF3D → #3DE3FF`, 1 `#3DE3FF → #9D85FF`, 2 `#9D85FF → #C6FF3D`, 3 `#E4FF9E → #9D85FF` (pairs are uC1/uC2).
- Network fade: `netA = 1 − min(1, morph * 1.6)`; edges opacity `0.15 * netA`; signals `uAlpha = netA`; hide both when `netA ≤ 0.01` (gone by morph ≈ 0.63).
- Parallax: `mouse.x += (tx − x) * 0.04` (same y); `group.rotation.y = sin(time*0.09)*0.45 + mouse.x*0.35 + (morph > 2 ? (morph−2)*time*0.04 : 0)`; `group.rotation.x = mouse.y*0.18 + sin(time*0.07)*0.08`.
- Camera: `z = (w < 760 ? 25 : 16) + sin(min(3, morph)·π) * 1.4`.
- Stage: `stage = clamp(round(morph), 0, 3)`; `setState` **only if changed** (HUD re-render).

### Port checklist

1. Island mounts after hero paint (`requestIdleCallback` or after `load`), `import('three')`.
2. N = 3400 (≥760px) / ~1500 (<760px); generate formations with the same seeded PRNG.
3. Pause RAF on `visibilitychange` hidden and when an `IntersectionObserver` reports the field off-screen (it is sticky across the page, so this mainly applies past the footer).
4. Reduced motion: ¼ time speed; hero caret hidden; HUD transitions instant.
5. WebGL failure (constructor throws or context lost): leave the dot grid + vignette, no message.
6. Dispose everything on unmount (geometries, materials, renderer).
7. Read scroll in a passive `scroll` listener into a variable; never `getBoundingClientRect` per frame if avoidable (cache root height on resize).
