# Auth → `/login` (Sign in · Create account) and `/login/check` (sent)

Artboard: `docs/design/artboards/Auth.dc.html` (1440 × 900, interactive). Title "Latent — sign in" → **"Sign in · Bits"** (`/login`), **"Create account · Bits"** (`?mode=signup`), **"Check your inbox · Bits"** (`/login/check`).

Access: public. `?next=` is carried through every form and link. Three states: **Sign in** (`/login`), **Create account** (`/login?mode=signup`), **Sent / check inbox** (`/login/check`). In the artboard all three are one component with `state = { mode: "signin", email: "", sent: false, goals: { curious: true } }`.

## "latent" → "bits"

- `<title>` (line 5).
- Left-panel wordmark `latent` (line 40).

## Layout

Root (line 29): `min-height:100vh; display:flex; flex-wrap:wrap; background:#07080D; color:#ECEEF5; font-family:Geist`.

Two panes, wrap when the viewport can't fit 560 + 480:

| Pane | Style |
|---|---|
| Left "living brain" (lines 32–50) | `position:relative; flex:1 1 560px; min-height:560px; overflow:hidden; border-right:1px solid rgba(255,255,255,0.06); display:flex; flex-direction:column; justify-content:space-between; padding:32px; box-sizing:border-box` |
| Right form (`<main>`, lines 53–143) | `flex:1 1 480px; display:flex; align-items:center; justify-content:center; padding:48px 24px; box-sizing:border-box` → inner `width:100%; max-width:420px; display:flex; flex-direction:column; gap:26px` |

### Left pane

1. BrainCanvas `<canvas aria-hidden="true">` `position:absolute; inset:0; width:100%; height:100%`.
2. Dot grid overlay: `position:absolute; inset:0; background-image:radial-gradient(rgba(255,255,255,0.05) 1px, transparent 1px); background-size:26px 26px; pointer-events:none` (`aria-hidden`).
3. Logo link → `/` (`position:relative; align-self:flex-start; gap:10px`): mark 28px + wordmark 19px **"bits"**.
4. Bottom block `position:relative; flex column; gap:22px; max-width:520px`:
   - Heading (artboard `<h2>`): `display-auth` — **"Your neurons,<br><span volt>saved.</span>"**. Make it a `<p aria-hidden>` or keep `<h2>` after the form's `<h1>` in DOM order; it sits before the `<h1>` in the source, which breaks heading order.
   - SessionPanel (components §12.9): `› session.restore()` / `✓ 5 lessons · 12-day streak · 1,240 neurons` / `✓ resuming “Temperature & randomness”▍`.

### Right pane, common parts

1. **Account tabs** (SegmentedTabs `account`, line 56–59): grid 2-up, `gap:4px; padding:4px; border-radius:13px; background:#0E1018; border:1px solid rgba(255,255,255,0.08)`; tabs `min-height:44px; border-radius:10px; font:14px Geist Mono`; selected `background:#1C2030; color:#ECEEF5`, unselected `transparent; #9AA0B4`. Labels **"Sign in"**, **"Create account"**. Implement as links `/login?next=…` and `/login?mode=signup&next=…` with `aria-current="page"`. Clicking either also clears the sent state (artboard: `sent:false`).
2. **Footer** (lines 138–141): `flex column; gap:12px; padding-top:20px; border-top:1px solid rgba(255,255,255,0.08)`:
   - Link 15px volt, no underline: **"Just exploring? Start lesson 1 without an account →"** → lesson 1.
   - 12px lh 1.5 `#7A8098`: **"By continuing you agree to the <a #9AA0B4>Terms</a> and <a #9AA0B4>Privacy Policy</a>."**

## State A — Sign in (`/login`)

Block `.rise` (`rise .4s ease both`, 8px), `flex column; gap:22px`:

