# 046. Keyed head links; a tree-shaken three.js in production

Status: Accepted (2026-10-28). Follows 002, 012, 020, 026 and 044.

## Context

Production showed console errors on client navigation (a modulepreload
"applied as a stylesheet" of JS, a font "loaded as a module script",
preloads without a valid `as`), and navigations felt slow.

The installed Remix 3.1 runtime (`@remix-run/component`
`dist/runtime/diff-dom.js`, `diffSiblingUnits`) diffs `<head>` like any
other children: siblings with a `data-rmx-key` match by key, the rest pair
by position, and a paired element has its attributes rewritten in place.
The landing page preloads one more font than the other pages, so every
later link shifted onto its neighbour: ~50 links had `rel`/`href` rewritten
(and refetched) per navigation, with broken intermediate states while the
attributes changed one at a time. Home → /courses took ~1 s on production.

Separately, an audit of asset delivery (`curl -I` on production,
2026-10-28) found compression and caching already right: fingerprinted
`/assets/*` get `public, max-age=31536000, immutable` from the generated
`_headers`, JS and CSS are served zstd, HTML brotli. The weight was
three.js: remix/assets serves packages file by file without tree-shaking,
so `three` shipped whole, `three.module.js` + `three.core.js`, 749 KB
minified, 156 KB brotli, for 13 classes.

## Decision

- Every `<link>` and `<script>` in `Document`'s head (and the extra font
  preloads from `Layout` and the landing page) carries a `data-rmx-key`
  (rel + href). Nonced ones also take `data-rmx-preserve-attrs="nonce"`:
  browsers hide a nonce after load, so the diff would rewrite it every
  time. `navigation.test.e2e.ts` asserts that home → /courses rewrites no
  head link's `rel`, `href` or `as`.
- Islands import three only through `app/actions/public/three.ts`, which
  re-exports the classes they use; typing them against it makes a missing
  class a type error. Development serves it unbundled as before.
  `scripts/build.ts` (`bundleThree`) replaces it with one esbuild bundle,
  tree-shaken and minified, published at a hash of its bytes (the
  remix/assets fingerprint covers only the module's source, not three's
  version). three's package files and import-map entries are left out of
  the build. The Worker bundle stubs the module like `three` itself.

## Consequences

- Client navigation keeps head elements that both pages share and only
  adds or removes the rest. Measured on production after the deploy:
  225–767 ms per navigation, no console errors.
- three: one request instead of two; 535 KB minified, 110 KB brotli (−30%).
  Client build output fell from 1458 to 1249 KiB.
- A new three class needs a line in `three.ts`. A new head `<link>` needs
  a `data-rmx-key`.
