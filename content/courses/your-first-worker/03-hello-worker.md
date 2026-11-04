---
# sources (checked 2026-11-03):
# - Cloudflare Workers, How Workers works (isolates, request in / response out)
#   https://developers.cloudflare.com/workers/reference/how-workers-works/
# - Cloudflare Workers, Vitest integration (tests run inside workerd; SELF)
#   https://developers.cloudflare.com/workers/testing/vitest-integration/
# - Cloudflare Workers, TypeScript: wrangler types https://developers.cloudflare.com/workers/languages/typescript/
# - Klippy a-02 → a-03, recorded output docs/outputs/a-03.txt (2026-11-03, wrangler 4.157.0, vitest 5.0.5)
title: "Hello, Worker"
order: 3
minutes: 20
xp: 50
module: Run it
device: desk
tag: a-02
verified: 2026-11-03
versions:
  node: "24.22.2"
  wrangler: "4.157.0"
  vitest: "5.0.5"
  typescript: "5.9.3"
---

Your Worker exists, but you haven't seen it run. In this lesson you'll run it
on your laptop, teach it two answers, and write tests that prove both. The
tests run inside the same runtime Cloudflare uses, so what passes here
behaves the same once it's live.

### 1. Run it

From `klippy/`, start the local server:

```sh
pnpm dev
```

That runs `wrangler dev` in `apps/agent` (the root script from the last
lesson). It prints `Ready on http://localhost:8787`. Open that address in
your browser and you'll see "Hello World!". Leave this terminal running and
open a second one for the commands below.

`wrangler dev` runs **workerd**, the open-source Workers runtime, on your
machine. Save a change to your code and it reloads by itself.

If port 8787 is taken, run `pnpm dev --port 8801` instead and use that port
below. Our recordings use 8801.

### 2. A route and a 404

Right now every address answers "Hello World!". Klippy should answer at its
home page, `/`, and say "Not found" for anything else. Replace
`apps/agent/src/index.ts` with:

:::code{file="apps/agent/src/index.ts" lang="ts" tag="a-03" highlight="3-9" label="apps/agent/src/index.ts"}
export default {
	async fetch(request): Promise<Response> {
		const url = new URL(request.url);

		if (url.pathname === '/') {
			return new Response('Hi, I am Klippy.');
		}

		return new Response('Not found', { status: 404 });
	},
} satisfies ExportedHandler<Env>;
:::

- `new URL(request.url)` splits the address into parts, so you can read its
  `pathname`: `/` for the home page, `/nope` for `http://localhost:8787/nope`.
- A `Response` is a body plus a status. Leave the status out and it's
  `200 OK`. `404` tells the caller, and any program reading the answer,
  that nothing lives there.
- We dropped the `env` and `ctx` arguments c3 had. This code doesn't use
  them yet. `env` comes back in the next lesson.

Ask it with **curl**, a command that sends a request and prints the answer.
`-i` shows the status line and headers too:

:::terminal{cmd="curl -i http://localhost:8801/"}
HTTP/1.1 200 OK
Content-Length: 16
Content-Type: text/plain;charset=UTF-8

Hi, I am Klippy.
:::

:::terminal{cmd="curl -i http://localhost:8801/nope"}
HTTP/1.1 [synapse]404 Not Found[text]
Content-Length: 9
Content-Type: text/plain;charset=UTF-8

Not found
:::

The first terminal logs each request, like `GET / 200 OK (20ms)`. If curl
says "connection refused", the dev server isn't running, or it's on
another port.

### 3. Types for what your Worker can reach

Your Worker will soon reach Cloudflare services: an AI model, a database.
Each one arrives on `env`, and `wrangler types` reads `wrangler.jsonc` and
writes their types into `worker-configuration.d.ts`. Run it now so you know
the command:

```sh
pnpm --filter agent run cf-typegen
```

:::terminal{cmd="pnpm --filter agent run cf-typegen"}
Generating project types...

