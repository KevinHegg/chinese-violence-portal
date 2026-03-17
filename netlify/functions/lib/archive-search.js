/**
 * Pure archive search. No HTTP. Used by search_archive.js and chat-response.js.
 * Reads data/archive-json/events.json and articles.json.
 * Path resolution via import.meta.url + URL only (no __dirname/__filename).
 * First candidate: bundled (../../data/archive-json relative to executing module).
 * Fallback: dev (../../../data/archive-json from netlify/functions/lib/ to repo root).
 */

import fs from "node:fs";

const DEFAULT_LIMIT = 5;
const MAX_LIMIT = 20;
const DEFAULT_ARTICLE_SEARCH_FIELDS = ["headline", "summary", "transcript", "keywords"];
const ALLOWED_ARTICLE_SEARCH_FIELDS = new Set(DEFAULT_ARTICLE_SEARCH_FIELDS);

const CANDIDATE_RELATIVE_PATHS = [
  "../../data/archive-json",    // bundled: search_archive.mjs at .../search_archive/netlify/functions/ -> ../../data/archive-json
  "../../../data/archive-json", // dev: netlify/functions/lib/archive-search.js -> repo root
];

function loadJSON(filename) {
  const base = import.meta.url;
  const urlsToTry = CANDIDATE_RELATIVE_PATHS.map((rel) => new URL(`${rel}/${filename}`, base));
  console.log("[archive-search] resolved JSON candidates for", filename, urlsToTry.map((u) => u.href));

  let lastErr = null;
  for (const url of urlsToTry) {
    try {
      const raw = fs.readFileSync(url, "utf8");
      const data = JSON.parse(raw);
      const count = Array.isArray(data) ? data.length : 0;
      console.log("[archive-search]", filename, "at", url.href, "loaded OK, count:", count);
      return data;
    } catch (e) {
      lastErr = e;
      console.warn("[archive-search]", filename, "at", url.href, "failed:", e.message);
    }
  }
  const msg = lastErr ? `${filename}: ${lastErr.message}` : `${filename}: no candidate path worked`;
  throw new Error(msg);
}

const EVENT_WEIGHTS = {
  id: 3,
  title: 3,
  summary: 2,
  narrative: 1.5,
  location: 2,
  keywords: 2,
};
const ARTICLE_WEIGHTS = {
  id: 3,
  linked_record_id: 3,
  headline: 3,
  newspaper: 2,
  summary: 2,
  transcript: 1.5,
  location: 2,
  keywords: 2,
};

function normalizeState(s) {
  return (s || "").trim().toLowerCase();
}

