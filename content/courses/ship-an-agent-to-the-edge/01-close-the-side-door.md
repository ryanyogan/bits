---
# sources (checked 2026-11-03):
# - Cloudflare Workers, workers.dev (workers_dev: false; turning it off does NOT turn off the URLs
#   each version gets, which have their own preview_urls setting)
#   https://developers.cloudflare.com/workers/configuration/routing/workers-dev/
# - Cloudflare Workers, Version URLs (formerly preview URLs; preview_urls)
#   https://developers.cloudflare.com/workers/versions-and-deployments/version-urls/
# - Cloudflare Workers, Service bindings (one Worker calls another without a public URL)
#   https://developers.cloudflare.com/workers/runtime-apis/bindings/service-bindings/
# - Klippy e-09 → f-01, recorded output docs/outputs/f-01.txt (2026-11-03): typecheck, tests (agent 96),
#   dry run and a local smoke on 8802 with a test cookie. Not recorded: a live deploy, so "workers.dev no
#   longer answers" is the expected result, not a recorded one. The lesson says so.
title: "Close the side door"
order: 1
minutes: 25
xp: 60
module: Lock it down
device: desk
tag: e-09
verified: 2026-11-03
versions:
  agents: "0.33.0"
  ai: "7.0.162"
  wrangler: "4.157.0"
  remix: "3.1.0"
---

Klippy has two Workers: the agent and the web app from course D. The web
app signs you in with GitHub and talks to the agent over a **service
binding**, a direct call from one Worker to another with no public URL in
between.

But the agent still has a public address of its own:
`klippy.<subdomain>.workers.dev`. Anyone who has your `KLIPPY_TOKEN` can
call `/agents/klippy/<any-name>` there and pick **any** Klippy by name. That's
the side door. In this lesson you close it, so the only way in is the web
app, which picks your Klippy from your session.

### 1. No public address

Two keys in the agent's config:

:::code{file="apps/agent/wrangler.jsonc" lang="json" tag="f-01" highlight="4-5" label="apps/agent/wrangler.jsonc"}
	// No public address (f-01). No klippy.<subdomain>.workers.dev route, and no preview URLs either (turning off workers.dev
	// alone leaves those on). The only way in is the web app's service binding, which picks your Klippy from your session.
	// `wrangler dev` still answers on localhost, so `pnpm chat` works against your local copy.
	"workers_dev": false,
	"preview_urls": false,
:::

You need both. `workers_dev: false` removes the `workers.dev` route, but
Cloudflare's docs say it doesn't turn off the URL each uploaded version
gets (the docs now call them **version URLs**; the setting is still
`preview_urls`). `preview_urls: false` closes those too. With no `routes` either, the deployed agent has no address at
all. The web app still reaches it over the binding.

### 2. Name the agent on the server

The web app already names your Klippy from your session, never from the
request:

:::code{file="apps/web/app/auth.ts" lang="ts" tag="f-01" highlight="2-4" label="apps/web/app/auth.ts"}
// The agent instance is chosen here, on the server, from the signed-in user. The browser never names it.
export function agentName(user: User) {
	return `gh-${user.id}`;
}
:::

The chat used that from course D. But two features still went straight to
the agent: sending a file, and searching your sources. Give them routes on
the web app:

:::code{file="apps/web/app/routes.ts" lang="ts" tag="f-01" highlight="2-4" label="apps/web/app/routes.ts"}
	// Your saved sources, through your Klippy (f-01: the agent has no public address, so the web app is the way in).
	sources: {
		upload: post('/sources/file'),
		search: get('/sources/search'),
	},
	// For the bits checkpoint grader. Public.
:::

The controller is short. It's signed in only (`requireUser`), checks the
size before and after reading the body, and builds the agent's path from
the session:

:::code{file="apps/web/app/actions/sources/controller.tsx" lang="tsx" tag="f-01" highlight="16" label="apps/web/app/actions/sources/controller.tsx"}
const MAX_UPLOAD = 1_100_000;

