---
# sources (checked 2026-10-27):
# - Anthropic, Introducing Contextual Retrieval (2024-09-19): chunks "usually no more than a
#   few hundred tokens"; chunk size, boundary and overlap all affect retrieval; a chunk like
#   "revenue grew by 3%" loses which company and quarter it's about
#   https://www.anthropic.com/engineering/contextual-retrieval
# - Anthropic, Embeddings (Voyage 4 models take up to 32,000 tokens per input)
#   https://platform.claude.com/docs/en/build-with-claude/embeddings
# - Anthropic, Search results (each result carries a source and title; Claude cites whole
#   text blocks, so smaller blocks give finer citations)
#   https://platform.claude.com/docs/en/build-with-claude/search-results
# The compare toy is illustrative. The terminal output is example output, not a live run.
title: "Chunking"
order: 2
minutes: 8
xp: 60
module: Finding the right bits
---

Retrieval works on **passages**, not whole documents. Before you can search,
you cut every document into pieces called **chunks**. A search returns the
best chunks, and only those go to Claude.

Why not search whole documents? A 40-page manual is about everything at
once, so it matches every question a little and none of them well. And if it
wins, you're back to pasting 40 pages. Anthropic's guide puts typical chunks
at **a few hundred tokens**. Embedding models can take much more (Voyage's
current models take 32,000 tokens per input), so the limit isn't the model.
It's how precise you want each match to be.

---

**Where you cut matters as much as how big.** Here's the same warranty page
split two ways:

:::compare{left="Every 120 characters" right="On paragraphs" illustrative}
- prompt "Orbit Bikes warranty page, split into chunks"
- left "Chunk 1: “E-bike batteries have a 2-year warranty from delivery. It covers capacity below 70%. Claims must be fil”\nChunk 2: “ed within 30 days of noticing the fault. Frames have a lifetime warranty for the first owne”"
- right "Chunk 1: “E-bike batteries have a 2-year warranty from delivery. It covers capacity below 70%. Claims must be filed within 30 days of noticing the fault.”\nChunk 2: “Frames have a lifetime warranty for the first owner.”"
:::

Fixed-size cuts slice through words and mix topics. Cutting on the
document's own structure (headings, then paragraphs) keeps each idea in one
piece.

Three habits that pay off. **Cut on structure**, and only pack small
paragraphs together until you hit a size limit. **Overlap a little**: repeat
the last paragraph at the start of the next chunk, so an idea that spans a
boundary survives in at least one of them. **Keep metadata**: store the
source, title and heading with every chunk. You'll need them to cite sources
in lesson 7.

Here's a paragraph chunker with one paragraph of overlap. It measures size in
characters, which is close enough for chunking:

:::code{file="chunk.ts" lang="ts" copy highlight="10-17" label="the packing loop"}
export type Chunk = { id: string; source: string; text: string };

// Pack paragraphs into chunks of up to maxChars, repeating the last
// paragraph of a multi-paragraph chunk at the start of the next one.
export function chunk(source: string, text: string, maxChars = 1500): Chunk[] {
  const paragraphs = text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  const chunks: Chunk[] = [];
  let current: string[] = [];

  for (const p of paragraphs) {
    const size = current.join("\n\n").length + p.length;
    if (current.length > 0 && size > maxChars) {
      chunks.push({ id: `${source}#${chunks.length}`, source, text: current.join("\n\n") });
      current = current.length > 1 ? [current[current.length - 1]!] : [];
    }
    current.push(p);
  }
  if (current.length > 0) {
    chunks.push({ id: `${source}#${chunks.length}`, source, text: current.join("\n\n") });
  }
  return chunks;
}
:::

Example output from running it on a short warranty page (yours will differ):

:::terminal{cmd="npx tsx try-chunk.ts warranty.md" summary="example output, not a live run"}
[ion]warranty.md#0[quiet] 412 chars · E-bike batteries have a 2-year warranty…
[ion]warranty.md#1[quiet] 655 chars · Claims must be filed within 30 days…
[ion]warranty.md#2[quiet] 388 chars · Frames have a lifetime warranty…
:::

