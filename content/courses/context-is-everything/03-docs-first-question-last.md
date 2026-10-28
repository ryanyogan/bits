---
# sources (checked 2026-10-27):
# - Anthropic, Prompting best practices > Long context prompting (for 20k+ token inputs: put
#   long documents at the top, above the query, instructions and examples; queries at the end
#   improved response quality by up to 30% in Anthropic's tests, especially with complex,
#   multidocument inputs; wrap each document in <document> tags with <document_content> and
#   <source> subtags; ask Claude to quote the relevant parts first)
#   https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices#long-context-prompting
# - Anthropic, Messages API (TypeScript SDK: client.messages.create with model, max_tokens,
#   messages), via the claude-api skill
# Toy: both answers are illustrative.
title: "Docs first, question last"
order: 3
minutes: 7
xp: 50
module: Packing it
---

Once you've picked what goes in, **where** you put it matters. Anthropic's
guidance for long inputs (think 20,000 tokens and up) comes down to three
habits.

**Documents at the top, question at the bottom.** Put the long material
first, then your instructions and the question last. In Anthropic's tests,
ending with the query improved answers by **up to 30%**, most of all with
several complex documents.

**Wrap each document in tags, with its metadata.** A `<document>` holding a
`<source>` (and any other metadata, such as a date) plus a
`<document_content>`. Now Claude can tell where one file ends and the next
begins, and can say which one it's quoting.

**Ask for quotes first.** Have Claude pull out the relevant lines before it
answers. It has to find the evidence before reasoning from it, and you can
check the quotes against the source.

:::compare{left="Question first, raw paste" right="Docs first, tagged, question last" illustrative}
- prompt "Two supplier contracts, about 40 pages each, and one question: which has the longer notice period?"
- left "The notice period is 30 days, after which either party may terminate the agreement."
- right "<quotes>acme.pdf: “either party may end this agreement with 30 days' notice”. globex.pdf: “termination requires 90 days' written notice”.</quotes> Globex has the longer notice period: 90 days, against Acme's 30."
:::

On the left, Claude answered about one contract and never noticed there
were two. On the right, the tags told it there were two sources, and the
quotes show its working.

---

Tags are cheap. Here's a `<source>` line cut into tokens (illustrative ids):
a handful of tokens to label a document that might be thousands long.

:::tokenizer{sample="<source>acme.pdf</source>" illustrative}
"<"       27
"source"  2484
">"       29
"ac"      582
"me"      1326
".pdf"    16378
"</"      524
"source"  2484
">"       29
:::

In code, the layout looks like this. The documents go in first, the
instructions and question last.

:::code{file="ask.ts" lang="ts" copy highlight="9-14"}
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

type Doc = { source: string; text: string };

export async function ask(docs: Doc[], question: string) {
  const documents = docs
    .map((doc, i) => `<document index="${i + 1}">
<source>${doc.source}</source>
<document_content>
${doc.text}
</document_content>
</document>`)
    .join("\n");

  return client.messages.create({
    model: "claude-haiku-5-5",
    max_tokens: 1024,
    messages: [{
      role: "user",
      content: `<documents>\n${documents}\n</documents>

Quote the lines that answer the question in <quotes> tags, then answer.
If the documents don't say, reply "Not in the documents."

Question: ${question}`,
    }],
  });
}
:::

Your turn, at a small scale. The draft below asks first and pastes the policy
after. Rebuild it: the policy inside `<document>` with a `<source>`, then ask
for a quote, then the question **last**. The checks can see your tags and the
quote request, but not the order, so the order is on you.

:::prompt{id="pack-a-doc" xp=30}
Wrap the policy in tags, ask for a quote, put the question last

- placeholder "<document><source>…</source><document_content>…</document_content></document> Quote … then answer: …?"
- draft "What's the refund window? Here's our policy: Refunds are accepted within 30 days of delivery for unused items. Sale items are final. Gift cards can't be refunded."
- check "Keeps the policy"           /30 days/i
- check "Wraps it in a document tag" /<document/i
- check "Names the source"           /<source>/i
- check "Asks for a quote"           /quot/i
- check "Asks the question"          /\?/
- run temperature=[1.0]
- example T=1.0 "<quotes>“Refunds are accepted within 30 days of delivery for unused items.”</quotes> The refund window is 30 days from delivery, for unused items. Sale items and gift cards can't be refunded."
- example T=1.0 "Quote: “Refunds are accepted within 30 days of delivery for unused items.” So you have 30 days after delivery, as long as the item is unused."
- example T=1.0 "<quotes>“within 30 days of delivery for unused items”</quotes> 30 days from delivery, unused items only."
- success "Docs first, question last, evidence before answers." next="Next: when the chat gets long →"
:::

:::rabbithole
- read "Long context prompting" by="Anthropic" url="https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices#long-context-prompting"
- video "AI prompt engineering: A deep dive" by="Anthropic" mins=77 deep url="https://www.youtube.com/watch?v=T9aRN5JkmL8"
:::
