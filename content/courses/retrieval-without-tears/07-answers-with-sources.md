---
# sources (checked 2026-10-27):
# - Anthropic, Search results (search_result content blocks with source, title, content[] and
#   citations.enabled; responses carry search_result_location citations with source, title,
#   cited_text and block indices; Claude cites whole text blocks; return a plain text block
#   when a search finds nothing; all active models support it)
#   https://platform.claude.com/docs/en/build-with-claude/search-results
# - Anthropic, Citations (document blocks with citations; cited_text doesn't count toward
#   output tokens; pointers are guaranteed valid; citations and structured outputs together
#   return a 400)
#   https://platform.claude.com/docs/en/build-with-claude/citations
# - Anthropic, Prompting best practices, "Long context prompting" (put documents at the top
#   and the question at the end: up to 30% better in tests; ground answers in quotes)
#   https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices
# - bits app/runs/model.ts (the sandbox sends one plain user message, so the exercise uses
#   prompt-based citations)
# The terminal output is example output, not a live run.
title: "Answers with sources"
order: 7
minutes: 8
xp: 50
module: Answering with sources
---

You've found the right chunks. Now hand them to Claude so that its answer
**sticks to them**, and so you can show the reader where each claim came
from.

Claude's API has a block made for this: the **search result**. Each one
carries a `source` (a URL or any id), a `title` and the text. Turn on
`citations`, and Claude's reply comes back split into pieces, each pointing at
the result it used. No special prompting needed.

:::code{file="answer.ts" lang="ts" copy highlight="14-20"}
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

type Hit = { source: string; title: string; text: string };

export async function answer(question: string, hits: Hit[]) {
  const res = await client.messages.create({
    model: "claude-haiku-5-5",
    max_tokens: 1024,
    messages: [{
      role: "user",
      content: [
        ...hits.map((hit) => ({
          type: "search_result" as const,
          source: hit.source,
          title: hit.title,
          content: [{ type: "text" as const, text: hit.text }],
          citations: { enabled: true },
        })),
        { type: "text" as const, text: `Answer using only these search results. If they don't contain the answer, say so.\n\nQuestion: ${question}` },
      ],
    }],
  });

  const sources = new Set<string>();
  for (const block of res.content) {
    if (block.type !== "text") continue;
    process.stdout.write(block.text);
    for (const cite of block.citations ?? []) {
      if (cite.type === "search_result_location") sources.add(`${cite.title} (${cite.source})`);
    }
  }
  console.log(`\n\nSources:\n${[...sources].join("\n")}`);
}
:::

Example output (yours will be worded differently):

:::terminal{cmd='npx tsx ask.ts "Can I claim on an 18-month-old battery?"' summary="example output, not a live run"}
Yes. E-bike batteries have a 2-year warranty from delivery, so an 18-month-old battery is covered if its capacity has dropped below 70%. File the claim within 30 days of noticing the fault.
[ion]Sources:
[quiet]Warranty guide: batteries (https://docs.orbitbikes.example/warranty#batteries)
[quiet]Warranty guide: claims (https://docs.orbitbikes.example/warranty#claims)
:::

---

Each citation includes `cited_text`, the exact passage Claude relied on, so
you can show it on hover or link to it. Three things worth knowing, from
Anthropic's docs. The pointers are **guaranteed** to point at text you sent.
`cited_text` **doesn't count** toward output tokens. And citations
**can't be combined** with structured outputs (JSON mode): the request fails
with a 400.

Two habits from Anthropic's long-context advice. Put the results **first**
and the question **last**; that order scored up to 30% better in their
tests. And tell Claude what to do when the results **don't** answer the
question. Retrieval sometimes misses, and “I couldn't find that” beats a
confident guess.

:::quiz{id="citations-json" xp=10}
You want Claude's answer as JSON via structured outputs, **with** API citations on your search results. What happens?

- [ ] You get JSON with a citations field
  Not quite. Citations interleave with the text, which doesn't fit a strict schema.
- [x] The API returns a 400 error
  Right. The two features don't combine. Pick one, or ask for citations in the text instead.
- [ ] Citations are silently dropped
  Not quite. The API refuses the request so you notice.
:::

Your turn, the low-tech version. This sandbox sends Claude plain text, so
you'll ask for citations in the prompt itself, the way you would with any
model. The passages and a question are in the box. Tell Claude to answer
**only** from them, cite each claim like `[1]`, and say so if they don't
cover something. The question asks two things, and the passages only answer
one.

:::prompt{id="cite-the-passages" xp=40}
Answer from numbered passages, cite them, and admit the gap

- placeholder "…passages… Answer using only the passages. Cite each claim like [1]. If they don't cover something, say so."
- draft "[1] E-bike batteries have a 2-year warranty from delivery, covering capacity below 70%. [2] Claims must be filed within 30 days of noticing the fault. [3] Frames have a lifetime warranty for the first owner. Question: My battery is 18 months old and fading. Can I claim, and do you ship replacements to Canada?"
- check "Limits Claude to the passages"   /\bonly\b|based on|according to|nothing else|solely|strictly/i
- check "Asks for citations"              /\bcite|citation|\bsources?\b|reference/i
- check "Says what to do when it's missing" /don.t (know|cover|say|mention)|not (in|covered|mentioned)|isn.t (in|covered)|say so|admit|can.t find|cannot find/i
- run temperature=[1.0]
- example T=1.0 "Yes, you can likely claim: batteries have a 2-year warranty from delivery and cover capacity below 70% [1], so file within 30 days of noticing the fault [2]. The passages don't say whether you ship replacements to Canada."
- example T=1.0 "Your 18-month-old battery is within the 2-year warranty if its capacity is below 70% [1]. Claim within 30 days of noticing it [2]. Shipping to Canada isn't covered in these passages, so I can't answer that part."
- success "Grounded, cited, and honest about the gap." next="Next: measuring retrieval →"
:::

:::rabbithole
- read "Search results" by="Anthropic" url="https://platform.claude.com/docs/en/build-with-claude/search-results"
- read "Citations" by="Anthropic" url="https://platform.claude.com/docs/en/build-with-claude/citations"
- read "Prompting best practices: long context" by="Anthropic" url="https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices"
:::