In production the code above does the cutting. To see where the cuts
belong, have Claude do it once by hand. Here's a short warranty page:

```text
# Orbit Bikes warranty
## Batteries
E-bike batteries have a 2-year warranty from delivery. It covers capacity below 70%.
## Claims
Claims must be filed within 30 days of noticing the fault. Send the order number and a photo of the battery label.
## Frames
Frames have a lifetime warranty for the first owner.
```

Paste it and ask Claude to split it on its structure, as JSON, with each
chunk keeping the heading it came from.

:::prompt{id="chunk-on-structure" xp=20 coach}
Get Claude to chunk a page on its headings, keeping the metadata
- goal "Get Claude to split the warranty page into chunks on its own structure, as JSON, each chunk carrying its heading"
- placeholder "Split this page into chunks for search, one per section. Reply with only a JSON array of {\"heading\": …, \"text\": …}. Page: …"
- draft "Chunk this for me."
- check "Pastes the page" /batteries/i
- check "Pastes the page" /claims/i
- check "Pastes the page" /lifetime/i
- check "Asks to split it" /chunk|split|break/i
- check "Keeps the heading with each chunk" /heading|section|metadata|title|source/i
- expect "Parses as JSON" json
- expect "Keeps the frames line" match /lifetime/i
- rubric "Cuts only on the page's sections: no chunk splits a sentence or mixes two sections" must evidence
- rubric "Each chunk carries the heading of the section it came from" must evidence
- rubric "Keeps the page's words instead of rewriting them" should
- hint "Claude can only cut a page it can see. Is the page itself in your prompt?"
- hint "Say where to cut. The page already has its own boundaries."
- hint "Ask for one chunk per ## section, as a JSON array of objects with heading and text, and the text copied as written."
- reference "Split this page into chunks for a search index. Cut only at the ## headings, one chunk per section, and copy the text exactly as written. Reply with only a JSON array of objects with \"heading\" and \"text\".\n\n# Orbit Bikes warranty\n## Batteries\nE-bike batteries have a 2-year warranty from delivery. It covers capacity below 70%.\n## Claims\nClaims must be filed within 30 days of noticing the fault. Send the order number and a photo of the battery label.\n## Frames\nFrames have a lifetime warranty for the first owner."
- run temperature=[1.0]
- example T=1.0 "[\n  { \"heading\": \"Batteries\", \"text\": \"E-bike batteries have a 2-year warranty from delivery. It covers capacity below 70%.\" },\n  { \"heading\": \"Claims\", \"text\": \"Claims must be filed within 30 days of noticing the fault. Send the order number and a photo of the battery label.\" },\n  { \"heading\": \"Frames\", \"text\": \"Frames have a lifetime warranty for the first owner.\" }\n]"
- success "Cut where the author did, and keep the label on every piece." next="Next: embeddings and similarity →"
:::

Notice that a chunk can still lose its meaning on its own. Lesson 5 fixes
that.

:::quiz{id="lonely-chunk" xp=20}
A chunk reads: “Claims must be filed within 30 days of noticing the fault.” Why might search miss it for “how long do I have to claim on my e-bike battery?”

- [ ] It's too long
  Not quite. It's one sentence, which is short.
- [x] It never says what the claim is for
  Right. Nothing in it mentions batteries or warranties, so a search for those words has little to match.
- [ ] Search can't read numbers
  Not quite. Both embeddings and keyword search handle “30 days” fine.
:::

:::rabbithole
- read "Introducing Contextual Retrieval" by="Anthropic" url="https://www.anthropic.com/engineering/contextual-retrieval"
- read "Retrieval augmented generation (cookbook)" by="Anthropic" deep url="https://platform.claude.com/cookbook/capabilities-retrieval-augmented-generation-guide"
:::
