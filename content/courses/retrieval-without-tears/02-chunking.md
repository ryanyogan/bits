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
minutes: 7
xp: 40
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

:::quiz{id="chunk-size" xp=20}
Your chunks are whole 20-page chapters. What's the most likely symptom?

- [ ] Search finds nothing at all
  Not quite. Big chunks still match. They just match vaguely.
- [x] The right chapter comes back, but Claude gets far more text than it needs
  Right. A big chunk dilutes the match and floods the prompt. Smaller chunks give sharper hits and leaner prompts.
- [ ] Claude refuses to read chunks that long
  Not quite. 20 pages fits in the context window. The cost is precision, not a hard limit.
:::

:::rabbithole
- read "Introducing Contextual Retrieval" by="Anthropic" url="https://www.anthropic.com/engineering/contextual-retrieval"
- read "Retrieval augmented generation (cookbook)" by="Anthropic" deep url="https://platform.claude.com/cookbook/capabilities-retrieval-augmented-generation-guide"
:::
