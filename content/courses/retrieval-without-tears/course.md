---
title: "Retrieval without tears"
track: tools
level: intermediate
order: 6
summary: "Search your own docs, hand the best bits to the model, and cite where they came from."
outcomes:
  - "Decide when to paste everything into the prompt and when to search instead."
  - "Chunk documents and find the right passages with embeddings, keywords and a reranker."
  - "Hand passages to Claude as search results and get answers back with citations."
  - "Measure retrieval with recall@k on a handful of real questions."
cover:
  pattern: dots-offset
  sigil: "RAG"
  tone: synapse
badge:
  name: "Retrieval without tears"
  glyph: "RAG"
exercise: "make Claude answer only from the passages you give it, cite each one, and say so when the answer isn't there."
---

Claude knows a lot, but not your docs. You'll learn when to just paste them
in, and when to search instead: chunking, embeddings, keyword search,
contextual retrieval, reranking and citations. Then you'll measure it and
build a tiny "ask my docs" pipeline in TypeScript.
