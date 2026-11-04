---
# sources (checked 2026-11-03):
# - Installed remix 3.1.0 docs: guides 08 (data and validation) and 09 (forms and mutations: redirect 303 after a
#   POST), the data-table and data-schema READMEs
# - Klippy d-06 → d-07, docs/outputs/d-07.txt (2026-11-03). The code was written by an agent against the prompt, not
#   recorded from a fresh run; the checks are real (signed in with a local-only test cookie; three seeded notes with
#   made-up dates).
title: "Your notes, as pages"
order: 7
minutes: 20
xp: 70
module: Build the app
device: desk
tag: d-06
verified: 2026-11-03
versions:
  remix: "3.1.0"
  wrangler: "4.157.0"
---

Klippy saves notes from the chat. This lesson gives them a page: list,
search and delete, with plain HTML forms and no browser JavaScript. It
reads the **same** D1 table the agent writes, through the same query layer.

### 1. The prompt

You practised this one in lesson 4. Fresh session, plan mode:

```text
Goal: add a Notes page that lists, searches and deletes the notes Klippy saves, so I can tidy them without the chat.
Use the remix skill: read guides 08 (data and validation) and 09 (forms and mutations), and the data-table and
data-schema READMEs first.
Constraints:
- Same D1 database and the same `notes` table as the agent: import it from @klippy/db, query with remix/data-table
  through the data-table-d1 driver. No raw SQL strings, no new tables.
- Native forms: search is a GET form with ?q (at most 100 characters), delete is a POST form per note that
  redirects with 303. Validate q and the id with remix/data-schema.
- Signed-in only (the d-06 requireUser). Touch only apps/web/**.
Plan first, then wait for my go-ahead.
Done when typecheck and remix doctor pass, signed-out /notes redirects to /login, and a cross-site delete gets 403.
Report the files and outputs.
```

- **One table, one definition.** Importing it from `@klippy/db` means the
  agent and the page can't drift apart.
- **GET to search, POST to delete.** A link that deletes can be followed
  by a prefetcher or a crawler. A 303 after the POST means a refresh
  doesn't delete again.

### 2. What to expect

New: `app/db.ts` and `app/actions/notes/` (controller, schema, page).
Changed: routes, router, the layout's nav, `wrangler.jsonc` (the same
`klippy-db`, same id) and `package.json`.

:::code{file="apps/web/app/actions/notes/controller.tsx" lang="ts" tag="d-07" highlight="8-12" label="apps/web/app/actions/notes/controller.tsx"}
export default createController(routes.notes, {
	middleware: [requireUser],
	actions: {
		async index(context) {
			const query = parseSafe(NotesQuery, context.url.searchParams);
			if (!query.success) return new Response('Search is at most 100 characters.', { status: 400 });
			const { q, deleted } = query.value;
			const rows = await database().findMany(notes, {
				where: q ? like('body', `%${q}%`) : undefined,
				orderBy: ['id', 'desc'],
				limit: 50,
			});
			return context.render(<NotesPage user={context.auth.identity} notes={rows} q={q} deleted={deleted === '1'} />);
		},
		async destroy(context) {
			const id = parseSafe(NoteId, context.params.id);
			if (!id.success) return new Response('No such note.', { status: 404 });
			await database().delete(notes, id.value);
			// 303: the browser follows with a GET, so a refresh doesn't post again.
			return redirect(`${routes.notes.index.href()}?deleted=1`, 303);
		},
	},
});
:::

- Every input is parsed with `data-schema` first. Bad input is a 4xx,
  never a 500.
- `like('body', …)` binds the value. A typed `%` only widens the search;
  it never becomes SQL.

Our run (real; signed in with a test cookie made locally from our
`.dev.vars`, and three seeded notes):

:::terminal{cmd="curl -s -b jar 'localhost:8802/notes?q=sam'"}
<ul class="notes"><li><p>Call Sam about the trip<time …>Mon, 03 Nov 2025 22:46:40 GMT</time></p><form method="post" action="/notes/2/delete"><button type="submit" [volt]aria-label="Delete note: Call Sam about the trip"[text] class="danger">Delete</button></form></li></ul>
:::

Also checked: no match says `No notes match "zebra".`; a 101-character
search is a 400; a bad id is a 404; a cross-site delete is a 403; a
signed-out delete goes to `/login`; a delete answers `303` to
`/notes?deleted=1`, which shows "Note deleted." in a status line.

**Privacy, again.** Notes have no owner column. The allowlist from lesson 6
is what keeps them yours.

### 3. Review it

- The table comes from `@klippy/db`, not redefined. The D1 `database_id`
  matches the agent's `wrangler.jsonc`.
- Every input goes through `data-schema` before use.
- Delete is POST + 303. No GET deletes anything.
- Each Delete button's name says which note.
- **Reject**: string-built SQL (`"… LIKE '%" + q + "%'"`), a second copy of
  the notes table, browser JavaScript for this page.

Steer prompts:

```text
You built the search SQL by joining strings. Use like('body', `%${q}%`) from remix/data-table so the value is bound.
```

```text
Delete is a link (GET). Make it a POST form, and redirect with 303 after deleting.
```

```text
You redefined the notes table in apps/web. Import it from @klippy/db so both Workers share one definition.
```

:::quiz{id="delete-is-post" xp=20}
Why is Delete a POST form that answers 303, not a link?

- [ ] Links can't carry an id
  Not quite. `/notes/3/delete` carries one fine.
- [x] A GET can be followed by a prefetcher or crawler, and the 303 means a refresh doesn't post again
  Right. Changes go in POSTs, and the redirect turns the result into a safe GET.
- [ ] POST is faster
  Not quite. Speed isn't the reason.
:::

Your repo matches tag `d-07`
([changes from d-06](https://github.com/ryanyogan/klippy/compare/d-06...d-07)).
