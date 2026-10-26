# 010. Component library: static by default, small islands, @remix-run/ui where it fits

Status: Accepted (2026-10-26)

## Context

`packages/ui` needed every shared component from `docs/design/spec/components.md`
(resolutions.md overrides the artboards). Remix 3 components are not React:
only `clientEntry` modules ship JavaScript, and props crossing into an island
are serialized.

## Decision

- **Static by default.** Hover, press, focus, selected and disabled states are
  CSS (`lib/states.ts` exports the selector keys). Anything that only links or
  posts a form (SegmentedTabs, FilterPill, QuizChoice, Switch) stays static and
  works without JS.
- **Islands** only where behaviour needs the browser: AppBarMenu, TabPanels,
  SearchShortcut, CodeInput, RewardRegion, OddsBars, PromptComposer, CodeEditor,
  TerminalLog, OutputPanel, VideoPlayer. Each degrades to readable server HTML.
  Islands talk through DOM events (`bits:reward`, `bits:temperature`, `bits:run`),
  not shared state.
- **Island-prop JSX carries no `mix`.** JSX passed as a prop (panel content,
  terminal parts) is serialized; mixins and component elements in it fail with
  "Invalid mix prop". Pass plain elements and style them from the island's CSS.
- **ARIA booleans are strings** (`aria-busy="true"`); a JS `true` renders a bare
  attribute.
- **@remix-run/ui 0.13.0** supplies the tabs primitive (TabPanels,
  CodeEditor file tabs): tablist, roving tabindex and arrow keys come from
  it, not from code written here. The mobile nav sheet is a native `popover`
  (a light-dismiss top layer, no JS state), which fits better than a
  disclosure primitive. Menus/listbox were not needed yet.
- **Style-guide states** are forced with `data-force="hover|active|focus"`
  (`forceState` prop), styled by the same rules as the real pseudo-classes.
- **Keycap sizes** follow resolutions §3: sm 36px (44px hit area), md 46px,
  lg 56px. Ghost buttons keep the System 44px / radius-10 geometry.
- **Danger** (`--danger*`) is provisional, per resolutions §1.
- **Tone** for covers/badges is `--tone` plus `color-mix()` (`lib/tone.ts`),
  so one pattern works for volt, ion and synapse.
- **Tests**: server render tests (`components.test.tsx`) plus a browser island
  test (`islands.test.browser.tsx`). The package's `test` script runs
  `remix test` from the repo root (`--config packages/ui/remix.json`) because
  the browser harness must sit inside rootDir.
- `/styleguide` stays in production with `noindex` (meta + `X-Robots-Tag`).

## Consequences

- Islands stay small and serializable; to add behaviour, wrap a static
  component and add `mix` inside the island.
- VideoPlayer is a visual shell on a simulated clock; real HLS playback
  is separate work. TerminalLog replies are canned until the runtime exists.
