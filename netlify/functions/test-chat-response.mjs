/**
 * Local test for chat-response (Responses API). Run from repo root:
 *   node netlify/functions/test-chat-response.mjs
 *
 * For a real POST test, set OPENAI_API_KEY (and optionally OPENAI_CHAT_MODEL).
 */

import handler from "./chat-response.js";

const tests = [
  {
    name: "GET (expect 405)",
    method: "GET",
    body: {},
  },
  {
    name: "Empty message (expect 400)",
    body: { message: "" },
  },
  {
    name: "Missing message (expect 400)",
    body: {},
  },
  {
    name: "Invalid JSON body (expect 400)",
    rawBody: "not json",
  },
  {
    name: "Valid message (expect 200 or 500 if no key)",
    body: { message: "What events are in the archive for California in 1869?" },
  },
];

async function run() {
  console.log("Testing chat-response (Responses API) → Response\n");
  for (const t of tests) {
    const hasBody = t.method !== "GET";
    const body = hasBody
      ? (t.rawBody != null ? t.rawBody : JSON.stringify(t.body ?? {}))
      : undefined;
    const req = new Request("http://localhost/.netlify/functions/chat-response", {
      method: t.method || "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });
    const res = await handler(req, {});
    const text = await res.text();
    let out;
    try {
      out = JSON.parse(text);
    } catch {
      out = text;
    }
    console.log(`--- ${t.name} (${res.status}) ---`);
    console.log(typeof out === "object" ? JSON.stringify(out, null, 2) : out);
    console.log("");
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
