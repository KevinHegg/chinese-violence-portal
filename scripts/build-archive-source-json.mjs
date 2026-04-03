import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'csv-parse/sync';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const CURRENT_SITE_URL = 'https://chineseredrecord.org';
const LEGACY_SITE_URL = 'https://johncrow.org';

const LYNCHINGS_SHEET_ID = '18Bo9acVyuQTsdQ1baxSntSUZur50Yla8NcZKe2nZWyQ';
// Use the Main tab for authoritative lynching/event data (default gid from site config)
const LYNCHINGS_MAIN_GID = process.env.PUBLIC_LYNCHINGS_MAIN_GID || '760826284';

const ARTICLES_SHEET_ID = '1ZRNb-M7aO0-j58avDV9JyMsHMllKNmewWm7dmZy7JPw';

async function fetchCsv(sheetId, gid) {
  const url = gid
    ? `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`
    : `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv`;

  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(
      `Failed to fetch CSV ${url} (${res.status} ${res.statusText}): ${text.slice(0, 200)}`
    );
  }
  return res.text();
}

function parseCsv(text) {
  if (!text.trim()) return [];
  return parse(text, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });
}

function getField(row, names) {
  for (const name of names) {
    if (name in row && row[name]) return String(row[name]).trim();
    const variants = [
      name.toLowerCase(),
      name.toUpperCase(),
      name.replace(/ /g, '-'),
      name.replace(/ /g, '_'),
      name.replace(/-/g, ' '),
    ];
    for (const v of variants) {
      if (v in row && row[v]) return String(row[v]).trim();
    }
  }
  return '';
}

function normalizeText(value) {
  if (value == null) return null;
  let text = String(value);
  if (!text.trim()) return null;
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&ldquo;/g, '"')
    .replace(/&rdquo;/g, '"')
    .replace(/&lsquo;/g, "'")
    .replace(/&rsquo;/g, "'")
    .replace(/&ndash;/g, '–')
    .replace(/&mdash;/g, '—')
    .replace(/\u2018/g, "'")
    .replace(/\u2019/g, "'")
    .replace(/\u201C/g, '"')
    .replace(/\u201D/g, '"')
    .replace(/\u00a0/g, ' ')
    .replace(/bloodiest decade of John Crow/g, 'bloodiest decade of anti-Chinese racial terror')
    .replace(/John Crow Project dataset/g, 'Chinese Red Record archive dataset')
    .replace(/John Crow dataset/g, 'Chinese Red Record archive dataset')
    .replace(/John Crow Archive/g, 'Chinese Red Record archive')
    .replace(/John Crow Project/g, 'Chinese Red Record')
    .trim();
}

function normalizeArchiveUrl(url, fallbackPath) {
  const raw = String(url || '').trim();
  if (!raw) return `${CURRENT_SITE_URL}${fallbackPath}`;
  if (raw.startsWith('/')) return `${CURRENT_SITE_URL}${raw}`;
  return raw.replace(LEGACY_SITE_URL, CURRENT_SITE_URL);
}

function parseDateWithPrecision(dateStr) {
  const raw = (dateStr || '').trim();
  if (!raw) {
    return {
      date: null,
      year: null,
      month: null,
      day: null,
      date_precision: null,
    };
  }

  const parts = raw.split('-');
  const year = parts[0] && /^\d{4}$/.test(parts[0]) ? Number.parseInt(parts[0], 10) : null;
  const monthRaw = parts[1] || '00';
  const dayRaw = parts[2] || '00';

  const month = monthRaw !== '00' && /^\d{2}$/.test(monthRaw) ? Number.parseInt(monthRaw, 10) : null;
  const day = dayRaw !== '00' && /^\d{2}$/.test(dayRaw) ? Number.parseInt(dayRaw, 10) : null;

  let precision = null;
  if (year && !month && !day) {
    precision = 'year';
  } else if (year && month && !day) {
    precision = 'month';
  } else if (year && month && day) {
    precision = 'day';
  }

  return {
    date: raw,
    year,
    month,
    day,
    date_precision: precision,
  };
}