1. Heading group `gap:10px`: `<h1>` `h1-form` (Unbounded 700 34px ls -0.03em) **"Welcome back."** + p 16px lh 1.55 `#9AA0B4` **"Pick up exactly where you left off — mid-lesson, mid-prompt."**
2. Provider buttons `flex column; gap:10px` (ProviderButton, 50px): **"Continue with GitHub"** (github icon, `/auth/oauth/github?next=`), **"Continue with Google"** (globe icon, `/auth/oauth/google?next=`), **"Use a passkey"** (key icon in volt; WebAuthn island → `POST /api/passkey/login-options` → verify).
3. DividerLabel **"or use email"**.
4. Form (`<form method="post" action="/login">`, `flex column; gap:16px`):
   - TextField: label **"Email"**, `<input id="auth-email" type="email" name="email" placeholder="you@somewhere.dev" autocomplete="email" required>` — Geist Mono 15px.
   - Turnstile (invisible) goes here (handoff).
   - Submit Keycap primary `xl-54` full width (`margin-top:4px; min-height:54px; border-radius:13px; font:500 15px Geist Mono; box-shadow:0 5px 0 #6E9116, inset 0 1px 0 rgba(255,255,255,0.55)`): **"Email me a sign-in link →"**.
   - Note 13px lh 1.5 `#7A8098` centred: **"No passwords. We'll email you a one-time link and code."**

On submit → server sends the email, redirects to `/login/check?email=…&next=…` (PRG). Artboard just sets `sent:true`.

## State B — Create account (`/login?mode=signup`)

Same block, with:

- `<h1>` **"Make it yours."**; sub **"Free forever. Save your progress, streaks and every prompt you write."**
- Providers and divider identical.
- Form adds, before Email: TextField label **"What should we call you?"** `<input id="auth-name" type="text" name="name" placeholder="Ada" autocomplete="name">` (Geist 16px).
- After Email: `<fieldset>` (no border/padding) with `<legend style="font-size:14px; color:#D5D8E3; padding:0; margin-bottom:10px">` **"What brings you here? <span #7A8098>— we'll suggest a first course</span>"** + chips `display:flex; flex-wrap:wrap; gap:8px` of ChoiceChips (`aria-pressed`, 44px pill, 14px Geist). Data:

```json
[["curious","Curious about AI"],["work","Use AI at work"],["code","Build with code"],["teach","Teach others"]]
```
  Default selected: `curious`. Off: border `rgba(255,255,255,0.14)`, bg transparent, text `#B4B9CA`. On: border `rgba(198,255,61,0.6)`, bg `rgba(198,255,61,0.12)`, text `#E4FF9E`. Without JS: checkbox inputs `name="goals"` styled as chips.
- Submit label **"Create account →"**. Hidden input `timezone` filled by a tiny script (`Intl.DateTimeFormat().resolvedOptions().timeZone`) — handoff stores timezone at sign-up.
- Same note line.

## State C — Sent / check inbox (`/login/check`)

Own route. Account tabs remain on top (artboard keeps them; clicking returns to the form). Block `.rise`, `flex column; gap:22px`:

1. Icon tile `aria-hidden`: `width:64px; height:64px; border-radius:18px; background:rgba(198,255,61,0.1); border:1px solid rgba(198,255,61,0.4); display:grid; place-items:center` + mail icon 28px volt.
2. Heading group `gap:10px`: `<h1>` Unbounded 700 **32px** ls -0.03em **"Check your inbox."** + p 16px lh 1.55 `#9AA0B4`: **"We sent a sign-in link to <span style="color:#ECEEF5; font-family:Geist Mono">{email}</span>. Or type the 6-digit code from the email:"** (fallback email shown in the prototype: `you@somewhere.dev`).
3. CodeEntry (components §7.3): grid 6 × `minmax(0,1fr)`, gap 8px; each input `height:60px; border-radius:12px; border:1px solid rgba(255,255,255,0.14); background:#0A0C14; font:22px Unbounded; text-align:center`; sr label "Digit n". Form `method="post" action="/auth/verify"` with `next`.
4. Actions `display:flex; gap:12px; flex-wrap:wrap`:
   - Keycap primary `xl` (`flex:1; min-height:52px; border-radius:13px; font:500 15px Geist Mono; box-shadow:0 5px 0 #6E9116, inset …`) **"Verify & continue"** — must be `<button type="submit">` (artboard: link to Catalog).
   - Ghost-mono (`min-height:52px; padding:0 18px; border-radius:13px; border:1px solid rgba(255,255,255,0.12); background:transparent; font:14px Geist Mono`) **"Use another email"** → `/login?next=…` (artboard: `back()` → `sent:false`).

Additional states for C (not drawn; compose from existing parts):

