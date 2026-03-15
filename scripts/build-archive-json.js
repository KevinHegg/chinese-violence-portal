/**
 * build-archive-json.js
 *
 * Reads canonical archive source (public/data/johncrow_data.json) and emits
 * data/archive-json/events.json and data/archive-json/articles.json that
 * conform exactly to data/archive-json/schema.json.
 *
 * Source: public/data/johncrow_data.json (from build-johncrow-json.mjs)
 * Output: data/archive-json/events.json, data/archive-json/articles.json
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

const SOURCE_PATH = path.join(ROOT, 'public/data/johncrow_data.json');
const SCHEMA_PATH = path.join(ROOT, 'data/archive-json/schema.json');
const OUT_DIR = path.join(ROOT, 'data/archive-json');
const EVENTS_PATH = path.join(OUT_DIR, 'events.json');
const ARTICLES_PATH = path.join(OUT_DIR, 'articles.json');

function stripHtml(text) {
  if (text == null || text === '') return '';
  return String(text)
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(parseInt(n, 10)))
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>\s*<p>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .trim();
}

function normalizeWhitespace(text) {
  if (text == null || text === '') return '';
  return String(text)
    .replace(/\u240A/g, '\n')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function parseYearFromDate(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return null;
  const y = dateStr.slice(0, 4);
  const n = parseInt(y, 10);
  return Number.isNaN(n) ? null : n;
}

function decadeFromYear(year) {
  if (year == null || typeof year !== 'number' || Number.isNaN(year)) return null;
  return Math.floor(Number(year) / 10) * 10;
}

/** All article IDs must be 4-character zero-padded strings. */
function normalizeArticleId(id) {
  const s = String(id ?? '').trim();
  if (!s) return '';
  const digits = s.replace(/\D/g, '');
  if (digits.length <= 4) return digits.padStart(4, '0');
  return s;
}

/**
 * Repair event article_ids: normalize each ID to 4-char; split concatenated
 * values like "01220236" into ["0122", "0236"].
 */
function repairArticleIdsArray(arr) {
  const out = [];
  for (const raw of Array.isArray(arr) ? arr : []) {
    const s = String(raw).trim();
    if (!s) continue;
    const digits = s.replace(/\D/g, '');
    if (digits.length === 8) {
      out.push(digits.slice(0, 4).padStart(4, '0'));
      out.push(digits.slice(4, 8).padStart(4, '0'));
    } else {
      out.push(normalizeArticleId(s));
    }
  }
  return [...new Set(out)].filter(Boolean).sort();
}

const KEYWORD_STOPWORDS = new Set([
  'the', 'and', 'a', 'an', 'of', 'to', 'in', 'on', 'at', 'for', 'by', 'with', 'was', 'is',
]);

function cleanKeywords(keywords) {
  const seen = new Set();
  for (const w of keywords || []) {
    let k = String(w).trim().toLowerCase().replace(/^[\s\W]+|[\s\W]+$/g, '');
    if (!k || k.length < 2) continue;
    if (KEYWORD_STOPWORDS.has(k)) continue;
    seen.add(k);
  }
  return Array.from(seen);
}

/** Conservative keywords from existing text only; then dedupe and remove stopwords. */
function eventKeywords(record, articleIds) {
  const seen = new Set();
  const add = (w) => {
    if (!w || w.length > 50) return;
    const k = w.toLowerCase().trim();
    if (k.length < 2) return;
    seen.add(k);
  };
  const id = record.id || '';
  if (id) add(id);
  const state = (record.state || '').trim();
  if (state) add(state);
  const location = (record.place || '').trim();
  if (location) add(location);
  const title = (record.narrative_title || record.narrative_short_title || '').trim();
  title.split(/\s+/).forEach(add);
  const summary = stripHtml(record.narrative_summary || '');
  summary.split(/\s+/).forEach((w) => add(w.replace(/\W/g, '')));
  (articleIds || []).forEach((aid) => add(aid));
  if (record.name && record.name !== 'Unnamed') add(record.name);
  return cleanKeywords(Array.from(seen));
}

/** Conservative keywords for article; then dedupe and remove stopwords. */
function articleKeywords(article, state, location) {
  const seen = new Set();
  const add = (w) => {
    if (!w || w.length > 50) return;
    const k = w.toLowerCase().trim();
    if (k.length < 2) return;
    seen.add(k);
  };
  const id = article.article_id || '';
  if (id) add(id);
  const linked = article.lynching_id || '';
  if (linked) add(linked);
  const newspaper = (article.publication || '').trim();
  if (newspaper) add(newspaper);
  (article.headline || '').split(/\s+/).forEach(add);
  if (state) add(state);
  if (location) add(location);
  const summary = stripHtml(article.summary || '');
  summary.split(/\s+/).forEach((w) => add(w.replace(/\W/g, '')));
  const transcript = (article.transcript || '').slice(0, 500);
  transcript.split(/\s+/).forEach((w) => add(w.replace(/\W/g, '')));
  return cleanKeywords(Array.from(seen));
}

function isLinkedRecordIdEvent(linkedId) {
  if (!linkedId || typeof linkedId !== 'string') return false;
  const t = linkedId.trim();
  if (t.startsWith('_')) return false;
  return /^[A-Z]{2}\d{4}-\d{2}-\d{2}$/.test(t) || /^[A-Z]{2}\d{4}-\d{2}-00$/.test(t) || /^[A-Z]{2}\d{4}-00-00$/.test(t);
}

