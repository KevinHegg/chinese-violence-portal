/**
 * Production chat route for Ask the Archive. POST only.
 * Uses OpenAI Responses API (client.responses.create), not Chat Completions.
 * Fulfills search_archive via lib/archive-search.js. Optional file_search when
 * OPENAI_ARCHIVE_VECTOR_STORE_ID / OPENAI_SECONDARY_VECTOR_STORE_ID are set.
 *
 * Body: { "message": "user question here", "history": [{ role, content }, ...] }
 * Response: { "response": "final answer text (Markdown)" }
 *
 * Requires: OPENAI_API_KEY. Model: OPENAI_CHAT_MODEL or "gpt-5.4".
 */

import OpenAI from "openai";
import { searchArchive } from "./lib/archive-search.js";

const JSON_HEADERS = { "Content-Type": "application/json" };
const MAX_TOOL_ROUNDS = 8;
const MAX_SEARCH_ARCHIVE_CALLS = 3;
const FILE_SEARCH_MAX_NUM_RESULTS = 3;

const SEARCH_ARCHIVE_TOOL = {
  type: "function",
  name: "search_archive",
  description: "Search the John Crow archive of events and articles. Use linked_record_id to get all articles linked to a specific event (e.g. after finding an event by id). For broad or regional questions, prefer one or two searches with a higher limit (e.g. 10–15) rather than many narrow searches. For exact phrase, count, transcript, or exhaustive requests over articles, use mode=\"exhaustive_phrase\" with a phrase.",
  parameters: {
    type: "object",
    properties: {
      type: {
        type: ["string", "null"],
        enum: ["events", "articles", null],
      },
      year: {
        type: ["integer", "null"],
      },
      decade: {
        type: ["integer", "null"],
      },
      state: {
        type: ["string", "null"],
      },
      keywords: {
        type: ["string", "null"],
      },
      linked_record_id: {
        type: ["string", "null"],
      },
      mode: {
        type: ["string", "null"],
        enum: ["exhaustive_phrase", null],
      },
      phrase: {
        type: ["string", "null"],
      },
      match_mode: {
        type: ["string", "null"],
        enum: ["default", "exact_phrase", "contains", null],
      },
      search_fields: {
        type: ["array", "null"],
        items: {
          type: "string",
          enum: ["headline", "summary", "transcript", "keywords"],
        },
      },
      exhaustive: {
        type: ["boolean", "null"],
      },
      limit: {
        type: ["integer", "null"],
      },
    },
    required: ["type", "year", "decade", "state", "keywords", "linked_record_id", "mode", "phrase", "match_mode", "search_fields", "exhaustive", "limit"],
    additionalProperties: false,
  },
  strict: true,
};

