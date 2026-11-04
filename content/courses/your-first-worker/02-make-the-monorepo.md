---
# sources (checked 2026-11-03):
# - Cloudflare Workers, Get started with the CLI (create-cloudflare, the generated files)
#   https://developers.cloudflare.com/workers/get-started/guide/
# - pnpm, Workspaces (pnpm-workspace.yaml, --filter) https://pnpm.io/workspaces
# - Klippy a-01 → a-02, recorded output docs/outputs/a-02.txt (2026-11-03, create-cloudflare 2.74.8,
#   pnpm 10.34.9, Node 24.22.2)
title: "Make the monorepo"
order: 2
minutes: 20
xp: 50
module: Set up
device: desk
tag: a-01
verified: 2026-11-03
versions:
  node: "24.22.2"
  pnpm: "10.34.9"
  create-cloudflare: "2.74.8"
  wrangler: "4.157.0"
---

Klippy will grow into more than one app: the agent first, then a web page to
talk to it. So its folder is a **monorepo**: one repository, one install,
several apps side by side. In this lesson you'll make that folder, put an
empty Cloudflare **Worker** in it, and read every file you got.

A Worker is a small program that runs on Cloudflare's network. When a
request arrives, Cloudflare runs your code close to whoever sent it, and
your code sends back a response. You don't run a server or pick a region.

### 1. A folder with git

Make the folder, go into it, and start a git repository, so every step can
be saved and undone:

```sh
mkdir klippy
cd klippy
git init
```

Some files should never be saved in git: downloaded packages, build output
and, above all, secrets. Make a file called `.gitignore` in `klippy/` with
these lines:

:::code{file=".gitignore" tag="a-01" label="klippy/.gitignore"}
node_modules/
.wrangler/
dist/
.dev.vars*
!.dev.vars.example
.env*
*.log
.DS_Store
:::

`node_modules/` is where packages land. `.wrangler/` is Cloudflare's local
state. `.dev.vars*` and `.env*` hold secrets, so they're ignored, with one
exception: `.dev.vars.example`, a template with no real values in it.

Then pin the Node version, so anyone who opens the repo uses the same one:

```sh
echo 24 > .node-version
```

### 2. The root package.json

Every Node project has a `package.json`: its name, its scripts and what it
depends on. This one is the root of the monorepo. Make `klippy/package.json`:

:::code{file="package.json" lang="json" tag="a-02" highlight="4-8" label="klippy/package.json"}
{
  "name": "klippy",
  "private": true,
  "packageManager": "pnpm@10.34.9",
  "scripts": {
    "dev": "pnpm --filter agent run dev",
    "test": "pnpm --recursive run test",
    "deploy": "pnpm --filter agent run deploy"
  }
}
:::

- `"private": true` means this is never published as a package.
- `packageManager` pins pnpm 10.34.9. Corepack reads this line and fetches
  that exact version, so everyone's installs match.
- The three scripts are shortcuts you'll run from the root. `--filter agent`
  runs a script in the app called `agent` only. `--recursive` runs it in
  every app that has one.

### 3. The workspace file

pnpm needs to know where the apps live. Make `klippy/pnpm-workspace.yaml`:

:::code{file="pnpm-workspace.yaml" lang="yaml" tag="a-02" label="klippy/pnpm-workspace.yaml"}
packages:
  - "apps/*"
  - "packages/*"

# workerd (the Workers runtime) and esbuild download native binaries when they install.
onlyBuiltDependencies:
  - esbuild
  - workerd
:::

Every folder under `apps/` or `packages/` is now part of the workspace.
`onlyBuiltDependencies` is a safety switch: pnpm doesn't run install scripts
from packages unless you allow them. Two need one: `workerd`, the Workers
runtime you'll run locally, and `esbuild`, which bundles your code. Both
download a native program for your machine when they install.

### 4. Make the Worker

Cloudflare's project maker is called **create-cloudflare**, or c3. Run it
from `klippy/`:

```sh
pnpm create cloudflare@2.74.8 apps/agent --type=hello-world --lang=ts --no-git --no-deploy --no-agents
```

The flags answer its questions up front: a Hello World Worker, in
TypeScript, without its own git repository (you have one), without
deploying yet, and without the extra AI-assistant files it can add. Here's
the end of our run:

:::terminal{cmd="pnpm create cloudflare@2.74.8 apps/agent --type=hello-world --lang=ts --no-git --no-deploy --no-agents"}
├ Copying template files
│ files copied to project directory
│
├ Selecting workerd compatibility date
│ compatibility date 2026-11-03
│
├ Generating types for your application
│ generated to `./worker-configuration.d.ts` via `pnpm run cf-typegen`
│
╰ Done
[volt]🎉  SUCCESS  Application created successfully!
:::

