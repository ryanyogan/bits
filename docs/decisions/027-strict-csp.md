# 027. A strict, nonce-based Content-Security-Policy

Status: Accepted (2026-10-27). Amends 020.

## Context

Decision 020 sent a CSP with no `script-src` or `style-src`. Every page has
an inline import map and inline `<style data-rmx-style>` tags, and a strict
policy needed nonces first. This decision adds them.

What a page loads (inventory, 2026-10-27, under `pnpm preview`):

- **Scripts.**
  - One inline `<script type="importmap">`, from `Document`'s `ImportMap`.
  - One `<script type="module">`, the browser entry.
  - `<link rel="modulepreload">` tags.
  - `<script type="application/json" id="rmx-data">`. This is a data block
    and never runs, so CSP doesn't apply to it.
  - Everything else is imported by the entry: islands through
    `importModule`, three.js and the runtime.
  - The import-map polyfill (`remix/multiple-import-maps-polyfill`) feature
    detects with a `srcdoc` iframe that holds a nonced inline script. In
    browsers without multiple import maps, it runs module graphs from `blob:`
    URLs and compiles its lexer from Wasm.
  - Nothing in the client build uses `eval` or `new Function`.
- **Styles.**
  - Our stylesheets (`/assets/...`).
  - The inline layer order in `Document`.
  - The landing page's and lesson page's inline `<style>`.
  - Remix's `<style data-rmx-style>` tags. Remix 3.1 renders these with no
    nonce and no option for one. The client moves them into a constructed
    stylesheet.
  - Many `style={...}` attributes.
- **Connections.** All same-origin: `/api/run` (streamed `fetch`), the
  passkey endpoints and client navigation. AI Gateway is called from the
  Worker only.
- **Fonts and images.** Self-hosted woff2 files, and inline SVG. Nothing
  comes from a third-party origin.
- **Cloudflare-injected scripts.** None today: the production home page has
  no `cdn-cgi` or `cloudflareinsights` script.
- **Dev HMR** (`pnpm dev`). The HMR client opens an `EventSource` on another
  port and appends import maps without a nonce.

What Remix 3.1 supports (installed source, not docs; no guide mentions CSP):

- `ImportMap` passes extra attributes through, so a `nonce` prop works.
- During client navigation, the runtime's import-map manager copies the
  nonce of the document's first managed import map (`.nonce`) onto every
  import map it adds.
