---
title: "Ship it"
order: 1
minutes: 5
xp: 40
---

Deploy your Worker, then let bits check it. bits calls one path on your
`workers.dev` address from its own server and checks the reply.

:::verify{id="optional-root" path="/" xp=0 gate=false}
- goal "Your Worker's root answers with a short hello"
- expect "Short" words<=20
:::

The check that counts calls `/health`. The last deploy check in a course is
the one a certificate links.

:::verify{id="health" path="/health" xp=30}
Paste the https://….workers.dev URL that `wrangler deploy` printed.
- goal "Your Worker answers /health with JSON that says it's ok"
- expect "Says ok" json keys=ok,app types=ok:boolean
- expect "Names the app" match /"app"\s?:\s?"klippy"/
- hint "Return Response.json({ ok: true, app: 'klippy' }) from your /health route, then run wrangler deploy."
- hint for="Names the app" "Set app to \"klippy\" in the JSON your /health route returns."
:::

A pass proves a Worker at that address answers the way the lesson asks. It
doesn't prove who wrote it.
