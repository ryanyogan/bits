# 020. Production hardening: client navigation, headers, caching, limits, placement

Status: Accepted (2026-10-26). Amends 014, 017, 018 and 019.

## Context

An audit of the app against the installed Remix docs and the Cloudflare
skills found that the browser runtime's client navigation, which is on by
default once `run()` starts, broke several assumptions:
- islands kept their setup state across lessons;
- the pending key stayed busy after a 422;
- OAuth and download links were intercepted;
- a 503 page never rendered.

It also found that HTML responses had no security or cache headers, that
nothing limited bursts of anonymous writes, and that the Worker bundled
three.js. A security review then found two more problems:
- the `/api/run` limits were count-then-insert, so they could be raced;
- the check-regex analyzer had bypasses.

## Decision

- **Client navigation is the default, so write for it.**
  - An island in a matching spot keeps its setup state and gets new
    props. Per-page state must therefore be keyed: the lesson `<main>`
    and the XP pill's wrapper carry `data-rmx-key={view.key}`, so another
    lesson replaces them. The same lesson (a quiz GET, a 422) keeps its
    state.
  - Pending UI resets on `handle.frame`'s `reloadComplete` (guide 09), as
    well as on `pageshow`.
  - A link that leaves the origin (OAuth start) gets `data-rmx-document`,
    and so does a form whose answer isn't a page (JSON uploads). A file
    link gets `download`. `Keycap` takes `document` and `download` props;
    `ProviderButton` links are always document navigations.
  - Re-renders are 4xx: the runtime treats 5xx as a failed navigation. The
    email-send failure is 422.
  - `entry.ts` listens for runtime errors. If one happens during a
    navigation, it falls back to the browser: a link loads its
    destination, and a form is submitted again natively.
  - An e2e test (`app/navigation.test.e2e.ts`) covers lesson to lesson and
    the code key's 422.
- **Headers: one outermost router middleware** (`app/middleware/headers.ts`).
  - Every response gets:
    - `Strict-Transport-Security: max-age=31536000; includeSubDomains`;
    - `X-Content-Type-Options: nosniff`;
    - `Referrer-Policy: strict-origin-when-cross-origin`;
    - a `Permissions-Policy` that turns off camera, microphone,
      geolocation, payment and usb.
  - HTML also gets `Content-Security-Policy: frame-ancestors 'self';
    base-uri 'self'; object-src 'none'; form-action 'self'`.
    - `'self'`, not `'none'`: the same-origin breakpoint iframes rely on it.
    - No `script-src` or `style-src` yet: every page has an inline import
      map and inline `<style data-rmx-style>` tags, so a strict policy needs
      nonce support in the renderer first.
  - Checked under `pnpm preview`: islands hydrate, the three.js field
    renders, `/api/run` streams, and there are no console CSP errors.
  - Headers an action already set win (the magic-link page's
    `no-referrer`).
- **Caching.** HTML defaults to `Cache-Control: private, no-cache`, since
  every page can be personalized (the app bar, progress). `/settings`,
  `/me`, `/login`, `/auth` and `/logout` get `no-store`. Actions can still
  set their own. Fingerprinted assets stay `immutable` through Static
  Assets. Per the audit, HTML is not edge-cached, and the Worker doesn't
  compress.
- **Burst limits: the Workers Rate Limiting binding** (017's step 2). Each
  tier is one binding, checked by one action middleware
  (`app/middleware/rate-limit.tsx`) and keyed by the signed-in user, else
  the IP:
  - `RL_WRITES` 20/min: saving a lesson;
  - `RL_SIGNIN` 10/min: `POST /login`, `POST /auth/verify`;
  - `RL_RUNS` 15/min: `POST /api/run`.

  Pages get a 429 status page, and `/api/run` gets JSON. The binding is
  per-location and approximate, which suits bursts. The exact, durable
  limits stay in D1. `namespace_id`s 2001–2003 only need to be unique in
  the account; nothing is created remotely. Miniflare provides the
  bindings in dev. The test platform turns them off (every test request
  comes from one address), and `rate-limit.test.ts` installs fakes.
- **`/api/run` limits are enforced by the insert.** `insertRunWithin` is
  one `INSERT … SELECT … WHERE count < cap` statement, and D1 runs
  statements one at a time.
  - A live run first reserves its `live` row within the owner, IP and
    daily live caps. Only a reserved run calls `runModel`.
  - Until the stream ends, the row has no `model` (in flight). A failed
    call turns the row into `fallback`.
  - Canned runs are written the same way below the refusal caps.
  - No migration was needed.
- **Check regexes use an allowlist grammar** (see 018): literals, a few
  escapes, simple classes, groups, `|`, anchors and at most 4 `?`. There is
  no repetition, and at most 64 paths. `check.ts` re-validates stored
  patterns.
- **Placement pinned to ORD** (`placement.region: "azure:northcentralus"`).
  D1 is in ENAM with no read replicas (`read_replication.mode: disabled`),
  and a page makes several D1 round trips one after another, so the Worker
  should run next to the primary. Static assets never invoke the Worker,
  so placement can't slow them down.
  - The primary is served from ORD (`wrangler d1 execute --remote --json`,
    `meta.served_by_colo`). The R2 bucket `bits-content` is also ENAM.
  - We started on Smart Placement. *Checked 2026-10-26:* it first stayed at
    the edge (`cf-placement: local-*`), then sent an ORD visitor's requests
    to ATL (`remote-ATL`), away from D1. It never settled next to D1.
  - *Pinned 2026-10-26 at the owner's request.* `azure:northcentralus`
    puts the Worker in ORD (`remote-ORD`). `aws:us-east-1` put it in IAD,
    which was slower (`/health` went from ~80 ms to 150–460 ms).
  - Revisit if D1 read replication is turned on: then Smart Placement (or
    no placement) lets replicas serve reads near the visitor.
- **`preview_urls: false`.** A preview URL would be a second full host on
  the production D1, R2, email and secrets. Turn previews back on only
  with separate preview resources.
- **Worker bundle.** `scripts/build.ts` resolves browser-only packages
  (`three`) to a module that throws if evaluated, and fails the build if
  one leaks into the Worker. The metafile goes to `build/worker-meta.json`.
  - The bundle went from 2,148 KiB to 1,395 KiB (gzip 547 to 354 KiB).
  - The content compiler (unified, remark, yaml; about 285 KiB) stays,
    because the `/author` folder upload builds courses in the Worker.
- **Logs are JSON lines** (`app/log.ts`). They cover:
  - the top-level catch;
  - render failures (`render({ onError })`);
  - `/health`;
  - the cron (its result or its error);
  - model fallbacks.
- **Link previews.** `Document` takes `url` (canonical and `og:url`) and
  `siteName`, and always renders `og:title`, `og:description` and a
  Twitter card. Shareable pages pass a canonical path (home, catalog,
  course, lesson, public profile), built from `CANONICAL_ORIGIN` in
  production only.

## Consequences

- Deploying needs no new remote resources: the rate-limit namespaces exist
  once the config is deployed. Migrations 0004 and 0005 still need
  `pnpm db:migrate:remote` (unchanged by this decision).
- After deploying, check `cf-placement: remote-ORD` and latency.
- Not done:
  - a strict `script-src` CSP (needs nonces);
  - an `og:image` (needs a designed PNG);
  - a smaller three.js build for the browser. The two chunks are
    749 KB raw, about 188 KB gzip and 156 KB brotli, loaded idle and after
    LCP. Measure on 4G before building a tree-shaken bundle.
