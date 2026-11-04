---
title: "Retrieval without tears"
track: tools
level: intermediate
order: 90
repo: https://github.com/ryanyogan/klippy
summary: "Give Klippy your notes, links and files: ingest them in a Workflow, search them two ways, and answer with citations."
outcomes:
  - "Decide when to paste everything into the prompt and when to search instead."
  - "Ingest links and files in a durable Workflow: Markdown, chunks, context and vectors."
  - "Find the right passages with Vectorize, FTS5 keywords, reciprocal rank fusion and a reranker."
  - "Answer only from what was found, cite it, and lock writing tools once saved content is read."
  - "Measure retrieval with recall@k, safely, on an index of its own."
cover:
  pattern: dots-offset
  sigil: "RAG"
  tone: synapse
badge:
  name: "Retrieval without tears"
  glyph: "RAG"
exercise: "make Claude answer only from the passages you give it, cite each one, and say so when the answer isn't there."
---

Klippy can save notes, but it can't answer from them. In this course it
learns to. You'll start with the simplest option (paste everything), then
build the real pipeline on Klippy from course D: a Workflow that ingests
links and files, chunks with context, vectors in Vectorize, keyword search
in D1, a reranker, and answers that cite their sources. Then you'll measure
it, and ship it.