const SYSTEM_INSTRUCTION = `You answer questions about the John Crow Project archive and anti-Chinese violence in the United States (1848–1924). Answer briefly by default. Prefer one short explanatory paragraph, then a short bullet list of 1–3 archive links when useful. Do not ramble. Do not offer follow-up suggestions unless the user asks.

Primary interpretive framework:

"Hegg - A Murder of Crows (John Crow Thesis).pdf"

Vector store file ID: file-RZLZvJMyP8PrHxUNh4FeQ4

Rules:

- search_archive is the authoritative source for archive records, record IDs, article IDs, and johncrow.org URLs.
- Never invent archive records or johncrow.org URLs.
- Only cite johncrow.org URLs returned by search_archive.
- For interpretive questions about patterns, causes, labor conflict, racial terror, regional scope, or the meaning of "John Crow", prefer retrieving passages from the thesis using file_search before consulting other secondary sources.
- Secondary scholarship may provide supporting context but should not override the thesis or archive records.
- Be concise.
- Do not offer follow-up suggestions unless asked.
- If no archive record exists, say so plainly.
- For broad interpretive questions, gather only enough evidence to answer well. Prefer a few representative archive examples over exhaustive searching. Do not keep calling search_archive once sufficient support has been found.
- When search_archive has already returned sufficient results to answer the user's request, do not call it again. Prefer using the first successful archive result set rather than repeating the same lookup.
- For requests for links to a named event or victim: search the event once, then if needed search linked articles once (using linked_record_id), then answer. Do not re-search or make additional search_archive calls once you have the event and its linked articles.
- For ordinary archive lookup questions, use no more than 2 search_archive calls unless the user explicitly asks for exhaustive coverage. If enough archive evidence is already available, stop searching and answer.
- If the user clearly asks for exhaustive retrieval, exact phrase matching, transcript searching, or counts (for example: "all," "every," "exact phrase," "search the transcripts," "how many"), prefer exhaustive archive search rather than ordinary exploratory retrieval.

Output format:
- Write plain prose only. Do not emit raw citation tokens, tool names, or pseudo-citation markup (e.g. .search_archive, turn...commentary..., or similar). When you reference archive material, mention the record or article plainly and include only real johncrow.org URLs that were returned by search_archive.

Link format:

1. Event record links — Use this label pattern: [Location — Date](url). Examples: [Rock Springs, Wyoming Territory — Sept. 2, 1885](...), [Friars Point, Mississippi — May 5, 1885](...). Do not include the record ID in the visible link label unless the user explicitly asks for IDs. Do not use the full long event title unless the user explicitly asks for formal titles.

2. Article links — Use this label pattern: ["Headline" — Newspaper (Date)](url). Use exact newspaper names from the dataset. Do not include article ID unless the user explicitly asks. Keep the headline intact; abbreviate only if absolutely necessary.

3. Multiple links — When returning several links, always format them as a Markdown bullet list. Do not dump naked URLs in prose. Keep answers concise.

4. Always use Markdown links for archive references; do not output naked johncrow.org URLs unless absolutely necessary. If the user asks for "links," prioritize a short labeled list of links.

Rules (continued):
- If the user asks about a specific incident, lynching, riot, massacre, event, article, or named person, you must call search_archive before answering.
- Use the recent conversation context when the user says things like "that case," "those articles," "this event," "that lynching," "give me links," or "what about the South?" Treat the most recently discussed archive event, article set, or regional topic as the default referent unless the user clearly shifts topics.
- File search (if available) returns contextual or background material only. Do not treat file_search as a source for archive records or URLs. Do not cite or invent archive records or johncrow.org links from file_search.
- Call search_archive before answering any archive question. For event-like questions (incidents, lynching, riots, etc.), search events first; if you find an event and article coverage would help, you may search articles too.
- When the user asks for articles related to an event, lynching, massacre, or named incident: search events first to find the matching event. The event record is the authoritative source for linked articles. If the event has article_ids, retrieve those linked articles by calling search_archive with type "articles" and linked_record_id set to that event's id (e.g. MS1885-05-05). Do not rely only on free-text article search; use linked_record_id so all linked articles are returned. Do not claim only one article exists when the event has multiple linked articles.
- If an event has already been identified earlier in the conversation and the user asks for related articles, all linked articles, more articles, more examples, or links, prefer that existing event context first. If that event has linked articles, use linked_record_id to retrieve them before launching a new broad search.
- If the user asks for more examples or follow-up regional comparisons, prefer the most recently discussed archive result set and extend it with one additional targeted search rather than restarting from scratch.
- Only mention articles if they were returned by search_archive.
- For article queries that ask for "all," "every," "exact phrase," "how many," or "search the transcripts," call search_archive exactly once with type="articles", mode="exhaustive_phrase", and phrase set to the target phrase. Trust the returned total_matches count. Do not iterate or approximate exhaustiveness with multiple searches.
- In mode="exhaustive_phrase", search_archive performs a full scan across article transcripts and headlines and returns all matches. Treat that result as authoritative for completeness within the archive data.
- For exhaustive results, always report total_matches. If the matching list is long, show only the first several items and say so plainly, for example: "Found 24 matching articles. Showing first 10:" Do not say "here are all" unless the returned result set is actually complete and fully shown.
- For broad interpretive or regional questions, do not call search_archive repeatedly. Prefer one or a few broader searches with a higher limit (e.g. limit 10–15) rather than many narrow searches. Gather a few representative examples (e.g. 2–4), then synthesize; do not exhaustively call search_archive.
- For broad interpretive questions you may use file_search for context. But if your answer makes claims about archive geography, chronology, or the distribution of violence, you must first use search_archive to gather relevant archive examples. Do not generalize from a single event when the user asks about a broad pattern.
- If the user asks whether anti-Chinese violence was national, regional, southern, western, midwestern, etc.: use search_archive once or twice to gather multiple examples from relevant regions (e.g. limit 10–15); prefer at least 2–4 representative archive examples; then use file_search only for interpretive support. Do not make many separate search_archive calls.
- File search may include a lightweight archive navigation document (e.g. site-map-llm.md or site-map-llm.html) for orientation; use it for context only. Do not cite file_search or any navigation document as a source of archive records or johncrow.org URLs.
- For questions outside this scope, say you can only help with the John Crow archive and anti-Chinese violence in this period.`;

