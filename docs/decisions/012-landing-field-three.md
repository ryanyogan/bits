# 012. The landing page's 3D field: lazy `three`, named font hrefs

Status: Accepted (2026-10-26)

## Context

The landing page (`/`) renders a WebGL "neural field" behind every section
(docs/design/spec/pages/Main.md §NeuralField). It needs `three`, which is
large (~750 KiB minified across `three.module.js` + `three.core.js`), and must
not delay the server-rendered hero, which is the LCP element. The page must
also work on Workers, where only crawled assets exist (decision 002).

## Decision

- `three` is a dependency of `@bits/web` and is added to `allowPackages` in
  `app/platform/asset-plan.ts`.
- The island `app/actions/home/public/neural-field.tsx` waits for `load`
  plus an idle callback, probes for WebGL 2 on a throwaway canvas, then runs
  a literal `await import('three')`. The scene itself
  (`public/field-scene.ts`) takes the `three` namespace as an argument and
  imports only its types, so nothing three-related is in the page's
  modulepreloads.
- This needs no build change. `remix/assets` puts a literal dynamic import's
  target in the client entry's import map (scope `/assets/app/` →
  `three.module.@hash.js`) without preloading it. `scripts/build.ts` already
  crawls every import-map value, so both three files are written to
  `build/client` and resolve under `wrangler dev`. Verified with `pnpm build`
  and a `wrangler dev` run.
- Any failure (no WebGL 2, import error, renderer constructor throwing,
  context loss) leaves the server-rendered dot grid and vignette, with no
  message.
- `AppAssets.fonts` (and `AssetManifest.fonts`) maps every self-hosted woff2
  file name to its public URL. Pages can preload a face beyond the global
  critical set without every page paying for it. The landing page preloads
  `unbounded-latin-800-normal.woff2` for the h1, which removed the h1's
  font-swap layout shift (CLS 0.012 → 0).

## Consequences

- A computed (non-literal) `import()` would still not be crawled. Keep the
  `import('three')` literal.
- `css()` mixins each get their own cascade sublayer (`@layer rmx.<hash>`),
  so a descendant rule written on a parent's mixin loses to the child's own
  mixin, whatever its specificity. For parent-driven states (card hover,
  active HUD item), set a custom property on the parent, or put the state
  attribute on the element itself.
