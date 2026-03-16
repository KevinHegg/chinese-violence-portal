# Building an Archive Chatbot with Deterministic Search and LLM Interpretation

This document describes the architecture that powers the **Ask the Archive** assistant for the [John Crow Project](https://johncrow.org), which helps users explore anti-Chinese violence in the United States (1848–1924). The goal is to provide **grounded answers**, **deterministic archive links**, and **interpretive synthesis** using curated scholarship—without allowing the model to hallucinate archive records. The design is intended to be transparent and reproducible so other digital archives can adapt it.

---

## Design Goals

- **Archive facts must come from structured data.** Every record ID, date, location, and URL cited in an answer is retrieved from a deterministic search over the project’s own data.

- **The LLM must never invent archive records.** The model cannot fabricate event IDs, article IDs, or johncrow.org URLs. It can only reference results returned by the `search_archive` tool.

- **Interpretive answers should draw on curated scholarship.** Broader questions about meaning, patterns, and historical significance are grounded in a primary thesis and optional secondary sources stored in vector stores and retrieved via `file_search`.

- **The system should be transparent and reproducible.** Architecture, data flow, and prompt strategy are documented so others can inspect and reuse the approach.

- **The architecture should be usable by other archives.** The same pattern—deterministic search + vector-store interpretation + strict grounding rules—can be applied to other digital collections.

---

## Architecture Overview

```
Browser
  ↓
Netlify Function (chat-response.js)
  ↓
OpenAI Responses API
  ↓
Tools
  • search_archive  →  structured archive data (events + articles)
  • file_search    →  vector stores (thesis + secondary sources)
  ↓
Final grounded answer
```

The system separates three concerns:

| Concern            | Mechanism                    |
|--------------------|-----------------------------|
| **Archive truth**  | Deterministic search over JSON |
| **Interpretation** | Vector store retrieval      |
| **Synthesis**      | LLM reasoning over tool results |

The model is instructed to call `search_archive` for any claim about archive records or links, and to use `file_search` only for interpretive or contextual material. That separation is what prevents hallucinated records while still allowing rich, scholarly answers.

---

## Archive Data Layer

The archive is indexed as **structured JSON** that the chatbot never sees directly; it only sees results returned by the search tool.

**Files:**

- `data/archive-json/events.json` — one object per event (lynching, riot, expulsion, etc.)
- `data/archive-json/articles.json` — one object per newspaper article linked to events

**Event records** include (among others):

- `id` — canonical record ID (e.g. `WY1885-09-02`)
- `date`, `year`, `decade`, `state`, `location`
- `title`, `summary`, `narrative`
- `url` — canonical record URL (e.g. `https://johncrow.org/records/...`)
- `article_ids` — array of linked article IDs
- `keywords` — for search scoring

**Article records** include:

- `id` — article ID (e.g. zero-padded numeric)
- `linked_record_id` — event ID this article is tied to
- `headline`, `newspaper`, `publication_date`
- `summary`, `transcript`
- `url` — canonical article URL (e.g. `https://johncrow.org/articles/...`)
- `keywords`

A schema is defined in `data/archive-json/schema.json`. The chatbot uses these files only through the Netlify function `search_archive`, which reads the JSON and returns filtered, scored results.

---

## Deterministic Archive Search

**Purpose:** The LLM cannot invent archive records because it must retrieve them through the `search_archive` tool. Every cited event, article, and URL comes from this function.

**Main entrypoint:** `netlify/functions/search_archive.js`  
**Helper (pure search logic):** `netlify/functions/lib/archive-search.js`

The function:

1. Accepts a POST body with optional filters: `type` (events/articles), `year`, `decade`, `state`, `keywords`, `linked_record_id`, `limit`.
2. Loads `events.json` and `articles.json` from the bundled files (see Deployment).
3. Filters and scores results (e.g. keyword match in title, summary, narrative).
4. Returns a compact JSON list of results (id, type, url, summary, etc.) with no raw PII or internal fields that the model doesn’t need.

For “articles related to event X,” the caller passes `linked_record_id` so the tool returns only articles whose `linked_record_id` matches that event. That keeps article–event linkage authoritative and consistent.

---

## Interpretive Layer

Interpretation and historical framing come from **vector stores** attached to the Responses API as the `file_search` tool.

**Two vector stores** are used (configured via environment variables, not committed):

1. **Archive Structured**  
   - Primary thesis PDF (e.g. *A Murder of Crows – John Crow Thesis*).  
   - Sitemap / navigation document for the archive (e.g. `site-map-llm.md`).  
   - Other curated interpretive materials.

2. **Secondary Sources**  
   - Scholarly PDFs and historical research that support context and comparison.

The thesis is named explicitly in the system instruction as the **primary interpretive framework**. The model is told to prefer retrieving passages from it for questions about patterns, causes, regional scope, and the meaning of terms like “John Crow.” Archive facts (record IDs, URLs) still must come from `search_archive` only.

`file_search` is attached to the Responses API request when the corresponding vector store IDs are set in the environment. The same request can include both `search_archive` (function tool) and `file_search` (vector store tool).

---

## System Prompt Strategy

The system instruction encodes the separation of archive truth and interpretation:

- **`search_archive` is authoritative** for archive records, record IDs, article IDs, and all archive URLs. The model may only cite johncrow.org URLs that were returned by this tool.
- **`file_search` provides interpretation** (thesis, secondary sources). It must not be used as a source for archive records or URLs.
- **The model must never invent** archive records, dates, IDs, or URLs.
- **Interpretive questions** (patterns, significance, regional scope) should prefer the thesis first, then other secondary sources.
- **Answers should be concise:** short paragraph plus a brief bullet list of 1–3 archive links when useful. No raw citation tokens or tool names in the reply.

Additional rules cover: calling `search_archive` before answering factual archive questions; using `linked_record_id` to retrieve all articles for an event; limiting repeated tool calls; and stating plainly when no matching record exists (e.g. “No matching record in the archive.”).

---

## Frontend Integration

The public chat UI:

- Sends POST requests to `/.netlify/functions/chat-response` with a JSON body `{ "message": "user question" }`.
- Receives JSON `{ "response": "..." }` where the value is **Markdown**.
- Renders that Markdown to HTML on the client (e.g. with a library like Marked) so links, lists, and emphasis display correctly.

The live chat page is implemented in the site’s main frontend (e.g. `src/pages/chat.astro`). A standalone **test page**, `public/chat-response-test.html`, also calls the same function and renders Markdown; it is not linked in the main navigation and is intended for development and manual testing.

Using Markdown for the response keeps the payload simple and ensures links and structure render cleanly in the browser.

---

## Deployment

The system runs on:

- **Netlify** for hosting and serverless functions.
- **OpenAI Responses API** for the chat model and tool-calling loop.
- **Environment variables** for the API key and optional vector store IDs (no secrets are stored in the repository).

The archive JSON files must be available to the function at runtime. In Netlify, this is done by listing them in `netlify.toml`:

```toml
[functions]
  directory = "netlify/functions"
  node_bundler = "esbuild"
  included_files = ["data/archive-json/**"]
```

The function code (and its helper in `lib/`) resolves paths to these files so they work both in local `netlify dev` and in the deployed bundle.

---

## Adapting This for Your Own Archive

To replicate this pattern for another digital archive:

1. **Create structured archive JSON files** (e.g. events and articles, or your own entity types) with stable IDs, dates, summaries, and canonical URLs. Define a schema so the format stays consistent.

2. **Implement a deterministic search tool** that loads those JSON files and returns filtered, compact results (e.g. by keyword, date, location, or linkage). Expose it as a serverless function (e.g. `search_archive.js`) and as a **function tool** in the Responses API.

3. **Add vector stores** with your primary interpretive document (e.g. a thesis or project overview) and optional secondary scholarship. Attach them to the same Responses API request as the `file_search` tool.

4. **Write a system instruction** that (a) makes the search tool the only source of archive facts and URLs, (b) forbids inventing records or URLs, (c) directs interpretive questions to the thesis/vector store first, and (d) keeps answers concise and well-formatted (e.g. short paragraph + bullet list of links).

5. **Build a simple chat UI** that POSTs the user message to your function, receives Markdown, and renders it to HTML. Optionally add a small test page that hits the same endpoint.

The crucial idea is: **archive truth → search tool; interpretation → vector store; synthesis → LLM.** Keeping that split explicit in both implementation and prompts is what makes the system reliable and reproducible.

---

## Starter Prompt for Other Archives

You can use the following as a **reusable prompt** in Cursor or another coding assistant to bootstrap a similar chatbot:

```
Build an archive chatbot for my digital collection.

Requirements:

1. Archive facts must come from a deterministic search tool over structured JSON data.
2. The LLM must never invent archive records or URLs.
3. Interpretive answers should use a vector store containing curated scholarship.
4. The system should run as a serverless API route.
5. The chat UI should render Markdown responses.

Architecture:
- browser → serverless function → OpenAI Responses API
- tools: search_archive + file_search

Please generate the search tool, the API route, and the chat UI.
```

Adjust the tool name, JSON schema, and wording to match your project (e.g. “events” vs “items,” “articles” vs “sources”). The same architecture—deterministic search + file_search + strict grounding rules—applies across archives.

---

## Why This Architecture Works

The main insight is **separating three roles**:

| Role                | Handled by           | Prevents                |
|---------------------|----------------------|-------------------------|
| **Archive truth**   | Deterministic search | Hallucinated records/URLs |
| **Interpretive context** | Vector store retrieval | Model “making up” scholarship |
| **Synthesis**       | LLM reasoning        | Overly generic or ungrounded answers |

Because the model must call `search_archive` for any claim about the archive, it cannot cite records or URLs that do not exist in your data. Because interpretive material is pulled from your own uploaded documents via `file_search`, answers stay aligned with your project’s framework. The result is an assistant that can give both precise, linkable archive facts and thoughtful historical interpretation, without inventing either.

---

*This document describes the John Crow Project’s archive chatbot as of the date of the repository. Implementation details live in `netlify/functions/chat-response.js`, `netlify/functions/search_archive.js`, `netlify/functions/lib/archive-search.js`, and the chat page and test page referenced above.*