function buildEvents(records, allArticleIds, stats) {
  return records.map((r) => {
    const year = r.year != null ? Number(r.year) : parseYearFromDate(r.date);
    const decade = year != null ? decadeFromYear(year) : null;
    const rawIds = Array.isArray(r.newspaper_ids) ? r.newspaper_ids : [];
    const articleIds = repairArticleIdsArray(rawIds);
    if (rawIds.some((x) => String(x).replace(/\D/g, '').length === 8)) stats.malformedRepaired += 1;
    const keywords = eventKeywords(r, articleIds);

    return {
      id: r.id ?? '',
      type: 'event',
      date: r.date ?? '',
      year: year != null ? year : 0,
      decade: decade != null ? decade : 0,
      state: r.state ?? '',
      location: r.place ?? '',
      title: r.narrative_title || r.narrative_short_title || '',
      summary: stripHtml(r.narrative_summary ?? ''),
      narrative: stripHtml(r.narrative_summary ?? ''),
      url: r.url || `https://johncrow.org/records/${r.id ?? ''}`,
      article_ids: articleIds,
      keywords,
    };
  });
}

function buildArticles(articles, eventById, stats) {
  let withEventStateLocation = 0;
  const out = articles.map((a) => {
    const rawId = a.article_id ?? '';
    const id = normalizeArticleId(rawId);
    if (id !== rawId) stats.articleIdsNormalized += 1;
    const pubDate = a.date ?? '';
    const year = parseYearFromDate(pubDate);
    const decade = year != null ? decadeFromYear(year) : null;
    const linkedId = a.lynching_id ?? '';
    const event = isLinkedRecordIdEvent(linkedId) ? eventById.get(linkedId) : null;
    let state = '';
    let location = '';
    if (event) {
      state = event.state ?? '';
      location = event.location ?? '';
      withEventStateLocation += 1;
    }
    const transcript = normalizeWhitespace(stripHtml(a.transcript ?? ''));
    const keywords = articleKeywords(a, state, location);

    return {
      id,
      type: 'article',
      linked_record_id: linkedId,
      headline: (a.headline ?? '').replace(/\n/g, ' '),
      newspaper: a.publication ?? '',
      publication_date: pubDate,
      year: year != null ? year : 0,
      decade: decade != null ? decade : 0,
      state,
      location,
      summary: stripHtml(a.summary ?? ''),
      transcript,
      url: a.url || `https://johncrow.org/articles/${id}`,
      keywords,
    };
  });
  return { articles: out, withEventStateLocation };
}

function validateEvents(events, knownArticleIds) {
  const ids = new Set();
  const unresolved = [];
  for (const e of events) {
    if (ids.has(e.id)) throw new Error(`Duplicate event id: ${e.id}`);
    ids.add(e.id);
    for (const aid of e.article_ids || []) {
      if (knownArticleIds && !knownArticleIds.has(aid)) {
        unresolved.push({ eventId: e.id, articleId: aid });
      }
    }
  }
  return unresolved;
}

function validateArticles(articles) {
  const ids = new Set();
  for (const a of articles) {
    if (ids.has(a.id)) throw new Error(`Duplicate article id: ${a.id}`);
    ids.add(a.id);
  }
}

async function main() {
  console.log('Source:', SOURCE_PATH);
  console.log('Schema:', SCHEMA_PATH);

  let raw;
  try {
    raw = await fs.readFile(SOURCE_PATH, 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT') {
      throw new Error(`Missing source: ${SOURCE_PATH}. Run "npm run build:archive" first.`);
    }
    throw err;
  }

  let data;
  try {
    data = JSON.parse(raw);
  } catch (err) {
    throw new Error(`Invalid JSON in source: ${err.message}`);
  }

  const records = Array.isArray(data.records) ? data.records : [];
  const articles = Array.isArray(data.articles) ? data.articles : [];
  if (records.length === 0) throw new Error('Source has no records.');
  if (articles.length === 0) throw new Error('Source has no articles.');

  const stats = { articleIdsNormalized: 0, malformedRepaired: 0 };

  const events = buildEvents(records, null, stats);
  const eventById = new Map(events.map((e) => [e.id, e]));
  const { articles: articlesOut, withEventStateLocation } = buildArticles(articles, eventById, stats);

  const knownArticleIds = new Set(articlesOut.map((a) => a.id));
  const unresolved = validateEvents(events, knownArticleIds);
  validateArticles(articlesOut);

  const transcriptsMatched = articlesOut.filter((a) => (a.transcript || '').length > 0).length;

  await fs.mkdir(OUT_DIR, { recursive: true });
  await fs.writeFile(EVENTS_PATH, JSON.stringify(events, null, 2), 'utf8');
  await fs.writeFile(ARTICLES_PATH, JSON.stringify(articlesOut, null, 2), 'utf8');

  console.log('');
  console.log('Event count:', events.length);
  console.log('Article count:', articlesOut.length);
  console.log('Article IDs normalized:', stats.articleIdsNormalized);
  console.log('Malformed article_ids repaired:', stats.malformedRepaired);
  if (unresolved.length > 0) {
    console.log('Unresolved event→article references:', unresolved.length);
    unresolved.slice(0, 10).forEach(({ eventId, articleId }) => console.warn(`  Event ${eventId} → article ${articleId}`));
    if (unresolved.length > 10) console.warn(`  ... and ${unresolved.length - 10} more`);
  } else {
    console.log('Unresolved references: none');
  }
  console.log('');
  console.log('Events →', EVENTS_PATH);
  console.log('Articles →', ARTICLES_PATH);
  console.log('Transcripts matched:', transcriptsMatched);
  console.log('Articles with linked event-derived state/location:', withEventStateLocation);
  console.log('Output directory:', OUT_DIR);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