c3 was built to make a stand-alone project, so it left two files in
`apps/agent` that belong at the root in a monorepo: a lockfile and a
workspace file. Delete them, then install once from the root:

```sh
rm apps/agent/pnpm-lock.yaml apps/agent/pnpm-workspace.yaml
pnpm install
```

:::terminal{cmd="pnpm install"}
Scope: all 2 workspace projects
Packages: +73
.../esbuild@0.28.2/node_modules/esbuild postinstall: Done
.../node_modules/workerd postinstall: Done
[volt]Done in 1.1s using pnpm v10.34.9
:::

Two workspace projects: the root and `apps/agent`. The two `postinstall`
lines are the install scripts you allowed in step 3. If pnpm instead warns
"Ignored build scripts", check the spelling under `onlyBuiltDependencies`.

### 5. What c3 made

Open `apps/agent` in your editor. The file that matters most is the code:

:::code{file="apps/agent/src/index.ts" lang="ts" tag="a-02" label="apps/agent/src/index.ts"}
export default {
	async fetch(request, env, ctx): Promise<Response> {
		return new Response("Hello World!");
	},
} satisfies ExportedHandler<Env>;
:::

A Worker is an object with a `fetch` function. Cloudflare calls it with
each request and sends back the `Response` it returns. This one answers
every request with "Hello World!". `satisfies ExportedHandler<Env>` lets
TypeScript check that the object has the right shape.

Next, the Worker's settings:

:::code{file="apps/agent/wrangler.jsonc" lang="json" tag="a-02" label="apps/agent/wrangler.jsonc"}
{
	"$schema": "node_modules/wrangler/config-schema.json",
	"name": "klippy",
	"main": "src/index.ts",
	"compatibility_date": "2026-11-03",
	"observability": {
		"enabled": true
	},
	"upload_source_maps": true
:::

- `name` is the Worker's name on Cloudflare. c3 took it from the folder,
  `agent`. **Change it to `klippy` in your file now**, so the address you
  deploy to later starts with `klippy.`.
- `main` is the file Cloudflare runs.
- `compatibility_date` pins how the runtime behaves. Cloudflare never
  changes the behaviour your Worker was written for; you move the date
  forward when you want newer behaviour.
- `observability` turns on logs you can read in the dashboard.

And the app's own `package.json`. c3 wrote two things you'll change. Its
`test` script is plain `vitest`, which keeps watching for changes and never
exits; make it `vitest run`, which runs the tests once. And it wrote
version ranges like `^1.4.3`; drop the `^` and use exactly these versions,
the ones this course was checked with. **Edit your
`apps/agent/package.json` so these two blocks match**, then run
`pnpm install` again from `klippy/`:

:::code{file="apps/agent/package.json" lang="json" tag="a-02" label="apps/agent/package.json"}
	"scripts": {
		"deploy": "wrangler deploy",
		"dev": "wrangler dev",
		"start": "wrangler dev",
		"test": "vitest run",
		"cf-typegen": "wrangler types"
	},
	"devDependencies": {
		"@cloudflare/vitest-plugin": "1.5.1",
		"@types/node": "26.6.6",
		"typescript": "5.9.3",
		"vitest": "5.0.5",
		"wrangler": "4.157.0"
	}
:::

If you skip this, `pnpm test` in the next lesson sits there watching
instead of finishing (press `q` to quit it).

`wrangler` is Cloudflare's command-line tool: `wrangler dev` runs the
Worker on your laptop and `wrangler deploy` ships it. `vitest` and its
Cloudflare plugin run tests. `cf-typegen` writes `worker-configuration.d.ts`,
the types for what your Worker can reach. The rest (`tsconfig.json`,
`test/`, `.prettierrc`) you'll meet as you need them.

### 6. Save it

```sh
git add -A
git commit -m "A pnpm workspace and an empty Worker"
```

:::quiz{id="why-root-install" xp=20}
Why did you delete c3's lockfile in `apps/agent` and install from the root?

- [ ] The lockfile in apps/agent was broken
  Not quite. It was fine for a stand-alone project. The problem is having two.
- [x] A monorepo has one lockfile and one install, at the root
  Right. One lockfile pins every app's versions together, so apps can't drift apart.
- [ ] pnpm can't install inside a subfolder
  Not quite. It can. But the workspace file at the root is what links the apps.
:::

Stuck? Your folder should now match tag `a-02`. Compare yours with
`git checkout a-02` in a clone of Klippy, or read the
[changes from a-01 to a-02](https://github.com/ryanyogan/klippy/compare/a-01...a-02).

:::rabbithole
- read "Get started with the Workers CLI" by="Cloudflare" url="https://developers.cloudflare.com/workers/get-started/guide/"
- read "Workspaces" by="pnpm" url="https://pnpm.io/workspaces"
:::