function tokenizeKeywords(keywordsStr) {
  if (!keywordsStr || typeof keywordsStr !== "string") return [];
  return keywordsStr
    .toLowerCase()
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

function normalizeSearchText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeMatchMode(value) {
  if (value === "exact_phrase" || value === "contains") return value;
  return "default";
}

function normalizeMode(value) {
  if (value === "exhaustive_phrase") return value;
  return null;
}

function normalizeSearchFields(fields) {
  if (!Array.isArray(fields) || fields.length === 0) {
    return [...DEFAULT_ARTICLE_SEARCH_FIELDS];
  }

  const normalized = fields
    .map((field) => String(field || "").trim())
    .filter((field) => ALLOWED_ARTICLE_SEARCH_FIELDS.has(field));

  return normalized.length ? normalized : [...DEFAULT_ARTICLE_SEARCH_FIELDS];
}

function getArticleFieldValue(article, field) {
  if (field === "keywords") {
    return Array.isArray(article.keywords) ? article.keywords.join(" ") : "";
  }
  return article[field] ?? "";
}

function scoreText(tokens, text, weight) {
  if (!text || !tokens.length) return 0;
  const lower = String(text).toLowerCase();
  let score = 0;
  for (const t of tokens) {
    if (lower.includes(t)) score += weight;
  }
  return score;
}

function scoreKeywordArray(tokens, arr, weight) {
  if (!Array.isArray(arr) || !tokens.length) return 0;
  const set = new Set(arr.map((k) => String(k).toLowerCase()));
  let score = 0;
  for (const t of tokens) {
    if (set.has(t)) score += weight;
  }
  return score;
}

function scoreEvent(event, tokens) {
  if (!tokens.length) return 0;
  let s = 0;
  s += scoreText(tokens, event.id, EVENT_WEIGHTS.id);
  s += scoreText(tokens, event.title, EVENT_WEIGHTS.title);
  s += scoreText(tokens, event.summary, EVENT_WEIGHTS.summary);
  s += scoreText(tokens, event.narrative, EVENT_WEIGHTS.narrative);
  s += scoreText(tokens, event.location, EVENT_WEIGHTS.location);
  s += scoreKeywordArray(tokens, event.keywords, EVENT_WEIGHTS.keywords);
  return s;
}

function scoreArticle(article, tokens) {
  if (!tokens.length) return 0;
  let s = 0;
  s += scoreText(tokens, article.id, ARTICLE_WEIGHTS.id);
  s += scoreText(tokens, article.linked_record_id, ARTICLE_WEIGHTS.linked_record_id);
  s += scoreText(tokens, article.headline, ARTICLE_WEIGHTS.headline);
  s += scoreText(tokens, article.newspaper, ARTICLE_WEIGHTS.newspaper);
  s += scoreText(tokens, article.summary, ARTICLE_WEIGHTS.summary);
  s += scoreText(tokens, article.transcript, ARTICLE_WEIGHTS.transcript);
  s += scoreText(tokens, article.location, ARTICLE_WEIGHTS.location);
  s += scoreKeywordArray(tokens, article.keywords, ARTICLE_WEIGHTS.keywords);
  return s;
}

function scoreArticleByFields(article, tokens, fields) {
  if (!tokens.length) return 0;

  const usingDefaultFields =
    fields.length === DEFAULT_ARTICLE_SEARCH_FIELDS.length &&
    DEFAULT_ARTICLE_SEARCH_FIELDS.every((field) => fields.includes(field));

  if (usingDefaultFields) {
    return scoreArticle(article, tokens);
  }

  let s = 0;
  if (fields.includes("headline")) s += scoreText(tokens, article.headline, ARTICLE_WEIGHTS.headline);
  if (fields.includes("summary")) s += scoreText(tokens, article.summary, ARTICLE_WEIGHTS.summary);
  if (fields.includes("transcript")) s += scoreText(tokens, article.transcript, ARTICLE_WEIGHTS.transcript);
  if (fields.includes("keywords")) s += scoreKeywordArray(tokens, article.keywords, ARTICLE_WEIGHTS.keywords);

  // Keep id/linkage/location/newspaper signals for ordinary article lookup unless caller explicitly
  // narrows fields for exhaustive phrase-style searches.
  s += scoreText(tokens, article.id, ARTICLE_WEIGHTS.id);
  s += scoreText(tokens, article.linked_record_id, ARTICLE_WEIGHTS.linked_record_id);
  s += scoreText(tokens, article.newspaper, ARTICLE_WEIGHTS.newspaper);
  s += scoreText(tokens, article.location, ARTICLE_WEIGHTS.location);
  return s;
}

function matchesArticleByMode(article, queryText, matchMode, fields) {
  const needle = normalizeSearchText(queryText);
  if (!needle) return false;

  for (const field of fields) {
    const haystack = normalizeSearchText(getArticleFieldValue(article, field));
    if (!haystack) continue;
    if (matchMode === "exact_phrase" || matchMode === "contains") {
      if (haystack.includes(needle)) return true;
    }
  }

  return false;
}

function matchesArticleByPhrase(article, phrase) {
  const needle = normalizeSearchText(phrase);
  if (!needle) return false;

  const transcript = normalizeSearchText(article.transcript);
  const headline = normalizeSearchText(article.headline);

  return transcript.includes(needle) || headline.includes(needle);
}

function filterEvents(events, query) {
  let list = [...events];
  if (query.year != null) {
    const y = Number(query.year);
    if (!Number.isNaN(y)) list = list.filter((e) => e.year === y);
  }
  if (query.decade != null) {
    const d = Number(query.decade);
    if (!Number.isNaN(d)) list = list.filter((e) => e.decade === d);
  }
  if (query.state) {
    const want = normalizeState(query.state);
    list = list.filter((e) => normalizeState(e.state) === want);
  }
  return list;
}

function filterArticles(articles, query) {
  let list = [...articles];
  if (query.linked_record_id != null && String(query.linked_record_id).trim()) {
    const want = String(query.linked_record_id).trim();
    list = list.filter((a) => (a.linked_record_id || "").trim() === want);
  }
  if (query.year != null) {
    const y = Number(query.year);
    if (!Number.isNaN(y)) list = list.filter((a) => a.year === y);
  }
  if (query.decade != null) {
    const d = Number(query.decade);
    if (!Number.isNaN(d)) list = list.filter((a) => a.decade === d);
  }
  if (query.state) {
    const want = normalizeState(query.state);
    list = list.filter((a) => normalizeState(a.state) === want);
  }
  return list;
}

function sortArticlesByDateOrId(articles) {
  return [...articles].sort((a, b) => {
    const da = a.publication_date || "";
    const db = b.publication_date || "";
    if (da !== db) return da.localeCompare(db);
    return (a.id || "").localeCompare(b.id || "");
  });
}

function toCompactEvent(event, score) {
  return {
    id: event.id,
    type: "event",
    date: event.date,
    year: event.year,
    state: event.state,
    location: event.location,
    title: event.title,
    summary: event.summary,
    url: event.url,
    score,
  };
}

function toCompactArticle(article, score) {
  return {
    id: article.id,
    type: "article",
    linked_record_id: article.linked_record_id,
    publication_date: article.publication_date,
    year: article.year,
    state: article.state,
    location: article.location,
    headline: article.headline,
    newspaper: article.newspaper,
    summary: article.summary,
    url: article.url,
    score,
  };
}

/**
 * Run archive search. Query: { type?, year?, decade?, state?, keywords?, limit?, linked_record_id?, match_mode?, search_fields?, exhaustive?, mode?, phrase? }.
 * For type "articles", linked_record_id filters to articles whose linked_record_id matches (event's canonical link).
 * Returns { query, count, total_matches, returned_matches, results }. Throws if data files are missing.
 */
export function searchArchive(query) {
  const type = query.type;
  const year = query.year != null ? Number(query.year) : undefined;
  const decade = query.decade != null ? Number(query.decade) : undefined;
  const state = query.state != null ? String(query.state) : undefined;
  const keywords = query.keywords != null ? String(query.keywords) : undefined;
  const linked_record_id = query.linked_record_id != null ? String(query.linked_record_id).trim() || undefined : undefined;
  const match_mode = normalizeMatchMode(query.match_mode);
  const search_fields = normalizeSearchFields(query.search_fields);
  const exhaustive = query.exhaustive === true;
  const mode = normalizeMode(query.mode);
  const phrase = query.phrase != null ? String(query.phrase) : undefined;
  let limit = query.limit != null ? Number(query.limit) : DEFAULT_LIMIT;
  if (Number.isNaN(limit) || limit < 1) limit = DEFAULT_LIMIT;
  if (limit > MAX_LIMIT) limit = MAX_LIMIT;

  const q = { type, year, decade, state, keywords, limit, linked_record_id, match_mode, search_fields, exhaustive, mode, phrase };

  let events = [];
  let articles = [];

  if (type !== "articles") {
    events = loadJSON("events.json");
    console.log("[archive-search] loaded events count:", Array.isArray(events) ? events.length : 0);
  }
  if (type !== "events") {
    articles = loadJSON("articles.json");
    console.log("[archive-search] loaded articles count:", Array.isArray(articles) ? articles.length : 0);
  }

  const tokens = tokenizeKeywords(keywords);
  const results = [];

  if (type !== "articles") {
    let eventList = filterEvents(events, q);
    if (tokens.length) {
      eventList = eventList
        .map((e) => ({ item: e, score: scoreEvent(e, tokens) }))
        .filter((x) => x.score > 0)
        .sort((a, b) => b.score - a.score)
        .map((x) => toCompactEvent(x.item, x.score));
    } else {
      eventList = eventList.map((e) => toCompactEvent(e, 0));
    }
    results.push(...eventList);
  }

  if (type !== "events") {
    let articleList = filterArticles(articles, q);
    if (mode === "exhaustive_phrase") {
      if (type !== "articles") {
        throw new Error('mode "exhaustive_phrase" is only valid for type "articles".');
      }
      const normalizedPhrase = normalizeSearchText(phrase);
      if (!normalizedPhrase) {
        throw new Error('mode "exhaustive_phrase" requires a non-empty "phrase" parameter.');
      }

      const matches = sortArticlesByDateOrId(articleList)
        .filter((a) => matchesArticleByPhrase(a, normalizedPhrase))
        .map((a) => toCompactArticle(a, 0));

      results.push(...matches);
    } else if (linked_record_id != null && linked_record_id !== "") {
      const sorted = sortArticlesByDateOrId(articleList);
      const compact = sorted.slice(0, limit).map((a) => toCompactArticle(a, 0));
      results.push(...compact);
    } else {
      if (tokens.length) {
        if (exhaustive && type === "articles" && match_mode !== "default") {
          articleList = sortArticlesByDateOrId(
            articleList.filter((a) => matchesArticleByMode(a, keywords, match_mode, search_fields))
          ).map((a) => toCompactArticle(a, 0));
        } else if (exhaustive && type === "articles") {
          articleList = articleList
            .map((a) => ({ item: a, score: scoreArticleByFields(a, tokens, search_fields) }))
            .filter((x) => x.score > 0)
            .sort((a, b) => b.score - a.score)
            .map((x) => toCompactArticle(x.item, x.score));
        } else {
          articleList = articleList
            .map((a) => ({ item: a, score: scoreArticleByFields(a, tokens, search_fields) }))
            .filter((x) => x.score > 0)
            .sort((a, b) => b.score - a.score)
            .map((x) => toCompactArticle(x.item, x.score));
        }
      } else {
        articleList = articleList.map((a) => toCompactArticle(a, 0));
      }
      results.push(...articleList);
    }
  }

  if (mode !== "exhaustive_phrase") {
    results.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  }
  const totalMatches = results.length;
  const top = mode === "exhaustive_phrase" ? results : results.slice(0, limit);

  return {
    query: {
      type: q.type ?? null,
      year: q.year ?? null,
      decade: q.decade ?? null,
      state: q.state ?? null,
      keywords: q.keywords ?? null,
      linked_record_id: q.linked_record_id ?? null,
      match_mode: q.match_mode ?? null,
      search_fields: Array.isArray(q.search_fields) ? q.search_fields : null,
      exhaustive: q.exhaustive === true,
      mode: q.mode ?? null,
      phrase: q.phrase ?? null,
      limit: q.limit,
    },
    count: top.length,
    total_matches: totalMatches,
    returned_matches: top.length,
    results: top,
  };
}
