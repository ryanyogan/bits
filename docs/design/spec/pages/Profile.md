# Profile → `/me` (private) and `/u/:handle` (public)

Artboard: `docs/design/artboards/Profile.dc.html` (1440 × 1600, not interactive). Title "Latent — your profile" → **"Your profile · Bits"** (`/me`), **"{Name} (@{handle}) · Bits"** (`/u/:handle`).

Access: `/me` requires a user (private dashboard: stats, activity, courses, badges, journal, account box). `/u/:handle` is public and shown only when the profile is public — **no email, no journal, no account box**, no Edit button.

## "latent" → "bits"

- `<title>` (line 5); app-bar wordmark (line 30).

## Structure

### 1. AppBar `app` (lines 26–39)

Border-only header in the artboard; canonical sticky glass. Nav: **Courses**, **My learning**, **Write a course**. AvatarButton current state: `background:#C6FF3D; color:#0A0C05; aria-current="page"`, text **JP**. On `/u/:handle` (viewer may be anonymous) use the normal bar for the viewer.

### 2. Identity band (lines 42–68)

`<section style="border-bottom:1px solid rgba(255,255,255,0.07); background-image:radial-gradient(rgba(255,255,255,0.05) 1px, transparent 1px); background-size:24px 24px">` → inner `max-width:1280px; margin:0 auto; padding:56px 32px 48px; display:flex; flex-wrap:wrap; gap:36px; align-items:center`.

1. GeneratedAvatar 148px (`aria-label="Jamie's generated avatar"`).
2. Text (`flex:1 1 360px; flex column; gap:12px`):
   - mono 13px volt **"LEVEL 7 · PROMPT WRANGLER"**
   - `<h1>` `display-profile` **"Jamie Park"**
   - 16px `#9AA0B4` **"@jamie · learning since March 2026 · wants to “build an agent that triages my inbox”"** (the goal clause comes from `users.goals`/a free-text goal; omit on public profile if not set — product call).
   - Level bar (`display:flex; align-items:center; gap:12px; max-width:420px; padding-top:6px`): track 8px radius 4 `rgba(255,255,255,0.08)` with volt fill **74%** + mono 12px `#9AA0B4` **"260 to level 8"**.
3. Actions (`display:flex; gap:10px; flex-wrap:wrap`): ghost-mono link (`min-height:46px; padding:0 16px; radius 12; border rgba(255,255,255,0.14); 14px`) **"Edit profile"** → `/settings`; Keycap dark `m` (`padding:0 16px`, `box-shadow:0 4px 0 #020305`) **"Share ↗"** → copies/opens `/u/:handle` (Web Share API island, fallback copy-link). Public view: only **"Share ↗"**.

### 3. Body (lines 70–179)

`max-width:1280px; margin:0 auto; padding:40px 32px 96px; display:flex; flex-wrap:wrap; gap:32px; align-items:flex-start`.

#### 3a. `<main>` (`flex:999 1 600px; min-width:0; flex column; gap:32px`)

