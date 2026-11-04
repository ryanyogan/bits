---
# sources (checked 2026-11-03):
# - Cloudflare Workers, Custom Domains (routes: [{ pattern, custom_domain: true }]; the hostname must be
#   on an active zone in your account; Cloudflare creates the DNS record and certificate; no wildcards;
#   docs updated 2026-09-29)
#   https://developers.cloudflare.com/workers/configuration/routing/custom-domains/
# - Cloudflare Workers, workers.dev (adding routes turns workers_dev off on the next deploy unless set)
#   https://developers.cloudflare.com/workers/configuration/routing/workers-dev/
# - Cloudflare Workers, Previews configuration (2026-09-22): Previews don't inherit production settings;
#   storage bindings must be repeated in `previews`; "Service bindings from a Preview call the bound
#   Worker's production deployment"; secrets come from `wrangler preview base-config secret put`;
#   Preview URLs are public unless you add Access. Needs wrangler 4.136.3+ in wrangler-action.
#   https://developers.cloudflare.com/workers/previews/
# - Klippy f-06 → f-07, recorded output docs/outputs/f-07.txt (2026-11-03): typecheck, tests (agent 111),
#   a clean web dry run, the workflow parsed, a local check. Not run: `wrangler preview` (it creates a
#   live deployment and has no dry run in 4.157.0) and any custom domain.
title: "Your own domain, previews"
order: 7
minutes: 20
xp: 60
module: Ship it
device: desk
tag: f-06
verified: 2026-11-03
versions:
  wrangler: "4.157.0"
---

Two last pieces of setup, both in the web app's config: an address of your
own, and a Preview for each pull request, so you can look at a change
before it ships. The Preview is where it's easy to get wrong, because by
default it would talk to your real agent.

### 1. Your own domain

A custom domain is one route in the web app's config:

:::code{file="apps/web/wrangler.jsonc" lang="json" tag="f-07" highlight="5" label="apps/web/wrangler.jsonc"}
	// f-07 Your own domain. Uncomment with a hostname on a zone in your Cloudflare account; Cloudflare creates the DNS
	// record and the certificate. Then set APP_ORIGIN above to https://<that hostname>, and add
	// https://<that hostname>/auth/github/callback to your GitHub OAuth app. (A route also turns off workers.dev, unless
	// you set "workers_dev": true.)
	// "routes": [{ "pattern": "klippy.example.com", "custom_domain": true }],
:::

It's commented out because the hostname must be on a zone in **your**
Cloudflare account. Uncomment it with yours and Cloudflare creates the DNS
record and the certificate. Three things change with it:

1. `APP_ORIGIN` becomes `https://<your hostname>`.
2. Your GitHub OAuth app gets `https://<your hostname>/auth/github/callback`.
3. `workers.dev` turns off for the web app on the next deploy, unless you
   set `"workers_dev": true`. Then your domain is the only address.

Your CI token also needs Workers Routes edit on that zone. This is optional:
the checkpoint works with the `workers.dev` address too.

### 2. Previews see pages, never data

`wrangler preview` uploads a branch as a separate Preview with its own URL.
Cloudflare's docs say Previews **don't inherit** production settings: a
Preview gets only what's in the `previews` block. And one line matters most:
**a service binding from a Preview calls the bound Worker's production
deployment.** Give the Preview `AGENT`, and a pull request's code would talk
to your real Klippy. So it gets no agent and no database:

:::code{file="apps/web/wrangler.jsonc" lang="json" tag="f-07" highlight="6-7" label="apps/web/wrangler.jsonc"}
	// f-07 Previews: `wrangler preview` (or the CI job on a pull request) uploads this branch as a separate Preview with its
	// own URL. Previews don't inherit production settings: they get only what's in this block. A Preview is for looking at
	// the pages, never your data, so it gets no AGENT and no DB binding (a Preview's service binding would call your
	// PRODUCTION agent), and nobody is allowed to sign in. Its secrets are its own: set the four above once with
	// `wrangler preview base-config secret put <NAME>`, each a NEW value, never production's.
	"previews": {
		"vars": { "APP_ORIGIN": "https://preview.invalid", "ALLOWED_GITHUB_IDS": "" },
		"ratelimits": [
			{ "name": "CHECK_LIMITER", "namespace_id": "3002", "simple": { "limit": 10, "period": 60 } },
			{ "name": "USER_LIMITER", "namespace_id": "3003", "simple": { "limit": 30, "period": 60 } }
		]
	}
