# Settings → `/settings` (proposed; no artboard)

Access: signed-in user. Title **"Settings · Bits"**. Composed only from existing components and patterns (`components.md`). Required content (handoff): email; sign-in methods (add/remove passkeys and providers); public profile toggle; handle edit; data export; delete account; sign out everywhere.

Every action is a plain `<form method="post">` (works without JS); islands only for passkey registration and the delete-confirm typing check.

## Layout

Same frame as Profile/Authoring:

- AppBar `app` (sticky glass), nav **Courses** · **My learning** · **Write a course**; AvatarButton (not current — Settings is reached from Profile "Edit profile" and the Account card).
- `<main style="max-width:1280px; margin:0 auto; padding:56px 32px 96px; display:flex; flex-direction:column; gap:40px">`.
- Header (Authoring pattern): Eyebrow volt **"ACCOUNT"**; `<h1>` `display-l` (`clamp(36px, 5vw, 64px)`) **"Settings"**; lead 18/1.6 `#B4B9CA` **"Your sign-in, your profile, your data. Everything here is yours to change or take with you."**
- Two-pane flex (Profile pattern): `display:flex; flex-wrap:wrap; gap:32px; align-items:flex-start`:
  - `<main>`-column `flex:999 1 600px; min-width:0; flex column; gap:16px` → section cards below.
  - `<aside>` `flex:1 1 320px; min-width:0` → sticky (`position:sticky; top:88px`) **On this page** nav: SectionCard (22/18, gap 4) with MonoHeading "ON THIS PAGE" and OutlineItem-style links (44px, radius 10, 14px, hover `rgba(255,255,255,0.04)`) to `#profile`, `#email`, `#sign-in`, `#data`, `#sessions`, `#danger`. On < 952px the aside drops above main → hide it at ≤820px (anchors are optional).

All sections are SectionCards: `padding:24px; border-radius:20px; background:#0E1018; border:1px solid rgba(255,255,255,0.08); display:flex; flex-direction:column; gap:18px`, each starting with a MonoHeading `<h2>` and a 14px lh 1.55 `#9AA0B4` description.

## Sections

### 1. Profile (`#profile`)

- MonoHeading **"PROFILE"**.
- Row: GeneratedAvatar 64px (scaled SVG) + KeyValue-style text: name (16px 600) + `@handle` (mono 13px `#9AA0B4`).
- TextField **"Display name"** (`name`, Geist 16px, 50px).
- TextField **"Handle"** — input wrapped in a group with a static prefix: `<span style="font:15px Geist Mono; color:#7A8098">bits.dev/u/</span>` inside the field's left padding (Geist Mono 15px input). Hint (13px `#7A8098`): "Letters, numbers and dashes. Changing it breaks old links." Error (taken): danger text "That handle is taken."
- **Public profile** — SegmentedTabs `account` flavour bound to radios (`name="public"`), labels **"Public"** / **"Private"**; selected `#1C2030/#ECEEF5`. Under it, 13px `#9AA0B4`: "Public profiles show your name, level, stats, activity, courses and badges. Your email and prompt journal are never shown." + link mono 13px "View public profile →" (`/u/:handle`, only when public).
- Footer row: Keycap primary `m` **"Save profile"** (right-aligned on desktop, full width on mobile).

### 2. Email (`#email`)

- MonoHeading **"EMAIL"**.
- KeyValueList: **Email** `jamie@example.com` (mono 13px) + MetaTag volt "verified" (or MetaTag warn "unverified").
- `<details>` "Change email" (summary styled as ghost-mono button 44px): TextField **"New email"** (Geist Mono 15px) + Keycap `m` **"Send confirmation link →"**. On submit → the same check-inbox pattern as `/login/check` inline: mail icon tile 64px + "Check {new email} for a link to confirm the change." (no code entry needed; reuse CodeEntry if product wants parity).

### 3. Sign-in methods (`#sign-in`)

- MonoHeading **"SIGN-IN METHODS"** + description "Use any of these to get in. Keep at least one."
- List (`<ul>`, gap 10) of method rows — reuse the ProviderButton shell as a non-button row: `min-height:56px; display:flex; align-items:center; gap:12px; padding:0 8px 0 16px; border-radius:12px; border:1px solid rgba(255,255,255,0.12); background:#0A0C14` →
  - icon 18px (github / globe / key / mail from `components.md §2`),
  - label block: name 15px 500 `#ECEEF5` + meta mono 12px `#9AA0B4`,
  - right action (`margin-left:auto`).

  | Method | Meta (example) | Connected action | Not connected action |
  |---|---|---|---|
  | Email link + code | `jamie@example.com` | none (always on; shown as MetaTag "always on") | — |
  | GitHub | `@jamiepark · connected Mar 2026` | ghost-mono `s` **"Disconnect"** (POST) | Keycap dark `m` **"Connect"** → `/auth/oauth/github?link=1&next=/settings` |
  | Google | `jamie@gmail.com` | **"Disconnect"** | **"Connect"** → `/auth/oauth/google?link=1&next=/settings` |
  | Passkey (one row per passkey) | `MacBook · iCloud Keychain · added 12 Oct 2026 · last used today` | **"Remove"** (POST) | — |