**Stats** — grid `repeat(auto-fit, minmax(min(160px, 100%), 1fr)); gap:12px` of StatTile `profile`:
- **1,240** volt — "neurons"
- **12** ion — "day streak · best 19"
- **14** — "lessons finished"
- **37** — "prompts written" (private only; on public show it too — it's a count, not content; product call)

**Activity** — ActivityGrid (components §11.3): **"ACTIVITY · LAST 26 WEEKS"**, legend **less** □□□■ **more**, 26 × 7 cells, `aria-label="Activity heatmap: active most days in the last two weeks"`. Sample generator (lines 185–196): seed 42 Park–Miller; `shades = ["rgba(255,255,255,0.05)","rgba(198,255,61,0.25)","rgba(198,255,61,0.55)","#C6FF3D"]`; for i in 0..181: `recent = i/182`; `r = rnd()`; `lvl = i > 168 ? (r < .15 ? 2 : 3) : (r < .15 + recent*.55 ? (r < .08 ? 3 : r < .25 ? 2 : 1) : 0)`.

**Courses** — MonoHeading **"COURSES"** + CourseRows (gap 14):
1. **Tokens & temperature** — thumb stripes ion (`repeating-linear-gradient(115deg, rgba(61,227,255,0) 0 6px, rgba(61,227,255,0.35) 6px 7px), #0A0C14`, sigil **T°** 18px) — bar ion **62%** — **"Resume →"**.
2. **Your first agent loop** — thumb rays volt (`repeating-conic-gradient(from 0deg at 50% 120%, rgba(198,255,61,0.3) 0 3deg, transparent 3deg 14deg), #0A0C14`, sigil **loop** 14px) — bar volt **10%** — **"Resume →"**.
3. Finished: **What is an LLM, really?** — **"Finished · certificate ready"** — **"View certificate"** (→ certificate page per handoff open decision: a shareable page per finished course).

**Prompt journal** (private only) — header row (`display:flex; justify-content:space-between; align-items:baseline; gap:12px`): MonoHeading **"PROMPT JOURNAL"** + link mono 13px **"All 37 →"** (→ `/me/journal` or `/me?tab=journal` — route not in handoff, flag). Entries (JournalEntry), data (lines 215–219):

```json
[
  { "p": "You are a pirate. Answer in exactly 3 bullet points: why is the sea salty?", "lesson": "What is an LLM, really? · L6", "result": "✓ passed 3/3 checks", "c": "#C6FF3D" },
  { "p": "Write a tagline for a coffee shop on the moon. Under 6 words.", "lesson": "Tokens & temperature · L6", "result": "ran at T=0 and T=1.0", "c": "#3DE3FF" },
  { "p": "Here are two examples of good commit messages. Write one for this diff…", "lesson": "What is an LLM, really? · L8", "result": "✓ passed 2/2 checks", "c": "#C6FF3D" }
]
```

#### 3b. `<aside>` (`flex:1 1 320px; min-width:0; flex column; gap:16px`)

**Badges** — SectionCard (22/18, gap 16): MonoHeading **"BADGES · 5 OF 12"** + grid `repeat(3, minmax(0,1fr)); gap:14px 10px` of HexBadges 56px (data lines 204–214):

```json
[
  ["First token", "1st", true, "#C6FF3D"],
  ["Few-shot", "×3", true, "#9D85FF"],
  ["Streak ×7", "7d", true, "#E4FF9E"],
  ["Temperature tamer", "T°", true, "#3DE3FF"],
  ["Graduate", "LLM", true, "#C6FF3D"],
  ["Tool wielder", "fn", false],
  ["Loop closer", "∞", false],
  ["Streak ×30", "30d", false],
  ["Shipped", "↗", false]
]
```
Derived: earned → `op "1"`, fill = colour, ink `#07080D`, stroke = colour, dash `0`; locked → `op "0.45"`, fill transparent, ink `#7A8098`, stroke `#7A8098`, dash `1 1`. Hover `.badge` lift/rotate.

**Account** (private only) — SectionCard (22/18, gap 14): MonoHeading **"ACCOUNT"** + KeyValueList: **Email** `jamie@example.com` (mono 13px) · **Sign-in** "GitHub · passkey" · **Profile** "Public" + links block (`flex column; gap:4px; padding-top:8px; border-top:1px solid rgba(255,255,255,0.07)`): **"Download my data"** (volt link, `min-height:40px`, 14px) → export (`/settings#export`), **"Sign out"** (`#9AA0B4`) → `POST /logout` (must be a form button, not a link). Add a third link **"Settings →"** (`/settings`) — not drawn; Edit profile already goes there.

## Public variant `/u/:handle`

Same page minus: Edit profile button, Prompt journal section, Account card, email anywhere. XpPill/streak of the *viewer* stays in the app bar. If the profile is private → 404 page (not drawn; reuse EmptyState: "This profile is private.").

## Empty states (not drawn)

- New user, no activity: stats show `0`; ActivityGrid all level 0 with caption "Your first lesson lights this up."; Courses → EmptyState dashed with "No courses yet." + Keycap `m` "Browse courses →"; Journal → EmptyState "Prompts you write in lessons land here."; Badges all locked.

## Interactive states

| Element | Trigger | Result |
|---|---|---|
| HexBadge | hover | `translateY(-4px) rotate(-3deg)` (.25s `cubic-bezier(.2,1.4,.4,1)`) |
| Heat cell | hover | `outline:1px solid #ECEEF5` (add `title="Oct 12 · 3 activities"`) |
| Share keycap | hover/active | dark keycap; `.key` hover only (Profile has no `:active` rule — use canonical) |
| Course rows | hover | (proposed) border `rgba(255,255,255,0.14)` |

## Responsive

- Identity wraps: avatar + text + actions stack below ~900px.
- Body wraps: aside drops below at < ~952px.
- **360px**:
  - Identity padding `56px 32px 48px` → `32px 16px 32px`; gap 36 → 20; avatar 148 → 96px (left-aligned, above the name); h1 clamps to 36px; handle line wraps; level bar full width; actions full width (two buttons share a row, `flex:1`).
  - Body padding → `24px 16px 64px`; gap 32 → 24.
  - Stats: `minmax(min(160px,100%),1fr)` gives 2-up at 328px (each 158px) — good; value 30 → 26px.
  - ActivityGrid: 464px wide → horizontal scroll inside the card, scrolled to the latest week on load.
  - CourseRow: thumb 64 → 48px; title + bar take the rest; "Resume →" wraps onto its own line (the row is already `flex-wrap:wrap`), right-aligned.
  - Badges grid stays 3-up (≈90px columns; 56px badges fit).
  - Account KeyValueList stays 2 columns; email may wrap (`overflow-wrap:anywhere`).

## Accessibility

- One `<h1>` (name). MonoHeadings `<h2>`.
- Avatar `role="img"` with label; heatmap `role="img"` with a meaningful summary.
- Locked badges: label "{name} — locked"; contrast at opacity .45 fails (name 3.2:1, glyph 1.9:1) → render locked badges at full opacity with `#7A8098` stroke/glyph and `#9AA0B4` names.
- Account links 40px tall → 44px.
- "Sign out" must be a POST form button.
