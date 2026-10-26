# System → no product route (design-system reference)

Artboard: `docs/design/artboards/System.dc.html` (1440 × 1560, static). Title "Latent — design system" → **"Bits — design system"**.

Not a page in the handoff route table. It is the source for `tokens.md` and the component states in `components.md`. Recommended: build it as a dev-only style guide route (e.g. `/dev/system`, not linked, `noindex`, disabled in production) that renders the real components — useful as a visual regression target at 360 and 1440px.

## "latent" → "bits"

- `<title>` (line 5).
- Eyebrow **"latent / system"** (line 24) → **"bits / system"**.

## Layout

Root `background:#07080D; color:#ECEEF5; font-family:Geist` → container `max-width:1280px; margin:0 auto; padding:64px 32px 80px; display:flex; flex-direction:column; gap:64px`.

### Header (lines 22–28)

`display:flex; justify-content:space-between; align-items:flex-end; gap:32px; flex-wrap:wrap; padding-bottom:32px; border-bottom:1px solid rgba(255,255,255,0.08)`:
- Left (`gap:14px`): eyebrow volt 13px ls .14em uppercase **"bits / system"**; `<h1>` Unbounded 800 56px lh 1 ls -0.04em **"Ink, Volt & Ion."**
- Right p (`max-width:520px; 16px/1.6; #9AA0B4`): **"A dark ink ground, one electric accent for “do this”, one cool accent for “the model said this”. Unbounded shouts, Geist reads, Geist Mono is anything you type."**

### Color (lines 31–45)

MonoHeading **"Color"**. Grid `repeat(auto-fit, minmax(min(180px, 100%), 1fr)); gap:14px` of swatch cards: `border-radius:14px; overflow:hidden; border:1px solid rgba(255,255,255,0.08); background:#0E1018` → chip `height:96px; background:{hex}; border-bottom:1px solid rgba(255,255,255,0.06)` → text `padding:12px 14px; gap:4px`: name 15px 600, hex mono 12px `#C6CAD6`, use 13px lh 1.45 `#9AA0B4`. Data (lines 182–193):

```json
[
  { "name": "Ink", "hex": "#07080D", "use": "Page ground. Never pure black." },
  { "name": "Surface", "hex": "#0E1018", "use": "Cards, panels, inputs." },
  { "name": "Raised", "hex": "#151826", "use": "Dark keycaps, selected tabs." },
  { "name": "Text", "hex": "#ECEEF5", "use": "Headlines and primary copy." },
  { "name": "Muted", "hex": "#9AA0B4", "use": "Body secondary, descriptions." },
  { "name": "Dim", "hex": "#7A8098", "use": "Hints and meta. Smallest allowed grey (4.9:1)." },
  { "name": "Volt", "hex": "#C6FF3D", "use": "Primary action, your turn, success. Text on it is Ink." },
  { "name": "Volt edge", "hex": "#6E9116", "use": "Keycap shadow under Volt only." },
  { "name": "Ion", "hex": "#3DE3FF", "use": "Model output, in-progress, video." },
  { "name": "Synapse", "hex": "#9D85FF", "use": "3D field and Tools track only." }
]
```
(`hint-placeholder-count="11"` but 10 colours are defined.) In the style-guide route, extend with the `+` tokens from `tokens.md`.

### Type (lines 48–76)

MonoHeading **"Type"**. Rows: grid `repeat(auto-fit, minmax(min(220px, 100%), 1fr)); gap:24px; align-items:baseline; padding:22px 0; border-bottom:1px solid rgba(255,255,255,0.08)` (list has `border-top` too). Left label mono 12px `#9AA0B4` lh 1.6; sample `grid-column: span 3`:

| Label (verbatim) | Sample |
|---|---|
| display-xl · Unbounded 800 · clamp(46–124) · −0.045em | "Learn AI" at 88px / .95 / -0.045em |
| h2 · Unbounded 700 · 64 / 1.02 · −0.035em | "Every lesson is a conversation." at 52px / 1.02 |
| h3 / card title · Unbounded 500 · 22 / 1.15 · −0.02em | "Give your model tools" 22px (lh normal in sample) |
| body / lesson · Geist 400 · 17 / 1.7 · max 68ch | "A model never sees your sentence. It sees a list of numbers, one per token, and guesses which number should come next — then does it again." `#D5D8E3` |
| mono / input + code · Geist Mono 400 · 15 / 1.75 | "<span volt>›</span> You are a pirate. Answer in exactly 3 bullet points." |
| eyebrow · Geist Mono 500 · 12–13 · +0.14em · caps | "02 — How it works" ion 13px (rendered weight 400 — label says 500) |

Note: the `grid-column: span 3` sample overflows the auto-fit grid at narrow widths (span 3 forces 3 implicit columns) — in the style guide use `grid-column: 2 / -1` above 900px and full width below.

### Components (lines 79–173)

MonoHeading **"Components"**. Grid `repeat(auto-fit, minmax(min(380px, 100%), 1fr)); gap:16px` of SectionCards (`padding:24px; border-radius:18px; background:#0E1018; border:1px solid rgba(255,255,255,0.08); gap:20px`), each with a mono 12px `#9AA0B4` caption:

1. **"Keycap buttons — rest · hover · pressed"**: primary rest **"Start lesson →"**, hover **"Hover"** (`#D4FF66`, `0 5px 0 #6E9116, 0 12px 30px rgba(198,255,61,0.25), inset …`, `translateY(-1px)`), pressed **"Pressed"** (`0 1px 0 #6E9116`, `translateY(3px)`); row 2: dark **"Browse courses"**, ghost **"Ghost"** (44px, radius 10, Geist 15px), kbd **"⌘ K"**.
2. **"Prompt composer — the most important input on the site"**: focused composer sample — tag **"Your turn"** + **"Make the model answer as a pirate in 3 bullets"**; text **"You are a salty pirate captain.▍"**; footer **"8 tokens · temp 0.7"** + **"Run ↵"**.
3. **"Lesson nodes — done · current · next"**: **"What is a token?"** (done, struck through), **"Temperature & randomness"** (current, 600, **"IN PROGRESS"**), **"The context window"** (next).
4. **"Chips, tabs, token pills"**: chips **Agents** (selected), **Prompting**, **Foundations**; static tabs **Read**/**Watch**/**Terminal**; tokens **Un** (volt), **believ** (ion), **ably** (synapse).
5. **"Reward toast — fires when an exercise passes"**: **"+40 neurons"** / **"Prompt passed all 3 checks"**.
6. **"Shape & motion"** (grid 2 cols, `gap:10px 20px`, mono 13px, keys `#9AA0B4`, values `#D5D8E3`):
   - radius — 8 · 11 · 14 · 18 · 22 · pill
   - space — 4-pt; sections 120 / cards 24
   - glass — #0C0E16 @ 78% · blur 14–18
   - keycap press — 120ms · 3px travel
   - reveal — 400ms ease · 8px rise
   - 3D morph — lerp 0.055 / frame
   - reduced motion — field at ¼ speed, no caret

Helmet CSS (lines 13–16): `a{color:#C6FF3D} a:hover{color:#E2FF8F}`; `.pulse{animation:pulse 2s ease-in-out infinite}` with the **ion** pulse (`rgba(61,227,255,.6)` → 8px).

## Responsive

Intrinsic. At 360px: container padding `64px 16px 56px`; h1 56 → 40px; swatches 1-up (two 180px columns + 14px gap need 374px, more than the 328px available); components 1-up; type rows stack (label above sample), display sample scales with `clamp(46px, 8.4vw, 124px)`.
