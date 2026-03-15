/**
 * Local test for search_archive (req, context) + Response.
 * Run from repo root: node netlify/functions/test-search-archive.mjs
 */

import handler from "./search_archive.js";

const tests = [
  {
    name: "events + keywords (charles nuce truckee)",
    body: { type: "events", keywords: "charles nuce truckee", limit: 5 },
  },
  {
    name: "articles + year + state",
    body: { type: "articles", year: 1869, state: "California", limit: 3 },
  },
  {
    name: "both types + decade",
    body: { decade: 1860, limit: 5 },
  },
  {
    name: "POST only (expect 405)",
    method: "GET",
    body: null,
  },
];

async function run() {
  console.log("Testing search_archive (req, context) → Response\n");
  for (const t of tests) {
    const req = new Request("http://localhost/.netlify/functions/search_archive", {
      method: t.method || "POST",
      headers: { "Content-Type": "application/json" },
      body: t.body ? JSON.stringify(t.body) : undefined,
    });
    const res = await handler(req, {});
    const out = await res.json();
    console.log(`--- ${t.name} (${res.status}) ---`);
    console.log(JSON.stringify(out, null, 2));
    console.log("");
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