function buildRecords(rows) {
  return rows
    .map((row) => {
      const id = getField(row, ['Identifier', 'identifier', 'lynching-id', 'Lynching ID']);
      if (!id) return null;

      const link = getField(row, ['Link', 'link', 'URL', 'url']);
      const dateRaw = getField(row, ['Date', 'date']);
      const dateInfo = parseDateWithPrecision(dateRaw);

      const state = normalizeText(getField(row, ['State', 'state']));
      const county = normalizeText(getField(row, ['County', 'county']));
      const city = normalizeText(getField(row, ['City', 'city']));

      const newspaperIdsRaw = getField(row, ['Newspaper IDs', 'Newspaper ID', 'article-ids', 'Article IDs']);
      const newspaper_ids = newspaperIdsRaw
        ? newspaperIdsRaw
            .split(';')
            .map((s) => s.trim())
            .filter((s) => s.length > 0)
        : [];

      let place = null;
      if (city && state) {
        place = `${city}, ${state}`;
      } else if (county && state) {
        place = `${county}, ${state}`;
      } else if (state) {
        place = state;
      }

      const killingMethodGrouped = getField(row, [
        'Killing Method Grouped',
        'killing-method-grouped',
        'Killing Method Grouped ',
      ]);
      const killing_method = normalizeText(killingMethodGrouped);

      return {
        id: id.trim(),
        url: normalizeArchiveUrl(link, `/records/${id.trim()}`),
        newspaper_ids,
        name: normalizeText(getField(row, ['Name', 'name'])),
        gender: normalizeText(getField(row, ['Gender', 'gender'])),
        date: dateInfo.date,
        year: dateInfo.year,
        month: dateInfo.month,
        day: dateInfo.day,
        date_precision: dateInfo.date_precision,
        state,
        county,
        city,
        place,
        category_of_violence: normalizeText(getField(row, ['Category of Violence', 'category-of-violence'])),
        violence_category_grouped: normalizeText(
          getField(row, ['Violence Category Grouped', 'violence-category-grouped'])
        ),
        accusation_or_pretext: normalizeText(
          getField(row, ['Accusation or Pretext', 'accusation-or-pretext', 'Accusation', 'accusation'])
        ),
        pretext_grouped: normalizeText(getField(row, ['Pretext Grouped', 'pretext-grouped'])),
        killing_method,
        narrative_title: normalizeText(getField(row, ['Narrative Title', 'narrative-title'])),
        narrative_short_title: normalizeText(getField(row, ['Narrative Short Title', 'narrative-short-title'])),
        narrative_summary: normalizeText(getField(row, ['Narrative Summary', 'narrative-summary'])),
      };
    })
    .filter(Boolean);
}

function buildArticles(rows) {
  return rows
    .map((row) => {
      const articleId = getField(row, ['article-id', 'Article ID', 'article_id']);
      if (!articleId) return null;

      const lynchingId = getField(row, ['lynching-id', 'Lynching ID', 'lynching_id']);
      const link = getField(row, ['link', 'Link', 'URL', 'url']);
      const publication = normalizeText(getField(row, ['newspaper', 'Newspaper']));
      const publicationPlace = normalizeText(
        getField(row, ['newspaper-location', 'Newspaper Location', 'newspaper_location'])
      );
      const dateOriginal = getField(row, ['publication-date', 'Publication Date', 'publication_date']);
      let dateNormalized = null;
      if (dateOriginal) {
        const d = new Date(dateOriginal);
        if (!Number.isNaN(d.getTime())) {
          const y = d.getUTCFullYear().toString().padStart(4, '0');
          const m = (d.getUTCMonth() + 1).toString().padStart(2, '0');
          const da = d.getUTCDate().toString().padStart(2, '0');
          dateNormalized = `${y}-${m}-${da}`;
        }
      }

      return {
        article_id: articleId.trim(),
        lynching_id: lynchingId || null,
        url: normalizeArchiveUrl(link, `/articles/${articleId.trim()}`),
        headline: normalizeText(getField(row, ['article-title', 'Article Title', 'article_title'])),
        publication: publication,
        publication_place: publicationPlace,
        date: dateNormalized,
        transcript: normalizeText(getField(row, ['article-transcript', 'Article Transcript', 'article_transcript'])),
        summary: normalizeText(getField(row, ['article-summary', 'Article Summary', 'article_summary'])),
      };
    })
    .filter(Boolean);
}

async function main() {
  console.log('Fetching lynching records CSV…');
  const lynchingsCsv = await fetchCsv(LYNCHINGS_SHEET_ID, LYNCHINGS_MAIN_GID);
  const lynchingRows = parseCsv(lynchingsCsv);

  console.log('Fetching newspaper articles CSV…');
  const articlesCsv = await fetchCsv(ARTICLES_SHEET_ID);
  const articleRows = parseCsv(articlesCsv);

  const records = buildRecords(lynchingRows);
  const articles = buildArticles(articleRows);

  const output = {
    records,
    articles,
  };

  const outDir = path.join(ROOT_DIR, 'public', 'data');
  await fs.mkdir(outDir, { recursive: true });
  const outPath = path.join(outDir, 'johncrow_data.json');
  await fs.writeFile(outPath, JSON.stringify(output, null, 2), 'utf8');

  console.log(`Records exported: ${records.length}`);
  console.log(`Articles exported: ${articles.length}`);
  console.log(`Wrote ${outPath}`);

  const recordsWithKilling = records.filter((r) => r.killing_method);
  const recordsWithMultiNewspaperIds = records.filter(
    (r) => Array.isArray(r.newspaper_ids) && r.newspaper_ids.length > 1
  );
  console.log(`Records with killing_method populated: ${recordsWithKilling.length}`);
  console.log(`Records with multiple newspaper_ids: ${recordsWithMultiNewspaperIds.length}`);
}

main().catch((err) => {
  console.error('Error building johncrow_data.json:', err);
  process.exit(1);
});
