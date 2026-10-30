# 059. One header on every page: the centred bar

Status: Accepted (2026-10-29). Amends 022 (drops its two exceptions: the
landing's marketing bar and the sign-in page's logo row), 040 and 048 (the
landing header's frosting over the field), 044 (the sign-in brand row).

## Context

There were three headers. App pages had `AppBar` (`variant="app"`): logo,
nav cells beside it, actions pushed right, 26px mark. The landing had its
own `LandingHeader` (`home/landing-header.tsx`): logo left, nav truly
centred, actions right, a 30px mark, transparent over the 3D field and
filling with ink over the first 120px of scroll. Sign-in drew a third: a
bare logo row in the Auth frame. `AppBar` also kept a `marketing` variant
nobody rendered.

The owner, 2026-10-29: "lets use the same header, nav logo throughout, i
like the one that has center nav personally" and "the content of the
header can change, but same visual style, component, height, etc."

## Decision

- **`AppBar` is the landing's bar, and it is the only header.** Logo left,
  the nav centred on a `1fr auto 1fr` grid as a row of full-height cells
  between hairlines, actions right. Exactly `--appbar-h` tall (the row is
  `--appbar-h` minus the 1px rule). The row sits on a `PageFrame`'s column
  with its two rails; the header's own bottom border is the full-bleed
  rule, with `+` marks where it crosses the rails. Sticky at the top on an
  opaque `--ink` ground, flat (047). Nothing wraps (`white-space: nowrap`).
  760–1023px: `auto 1fr auto` and tighter cells (`--appbar-link-pad`,
  `--appbar-link-fs`), as the landing had. Under 760px the nav folds into
  `AppBarMenu`'s sheet, which drops from `--appbar-h`.
- **One logo size**: `Logo variant="nav"` (30px mark, 20px wordmark), the
  landing's, everywhere. The `variant` prop on `AppBar` is gone (no
  `app` / `marketing`); `position` stays (`static` only for styleguide
  specimens), as do `sub`, `actions`, `menuId`, `navLabel`.
- **Content is per page, the bar is not.** `Layout` renders it for every
  page, the landing and sign-in included:
  - app pages: Courses / My learning / Write a course (`appLinks`);
  - the landing: Courses / How it works / The path / For authors
    (`Layout links=…`), and Start free goes to lesson 1 (`startHref`);
  - signed out: Sign in + Start free; signed in: the avatar (048);
  - the sign-in pages (`AuthShell`): the nav, but no account actions
    (`account={false}`): the page is itself the way in;
  - lesson pages: the sub-bar (`sub`, 022).
- **Section links are an opt-in on the link.** `AppBarLink.section`
  (`'how'`) lights the link (text colour + the volt inset rule, like the
  current page) while the view timeline `--how` covers 25–75%. The
  keyframes (`bits-nav-here`) ship in the bar's mixin; the page names the
  timelines on its sections and scopes them on an ancestor of both
  (the landing: `body { timeline-scope: --how, --path }`, since the
  header is now outside its root). Section links are never prefetched or
  `aria-current`.
- **Sign in is never out of reach.** Under 420px the bar hides Sign in
  and keeps Start free and the menu; Sign in joins the sheet
  (`menuExtras`). The landing did this; app pages now do too (they used
  to just hide it).
- **The landing renders through `Layout`** (`bare`, `documentTitle`,
  `preloadFonts` for Unbounded 800, its keyframes in `head`).
  `landing-header.tsx` is deleted. **Sign-in renders through `Layout`**
  (`bare`): its frame joins the bar (the body section keeps
  `rule={false}`) and fills `100dvh - --shell-h`; the logo in the bar is
  still the page's only `href="/"` (044).

## Rejected

- **Keeping the landing's transparent bar over the field.** The header now
  sits above the landing's root (Layout renders it), so the field starts
  under it rather than behind it. A transparent bar would show plain ink
  there, so the option would do nothing visible; the bar is ink from the
  first frame, the same as everywhere. The `landing-bar` keyframes and the
  `--landing-bar-bg` property are gone.
- **Keeping `variant` as a no-op.** Only the styleguide passed it; removing
  it costs one specimen edit and leaves no dead prop.
- **A thin landing wrapper around `AppBar`.** Section links as a field on
  the link item cover the one thing the wrapper would add.

## Consequences

- One shape everywhere: `a11y.test.e2e.ts` ("one header everywhere")
  checks that the landing, `/courses` and `/login` draw the bar at the
  same height, column and logo box at 360 and 1440, sticky and opaque
  after a scroll, and that the menu sheet opens clean on the landing and
  sign-in.
- The sheet's id is `app-nav-sheet` on every page.
- A new page area never builds its own header: it passes content to
  `Layout` (`links`, `account`, `startHref`, `sub`).
