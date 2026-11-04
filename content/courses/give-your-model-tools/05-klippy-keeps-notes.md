---
# sources (checked 2026-11-03):
# - Cloudflare D1, Get started (wrangler d1 create, the d1_databases binding)
#   https://developers.cloudflare.com/d1/get-started/
# - Cloudflare D1, Migrations (migrations apply --local / --remote, never edit an applied file)
#   https://developers.cloudflare.com/d1/reference/migrations/
# - Remix, data-table README (table(), column builders, create/findMany)
#   apps/web/node_modules/remix docs; https://github.com/remix-run/remix/tree/main/packages/data-table
# - Klippy b-04 → b-05, recorded output docs/outputs/b-05.txt (2026-11-03, remix 3.1.0). The D1 driver
#   is included in the repo (packages/data-table-d1). The Workers AI fallback answered, not Claude.
title: "Klippy keeps notes"
order: 5
minutes: 30
xp: 70
module: Tools that write
device: desk
tag: b-04
verified: 2026-11-03
versions:
  wrangler: "4.157.0"
  remix: "3.1.0"
  ai: "7.0.162"
  zod: "4.6.7"
---

So far Klippy's tools only read. Now it gets tools that **write**: say
"note down: call Sam on Friday" and it saves the note; ask "what did I
note?" and it lists them. Notes have to outlive a request, so they go in a
database: **D1**, Cloudflare's SQL database.

### 1. Make the database

From `apps/agent`, ask Cloudflare for a database called `klippy-db`:

```sh
cd apps/agent
pnpm wrangler d1 create klippy-db
```

wrangler prints a block with a `database_id`. Yours is your own; copy it.
Then add the binding to `wrangler.jsonc`, after `ratelimits` (which now
needs a comma after it). Use your `database_id`, not ours:

:::code{file="apps/agent/wrangler.jsonc" lang="json" tag="b-05" highlight="2-10" label="apps/agent/wrangler.jsonc"}
	// Klippy's notes. `wrangler dev` and the tests use a local copy; --remote is the real one.
	"d1_databases": [
		{
			"binding": "DB",
			"database_name": "klippy-db",
			"database_id": "e51fc5ce-ea1d-48b0-afd7-e0af5cd1672f",
			// The migrations live in packages/db, next to the table definitions.
			"migrations_dir": "../../packages/db/migrations"
		}
	]
:::

- `binding: "DB"` makes it `env.DB` in your code.
- `migrations_dir` points at the folder where the database's changes will
  live. It's in a shared package, so later apps can use the same tables.

Run `pnpm run cf-typegen` (you're in `apps/agent`) so `env.DB` is typed.

### 2. The table, as a migration

A database starts empty. You describe its tables in SQL, in numbered files
called **migrations**. Each one runs once, in order, and is never edited
after it has run: a later change is a new file, `0002_…`. That way every
copy of the database, yours, your tests' and the live one, goes through the
same steps. Make `packages/db/migrations/0001_notes.sql` (from `klippy/`):

:::code{file="packages/db/migrations/0001_notes.sql" lang="sql" tag="b-05" label="packages/db/migrations/0001_notes.sql"}
-- Klippy's notes. Applied by `wrangler d1 migrations apply`, never edited after it has run:
-- a change to the schema is a new file (0002_...).
CREATE TABLE notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  body TEXT NOT NULL,
  created_at INTEGER NOT NULL -- milliseconds since 1970, from Date.now()
);
:::

Three columns: an `id` the database counts up by itself, the note's
`body`, and when it was made, as milliseconds since 1970.

Apply it to your **local** database, the copy `pnpm dev` uses (from
`apps/agent`):

```sh
pnpm wrangler d1 migrations apply klippy-db --local
```

:::terminal{cmd="pnpm wrangler d1 migrations apply klippy-db --local"}
Migrations to be applied:
│ name           │
│ 0001_notes.sql │
? About to apply 1 migration(s)
Your database may not be available to serve requests during the migration, continue?
[muted]🤖 Using fallback value in non-interactive context: yes
🌀 Executing on local database klippy-db (e51fc5ce-ea1d-48b0-afd7-e0af5cd1672f) from .wrangler/state/v3/d1:
[volt]🚣 2 commands executed successfully.
│ name           │ status │
│ 0001_notes.sql │ ✅     │
:::

In your terminal, wrangler asks "continue?" and waits: type `y`. (Our
recording ran from a script, hence the "fallback value" line.) The live
database waits for the checkpoint, with `--remote`.

### 3. The same table, for TypeScript

The SQL makes the table. TypeScript also needs to know its shape, so your
code can't save a note without a body. Klippy uses **data-table** from
Remix for that. Make a package for the tables, `packages/db/package.json`:

