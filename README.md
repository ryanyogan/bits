# bits

Learn AI by typing to it. A free AI-learning app built with Remix 3 on
Cloudflare Workers and D1.

- Live: https://bits.ryanyogan.workers.dev
- Product spec: `docs/handoff.md`
- Design: `docs/design/`
- Decisions: `docs/decisions/`
- Working in this repo (agents and humans): `AGENTS.md`

```sh
pnpm i
pnpm db:migrate:local && pnpm db:seed:local
pnpm dev        # http://localhost:44100
pnpm test && pnpm typecheck
pnpm preview    # the real Worker under wrangler dev
pnpm deploy
```