- Islands load through dynamic `import()` from the nonced entry.
- New pages arrive as HTML, parsed with `DOMParser`. Their
  `<style data-rmx-style>` tags are adopted into a constructed stylesheet
  (CSSOM, which CSP doesn't check) and removed. Their import maps and
  module preloads are taken out before the diff, so no new-nonce element is
  ever inserted into the live document.
- `context.render` is replaceable: `render()` installs it with
  `context.set(Renderer, ..., { property: 'render' })`.

## Decision

- **Enforce, don't start report-only.**
  - The policy was checked in Chrome under the real Worker, with zero
    violations:
    - each page loaded as a document;
    - every lesson, both lesson modes, the landing page, `/login`, `/me`,
      `/settings`, `/author`, `/styleguide`, a profile and the 404 page, all
      visited through client navigation in one document.
  - The e2e suite runs under the enforced policy, and it covers client
    navigation, islands, the composer and the forms.
  - There are no third-party scripts that could break.
  - Violations are still reported (below), so a surprise shows up in the
    Workers logs.
  - Rolling back means a redeploy (`contentSecurityPolicy` in
    `app/middleware/headers.ts`).
- **The policy** (HTML only; `contentSecurityPolicy()`):

  ```
  default-src 'self';
  script-src 'nonce-<per response>' 'strict-dynamic' 'wasm-unsafe-eval' https: 'unsafe-inline';
  style-src 'self' 'unsafe-inline';
  img-src 'self' data:; font-src 'self'; connect-src 'self';
  object-src 'none'; base-uri 'none'; frame-ancestors 'self'; form-action 'self';
  report-uri /csp-report
  ```

  - `'strict-dynamic'` lets the nonced entry load islands, three.js and the
    polyfill's `blob:` modules. Browsers that understand nonces ignore
    `https:` and `'unsafe-inline'`; those two only keep very old browsers
    working (the usual strict-CSP fallback). `'wasm-unsafe-eval'` is for
    the polyfill's lexer, as its README asks.
  - Module preloads need no nonce: under `'strict-dynamic'` a modulepreload
    fetch isn't parser-inserted, so it is allowed. `Document` puts the nonce
    on its own preloads anyway. Remix's `data-rmx-module-preload` tags and
    the runtime's preloads carry none. Both were checked in Chrome with no
    violations.
  - **Styles stay `'unsafe-inline'`.** Remix renders `<style data-rmx-style>`
    without a nonce. There are also dozens of `style=""` attributes, which a
    nonce can't cover. And a nonce in `style-src` would switch
    `'unsafe-inline'` off. We could add nonces by rewriting the HTML stream,
    but that would put a nonce on any markup that looks like a Remix style
    tag, which defeats the nonce. Style injection without script is a much
    smaller risk.
    - Revisit when Remix can put a nonce on its style tags. Then `style-src
      'self' 'nonce-…'` plus `style-src-attr 'unsafe-inline'`. Client
      navigation already adopts styles through CSSOM, so a per-response
      nonce wouldn't break it.
  - `frame-ancestors 'self'`, not `'none'`: same-origin iframes are how we
    check breakpoints (020).
  - `form-action 'self'`: OAuth starts are links (`ProviderButton`), and
    every form posts to this origin.
- **The nonce.**
  - Each response gets 16 bytes from `crypto.getRandomValues`, as base64.
  - `responseHeaders()` (outermost) makes the nonce, puts it on context as
    `cspNonceContext`, and sends the policy that names it.
  - `cspNonce()` goes right after `render()`. It wraps `context.render` so
    every page renders inside `<CspNonce nonce>` (`@bits/ui/csp-nonce`).
  - `Document` reads the nonce with `cspNonce(handle)` and puts it on the
    import map, its preloads and the entry script. App code never handles
    the nonce.
  - A policy an action sets itself still wins, as other headers do.
- **Client navigation.** A navigated page keeps the first response's policy
  and nonce. That works because:
  - the new page's scripts are never inserted;
  - its import maps are re-added with the document's nonce;
  - its islands are imported by the trusted runtime;
  - its styles go through CSSOM.

  `app/csp.test.e2e.ts` covers this. Pages are walked on the client, an
  island first needed after navigation (the training scrubber) must hydrate
  and respond, and the document must record no `securitypolicyviolation`.
  It also checks that injected inline handlers are blocked. With the nonce
  removed from `Document`, both tests fail.
- **Reports: `report-uri /csp-report`**, root controller, `app/actions/csp-report.ts`.
  - It accepts the `application/csp-report` and the Reporting API shapes.
  - It reads at most 16 KiB and logs at most 5 reports per request, each as
    one `warn` line (`CSP violation`). URLs keep only origin and path,
    because magic-link tokens are in query strings. It answers 204.
  - New burst tier `RL_REPORTS` (30/min, `namespace_id` 2004). The route
    bypasses `cop`: report uploads may not look same-origin, and the route
    only logs.
  - **No `report-to`.** With `report-to` present, Chrome ignores
    `report-uri` and batches through the Reporting API. Under `pnpm preview`
    that API never delivered a report in more than two minutes, while
    `report-uri` arrived at once, and the full round trip (browser → Worker
    → log) was checked. Add `report-to` when a delivery can be checked over
    HTTPS.
- **Dev seam.** `platform.csp` (`{ reportOnly, connectSrc }`):
  - The Worker, `pnpm dev:restart`, `pnpm start` and tests enforce.
  - `pnpm dev` (HMR) sends `Content-Security-Policy-Report-Only` and allows
    `http://localhost:*` and `http://127.0.0.1:*` for the HMR event stream,
    because the HMR client's import maps carry no nonce.
  - App code doesn't branch on runtime.

## Consequences

- **Rules for new code** (AGENTS.md):
  - Never add an inline `<script>` or an `on*=` attribute: it won't run.
  - Scripts reach the page as modules imported by the entry or as islands.
  - A third-party script needs a nonce from `cspNonce(handle)`, or must be
    loaded by our code.
  - New origins for images, fonts or connections go in
    `contentSecurityPolicy()`.
- **Turning on Cloudflare features that inject scripts.**
  - Web Analytics' automatic beacon, Rocket Loader and email obfuscation's
    decoder all inject scripts. These would be blocked unless Cloudflare
    nonces them.
  - Cloudflare documents that JavaScript Detections reads the nonce from
    the CSP header and adds it to its injected scripts.
  - The beacon's behaviour is not documented. If Web Analytics is turned
    on, add the beacon as a module from our entry, or check that the
    injected tag gets the nonce, and watch the `CSP violation` logs.
- **Deploy.** Nothing remote to create. `RL_REPORTS` exists once the config
  is deployed. Afterwards:
  - check the header on `https://bits.yogan.dev`;
  - click through a lesson in Chrome with DevTools open;
  - watch Workers Logs for `CSP violation`.
- **Not done:**
  - nonced styles (needs Remix support);
  - Trusted Types;
  - `report-to`;
  - `upgrade-insecure-requests` (HSTS already covers it).
