---
title: Lists and fences
order: 1
minutes: 6
xp: 10
---

A shared turn. A lesson's prose can hold **lists**, `###` subheadings and
static code samples:

- a bulleted item with `code` and a [link](/courses/prose)
- an item with a nested list:
  - one level deep is enough
  - ==marks== work here too
- a last item

1. Ordered lists count.
2. They can hold **strong** text.

### A subheading

It starts a new tutor turn. A bare fence is a read-only sample:

```ts
const reply = await client.messages.create({ model, max_tokens: 256, messages })
```

:::new
In plain words, three things matter:

3. lists can start anywhere,
4. and keep counting.

```
plain text, no language
```
:::

:::engineer
The engineer depth has its own list and sample, and needs no `::::` fence:

- items hold inline markdown
- one nested list per item

```sh
curl https://api.anthropic.com/v1/messages -H "x-api-key: $ANTHROPIC_API_KEY"
```
:::

The closing turn is shared again.