- Below the list: Keycap primary `m` with key icon **"Add a passkey"** (island: `POST /api/passkey/register-options` → WebAuthn → verify; state "Waiting for your device…" with `aria-busy`; success adds a row with `.rise`; failure → warn ValidationItem "Passkey wasn't added. Try again.").
- Rule: the last remaining method can't be removed → its action is disabled (`aria-disabled`, text 12px `#7A8098` "Your only way in").
- Inline confirmation for Disconnect/Remove: the button turns into a pair — ghost "Cancel" + danger-outline "Remove passkey" (proposed danger: `border:1px solid rgba(255,122,107,.45); color:#FF7A6B`) — no modal needed.

### 4. Your data (`#data`)

- MonoHeading **"YOUR DATA"** + "Download everything you've done here: progress, neurons, badges and every prompt in your journal, as one JSON file."
- Keycap dark `m` **"Download my data (.json)"** → `GET /settings/export` (`Content-Disposition: attachment`). 13px `#7A8098` meta: "About 40 KB · includes 37 prompts".

### 5. Sessions (`#sessions`)

- MonoHeading **"SESSIONS"** + "You're signed in on 3 devices."
- Optional list (KeyValueList rows, mono 13px): "This device · Chrome on macOS · active now", "Safari on iPhone · 2 days ago", … (from session rows).
- Keycap dark `m` **"Sign out everywhere"** (POST; deletes all sessions including this one → redirects to `/login`). Hint: "Including this device."
- Plain sign out lives in the Account card on `/me` (POST `/logout`).

### 6. Delete account (`#danger`)

Dashed SectionCard variant with danger tint (proposed): `border:1px dashed rgba(255,122,107,.35); background:rgba(255,122,107,.04)`.

- MonoHeading **"DELETE ACCOUNT"** (colour `#FF7A6B`, proposed danger).
- Copy (15px lh 1.55 `#D5D8E3`): "This permanently deletes your account, sign-in methods, sessions, progress, neurons, badges and prompt journal. It can't be undone. Download your data first if you want a copy."
- `<details>` with summary ghost-mono **"Delete my account…"** → reveals:
  - TextField label **"Type your handle to confirm"** (placeholder `jamie`, Geist Mono 15px).
  - Danger keycap (proposed, Keycap shape `m`): `background:#FF7A6B; color:#0A0C05; box-shadow:0 4px 0 #8F3A31, inset 0 1px 0 rgba(255,255,255,.4)`, label **"Delete account forever"**; disabled until the handle matches (small island; without JS the server checks the value).
- After deletion: redirect to `/` with a one-line banner (Eyebrow + text) "Your account is deleted. Thanks for learning with us."

## States

| Case | Treatment |
|---|---|
| Save success | `role="status"` line under the section footer: mono 12px volt "✓ Saved" (fades after 3s; static text without JS after redirect via flash cookie) |
| Validation error | TextField error recipe (`aria-invalid`, message below, danger colour) |
| Server error | warn ValidationItem at top of the section |
| Loading (passkey) | keycap label + `aria-busy` |

## Responsive (incl. 360px)

- Main padding → `32px 16px 64px`; gap 40 → 28; section card padding 24 → 18.
- Aside hidden ≤ 820px.
- Method rows: icon + label block on one line; action button wraps to its own line (`flex-wrap:wrap`, action `flex-basis:100%` with `margin-left:30px`) when the meta text is long; all actions ≥ 44px.
- All section footers: buttons full width (`flex:1 1 100%`).
- Handle field: prefix `bits.dev/u/` hides at ≤ 400px (keep as hint text under the field instead).
- Public/Private tabs: full width 2-up grid (already grid-based).

## Accessibility

- One `<h1>` "Settings"; section headings `<h2>` (MonoHeading); anchors match section ids.
- Each form has its own submit; destructive forms use `<details>` + explicit confirmation text; focus moves to the revealed field.
- Status messages in `role="status"`; errors with `role="alert"` only on submit.
- Public/Private is a radio group (`<fieldset>` + `<legend>Profile visibility</legend>`).
- Danger colour proposals (`#FF7A6B` on `#0E1018` 7.46:1; `#0A0C05` on `#FF7A6B` 7.73:1) need design sign-off — see README.