:::code{file="packages/db/package.json" lang="json" tag="b-05" highlight="2-8" label="packages/db/package.json"}
{
  "name": "@klippy/db",
  "version": "0.0.0",
  "private": true,
  "description": "Klippy's D1 tables (remix/data-table) and SQL migrations, shared by every app",
  "type": "module",
  "exports": {
    ".": "./src/index.ts"
  },
  "dependencies": {
    "remix": "3.1.0"
  }
}
:::

and `packages/db/src/index.ts`, the same columns as the SQL:

:::code{file="packages/db/src/index.ts" lang="ts" tag="b-05" highlight="4-11" label="packages/db/src/index.ts"}
import { column as c, table } from 'remix/data-table';

// The same columns as migrations/0001_notes.sql, typed for TypeScript.
export const notes = table({
	name: 'notes',
	columns: {
		id: c.integer().primaryKey(),
		body: c.text(),
		created_at: c.integer(),
	},
});
:::

data-table talks to databases through a **driver**, and it has no D1
driver of its own. **The driver is included in the repo**, as
`packages/data-table-d1`: copy that folder from Klippy at tag `b-05` into
your `packages/`. From `klippy/`, clone Klippy next to your folder and copy
it across:

```sh
git clone --branch b-05 https://github.com/ryanyogan/klippy ../klippy-ref
cp -r ../klippy-ref/packages/data-table-d1 packages/
```

You don't need to read it to use it. Keep `../klippy-ref` around: it's also
the easiest place to copy each lesson's tests from.

Then add the three packages to the agent, from `klippy/`:

```sh
pnpm --filter agent add --save-exact remix@3.1.0
pnpm --filter agent add @klippy/db@workspace:* data-table-d1@workspace:*
```

`workspace:*` means "the package in this repo", not one from the internet.
The driver's imports end in `.ts`, so `apps/agent/tsconfig.json` needs one
line, next to `moduleResolution`:

:::code{file="apps/agent/tsconfig.json" lang="json" tag="b-05" highlight="2-3" label="apps/agent/tsconfig.json"}
		"moduleResolution": "Bundler",
		/* Allow imports that end in .ts (the data-table-d1 package uses them). */
		"allowImportingTsExtensions": true,
:::

### 4. Two tools that use the database

Make `apps/agent/src/tools/notes.ts`. The tools need the database, which
arrives on `env` with each request, so they're made by a function:

:::code{file="apps/agent/src/tools/notes.ts" lang="ts" tag="b-05" highlight="13-23" label="apps/agent/src/tools/notes.ts"}
import { notes } from '@klippy/db';
import { tool } from 'ai';
import { createD1Database } from 'data-table-d1';
import { z } from 'zod';

// A note can be a sentence or a short paragraph, not a book: this caps what one request can store.
export const MAX_NOTE = 1000;

// These tools need your database, so they're made per request from env.DB.
export function noteTools(d1: D1Database) {
	const db = createD1Database(d1);

	const saveNote = tool({
		description:
			'Save a note for the user, word for word. Use it only when the user asks you to remember, save or note something down. It returns the saved note with its id.',
		inputSchema: z.object({
			body: z.string().trim().min(1).max(MAX_NOTE).describe('The note, in the words the user gave'),
		}),
		execute: async ({ body }) => {
			const note = await db.create(notes, { body, created_at: Date.now() }, { returnRow: true });
			return { saved: { id: note.id, body: note.body } };
		},
	});
:::

- `createD1Database(d1)` wraps your D1 binding for data-table.
- The description says **only** when the user asks to remember something.
  A tool that writes should be the hardest one to call by mistake.
- `z.string().trim().min(1).max(MAX_NOTE)` refuses an empty note or one
  over 1,000 characters before anything is written. A tool that writes
  needs a limit on what it writes.
- `db.create(notes, …, { returnRow: true })` inserts a row and gives it
  back with its new `id`.

Then the second tool, and the return, before the function's last `}`:

:::code{file="apps/agent/src/tools/notes.ts" lang="ts" tag="b-05" highlight="2-7" label="apps/agent/src/tools/notes.ts"}
	const listNotes = tool({
		description:
			"List the user's saved notes, newest first (at most 20). Use it when the user asks what they saved, or asks about something they told you to note down.",
		inputSchema: z.object({}),
		execute: async () => {
			const rows = await db.findMany(notes, { orderBy: ['id', 'desc'], limit: 20 });
			return { notes: rows.map((note) => ({ id: note.id, body: note.body, savedAt: new Date(note.created_at).toISOString() })) };
		},
	});

	return { saveNote, listNotes };
}
:::

`listNotes` takes no input (`z.object({})`) and returns at most 20 notes,
newest first: a cap on what one call can pour into the conversation.

