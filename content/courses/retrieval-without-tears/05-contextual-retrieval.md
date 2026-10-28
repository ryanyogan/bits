---
# sources (checked 2026-10-27):
# - Anthropic, Introducing Contextual Retrieval (2024-09-19): prepend 50–100 tokens of
#   chunk-specific context, written by Claude from the whole document, before embedding and
#   before BM25 indexing; prompt caching keeps the document cached across a document's chunks;
#   top-20 retrieval failure rate 5.7% -> 3.7% (contextual embeddings, -35%) -> 2.9% (plus
#   contextual BM25, -49%), measured with Claude 3 Haiku as the contextualiser; generic
#   document summaries gave "very limited gains"
#   https://www.anthropic.com/engineering/contextual-retrieval
# - Anthropic, Enhancing RAG with contextual retrieval (cookbook)
#   https://platform.claude.com/cookbook/capabilities-contextual-embeddings-guide
# - Anthropic, Prompt caching (cache_control on a content block; minimum cacheable prompt is
#   512 tokens on Claude Haiku 5.5; cache hits cost 0.1x base input on Haiku 5.5)
#   https://platform.claude.com/docs/en/build-with-claude/prompt-caching
# The prompt below is our own wording of the idea, not Anthropic's prompt.
title: "Contextual retrieval"
order: 5
minutes: 8
xp: 50
module: Finding the right bits
---

Remember the lonely chunk from lesson 2: “Claims must be filed within 30
days of noticing the fault.” It's the right answer to “how long do I have to
claim on my e-bike battery?”, but it never mentions batteries, warranties or
e-bikes. Both search methods struggle to find it.

**Contextual retrieval** is Anthropic's fix, and it's simple. Before you
index a chunk, ask Claude to write a sentence or two that **places the chunk
in its document**. Glue that context to the front of the chunk, then embed
it and add it to the keyword index as usual.

:::compare{left="Plain chunk" right="Contextual chunk" illustrative}
- left "Claims must be filed within 30 days of noticing the fault, with the order number and a photo of the battery label."
- right "From Orbit Bikes' 2026 warranty guide, in the section on e-bike battery warranty claims. Claims must be filed within 30 days of noticing the fault, with the order number and a photo of the battery label."
:::

Now “battery”, “warranty” and “e-bike” are all in the chunk, for both
embeddings and keywords to find.

---

**Does it help?** In Anthropic's tests (published September 2024, across
code, fiction and papers), the share of questions where the right chunk
missed the top 20 fell from **5.7% to 3.7%** with contextual embeddings, and
to **2.9%** with contextual embeddings plus contextual BM25. That's about half
the misses gone. A reranker cut it further, to 1.9%; that's next lesson.
Those numbers came from Anthropic's data and models of the time, so measure
on yours (lesson 8 shows how).

It costs one Claude call per chunk, once, at index time. **Prompt caching**
keeps that cheap: the whole document goes first and is cached, so each
chunk's call re-reads it from the cache at a tenth of the input price.
(Caching only kicks in above a minimum length, 512 tokens on Haiku 5.5.)

:::code{file="contextualize.ts" lang="ts" copy highlight="15-16" label="document first, cached"}
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

// Write a short context for one chunk, using the whole document.
// Call it for every chunk of a document, one after another: the first
// call writes the document to the cache, the rest read it.
export async function contextualize(doc: string, chunk: string) {
  const res = await client.messages.create({
    model: "claude-haiku-5-5",
    max_tokens: 200,
    messages: [{
      role: "user",
      content: [
        { type: "text", text: `<document>\n${doc}\n</document>`, cache_control: { type: "ephemeral" } },
        { type: "text", text: `Here is one chunk of that document:\n<chunk>\n${chunk}\n</chunk>\nIn one or two sentences, say where this chunk sits in the document and what it's about, so a search can find it. Reply with only those sentences.` },
      ],
    }],
  });
  const block = res.content.find((b) => b.type === "text");
  const context = block?.type === "text" ? block.text.trim() : "";
  return `${context}\n\n${chunk}`; // embed and keyword-index this
}
:::

Keep the original chunk too. When you hand results to Claude later, you can
show the context and the chunk separately so it knows which is which.

:::quiz{id="why-context-helps" xp=10}
Anthropic also tried adding one **generic summary of the whole document** to every chunk. Why would that help less than a context written for each chunk?

- [ ] Summaries are too short to embed
  Not quite. Length isn't the problem.
- [x] Every chunk gets the same summary, so it can't tell them apart
  Right. A per-chunk context says where **this** chunk sits and what it covers, which is what search needs. Anthropic saw very limited gains from generic summaries.
- [ ] Claude can't summarise long documents
  Not quite. It can. The issue is that one summary doesn't describe each chunk.
:::

Your turn. The document and the lonely chunk are in the box. Write the
instruction that makes Claude produce the context: say what it's for
(search), keep it short, and ask for **only** the context, with no
preamble. Run it a few times and check that the batteries and warranty make
it in.

:::prompt{id="contextualize-chunk" xp=40}
Write the prompt that situates a chunk in its document

- placeholder "…document and chunk… Write a short context that places this chunk in the document, to help search find it. Reply with only…"
- draft "<document> Orbit Bikes warranty guide (2026). Frames: lifetime warranty for the first owner. E-bike batteries: 2-year warranty from delivery, covering capacity below 70%. Claims must be filed within 30 days of noticing the fault, with the order number and a photo of the battery label. </document> <chunk> Claims must be filed within 30 days of noticing the fault, with the order number and a photo of the battery label. </chunk>"
- check "Includes the document and chunk" /<document>/i
- check "Includes the document and chunk" /<chunk>/i
- check "Asks for context"                /context|situate|where (this|the) chunk|place/i
- check "Says it's for search"            /search|retriev|find/i
- check "Keeps it short"                  /\bwords?\b|\bsentences?\b|\bshort\b|\bbrief\b|\bsuccinct\b|\bconcise\b|\bunder\b/i
- check "Asks for only the context"       /\bonly\b|nothing else|no preamble|just the/i
- run temperature=[1.0]
- example T=1.0 "From Orbit Bikes' 2026 warranty guide: how to file a claim under the 2-year e-bike battery warranty."
- example T=1.0 "This chunk is from the e-bike battery warranty section of Orbit Bikes' 2026 warranty guide and explains the claim deadline and what to include."
- example T=1.0 "Orbit Bikes warranty guide (2026), battery warranty claims: the deadline and documents needed to claim on an e-bike battery."
- success "That context is what makes the lonely chunk findable." next="Next: reranking →"
:::

:::rabbithole
- read "Introducing Contextual Retrieval" by="Anthropic" url="https://www.anthropic.com/engineering/contextual-retrieval"
- read "Enhancing RAG with contextual retrieval (cookbook)" by="Anthropic" deep url="https://platform.claude.com/cookbook/capabilities-contextual-embeddings-guide"
- read "Prompt caching" by="Anthropic" url="https://platform.claude.com/docs/en/build-with-claude/prompt-caching"
:::
