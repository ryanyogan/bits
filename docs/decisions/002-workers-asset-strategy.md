# 002. Workers asset strategy

Status: Accepted (2026-10-26)

## Context

Remix 3 compiles browser modules on demand with `remix/assets`
(`createAssetServer`). That needs the filesystem and esbuild. Neither exists
in a Worker. The app has to serve the same pages from Node (dev) and from
Workers (prod).

## Decision

Build time crawl into Workers Static Assets (`apps/web/scripts/build.ts`):

1. Start the same asset server dev uses (one shared access policy in
   `app/platform/asset-plan.ts`), with `fingerprint: true`, `minify: true`
   and `watch: false`.
2. Resolve the browser entry, every module that calls `clientEntry(` (found
   by scanning `app/**/public/**` and `packages/ui/src/**`), the global
   stylesheets and the preloaded fonts.
3. Crawl every URL a browser can receive: hrefs, preloads, import-map values
   and scopes, plus `url()` references in CSS. Fetch each one through
   `assetServer.fetch()` and write it to `build/client/`.
4. Publish each file at a canonical URL. Workers Static Assets 307-redirects
   paths that are not canonically encoded (the raw `@` in `.@hash`), and it
   sets Content-Type from the extension (`.ts` would be served as
   `video/mp2t`). So every path segment is percent-encoded, and `.ts`/`.tsx`
   modules get a `.js` suffix. Modules import each other by stable URL, and
   the rewritten import map resolves those, so no module source is rewritten.
   CSS `url()`s are.
5. Check that every `/assets/` import in every emitted module resolves
   through the import map to a written file. Fail the build if one does not.
6. Copy `public/`, write `_headers` (`/assets/*` immutable, nosniff) and
   `build/asset-manifest.json`.
7. Bundle `worker.ts` with esbuild (`conditions: ['workerd', ...]`,
   `keepNames`). The manifest is inlined through `define`.
   `import.meta.url` in each repo source file is replaced with
   `file:///<repo-relative path>`, which is the manifest key that
   `platform.worker.ts#getScriptEntry` looks up.

Wrangler's own bundler is not used (`main` points at the prebuilt
`build/worker/index.js`). It would collapse `import.meta.url` to a single
value for the whole bundle, so every `clientEntry` would get the same ID.

`keepNames` is required. `clientEntry()` falls back to the function name for
its export name, and minification would rename it.

Assets are served by the platform before the Worker runs
(`not_found_handling: none`), so asset hits cost no Worker CPU.

## Consequences

- `pnpm build` must run before `wrangler dev`/`deploy` (`pnpm preview` and
  `pnpm deploy` do this).
- A new interactive component works on Workers only if its file calls
  `clientEntry(` literally and lives under `app/**/public/` or
  `packages/ui/src/`. Otherwise the build will not find it, and the Worker
  throws "No built client entry" at render time.
- A dynamic import computed at runtime is not crawled. The graph check
  catches only static and literal dynamic `/assets/` imports.
- Fingerprints are content hashes. Unchanged files keep their URLs across
  deploys, and wrangler skips re-uploading them.
