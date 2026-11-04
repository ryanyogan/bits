---
# sources (checked 2026-11-03):
# - Installed remix 3.1.0 docs: node_modules/remix/INDEX.md, guides 02, 03 (the Workers entry) and 04
# - Cloudflare Workers, Service bindings https://developers.cloudflare.com/workers/runtime-apis/bindings/service-bindings/
# - Cloudflare Workers, Static Assets https://developers.cloudflare.com/workers/static-assets/
# - Klippy d-04 → d-05, docs/outputs/d-05.txt (2026-11-03; remix 3.1.0, wrangler 4.157.0, typescript 5.9.3). The code
#   was written by an agent against the prompt, not recorded from a fresh run; the checks are real.
title: "The Remix shell on Workers"
order: 5
minutes: 30
xp: 90
module: Build the app
device: desk
tag: d-04
verified: 2026-11-03
versions:
  remix: "3.1.0"
  wrangler: "4.157.0"
  typescript: "5.9.3"
---

Time for the app: `apps/web`, a second Worker that renders pages with
Remix 3 and talks to the agent through a **service binding**. The browser
only ever talks to the web app; the web app talks to the agent, Worker to
Worker, with no public internet in between.

### 1. The prompt

Fresh session, plan mode first (`claude --permission-mode plan`):

```text
Goal: add apps/web, a Remix 3 app on Workers that renders a home page and calls the agent through a service
binding, so the browser never talks to the agent directly.
Use the remix skill: read node_modules/remix/INDEX.md, then guides 02, 03 (the Workers entry) and 04 first.
Use the cloudflare skill for service bindings and static assets.
Constraints:
- Only apps/web/** and the root package.json. remix 3.1.0, wrangler 4.157.0, typescript 5.9.3, exact versions.
- No remix/assets asset server (it needs Node). Static files from Workers Static Assets in apps/web/public.
- Binding AGENT → service "klippy". The home page shows the agent's reply to GET /.
- Styles: one stylesheet, public/styles.css, from the tokens in docs/ui-brief.md. No CSS framework, no React.
Plan first: list the files and steps, then wait for my go-ahead.
Done when pnpm typecheck and remix doctor pass, and with `pnpm dev:web` running, curl localhost:8802 shows the
agent's words. Report the files, both command outputs and the curl output.
```

- **The goal names the security reason**: no browser-to-agent traffic.
- **Skills and named guides**: Remix 3 is newer than the model's memory.
- **"No remix/assets asset server"** saves a detour. `remix new` makes a
  Node app whose asset server reads files from disk at request time, which
  a Worker can't. We ran it in a scratch folder to copy its layout
  (`app/routes.ts`, `app/router.ts`, `app/actions/`), and left the Node
  parts out.
- **Plan first**: this step touches about ten files.

### 2. What to expect: the parts worth reading

About eight files under `apps/web`, a stylesheet, and a `dev:web` script in
the root `package.json`. Our plan had one change: the agent wanted to run
`remix new` in place; we kept its layout, not its Node files.

The binding is two lines of config:

:::code{file="apps/web/wrangler.jsonc" lang="json" tag="d-05" highlight="7-10" label="apps/web/wrangler.jsonc"}
{
	"$schema": "node_modules/wrangler/config-schema.json",
	"name": "klippy-web",
	"main": "app/worker.ts",
	"compatibility_date": "2026-11-03",
	"observability": { "enabled": true },
	// Files in public/ (the stylesheet, later the island bundles) are served by Cloudflare before the Worker runs.
	"assets": { "directory": "public" },
	// AGENT is the agent Worker ("klippy"), called like fetch() but Worker to Worker: no public internet in between.
	"services": [{ "binding": "AGENT", "service": "klippy" }]
}
:::

And it's called like `fetch`:

:::code{file="apps/web/app/actions/controller.tsx" lang="ts" tag="d-05" highlight="5" label="apps/web/app/actions/controller.tsx"}
export default createController(routes, {
	actions: {
		async home(context) {
			// Worker to Worker through the service binding. The host name is ignored: AGENT always means the agent Worker.
			const reply = await env.AGENT.fetch('https://agent/');
			return context.render(<HomePage agentSays={reply.ok ? await reply.text() : `The agent answered ${reply.status}.`} />);
		},
	},
});
:::

`env` comes from `cloudflare:workers`, so no plumbing is needed to reach a
binding. The Worker entry is just `router.fetch(request)`.

### 3. The one stylesheet

This is the one place in the build-along where a big file arrives whole.
It's written from the brief's tokens, with a dark theme, a visible focus
ring, 44px targets, reduced motion, and the classes later lessons use
(chat, tool card, notes). Read the tokens at the top; skim the rest.

:::code{file="apps/web/public/styles.css" lang="css" tag="d-05" stylesheet label="apps/web/public/styles.css (the one full stylesheet)"}
/* Klippy's one stylesheet (course D, d-05). Tokens come from docs/ui-brief.md. */

:root {
	--bg: #fbfaf7;
	--fg: #1d1f23;
	--muted: #5d6169;
	--accent: #2f5bd3;
	--on-accent: #ffffff;
	--border: #e2dfd8;
	--tint: #f1efe9;
	--danger: #b3261e;
	--radius: 10px;
	--space-1: 4px;
	--space-2: 8px;
	--space-3: 12px;
	--space-4: 16px;
	--space-5: 24px;
	--space-6: 32px;
	--column: 42rem;
	--touch: 44px;
	--font: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
	--mono: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
	color-scheme: light dark;
}

@media (prefers-color-scheme: dark) {
	:root {
		--bg: #16171a;
		--fg: #ecebe7;
		--muted: #a3a7ae;
		--accent: #8fb0ff;
		--on-accent: #16171a;
		--border: #2c2e33;
		--tint: #202227;
		--danger: #ffb4ab;
	}
}

/* Base */

*,
*::before,
*::after {
	box-sizing: border-box;
}

body {
	margin: 0;
	background: var(--bg);
	color: var(--fg);
	font: 16px/1.55 var(--font);
	-webkit-font-smoothing: antialiased;
}

a {
	color: var(--accent);
}

h1,
h2 {
	line-height: 1.2;
	margin: 0 0 var(--space-4);
}

h1 {
	font-size: 1.6rem;
}

h2 {
	font-size: 1.15rem;
}

p {
	margin: 0 0 var(--space-4);
}

:focus-visible {
	outline: 3px solid var(--accent);
	outline-offset: 2px;
}

.skip {
	position: absolute;
	left: var(--space-4);
	top: -100px;
}

.skip:focus {
	top: var(--space-2);
}

.muted {
	color: var(--muted);
}

/* Top bar and page column */

.bar {
	display: flex;
	align-items: center;
	gap: var(--space-4);
	max-width: var(--column);
	margin: 0 auto;
	padding: var(--space-3) var(--space-4);
	border-bottom: 1px solid var(--border);
}

.brand {
	font-weight: 700;
	color: var(--fg);
	text-decoration: none;
	margin-right: auto;
}

.bar nav {
	display: flex;
	gap: var(--space-2);
}

.bar nav a {
	display: inline-flex;
	align-items: center;
	min-height: var(--touch);
	padding: 0 var(--space-3);
	border-radius: var(--radius);
	color: var(--fg);
	text-decoration: none;
}

.bar nav a[aria-current='page'] {
	background: var(--tint);
	font-weight: 600;
}

.bar form {
	margin: 0;
}

main {
	max-width: var(--column);
	margin: 0 auto;
	padding: var(--space-5) var(--space-4) var(--space-6);
}

main:focus {
	outline: none;
}

/* Buttons and fields */

button,
.button {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	gap: var(--space-2);
	min-height: var(--touch);
	padding: 0 var(--space-4);
	border: 1px solid var(--accent);
	border-radius: var(--radius);
	background: var(--accent);
	color: var(--on-accent);
	font: inherit;
	font-weight: 600;
	text-decoration: none;
	cursor: pointer;
}