interface __BaseEnv_Env {
}
[volt]✨ Types written to worker-configuration.d.ts
[muted]📣 Remember to rerun 'wrangler types' after you change your wrangler.jsonc file.
:::

`Env` is empty: nothing is connected yet. You'll run this again each time
you add something to `wrangler.jsonc`.

### 4. Two tests

A test is code that runs your code and checks the answer. Replace
`apps/agent/test/index.spec.ts` with:

:::code{file="apps/agent/test/index.spec.ts" lang="ts" tag="a-03" highlight="5-14" label="apps/agent/test/index.spec.ts"}
import { SELF } from 'cloudflare:test';
import { describe, it, expect } from 'vitest';

describe('Klippy', () => {
	it('says hi at /', async () => {
		const response = await SELF.fetch('https://example.com/');
		expect(response.status).toBe(200);
		expect(await response.text()).toBe('Hi, I am Klippy.');
	});

	it('answers 404 for anything else', async () => {
		const response = await SELF.fetch('https://example.com/nope');
		expect(response.status).toBe(404);
	});
});
:::

- `SELF` is your Worker, running inside workerd for the test. `SELF.fetch`
  sends it a request, as curl did. The host, `example.com`, doesn't matter:
  the request never leaves your machine.
- `expect(...).toBe(...)` fails the test if the two don't match.
- Each `it` is one test with a sentence that says what should be true.

### 5. A typecheck, then run everything

TypeScript only checks your types when you ask it to. Add a `typecheck`
script to `apps/agent/package.json`. It checks the Worker, then the tests,
which have their own `tsconfig.json`:

:::code{file="apps/agent/package.json" lang="json" tag="a-03" highlight="7-7" label="apps/agent/package.json"}
	"scripts": {
		"deploy": "wrangler deploy",
		"dev": "wrangler dev",
		"start": "wrangler dev",
		"test": "vitest run",
		"cf-typegen": "wrangler types",
		"typecheck": "tsc --noEmit && tsc --noEmit -p test"
	},
:::

And one line to the root `package.json`, so `pnpm typecheck` checks every
app:

:::code{file="package.json" lang="json" tag="a-03" highlight="5-5" label="klippy/package.json"}
  "scripts": {
    "dev": "pnpm --filter agent run dev",
    "test": "pnpm --recursive run test",
    "deploy": "pnpm --filter agent run deploy",
    "typecheck": "pnpm --recursive run typecheck"
  }
:::

Now run both from `klippy/`:

```sh
pnpm typecheck
pnpm test
```

:::terminal{cmd="pnpm test"}
> agent@0.0.0 test /home/ryan/code/klippy/apps/agent
> vitest run

[volt] ✓[text] test/index.spec.ts (2 tests) 5ms

 Test Files  [volt]1 passed[text] (1)
      Tests  [volt]2 passed[text] (2)
:::

`pnpm typecheck` prints nothing when all is well; an error names the file
and line. If a test fails, vitest shows what it expected and what it got:
a typo in "Hi, I am Klippy." is the usual one.

Save your work with `git add -A` and `git commit -m "Hello, Worker"`.

:::quiz{id="test-runtime" xp=20}
Klippy's tests send requests with `SELF.fetch`. Why does it matter that they run inside workerd?

- [ ] It makes the tests run faster than plain Node
  Not quite. Speed isn't the point.
- [x] The code runs in the same runtime as in production, so a pass means the same thing there
  Right. Workers have their own APIs and limits. Testing in workerd catches what plain Node would miss.
- [ ] It deploys the Worker before each test
  Not quite. Nothing is deployed. Everything stays on your machine.
:::

Stuck? Compare with tag `a-03`
([changes from a-02](https://github.com/ryanyogan/klippy/compare/a-02...a-03)).

:::rabbithole
- read "How Workers works" by="Cloudflare" url="https://developers.cloudflare.com/workers/reference/how-workers-works/"
- read "Vitest integration" by="Cloudflare" url="https://developers.cloudflare.com/workers/testing/vitest-integration/"
:::