| State | Trigger | Treatment |
|---|---|---|
| verifying | submit / 6th digit typed | Verify keycap label "Verifying…", `aria-busy`, inputs `readonly` |
| wrong code | server rejects | boxes border `rgba(255,122,107,.6)` (proposed danger), message 14px below grid: "That code didn't match. {n} tries left." (`role="alert"`) |
| locked / expired | 5 attempts or 15 min | replace grid with p "This code has expired. Send a new one." + Keycap "Send a new code →" (re-posts email) |
| resend | — | Add a 13px `#7A8098` line under actions: "Didn't get it? <a>Send again</a>" (rate-limited 3/10 min) |
| magic link opened in another tab | — | `/auth/verify?token=` redirects to `next`; this tab can poll nothing — fine to leave as is |

## Interactive states

| Element | State | Style |
|---|---|---|
| Tabs | selected / hover | `#1C2030`/`#ECEEF5`; hover (proposed) unselected text `#ECEEF5` |
| ProviderButton | hover | `.ghost:hover` bg `rgba(255,255,255,0.06)`, border `rgba(255,255,255,0.22)` (.15s) |
| TextField / code boxes | focus | `border-color:rgba(198,255,61,0.7); box-shadow:0 0 0 4px rgba(198,255,61,0.12)`; placeholder `#7A8098` |
| Submit keycap | hover / active | lift 1px + brightness / press 3px, `0 1px 0 #6E9116` |
| Goal chips | toggle | off ↔ on (see above) |
| Links | hover | `#E2FF8F` |
| Caret in SessionPanel | — | `blink 1.05s steps(1)` |
| Form/sent blocks | mount | `rise .4s ease` |

## BrainCanvas logic (lines 169–252)

- `PerspectiveCamera(45, 1, 0.1, 100)` at z 12; group `position.y = 0.6`.
- 2,800 points on a Fibonacci sphere radius 3 (`golden = π(3 − √5)`); per-point random `aR = (sin(i*12.9898)*43758.5453) % 1`.
- Vertex: `n = normalize(position)`; `w = sin(n.x*4 + t*0.9) * sin(n.y*5 + t*0.7) * sin(n.z*3 + t*1.1)`; `p = position * (1 + w*0.16)`; size `uPx * (1 + max(w,0)*3) * (26 / −mv.z)`.
- Fragment: round sprite, `a = smoothstep(.5, 0, d)^2`; colour `mix(ion, volt, smoothstep(−0.2, 0.6, w))`; alpha `a * (0.35 + max(w,0)*0.9 + aR*0.2)`. Additive, no depth write.
- Orbit ring: 900 points at `r = 4.4 + sin(i*7.1)*0.08`, y jitter `sin(i*3.3)*0.05`; `PointsMaterial({ color: 0x9D85FF, size: 0.045, opacity: 0.7, additive })`; ring rotation x 1.15, z 0.3; spins `ring.rotation.y = −t*0.3`; group `rotation.y = t*0.12`.
- Same retry / DPR cap 2 / transparent clear / dispose pattern as the field. Add: reduced motion (¼ speed), pause when hidden, skip entirely below 760px or when the pane is stacked under the form (see 360px rules).

## Responsive

- Two panes wrap at < 1040px (560 + 480 bases): the brain pane then sits **above** the form at full width with `min-height:560px`. That pushes the form below the fold on phones.
- **360px rule (spec addition)**: at ≤760px put the form first — set the brain pane `order: 2` (or render it after `<main>`), shrink it to a decorative band `min-height:240px` with the canvas hidden (dot grid + heading only), or hide the pane entirely and show the logo above the tabs. Recommended: hide the canvas, keep a 200px band under the form with "Your neurons, saved." at 36px and no SessionPanel.
- Form pane padding `48px 24px` → `32px 16px`; inner max-width 420 → 100% (328px at 360).
- Code grid: 6 boxes × ≈48px with 8px gaps fits 328px; box height 60 → 56px.
- Sent actions: stack (`flex:1 1 100%` each).
- Goal chips wrap 2 per row.

## Accessibility

- `<main>` landmark exists; add a visually hidden `<h1>` order fix (see left-pane heading note).
- Tab group: links with `aria-current` (preferred) or full ARIA tabs.
- Code inputs: `autocomplete="one-time-code"` on the first, `inputmode="numeric"`, `pattern="[0-9]"`, group in a fieldset with legend "6-digit code".
- Error messages linked via `aria-describedby`; focus moves to the first invalid field.
- Canvas `aria-hidden`; the SessionPanel is decorative (`aria-hidden`) unless it shows the real returning-user data.
- Contrast: legal links `#9AA0B4` on ink 7.7:1; note `#7A8098` 5.1:1 — OK.