### 5. Wire them in, and keep the public door read-only

In `apps/agent/src/ask.ts`, gather every tool in one place, and let callers
pass their own set:

:::code{file="apps/agent/src/ask.ts" lang="ts" tag="b-05" highlight="1-7" label="apps/agent/src/ask.ts"}
// Every tool Klippy has. The notes tools need the database, so they're made from env.DB.
export function allTools(env: Env) {
	return { getWeather, getTime, ...noteTools(env.DB) };
}

// One question in, one answer out. Both /ask and /klippy/check use it.
export async function ask(env: Env, question: string, tools: ToolSet = allTools(env)) {
// ...
		tools,
:::

(Import `noteTools` and `type ToolSet` at the top, and replace
`tools: { getWeather, getTime }` with `tools`.) Why the parameter?
`/klippy/check` is public. Anyone can call it, so it must never write a note.
In `apps/agent/src/check.ts`, give the probe no tools at all:

:::code{file="apps/agent/src/check.ts" lang="ts" tag="b-05" highlight="6-6" label="apps/agent/src/check.ts"}
	if (!cached || Date.now() - cached.at > FIVE_MINUTES) {
		// One shared key for everyone: at most 10 fresh probes a minute in total.
		if (!(await underLimit(env, 'check'))) {
			return Response.json({ error: 'Too many checks. Wait a minute.' }, { status: 429 });
		}
		cached = { probe: await ask(env, 'Say hello to bits in one short sentence.', {}), at: Date.now() };
	}
:::

The `{}` at the end of the `ask(...)` call is the whole fix. `/ask` still
needs your token and shares the rate limit, so writes are capped at 10 a
minute too.

### 6. Take notes

Restart `pnpm dev` and try it. Our run:

:::terminal{cmd="curl -s -X POST http://localhost:8801/ask -H &quot;Authorization: Bearer demo-token-for-the-recording&quot; -d '{&quot;question&quot;:&quot;Please note down: call Sam about the bike on Friday&quot;}'"}
{"answer":"I've saved your note: \"call Sam about the bike on Friday\"","model":"[synapse]@cf/zai-org/glm-4.7-flash[text]"}
:::

:::terminal{cmd="curl -s -X POST http://localhost:8801/ask -H &quot;Authorization: Bearer demo-token-for-the-recording&quot; -d '{&quot;question&quot;:&quot;What notes have I saved?&quot;}'"}
{"answer":"You have 2 saved notes:\n\n1. \"call Sam about the bike on Friday\" \n2. \"oat milk, coffee beans, bin bags\"","model":"[synapse]@cf/zai-org/glm-4.7-flash[text]"}
:::

(We'd saved a shopping list in between.) The step log shows `saveNote`
with `{"body":"call Sam about the bike on Friday"}`, then `listNotes` with
`{}`. And the notes really are in the database:

:::terminal{cmd="pnpm wrangler d1 execute klippy-db --local --command &quot;SELECT * FROM notes&quot;"}
      {
        "id": 1,
        "body": "call Sam about the bike on Friday",
        "created_at": 1793750909460
      },
      {
        "id": 2,
        "body": "oat milk, coffee beans, bin bags",
        "created_at": 1793750915645
      }
:::

The fallback model answered here, as before. If you get "no such table:
notes", you skipped the migration in step 2, or ran it from the wrong
folder.

Klippy's tests run on a real local D1, built from your migrations: copy
[`test/notes.spec.ts`](https://github.com/ryanyogan/klippy/blob/b-05/apps/agent/test/notes.spec.ts),
`test/env.d.ts` and the updated `vitest.config.mts` from the repo, then
`pnpm test`. Ours: 22 passed, plus the driver's own 24.

:::quiz{id="never-edit-migration" xp=20}
Your `notes` table needs a new column. `0001_notes.sql` has already run on your local database. What do you do?

- [ ] Edit 0001_notes.sql and run the migrations again
  Not quite. It already ran, so it won't run again: your database and your file would disagree.
- [x] Add 0002_add_column.sql and apply it
  Right. Each migration runs once, in order, so every copy of the database ends up the same.
- [ ] Change the table in packages/db/src/index.ts only
  Not quite. That only changes what TypeScript believes. The database itself wouldn't change.
:::

Commit. Your code matches tag `b-05`
([changes from b-04](https://github.com/ryanyogan/klippy/compare/b-04...b-05)).

:::rabbithole
- read "D1: get started" by="Cloudflare" url="https://developers.cloudflare.com/d1/get-started/"
- read "D1 migrations" by="Cloudflare" url="https://developers.cloudflare.com/d1/reference/migrations/"
- read "data-table" by="Remix" url="https://github.com/remix-run/remix/tree/main/packages/data-table"
:::
