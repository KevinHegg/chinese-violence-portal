/**
 * Netlify function: POST-only archive search.
 * Uses (req, context) and returns a Response. Does not affect ask.js or /chat.
 *
 * Run locally: node netlify/functions/test-search-archive.mjs
 */

import { searchArchive } from "./lib/archive-search.js";

const JSON_HEADERS = { "Content-Type": "application/json" };

export default async function handler(req, context) {
  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed. Use POST." }),
      { status: 405, headers: JSON_HEADERS }
    );
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

  try {
    const result = searchArchive(body);
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: JSON_HEADERS,
    });
  } catch (err) {
    const details = err?.message ?? String(err);
    console.error("search_archive error:", details);
    return new Response(
      JSON.stringify({
        error: "Archive data unavailable.",
        details,
        query: body,
        count: 0,
        results: [],
      }),
      { status: 500, headers: JSON_HEADERS }
    );
  }
}
