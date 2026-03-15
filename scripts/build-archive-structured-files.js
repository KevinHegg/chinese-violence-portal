/**
 * build-archive-structured-files.js
 *
 * Generates canonical archive-structured files for manual upload to the
 * john-crow-archive-structured vector store. Do NOT create or manage the
 * vector store; this script only produces the corpus files.
 *
 * Source: public/data/johncrow_data.json (from build-johncrow-json.mjs)
 * Output: data/vectorstore/archive-structured/
 *
 * Rerun after major archive dataset updates.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

const SOURCE_PATH = path.join(ROOT, 'public/data/johncrow_data.json');
const OUT_DIR = path.join(ROOT, 'data/vectorstore/archive-structured');

const SEP = '\n---\n';

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
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeWhitespace(text) {
  if (text == null || text === '') return '';
  return String(text)
    .replace(/\u240A/g, '\n') // ⏎
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function decadeFromYear(year) {
  if (year == null || typeof year !== 'number' || Number.isNaN(year)) return '';
  const d = Math.floor(Number(year) / 10) * 10;
  return `${d}s`;
}

function requireSource(data) {
  if (!data || typeof data !== 'object') {
    throw new Error(`Invalid source data: expected object, got ${typeof data}`);
  }
  if (!Array.isArray(data.records)) {
    throw new Error('Source missing "records" array. Is public/data/johncrow_data.json from build-johncrow-json.mjs?');
  }
  if (!Array.isArray(data.articles)) {
    throw new Error('Source missing "articles" array.');
  }
}

function buildEventBlock(record) {
  const id = record.id ?? '';
  const date = record.date ?? '';
  const year = record.year ?? '';
  const state = record.state ?? '';
  const location = record.place ?? '';
  const title = record.narrative_title || record.narrative_short_title || '';
  const url = record.url || `https://johncrow.org/records/${id}`;
  const summary = stripHtml(record.narrative_summary ?? '');
  const narrative = stripHtml(record.narrative_summary ?? '');
  const decade = decadeFromYear(year);

  const lines = [
    '---',
    `Record ID: ${id}`,
    `Date: ${date}`,
    `Year: ${year}`,
    `Decade: ${decade}`,
    `State: ${state}`,
    `Location: ${location}`,
    `Title: ${title}`,
    `URL: ${url}`,
    'Summary:',
    summary || '(unavailable)',
    '',
    'Narrative:',
    narrative || '(unavailable)',
    '---',
  ];
  return lines.join('\n');
}

function buildArticleBlock(article) {
  const id = article.article_id ?? '';
  const linkedId = article.lynching_id ?? '';
  const headline = (article.headline ?? '').replace(/\n/g, ' ');
  const newspaper = article.publication ?? '';
  const pubDate = article.date ?? '';
  const url = article.url || `https://johncrow.org/articles/${id}`;
  const summary = stripHtml(article.summary ?? '');

  const lines = [
    '---',
    `Article ID: ${id}`,
    `Linked Record ID: ${linkedId}`,
    `Headline: ${headline}`,
    `Newspaper: ${newspaper}`,
    `Publication Date: ${pubDate}`,
    `URL: ${url}`,
    'Summary:',
    summary || '(unavailable)',
    '---',
  ];
  return lines.join('\n');
}

function buildTranscriptBlock(article) {
  const id = article.article_id ?? '';
  const linkedId = article.lynching_id ?? '';
  const headline = (article.headline ?? '').replace(/\n/g, ' ');
  const newspaper = article.publication ?? '';
  const pubDate = article.date ?? '';
  const url = article.url || `https://johncrow.org/articles/${id}`;
  const transcript = normalizeWhitespace(stripHtml(article.transcript ?? ''));

  const lines = [
    '---',
    `Article ID: ${id}`,
    `Linked Record ID: ${linkedId}`,
    `Headline: ${headline}`,
    `Newspaper: ${newspaper}`,
    `Publication Date: ${pubDate}`,
    `URL: ${url}`,
    'Transcript:',
    transcript || '(unavailable)',
    '---',
  ];
  return lines.join('\n');
}

function buildNarrativeBlock(record) {
  const id = record.id ?? '';
  const date = record.date ?? '';
  const location = record.place ?? '';
  const title = record.narrative_title || record.narrative_short_title || '';
  const url = record.url || `https://johncrow.org/records/${id}`;
  const narrative = stripHtml(record.narrative_summary ?? '');

  const lines = [
    '---',
    `Record ID: ${id}`,
    `Date: ${date}`,
    `Location: ${location}`,
    `Title: ${title}`,
    `URL: ${url}`,
    'Narrative:',
    narrative || '(unavailable)',
    '---',
  ];
  return lines.join('\n');
}

async function main() {
  console.log('Source:', SOURCE_PATH);

  let raw;
  try {
    raw = await fs.readFile(SOURCE_PATH, 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT') {
      throw new Error(`Missing source file: ${SOURCE_PATH}. Run "npm run build:archive" first.`);
    }
    throw err;
  }

  let data;
  try {
    data = JSON.parse(raw);
  } catch (err) {
    throw new Error(`Invalid JSON in ${SOURCE_PATH}: ${err.message}`);
  }

  requireSource(data);
  const records = data.records;
  const articles = data.articles;

  await fs.mkdir(OUT_DIR, { recursive: true });

  const eventsMd = records.map(buildEventBlock).join(SEP);
  const eventsPath = path.join(OUT_DIR, 'archive-events.md');
  await fs.writeFile(eventsPath, eventsMd, 'utf8');
  console.log('Event records written:', records.length, '→', eventsPath);

  const articlesMd = articles.map(buildArticleBlock).join(SEP);
  const articlesPath = path.join(OUT_DIR, 'archive-articles.md');
  await fs.writeFile(articlesPath, articlesMd, 'utf8');
  console.log('Article records written:', articles.length, '→', articlesPath);

  const transcriptsMd = articles.map(buildTranscriptBlock).join(SEP);
  const transcriptsPath = path.join(OUT_DIR, 'archive-article-transcripts.md');
  await fs.writeFile(transcriptsPath, transcriptsMd, 'utf8');
  const withTranscript = articles.filter((a) => (a.transcript ?? '').trim().length > 0).length;
  console.log('Article transcripts written:', articles.length, `(${withTranscript} with transcript text) →`, transcriptsPath);

  const narrativesMd = records.map(buildNarrativeBlock).join(SEP);
  const narrativesPath = path.join(OUT_DIR, 'archive-record-narratives.md');
  await fs.writeFile(narrativesPath, narrativesMd, 'utf8');
  const withNarrative = records.filter((r) => (r.narrative_summary ?? '').trim().length > 0).length;
  console.log('Record narratives written:', records.length, `(${withNarrative} with narrative text) →`, narrativesPath);

  const combinedParts = [
    '# Archive events',
    eventsMd,
    '',
    '# Archive articles',
    articlesMd,
    '',
    '# Article transcripts',
    transcriptsMd,
    '',
    '# Record narratives',
    narrativesMd,
  ];
  const combinedPath = path.join(OUT_DIR, 'archive-structured-combined.md');
  await fs.writeFile(combinedPath, combinedParts.join('\n\n'), 'utf8');
  console.log('Combined file written →', combinedPath);

  console.log('');
  console.log('Output directory:', OUT_DIR);
  console.log('Add these files manually to the john-crow-archive-structured vector store.');
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