:::

- **No `AGENT` and no `DB`.** A Preview is for reviewing pages: sign-in,
  layout, styles.
- **Nobody signs in**: `ALLOWED_GITHUB_IDS` is empty. (GitHub sign-in can't
  work on a `pr-<n>` URL anyway: an OAuth app's callback host is fixed.)
- **Its own rate-limit namespaces** (3002, 3003), so Previews never share
  production's counts.
- **Its own secrets**, set once with `wrangler preview base-config secret
  put <NAME>`, each a **new** value, never production's. (Wrangler 4.157.0
  lists `secrets` under `previews` in its schema but warns that it's an
  unexpected field there, so base-config secrets are the way.)

Without the binding, the web app answers plainly instead of crashing:

:::code{file="apps/web/app/agent.ts" lang="ts" tag="f-07" highlight="3" label="apps/web/app/agent.ts"}
export function agentFetch(path: string, init: RequestInit = {}) {
	// A Preview has no AGENT binding (wrangler.jsonc, f-07): answer that plainly instead of crashing.
	if (!env.AGENT) return Promise.resolve(Response.json({ error: 'This deployment has no agent (a Preview).' }, { status: 503 }));
	const headers = new Headers(init.headers);
:::

Preview URLs are public unless you put Cloudflare Access in front. That's
fine here, because there's nothing behind them.

### 3. A Preview for each pull request

The workflow gets a third job, with the same secret gate:

:::code{file=".github/workflows/ci.yml" lang="yaml" tag="f-07" highlight="15" label=".github/workflows/ci.yml"}
  preview:
    needs: check
    if: github.event_name == 'pull_request'
...
      - name: Preview the web app
        id: preview
        if: env.CLOUDFLARE_API_TOKEN != ''
        uses: cloudflare/wrangler-action@v4.1.3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          wranglerVersion: "4.157.0"
          packageManager: pnpm
          workingDirectory: apps/web
          command: preview --name pr-${{ github.event.pull_request.number }}
:::

Pull requests from forks never get your secrets, so their Preview job always
skips. Copy [`ci.yml`](https://github.com/ryanyogan/klippy/blob/f-07/.github/workflows/ci.yml),
[`apps/web/wrangler.jsonc`](https://github.com/ryanyogan/klippy/blob/f-07/apps/web/wrangler.jsonc)
and [`agent.ts`](https://github.com/ryanyogan/klippy/blob/f-07/apps/web/app/agent.ts).
Ours: 111 agent tests passed, and the web app's dry run had no warnings.

For a full staging copy, with chat and data, you'd deploy a second pair of
Workers with Wrangler environments, each with its own D1, Vectorize index
and OAuth app. That's more than Klippy needs.

**What we didn't run:** `wrangler preview` and the custom domain. Both
create live deployments, and Wrangler 4.157.0 has no dry run for
`wrangler preview`.

:::quiz{id="preview-binding" xp=20}
Why does Klippy's previews block leave out the AGENT service binding?

- [ ] Previews can't have service bindings
  Not quite. They can, and that's the problem.
- [x] A Preview's service binding would call your production agent
  Right. A pull request's code would reach your real Klippy.
- [ ] To make Previews deploy faster
  Not quite. It's about what a Preview can reach.
:::

Your code matches tag `f-07`
([changes from f-06](https://github.com/ryanyogan/klippy/compare/f-06...f-07)).

:::rabbithole
- read "Previews" by="Cloudflare" url="https://developers.cloudflare.com/workers/previews/"
- read "Custom Domains" by="Cloudflare" url="https://developers.cloudflare.com/workers/configuration/routing/custom-domains/"
:::