export default async function handler(req, context) {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed. Use POST." }), {
      status: 405,
      headers: JSON_HEADERS,
    });
  }

  let body = {};
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body." }), {
      status: 400,
      headers: JSON_HEADERS,
    });
  }

  const message = body.message != null ? String(body.message).trim() : "";
  const history = normalizeHistory(body.history);
  if (!message) {
    return new Response(JSON.stringify({ error: "Missing or empty message." }), {
      status: 400,
      headers: JSON_HEADERS,
    });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: "OPENAI_API_KEY not configured." }),
      { status: 500, headers: JSON_HEADERS }
    );
  }

  const model = process.env.OPENAI_CHAT_MODEL || "gpt-5.4";
  const client = new OpenAI({ apiKey });

  const archiveVsId = process.env.OPENAI_ARCHIVE_VECTOR_STORE_ID;
  const secondaryVsId = process.env.OPENAI_SECONDARY_VECTOR_STORE_ID;
  const vectorStoreIds = [archiveVsId, secondaryVsId].filter(Boolean);
  const usedVectorStores = vectorStoreIds.length > 0;
  const tools =
    usedVectorStores
      ? [
          SEARCH_ARCHIVE_TOOL,
          {
            type: "file_search",
            vector_store_ids: vectorStoreIds,
            max_num_results: FILE_SEARCH_MAX_NUM_RESULTS,
          },
        ]
      : [SEARCH_ARCHIVE_TOOL];

  const toolsAvailable = usedVectorStores ? ["search_archive", "file_search"] : ["search_archive"];
  let searchArchiveCalls = 0;
  let searchArchiveExecutions = 0;
  let fileSearchCalls = 0;
  let searchArchiveCapHit = false;

  let previousResponseId = null;
  let toolInputs = null;
  let finalText = null;
  let round = 0;
  let retried = false;

  try {
    while (round < MAX_TOOL_ROUNDS) {
      const createParams = {
        model,
        instructions: SYSTEM_INSTRUCTION,
        tools,
        tool_choice: "auto",
      };

      if (previousResponseId == null) {
        createParams.input = buildConversationInput(history, message);
      } else {
        createParams.previous_response_id = previousResponseId;
        createParams.input = toolInputs;
      }

      let response;
      try {
        response = await client.responses.create(createParams);
      } catch (createErr) {
        if (!retried && isTransientError(createErr)) {
          retried = true;
          response = await client.responses.create(createParams);
        } else {
          throw createErr;
        }
      }

      if (response.error) {
        return new Response(
          JSON.stringify({ error: response.error.message || "Responses API error." }),
          { status: 500, headers: JSON_HEADERS }
        );
      }

      previousResponseId = response.id;

      if (response.output_text != null && String(response.output_text).trim()) {
        finalText = String(response.output_text).trim();
      }

      const output = response.output || [];
      for (const item of output) {
        if (!item) continue;
        if (item.type === "function_call" && item.name === "search_archive") {
          searchArchiveCalls += 1;
        }
        if (item.type === "file_search_call") {
          fileSearchCalls += 1;
        }
      }

      const functionCalls = output.filter(
        (item) => item && item.type === "function_call"
      );

      if (functionCalls.length === 0) {
        break;
      }

      toolInputs = [];
      for (const fc of functionCalls) {
        const callId = fc.call_id;
        const name = fc.name;
        const argsStr = fc.arguments ?? "{}";
        let toolResult;
        try {
          if (name === "search_archive") {
            if (searchArchiveExecutions >= MAX_SEARCH_ARCHIVE_CALLS) {
              searchArchiveCapHit = true;
              toolResult = {
                query: null,
                count: 0,
                results: [],
                _message:
                  "Maximum search_archive calls per request reached. Use the results already returned to synthesize your answer. Do not call search_archive again.",
              };
            } else {
              const args = JSON.parse(argsStr);
              toolResult = searchArchive(args);
              searchArchiveExecutions += 1;
            }
          } else {
            toolResult = { error: `Unknown tool: ${name}` };
          }
        } catch (err) {
          toolResult = { error: err.message || "Tool execution failed." };
        }
        toolInputs.push({
          type: "function_call_output",
          call_id: callId,
          output: JSON.stringify(toolResult),
        });
      }

      round += 1;
    }

    if (finalText == null) {
      return new Response(
        JSON.stringify({ error: "No final answer from model." }),
        { status: 500, headers: JSON_HEADERS }
      );
    }

    return new Response(JSON.stringify({ response: finalText }), {
      status: 200,
      headers: JSON_HEADERS,
    });
  } catch (err) {
    console.error("chat-response error:", err.message);
    return new Response(
      JSON.stringify({ error: err.message || "Chat request failed." }),
      { status: 500, headers: JSON_HEADERS }
    );
  }
}

function isTransientError(err) {
  const msg = (err?.message || String(err)).toLowerCase();
  const status = err?.status ?? err?.statusCode ?? err?.response?.status;
  if (status === 502 || status === 503 || status === 504) return true;
  if (msg.includes("timeout") || msg.includes("econnreset") || msg.includes("econnrefused")) return true;
  return false;
}

function normalizeHistory(history) {
  if (!Array.isArray(history)) return [];

  return history
    .filter((item) => item && (item.role === "user" || item.role === "assistant"))
    .map((item) => ({
      role: item.role,
      content: String(item.content ?? "").trim(),
    }))
    .filter((item) => item.content)
    .slice(-4);
}

function buildConversationInput(history, message) {
  const input = history.map((item) => ({
    role: item.role,
    content: item.content,
  }));

  input.push({
    role: "user",
    content: message,
  });

  return input;
}