button.quiet {
	background: transparent;
	color: var(--fg);
	border-color: var(--border);
}

button.danger {
	background: transparent;
	color: var(--danger);
	border-color: var(--border);
}

button:disabled {
	opacity: 0.55;
	cursor: not-allowed;
}

label {
	display: block;
	font-weight: 600;
	margin-bottom: var(--space-1);
}

input[type='search'],
input[type='text'],
textarea {
	width: 100%;
	min-height: var(--touch);
	padding: var(--space-2) var(--space-3);
	border: 1px solid var(--border);
	border-radius: var(--radius);
	background: var(--bg);
	color: var(--fg);
	font: inherit;
}

textarea {
	resize: vertical;
	min-height: 88px;
}

.row {
	display: flex;
	gap: var(--space-2);
	align-items: flex-end;
}

.row > :first-child {
	flex: 1;
}

/* Notices */

.notice {
	padding: var(--space-3) var(--space-4);
	border: 1px solid var(--border);
	border-radius: var(--radius);
	background: var(--tint);
	margin-bottom: var(--space-4);
}

.notice.error {
	border-color: var(--danger);
	color: var(--danger);
}

/* Sign-in */

.signin {
	text-align: center;
	padding-top: var(--space-6);
}

/* Chat: conversation, messages, tool cards, prompt input (shapes from AI Elements, d-08) */

.conversation {
	display: flex;
	flex-direction: column;
	gap: var(--space-4);
	margin: 0 0 var(--space-5);
	padding: 0;
	list-style: none;
}

.conversation-empty {
	text-align: center;
	color: var(--muted);
	padding: var(--space-6) 0;
}

.message {
	display: flex;
	flex-direction: column;
	gap: var(--space-2);
	max-width: 100%;
}

.message[data-from='user'] {
	align-self: flex-end;
	max-width: 85%;
}

.message-content {
	white-space: pre-wrap;
	overflow-wrap: anywhere;
}

.message[data-from='user'] .message-content {
	padding: var(--space-2) var(--space-3);
	border-radius: var(--radius);
	background: var(--tint);
}

.message-thinking {
	color: var(--muted);
	font-style: italic;
}

.tool {
	border: 1px solid var(--border);
	border-radius: var(--radius);
	font-size: 0.92rem;
}

.tool summary {
	display: flex;
	align-items: center;
	gap: var(--space-2);
	min-height: var(--touch);
	padding: 0 var(--space-3);
	cursor: pointer;
}

.tool-name {
	font-family: var(--mono);
	font-weight: 600;
}

.tool-state {
	margin-left: auto;
	color: var(--muted);
}

.tool-body {
	padding: 0 var(--space-3) var(--space-3);
}

.tool-body pre {
	margin: 0 0 var(--space-2);
	padding: var(--space-2);
	border-radius: 6px;
	background: var(--tint);
	font: 0.85rem/1.45 var(--mono);
	white-space: pre-wrap;
	overflow-wrap: anywhere;
}

.tool-actions {
	display: flex;
	gap: var(--space-2);
	padding: 0 var(--space-3) var(--space-3);
}

.sources {
	font-size: 0.9rem;
	color: var(--muted);
}

.sources ul {
	margin: var(--space-1) 0 0;
	padding-left: var(--space-5);
}

.prompt-input {
	display: grid;
	gap: var(--space-2);
}

.prompt-input .row {
	align-items: flex-end;
}

/* Notes */

.notes {
	list-style: none;
	margin: var(--space-4) 0 0;
	padding: 0;
	border-top: 1px solid var(--border);
}

.notes li {
	display: flex;
	gap: var(--space-3);
	align-items: flex-start;
	padding: var(--space-3) 0;
	border-bottom: 1px solid var(--border);
}

.notes li p {
	flex: 1;
	margin: 0;
	white-space: pre-wrap;
	overflow-wrap: anywhere;
}

