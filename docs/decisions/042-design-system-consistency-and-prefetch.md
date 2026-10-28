# 042. Design-system consistency and link prefetch

Status: Accepted (2026-10-27). Amends 010 (component library) and 024
(pending feedback).

## Context

Before more features land, the owner asked for four things in the shared UI
layer (`packages/ui`):

- nav links that prefetch on hover;
- consistent margins, padding and borders;
- the design system used everywhere;
- Remix's own UI primitives (`@remix-run/ui`) used where they fit, styled
  with our tokens.

An audit of `packages/ui/src` found the following:

- No link prefetched.
- The focus outline was written out by hand about 30 times
  (`'2px solid var(--focus-ring-color)'`, offsets `2px`, `-2px`, `3px` and
  `4px`).
- Every border width was a literal `1px` or `2px`.
- Control heights were literals: 34, 36, 40, 46, 50, 52, 56 and 60px.
- The busy caret existed only on Keycap. ProviderButton and ToolButton set
  `aria-busy` but showed only a cursor change, so a pending provider button
  looked idle.
- Some controls had no pressed state: BackButton, the AppBarMenu button,
  ProviderButton and ToolButton.
- The AppBarMenu button and sheet links used a bare `:hover`, which the
  styleguide's `data-force` can't show and which also matched while disabled.
- The current link in the mobile sheet was marked only with a tint and an
  inset shadow, so it disappeared in forced colours.

## Decision

### Prefetch: one rule, on by default

- `lib/prefetch.ts` (exported as `@bits/ui/lib/prefetch`) has
  `prefetchFor(href, prefetch = 'intent', { document, download })`. It
  returns the value for `data-rmx-prefetch`, or `undefined`. It returns
  `undefined` in these cases:
  - `prefetch={false}`;
  - a `document` link (`data-rmx-document`: OAuth, JSON);
  - a `download`;
  - an absolute or protocol-relative URL, or another scheme (`mailto:`);
  - a bare `#fragment`;
  - a disabled Keycap, which has no `href`.
- Every same-origin page link component asks this rule and takes a
  `prefetch?: 'intent' | 'viewport' | false` prop. The components are
  NavLink, Logo, BackButton (and through it LessonBar), AvatarButton,
  SuggestionChip, FilterPill, Keycap with `href` (and through it the
  RewardToast "next" key), CourseCard, WriteCourseCard and ContinueBanner.
  The rule also covers the AppBar's links, the AppBarMenu sheet and the
  terminal reward's "next" link. Footer gets it through NavLink and Logo.
- ProviderButton (always `data-rmx-document`) and RabbitHole (external,
  `data-rmx-document`) never prefetch.
- `intent` (hover, focus or press) is the default, not `viewport`, which
  would fetch every visible card on the catalog. Remix already skips
  automatic prefetch under Save-Data and on 2g connections (component
  README).
- Every page GET in the app is safe to fetch speculatively. Side effects are
  POSTs, and `/auth/*` token links are never rendered through these
  components. A prefetch of a page that calls `takeReward` would consume
  the flash. The reward is set by a POST and taken by the 303 landing in
  the same navigation, so a hover can't come between them.
- HTML is `private, no-cache` (decision 020), so the prefetched page itself
  is fetched again on navigation. What the prefetch buys is the page's
  modules, CSS and font preloads, warm in the HTTP cache. That is the main
  cost of an island-heavy page such as a lesson. An `ETag` on HTML would
  let navigation revalidate the prefetched copy instead (decision 045: not done, and why).

### Tokens for strokes, focus and control sizes (`tokens.css`)

- Strokes: `--border-w` (1px: cards, fields, chips, dividers) and
  `--border-w-strong` (2px: the nav underline, the current lesson node, the
  active-row rule). Every component border, divider and the `calc(... - 1px)`
  bar heights now use them.
