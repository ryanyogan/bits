# 007. Styling: tokens, cascade layers, self-hosted fonts

Status: Accepted (2026-10-26)

## Decision

- **Tokens** are CSS custom properties in `packages/ui/src/styles/tokens.css`,
  transcribed from `docs/design/artboards/System.dc.html`. Components use
  `var(--token)`, never raw hex or px values that a token already covers.
- **Cascade layers**, declared once (inlined first in `<head>` by
  `Document`): `reset, tokens, base, rmx-reset, rmx, app`. Remix's `css()`
  mixins land in `rmx`, so component styles beat base styles regardless of
  source order. `app` is reserved for page-level overrides.
- **Component styles** use `css({...})` mixins applied with
  `mix={...}`, colocated in the component file and defined at module scope.
  No global class names, CSS modules or Tailwind.
- **Focus**: `:focus-visible` gets a 2px volt outline plus `--focus-ring`, a
  4px volt glow. Components that set their own `box-shadow` must compose
  `var(--focus-ring)` into it on `:focus-visible`.
- **Reduced motion**: base.css disables animation and transition under
  `prefers-reduced-motion: reduce`. Components still gate large motion
  themselves.
- **Fonts** are self-hosted woff2 from `@fontsource` (Unbounded 500/700/800,
  Geist 400–600, Geist Mono 400/500, latin and latin-ext subsets with
  `unicode-range`), copied by `pnpm --filter @bits/ui fonts`. Geist 400 and
  Unbounded 700 latin are preloaded.
- Dark only in v1 (`color-scheme: dark`).
