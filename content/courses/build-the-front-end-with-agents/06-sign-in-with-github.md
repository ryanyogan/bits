---
# sources (checked 2026-11-03):
# - Installed remix 3.1.0 docs: guide 10 (auth), and the auth, auth-middleware, session and cookie READMEs
#   (@remix-run/auth 1.0.0: createGitHubAuthProvider adds PKCE and a state value)
# - GitHub docs, Creating an OAuth app https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/creating-an-oauth-app
# - Klippy d-05 → d-06, docs/outputs/d-06.txt (2026-11-03). The code was written by an agent against the prompt, not
#   recorded from a fresh run; the checks are real, up to GitHub's door. The live GitHub round trip is not recorded
#   (no OAuth app was created for the recording); the lesson says so.
title: "Sign in with GitHub"
order: 6
minutes: 30
xp: 90
module: Build the app
device: desk
tag: d-05
verified: 2026-11-03
versions:
  remix: "3.1.0"
  wrangler: "4.157.0"
---

Each person gets their own Klippy, named after them. That name must come
from the **server**, from who's signed in, never from the browser: a name
the browser chose is a name anyone could change. This lesson adds GitHub
sign-in with Remix's own auth, and an allowlist so only you get in.

### 1. The prompt

Fresh session, plan mode:

```text
Goal: add GitHub sign-in so each person gets their own Klippy, chosen on the server from their GitHub id.
Use the remix skill. Read node_modules/remix/INDEX.md, guide 10, and the auth, auth-middleware, session and cookie
READMEs first.
Constraints:
- remix/auth's GitHub provider, remix/session with cookie storage, remix/middleware/auth, cop(). No other auth package.
- Only my GitHub account id may sign in (ALLOWED_GITHUB_IDS, not logins: those can be renamed); anyone else
  gets a 403 page and no session.
- The agent token stays on the server: add it to the service-binding call, never send it to the browser.
- Secrets in .dev.vars and `wrangler secret put` only; placeholders in .dev.vars.example. Touch only apps/web/**.
Plan first, then wait for my go-ahead.
Done when typecheck and remix doctor pass, and curl shows: / redirects to /login, /auth/github redirects to GitHub,
and a cross-site POST /logout gets 403. Report the files and the outputs.
```

- **"No other auth package"** stops a hand-written OAuth exchange. Auth is
  where home-made code goes wrong quietly.
- **The allowlist line.** Sign-in says **who** you are. The allowlist says
  whether you're **allowed**. Klippy's notes have no owner column: without
  the list, anyone with a GitHub account could sign in, spend your model
  budget and read your notes.
- **Ids, not logins.** A GitHub login can be renamed, and someone else can
  then register the old name. The numeric id never changes.

### 2. Find your GitHub id

```sh
gh api user --jq .id
```

No GitHub CLI? Open `https://api.github.com/users/<your-login>` and read
the `"id"` field. Put it in `ALLOWED_GITHUB_IDS` in your `.dev.vars`.

### 3. What to expect: the parts worth reading

New: `app/auth.ts`, `app/agent.ts`, `app/actions/auth/`, an allowlist with
a small Node test, and `.dev.vars.example`. Changed: routes, router, the
home page, the layout and `wrangler.jsonc`.

The agent's name, chosen on the server:

:::code{file="apps/web/app/auth.ts" lang="ts" tag="d-06" label="apps/web/app/auth.ts"}
// The agent instance is chosen here, on the server, from the signed-in user. The browser never names it.
export function agentName(user: User) {
	return `gh-${user.id}`;
}
:::

The token, added on the server side of the binding:

:::code{file="apps/web/app/agent.ts" lang="ts" tag="d-06" highlight="5-8" label="apps/web/app/agent.ts"}
import { env } from 'cloudflare:workers';

// Call the agent Worker through the service binding, with the agent's token. The token stays on the server:
// the browser only ever talks to this web app.
export function agentFetch(path: string, init: RequestInit = {}) {
	const headers = new Headers(init.headers);
	headers.set('Authorization', `Bearer ${env.KLIPPY_TOKEN}`);
	return env.AGENT.fetch(new URL(path, 'https://agent'), { ...init, headers });
}
:::

The agent's token check is exactly as it was. The browser never sees the
token, and never names the agent.

The allowlist is checked twice: in the callback (no session for a stranger)
and again on **every request**, so removing an id works at once:

:::code{file="apps/web/app/auth.ts" lang="ts" tag="d-06" highlight="5" label="apps/web/app/auth.ts"}
export const loadUser = auth({
	schemes: [
		createSessionAuthScheme<User, User>({
			read: (session) => (session.get('user') as User | undefined) ?? null,
			verify: (user) => (isAllowed(user.id) ? user : null),
			invalidate: (session) => session.unset('user'),
		}),
	],
});
:::

### 4. Check it, up to GitHub's door

With placeholder GitHub credentials in `.dev.vars`, our checks (real):

:::terminal{cmd="curl -si localhost:8802/auth/github | head -3"}
HTTP/1.1 302 Found
Location: https://github.com/login/oauth/authorize?client_id=placeholder-client-id&redirect_uri=http%3A%2F%2Flocalhost%3A8802%2Fauth%2Fgithub%2Fcallback&[volt]scope=read%3Auser[text]&state=…&[volt]code_challenge_method=S256[text]
Set-Cookie: __klippy=<signed>; [volt]HttpOnly[text]; Max-Age=604800; Path=/; SameSite=Lax; [volt]Secure[text]
:::

- `scope=read:user`: only who you are, not your email or repos.
- `state` and `code_challenge` (PKCE) come from `remix/auth` for free.
- The session cookie is signed, `HttpOnly` and `Secure`.

:::terminal{cmd="pnpm --filter web test"}
✔ lets in an id on the list
✔ refuses the same login with a different id (a renamed or re-registered account)
✔ refuses everyone when the list is empty or a placeholder
:::

Also checked: `/` redirects to `/login`; a callback with a wrong `state`
gets a 400 and "GitHub sign-in didn't finish"; a `POST /logout` from
another site gets 403 (`cop()`); one from this site signs you out.

**What we didn't record.** We haven't created a GitHub OAuth app for the
recording, so there's no recorded round trip through GitHub. To try it:

1. GitHub → Settings → Developer settings → OAuth Apps → New OAuth App.
   Homepage `http://localhost:8802`, callback
   `http://localhost:8802/auth/github/callback`. Copy the client id and
   make a secret.
2. Put `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` and a `SESSION_SECRET`
   (`openssl rand -hex 32`) in `apps/web/.dev.vars`.
3. `pnpm dev:web`, sign in. Expect a greeting with your name, and your
   Klippy named `gh-` plus your id. A second GitHub account should get the 403 page.

### 5. Review it

- The cookie is `httpOnly`, `secure`, `sameSite: 'lax'` and signed with
  `SESSION_SECRET`.
- `completeAuth()` runs before the user is written (a new session id), and
  logout is a POST that destroys the session.
- The agent name comes from the session, never a URL or form field.
- `KLIPPY_TOKEN` appears only in `app/agent.ts`
  (`grep -r KLIPPY_TOKEN apps/web/app`).
- The allowlist compares numeric ids. No real secret in any committed file.
- **Reject**: a hand-written token exchange with `fetch`, a session in
  `localStorage`, an allowlist checked only at sign-in, `?token=` in a
  browser URL.

Steer prompts:

```text
You wrote the GitHub token exchange by hand with fetch. Delete it and use createGitHubAuthProvider with startExternalAuth / finishExternalAuth from remix/auth, as the README shows.
```

```text
context.auth.identity doesn't typecheck in home. Move requireUser from the action to the controller's middleware, so the controller's context knows the user is signed in.
```

```text
You compared logins. A login can be renamed and re-registered by someone else: compare the numeric id instead.
```

The second one is a real snag we hit: as action middleware, `requireAuth`
didn't narrow the type; as controller middleware, it did.

:::quiz{id="agent-name-where" xp=20}
Where should the web app get the agent's name, `gh-<id>`?

- [ ] From a `?name=` in the chat's URL
  Not quite. Anyone can edit a URL and open someone else's Klippy.
- [x] From the signed-in user in the session, on the server
  Right. The browser never names the agent, so it can't name someone else's.
- [ ] From the browser's localStorage
  Not quite. The browser controls that too.
:::

Your repo matches tag `d-06`
([changes from d-05](https://github.com/ryanyogan/klippy/compare/d-05...d-06)).

:::rabbithole
- read "Creating an OAuth app" by="GitHub" url="https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/creating-an-oauth-app"
:::