- Focus:
  - `--focus-outline` (`--focus-outline-w` solid `--focus-ring-color`);
  - `--focus-offset` (2px), `--focus-offset-wide` (4px, which replaces the
    stray 3px and 4px) and `--focus-offset-inset` (-2px, for cells in a
    clipped box);
  - `--focus-ring-soft` (the search field's `.1` glow);
  - `--focus-ring-danger` (an invalid field while focused).

  `base.css`'s global ring and `lib/states.ts`'s `focusOutline` /
  `hiddenOutline` read the same tokens. Components spread `focusOutline`
  instead of repeating the literal pair.
- Control heights, the System and resolutions §3/§7 steps:
  - `--control-xs` 34 (the Type-it toggle);
  - `--control-sm` 36 (sm keycap);
  - `--control-compact` 40 (avatar, quiz and video tool buttons);
  - `--control-md` 46 (md keycap, editor tab);
  - `--control-field` 50 (text field, provider button);
  - `--control-search-input` 52;
  - `--control-lg` 56 (lg keycap, search);
  - `--control-code` 60 (code boxes).

  Each one smaller than 44px keeps its 44px hit area through `::before`.
- Only one visual value changed: the video big-play focus offset, 3px → 4px. Every other token equals the literal it replaced.
  Layout-only literals stay as they are: grid tracks such as `minmax(290px,
  …)`, breakpoints, and decorative dot sizes. They aren't scale values.

### One state vocabulary for every button

- `lib/states.ts` adds `BUSY` and `busyStyle`. `busyStyle` is the progress
  cursor plus the `▍` caret, kept out of the accessible name and still
  under reduced motion. Keycap, ProviderButton and ToolButton all mix it in,
  so any submitter the navigation runtime marks `aria-busy` (decision 024)
  looks pending, whichever component it is.
- Pressed: the ghost-key recipe (`--fill-btn`) is now on BackButton, the
  AppBarMenu button, the sheet links and ProviderButton. ToolButton presses
  to `--fill-tab-on`.
- Disabled: ProviderButton uses the ghost recipe (dim text, `--line`
  border) through `DISABLED`, so `aria-disabled` is covered too.
- AppBarMenu uses `HOVER` / `ACTIVE`, and its current sheet link gets
  `forcedSelected` in forced colours (decision 025 pattern).

### `@remix-run/ui` 0.13.0: what we adopted and what we kept

| Primitive | Our equivalent | Choice | Why |
|---|---|---|---|
| tabs | TabPanels, CodeEditor file tabs | Already adopted (010) | |
| popover | AppBarMenu sheet (native `popover="auto"` + `popovertarget`) | Kept native | The primitive is `popover="manual"`, driven by island state with scroll lock and anchoring. The native one opens, light-dismisses and restores focus with no JS, which the primitive can't. |
| accordion | `<details>` disclosures (settings, outline, author) | Kept native | Same reason: the primitive sets `hidden`/`inert` from JS, and `<details>` works without it. The disclosures are app-owned (`apps/web`) anyway. |
| toggle | Switch (native radios, n-way) | Kept | Switch is a segmented radio group, not a boolean switch. |
| menu, select, listbox, combobox, anchor | none | Not needed yet | Nothing in the product is a dropdown or an autocomplete. Use these first when one is. |
| animation | CSS keyframes + reduced motion | Kept | Entrance animations are one keyframe each, and a JS spring adds bytes for no visible gain. |

So nothing new was adopted. The rule from 010 still holds: use a primitive
when we would otherwise hand-roll its keyboard and ARIA behaviour, and keep
the platform's own element when it already works without JS.

## Consequences

- A new link component must take `prefetch` and render
  `data-rmx-prefetch={prefetchFor(href, prefetch, { document, download })}`.
  `lib/prefetch.test.tsx` covers the rule and every current link
  component. App code with its own `<a>` can import
  `prefetchFor` from `@bits/ui/lib/prefetch`.
- The attribute goes after `aria-current` in the markup (app tests match
  `href="…" aria-current="true"`).
- A component that sets a border, focus outline or control height in px
  is now a review finding. Use the tokens above.
- SegmentedTabs (`segmented-tabs.tsx`) was out of scope for this change:
  another branch owns it. Its URL tab links should take the same
  `prefetchFor(item.href)`. Its `minHeight: '38px'` mode item needs a
  token (`--control-tab`, 38px).
- Checked: `pnpm typecheck`, `@bits/ui` tests (58), the web server and
  browser tests (203). In Chrome, hovering a course card on `/courses`
  fetched `/courses/what-is-an-llm` and its modules before any click. The
  styleguide buttons and inputs, and a lesson page and its mobile sheet in
  a 360px iframe, render as before. The app is dark-only (`color-scheme:
  dark`), so there is no light scheme to check. Forced colours were not
  re-emulated (Chrome extension, no emulation). The new sheet rule follows
  the 025 helper.