.notes time {
	display: block;
	color: var(--muted);
	font-size: 0.85rem;
}

.notes form {
	margin: 0;
}

/* Visually hidden, still read by screen readers */

.visually-hidden {
	position: absolute;
	width: 1px;
	height: 1px;
	overflow: hidden;
	clip: rect(0 0 0 0);
	white-space: nowrap;
}

@media (prefers-reduced-motion: reduce) {
	* {
		animation: none;
		transition: none;
		scroll-behavior: auto;
	}
}
:::

### 4. Run both Workers

The web app's binding needs the agent running too. `pnpm dev:web` runs both
in one wrangler process (`wrangler dev -c wrangler.jsonc -c ../agent/wrangler.jsonc`,
port 8802): the first config is served, the second makes `AGENT` resolve.

:::terminal{cmd="curl -s localhost:8802/"}
<!DOCTYPE html><html lang="en"><head>… <title>Klippy</title><link rel="stylesheet" href="/styles.css" /></head><body><a href="#main" class="skip">Skip to content</a><header class="bar"><a href="/" class="brand">Klippy</a></header><main id="main" tabindex="-1"><h1>Klippy</h1><p>The agent says: [volt]<q>Hi, I am Klippy.</q>[text]</p></main></body></html>
:::

The agent's words, through the binding. Wrangler prints
`env.AGENT (klippy) Worker local [not connected]` before the second Worker
starts; the page proves it connected.

:::terminal{cmd="pnpm --filter web exec remix doctor"}
✓ environment
  [ion]• [ADVICE] package.json does not declare engines.node. Add one to document the supported Node.js version.[text]
✓ project
✓ actions
Summary: 0 warnings, 1 advice.
:::

We took the advice (`"engines": { "node": ">=24.3.0" }`) and it came back
`0 warnings, 0 advice`. The agent's routes are unchanged: `/` on the agent
is public, `/agents/*` still needs the token. The next lesson adds it, on
the server side of the binding.

### 5. Review it

- No `react`, `react-dom`, `@remix-run/react` or `react-router` anywhere
  (`grep -r "react" apps/web/app`).
- `tsconfig.json` has `"jsxImportSource": "remix/component"`. Routes live
  in `app/routes.ts`, actions in `app/actions/`.
- `wrangler.jsonc`: `AGENT` → `klippy`, `assets.directory` is `public`, no
  secrets.
- Exact versions in `apps/web/package.json`: no `^`, no `latest`.
- **Reject**: `remix/assets` or `createAssetServer` in the Worker, a CSS
  framework, inline styles.

Steer prompts for the usual misses:

```text
You imported createAssetServer from remix/assets. It reads files from disk, which a Worker can't. Remove it and serve public/ with Workers Static Assets, as the constraints say.
```

```text
The page says 'React is not defined'. Add jsx: react-jsx and jsxImportSource: remix/component to apps/web/tsconfig.json, then restart wrangler dev (it doesn't watch tsconfig).
```

```text
You copied remix new's dev script (node --watch server.ts). This app runs on Workers: use wrangler dev.
```

:::quiz{id="why-service-binding" xp=20}
Why does the browser talk to the web app, and the web app to the agent, instead of the browser calling the agent?

- [ ] Browsers can't open WebSockets to Workers
  Not quite. They can. The reason is what the browser would need to hold.
- [x] The agent needs its token, and the token must never reach a browser; the web app adds it on the server
  Right. The service binding keeps the agent's lock where nobody can read it.
- [ ] A service binding is faster than the internet, and that's all
  Not quite. It skips the public internet, but the point is the token.
:::

Your repo matches tag `d-05`
([changes from d-04](https://github.com/ryanyogan/klippy/compare/d-04...d-05)).

:::rabbithole
- read "Service bindings" by="Cloudflare" url="https://developers.cloudflare.com/workers/runtime-apis/bindings/service-bindings/"
- read "Static Assets" by="Cloudflare" url="https://developers.cloudflare.com/workers/static-assets/"
:::