// Files and search reach your Klippy only through here: signed in, and the agent picked from your session.
export default createController(routes.sources, {
	middleware: [requireUser],
	actions: {
		// POST /sources/file (a form with a "file" field): pass the file on to your Klippy, which ingests it.
		async upload(context) {
			const request = context.request;
			const type = request.headers.get('Content-Type') ?? '';
			const size = Number(request.headers.get('Content-Length') ?? NaN);
			if (!type.startsWith('multipart/form-data')) return new Response('Send a form with a file.', { status: 400 });
			if (!(size <= MAX_UPLOAD)) return new Response('Files can be up to 1 MB.', { status: 413 });
			const body = await request.arrayBuffer();
			if (body.byteLength > MAX_UPLOAD) return new Response('Files can be up to 1 MB.', { status: 413 });
			const reply = await agentFetch(`/agents/klippy/${agentName(context.auth.identity)}/file`, {
				method: 'POST',
				headers: { 'Content-Type': type },
				body,
			});
			if (reply.ok) return redirect(`${routes.notes.index.href()}?sent=1`, 303);
			const { error } = await reply.json<{ error?: string }>().catch(() => ({ error: undefined }));
			return new Response(error ?? `Klippy didn't take the file (HTTP ${reply.status}).`, { status: reply.status < 500 ? reply.status : 502 });
:::

The browser never sends a Klippy name, so it can't ask for someone else's.
The agent's own checks (file type, 1 MB, 10 a minute) still run, and the
web app passes the agent's reason on with its 4xx status. Copy
[`sources/controller.tsx`](https://github.com/ryanyogan/klippy/blob/f-01/apps/web/app/actions/sources/controller.tsx),
map it in [`router.ts`](https://github.com/ryanyogan/klippy/blob/f-01/apps/web/app/router.ts),
and add the upload form to
[`notes-page.tsx`](https://github.com/ryanyogan/klippy/blob/f-01/apps/web/app/actions/notes/notes-page.tsx)
(with `sent` in its
[`schema.ts`](https://github.com/ryanyogan/klippy/blob/f-01/apps/web/app/actions/notes/schema.ts)).
The page now needs `sent`, so the notes controller passes it on, or
typecheck fails:

:::code{file="apps/web/app/actions/notes/controller.tsx" lang="tsx" tag="f-01" label="apps/web/app/actions/notes/controller.tsx"}
			const { q, deleted, sent } = query.value;
...
			return context.render(<NotesPage user={context.auth.identity} notes={rows} q={q} deleted={deleted === '1'} sent={sent === '1'} />);
:::

**Why a service binding, not a Durable Object binding?** The web app could
also bind the agent's Durable Object class directly and call
`getAgentByName`. That works, but it adds a second way in and Durable Object
types shared across two Workers, for no gain at this size. One door is
easier to guard.

### 3. What stays

Nothing gets looser. `KLIPPY_TOKEN` stays as a second lock: anything that
does reach the agent, the web app or `wrangler dev`, must still prove it's
you. Every limit and cap from courses A to E stays.

One thing changes for you: from f-01, **`pnpm chat` is local only.** It
works against `wrangler dev` on your laptop. The deployed agent answers only
the web app, so use the web app there.

### 4. Klippy is personal

The web app lets in only the GitHub account ids in `ALLOWED_GITHUB_IDS`:

:::code{file="apps/web/wrangler.jsonc" lang="json" tag="f-01" highlight="2" label="apps/web/wrangler.jsonc"}
		// The GitHub account ids allowed in, comma-separated (`gh api user --jq .id`). Klippy is personal: put only yours.
		"ALLOWED_GITHUB_IDS": "your-github-id"
:::

**Put only your own id there.** Each person gets their own Klippy, with its
own chat, memory and sources. But the `notes` table from course B has no
owner column, so everyone you let in would see and search the same notes. A
Klippy for several people needs an owner on notes and a filter on every
query. That's out of scope for this course.

### 5. Try it

Run `pnpm test` (ours: 21 agent test files, 96 tests passed), then
`pnpm dev:web`. Locally, with a test cookie for GitHub id 1:

:::terminal{cmd="curl -i -b <cookie> -F 'file=@pip.md;type=text/markdown' localhost:8802/sources/file"}
HTTP/1.1 [volt]303 See Other[text]
Location: /notes?sent=1
:::

Keep `;type=text/markdown`: without it curl sends the file as
`application/octet-stream`, and the agent answers `415` ("Send plain text,
Markdown, HTML or a PDF."). Signed out, the same request gets a `302` to
`/login`. A 1.2 MB file gets
`Files can be up to 1 MB.` (413). A minute later, once the ingest Workflow
has run, search finds the file. Its `title` is the file's name: yours
will say `pip.md`. Our recording says `pip-f01.md`, and our notes don't show
why, so we've left it as recorded:

:::terminal{cmd="curl -b <cookie> 'localhost:8802/sources/search?q=what+does+Pip+eat'"}
{"hits":[{"chunkId":1,"sourceId":1,[volt]"title":"pip-f01.md"[text],"url":null,"kind":"file","context":"","text":"# Pip\n\nPip is my rabbit. Pip eats carrots and parsley every morning at 7."}]}
:::

**What we didn't record:** a deploy. After yours, the agent's old
`klippy.<subdomain>.workers.dev` address should stop answering (Cloudflare
returns an error page, not your Worker), while the web app keeps working.
You'll check that in the checkpoint.

:::quiz{id="side-door" xp=20}
You set "workers_dev": false on the agent and deploy. What can still reach it from the internet?

- [ ] Nothing at all: workers.dev was the only address
  Not quite. Turning off workers.dev leaves preview URLs on.
- [x] Its version URLs, unless you also set "preview_urls": false
  Right. They're a separate setting, so Klippy sets both.
- [ ] Any browser that knows the Klippy name
  Not quite. Names come from the session on the web app, never from the request.
:::

Your code matches tag `f-01`
([changes from e-09](https://github.com/ryanyogan/klippy/compare/e-09...f-01)).

:::rabbithole
- read "workers.dev" by="Cloudflare" url="https://developers.cloudflare.com/workers/configuration/routing/workers-dev/"
- read "Service bindings" by="Cloudflare" url="https://developers.cloudflare.com/workers/runtime-apis/bindings/service-bindings/"
:::
