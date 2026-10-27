# 033. Cloudflare Web Analytics: a nonced beacon we load ourselves

Status: Accepted (2026-10-27). Builds on 020, 027, 028.

## Context

The handoff's default for analytics is "Cloudflare Web Analytics (no
cookies)". Under the strict nonce CSP (027), Cloudflare's automatic
injection is a risk: the injected `<script>` has no nonce unless Cloudflare
adds one, and 027 left that undocumented. So we load the beacon ourselves.

Checked against Cloudflare's docs (developers.cloudflare.com, via Context7,
2026-10-27):

- Manual setup is one tag:
  `<script type="module" src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='{"token": "…"}'>`.
  The docs now show `type="module"` (deferred by the browser).
- CSP table ("Content Security Policies", product requirements):
  `script-src static.cloudflareinsights.com; connect-src cloudflareinsights.com`.
- Reports go to `https://<your domain>/cdn-cgi/rum` for sites proxied
  through Cloudflare, or `https://cloudflareinsights.com/cdn-cgi/rum`
  otherwise. bits.yogan.dev is a Workers custom domain on a Cloudflare zone,
  so it is proxied; but the manual snippet still reported to
  `cloudflareinsights.com` in preview (see Verification).
- Proxied sites get automatic injection by default; **Manage site** can
  switch it to "Enable with JS Snippet installation" (manual).
- No cookies, no `localStorage`, no client-side state, no fingerprinting by
  IP or user agent ("Core Web Vitals" page). Dimensions: country, host,
  path, referer, device type, browser, OS.
- SPAs: the beacon follows soft navigations through the Soft Navigations
  API, the Navigation API's `navigate` event, or a patched
  `history.pushState`, whichever exists. `"spa": false` turns it off.

## Decision

- **`WEB_ANALYTICS_TOKEN` var** in `wrangler.jsonc`, empty by default. The
  token is public (it ships in every page), so it is a var, not a secret.
  Empty or unset means no beacon and no CSP change. Tests force it unset
  (`platform.node.ts`) whatever `.dev.vars` holds; dev has none.
- **`webAnalytics()` middleware** (`app/middleware/web-analytics.tsx`),
  after `cspNonce()`, wraps the render in `<WebAnalytics token>`
  (`@bits/ui/web-analytics`), like `<CspNonce>`. `Document` then renders the
  documented tag in `<head>`, after the entry, with the response's nonce.
  `'strict-dynamic'` + the nonce cover the script origin, so `script-src` is
  unchanged.
- **CSP:** with a token, `connect-src` adds `https://cloudflareinsights.com`
  (Cloudflare's documented directive). The same-origin `/cdn-cgi/rum` is
  covered by `'self'`. Nothing else changes.
- **Global Privacy Control:** a request with `Sec-GPC: 1` gets no beacon.
  The beacon is cookieless and not a sale or share, so this is a courtesy,
  not a legal need; it costs nothing because HTML is `private, no-cache`.
  `DNT` is deprecated and not honoured.
- **/privacy** says what is true for the running config: with a token, a
  "Page views" section (what the beacon reports, no cookies, GPC skips it),
  and the short version no longer says "no analytics". Without one, the
  old wording stays. `PRIVACY_UPDATED` is bumped with the text.

## Client navigation (020)

Remix's runtime navigates with the Navigation API
(`navigation.addEventListener('navigate')` + `event.intercept()` in
`@remix-run/component/dist/runtime/navigation.js`). The beacon listens to
the same event (or soft navigations), so a client navigation counts as a
page view of the new URL. The reconciler keeps the `<head>` beacon tag; it
isn't re-executed, so there is one beacon per tab. Notes:

- Forms that re-render in place (search, quiz) are navigations too and may
  count as views.
- Browsers without the Navigation API get document loads (020), which the
  beacon counts as normal page loads.

## Verification

- `app/middleware/web-analytics.test.ts`: no token (unset, empty, blank)
  means no beacon and `connect-src 'self'`; a token gives the nonced module
  tag on every page (home, courses, login, 404) and
  `connect-src 'self' https://cloudflareinsights.com`; `Sec-GPC: 1` drops
  the tag; /privacy wording follows the config.
- `pnpm preview` (real Worker, `wrangler dev`) with a dummy token in
  `.dev.vars`, in Chrome:
  - the tag carries the response's nonce; `beacon.min.js` loaded (200,
    `access-control-allow-origin: *`, no `Set-Cookie`) and ran;
  - **the manually loaded beacon reports to
    `https://cloudflareinsights.com/cdn-cgi/rum`**, not same-origin, so the
    `connect-src` entry is needed even on our proxied domain (the fake token
    gets a 404 there, as expected);
  - a client navigation (/courses → a course, same document) sent a second
    report, and the page still had one beacon tag;
  - zero `securitypolicyviolation` events, no console errors, no
    `CSP violation` lines in the Worker log; `localStorage` stayed empty.

## Dashboard steps (owner)

1. Cloudflare dashboard → **Web Analytics** → **Add a site** → hostname
   `bits.yogan.dev` (or, since yogan.dev is a zone on the account, pick it
   from the proxied-site list).
2. **Manage site** → set automatic setup to **Enable with JS Snippet
   installation**, so Cloudflare does not inject a second, un-nonced beacon
   (it would be blocked by the CSP and log a violation).
3. Copy the token from the snippet's `data-cf-beacon` and put it in
   `apps/web/wrangler.jsonc` → `vars.WEB_ANALYTICS_TOKEN`, then deploy.
4. After deploying: view source on a page (one beacon, nonced), watch
   Workers Logs for `CSP violation`, and check data in Web Analytics after a
   few minutes.

## Consequences

- The beacon is the only third-party script. Its origin is not in
  `script-src`; trust comes from the nonce.
- If Cloudflare changes the report endpoint, reports fail as CSP violations
  (logged by `/csp-report`), not silently.
- No Subresource Integrity: Cloudflare updates `beacon.min.js` in place and
  publishes no hash, so `integrity` would break it on their next release.
  The nonce limits what can run; a compromise of
  `static.cloudflareinsights.com` would still run in our pages.
- Not done: custom events (Web Analytics has none), `"spa": false`.
