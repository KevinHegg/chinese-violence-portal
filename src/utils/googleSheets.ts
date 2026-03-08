/**
 * Google Sheets Data Fetcher
 * Fetches data from Google Sheets and converts CSV to JSON
 */

interface GoogleSheetsConfig {
  sheetId: string;
  gid?: string; // Tab ID (gid parameter)
  tabName?: string; // Alternative: tab name
}

/**
 * Fetch CSV data from Google Sheets public export URL
 * Supports both export format and publish-to-web format
 */
export async function fetchGoogleSheetCSV(config: GoogleSheetsConfig): Promise<string> {
  const { sheetId, gid } = config;
  
  // Try export format first (more reliable)
  // Format: https://docs.google.com/spreadsheets/d/{SHEET_ID}/export?gid={GID}&format=csv
  let url = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv`;
  
  if (gid) {
    url += `&gid=${gid}`;
  }
  
  let response = await fetch(url);
  
  if (!response.ok) {
    // If export format fails and we didn't specify gid, try with gid=0 (first tab)
    if (!gid) {
      url = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=0`;
      response = await fetch(url);
    }
    
    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      throw new Error(
        `Failed to fetch Google Sheet (${response.status} ${response.statusText}): ${errorText.substring(0, 200)}\n` +
        `Make sure the sheet is published to web. URL attempted: ${url}`
      );
    }
  }
  
  return await response.text();
}

/**
 * Parse CSV/TSV string to array of objects.
 * Detects delimiter: if first line has more tabs than commas, uses tab.
 * Handles quoted fields, commas within quotes, etc.
 */
export function parseCSV(csvText: string): Record<string, string>[] {
  const lines = csvText.split('\n').filter(line => line.trim());
  
  if (lines.length < 2) {
    return [];
  }
  
  const first = lines[0];
  const tabCount = (first.match(/\t/g) || []).length;
  const commaCount = (first.match(/,/g) || []).length;
  const delim = tabCount > commaCount ? '\t' : ',';
  
  const parseLine = (line: string) => parseCSVLine(line, delim);
  
  const headers = parseLine(first).map((h: string) => h.trim());
  
  const data: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseLine(lines[i]);
    const row: Record<string, string> = {};
    
    headers.forEach((header, index) => {
      row[header] = values[index] || '';
    });
    
    if (Object.values(row).some(val => val.trim())) {
      data.push(row);
    }
  }
  
  return data;
}

/**
 * Parse a single CSV/TSV line, handling quoted fields.
 * @param delim - ',' or '\t'
 */
function parseCSVLine(line: string, delim: string = ','): string[] {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];
    
    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delim && !inQuotes) {
      values.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  values.push(current.trim());
  return values;
}

/**
 * Convert Google Sheets row data to lynching record format
 * Maps column names to JSON structure
 */
export function convertToLynchingFormat(rows: Record<string, string>[]): any[] {
  if (rows.length === 0) return [];
  
  return rows.map(row => {
    const keys = Object.keys(row);
    const getField = (possibleNames: string[]): string => {
      for (const name of possibleNames) {
        const v = row[name] ?? row[name.toLowerCase()] ?? row[name.toUpperCase()] ??
          row[name.replace(/ /g, '-')] ?? row[name.replace(/ /g, '_')] ?? row[name.replace(/-/g, ' ')];
        if (v && String(v).trim()) return String(v).trim();
      }
      return '';
    };

    // Article IDs: "Newspaper IDs" (semicolon list) or "Article ID" / "Newspaper ID" (one per row).
    // Fallback: any header containing ("article" or "newspaper") and "id".
    let articleIdsStr = getField(["Newspaper IDs", "Newspaper ID", "Article ID", "article-ids", "Article IDs", "article_id"]);
    if (!articleIdsStr) {
      for (const k of keys) {
        const lower = k.trim().toLowerCase();
        if ((lower.includes('article') || lower.includes('newspaper')) && lower.includes('id')) {
          const val = (row[k] || '').trim();
          if (val) { articleIdsStr = val; break; }
        }
      }
    }
    const raw = (articleIdsStr || '').trim().replace(/\uFF1B/g, ';');
    const sep = raw.includes(';') ? ';' : ',';
    const articleIds = raw
      ? raw.split(sep).map((id: string) => id.trim()).filter(Boolean)
      : [];
    
    // Parse victim names (comma-separated)
    const namesStr = getField(["Name", "name", "victim-names"]);
    const victimNames = namesStr
      ? namesStr.split(',').map((name: string) => name.trim()).filter(Boolean)
      : [];
    
    return {
      "lynching-id": getField(["Identifier", "identifier", "lynching-id", "Lynching ID", "Record ID"]),
      "article-ids": articleIds,
      "victim-names": victimNames.length > 0 ? victimNames : [getField(["Name", "name"]) || "Unnamed"],
      "victim-gender": getField(["Gender", "gender", "victim-gender"]),
      "number-of-victims": parseInt(getField(["Number of Victims", "number-of-victims", "Number of Victims"])) || 1,
      "date": getField(["Date", "date"]),
      "year": parseInt(getField(["Year", "year"])) || 0,
      "decade": getField(["Decade", "decade"]),
      "state": getField(["State", "state"]),
      "county": getField(["County", "county"]),
      "city": getField(["City", "city"]),
      "latitude": parseFloat(getField(["Latitude", "latitude"])) || 0,
      "longitude": parseFloat(getField(["Longitude", "longitude"])) || 0,
      "event-type": getField(["Category of Violence", "Category of Violence", "event-type"]),
      "category-of-violence": getField(["Category of Violence", "category-of-violence"]),
      "violence-category-grouped": getField(["Violence Category Grouped", "violence-category-grouped"]),
      "pretext-grouped": (() => {
        // Use "Pretext Grouped" only (singular) - exclude "Pretexts Grouped"
        for (const k of keys) {
          if (k.trim().toLowerCase() === "pretext grouped" && !k.toLowerCase().includes("pretexts")) {
            const v = (row[k] || "").trim();
            return v;
          }
        }
        return "";
      })(),
      "accusation": getField(["Accusation or Pretext", "Accusation or Pretext", "accusation"]),
      "killing-method": getField(["Killing Method", "Killing Method", "killing-method"]),
      "killing-method-grouped": (() => {
        // Use "Killing Method Grouped" only - exclude ungrouped "Killing Method" (e.g. "Shooting")
        for (const k of keys) {
          if (k.trim().toLowerCase() === "killing method grouped") {
            const v = (row[k] || "").trim();
            return v;
          }
        }
        return "";
      })(),
      "job": getField(["Job", "job"]),
      "newly-documented": getField(["Newly Documented", "Newly Documented", "newly-documented"]) === "TRUE" ? "Yes" : "No",
      "compiled-by": getField(["Compiled By", "compiled-by", "Compiled By"]),
      "narrative-title": getField(["Narrative Title", "Narrative Title", "narrative-title"]),
      "narrative-short-title": getField(["Narrative Short Title", "Narrative Short Title", "narrative-short-title"]),
      "narrative-body": getField(["Narrative Summary", "Narrative Summary", "narrative-body", "Notes"]),
      "narrative-summary": getField(["Notes", "notes", "narrative-summary"]),
      "map-image-file-id": getField(["Map Image File ID", "map-image-file-id", "Map Image File ID"])
    };
  }).filter(item => item["lynching-id"] && item["lynching-id"].trim()); // Filter out empty rows
}

/**
 * Convert Google Sheets row data to article format
 */
export function convertToArticleFormat(rows: Record<string, string>[]): any[] {
  if (rows.length === 0) return [];
  
  return rows.map(row => {
    // Helper to get field value (case-insensitive, handles various formats)
    const getField = (possibleNames: string[]): string => {
      for (const name of possibleNames) {
        const value = row[name] || 
                     row[name.toLowerCase()] || 
                     row[name.toUpperCase()] ||
                     row[name.replace(/ /g, '-')] ||
                     row[name.replace(/ /g, '_')] ||
                     row[name.replace(/-/g, ' ')] ||
                     '';
        if (value) return value;
      }
      return '';
    };
    
    // Extract year from publication-date if publication-year is not available
    const publicationDate = getField(["publication-date", "Publication Date", "publication_date"]);
    const publicationYear = getField(["publication-year", "Publication Year", "publication_year", "Year"]) 
      || (publicationDate ? publicationDate.split('-')[0] : '');
    
    // Derive decade from publication year if not explicitly provided
    let decade = getField(["decade", "Decade"]);
    if (!decade && publicationYear) {
      const year = parseInt(publicationYear);
      if (!isNaN(year)) {
        decade = `${Math.floor(year / 10) * 10}s`;
      }
    }
    
    // Extract full state name from newspaper-location column
    // Format is typically "City, State" (e.g., "San Francisco, California")
    let state = '';
    const newspaperLocation = getField(["newspaper-location", "Newspaper Location", "newspaper_location"]);
    if (newspaperLocation) {
      const locationParts = newspaperLocation.split(',').map(s => s.trim());
      if (locationParts.length > 1) {
        // Take the last part as the state (e.g., "California" from "San Francisco, California")
        const lastPart = locationParts[locationParts.length - 1];
        if (lastPart && lastPart.length > 0) {
          state = lastPart;
        }
      }
    }
    
    return {
      "article-id": getField(["article-id", "Article ID", "article_id"]),
      "lynching-id": getField(["lynching-id", "Lynching ID", "lynching_id"]) || "",
      "image_name": getField(["image_name", "Image Name", "image-name"]),
      "newspaper": getField(["newspaper", "Newspaper"]),
      "newspaper-location": getField(["newspaper-location", "Newspaper Location", "newspaper_location"]),
      "publication-date-expanded": getField(["publication-date-expanded", "Publication Date Expanded", "publication_date_expanded"]),
      "publication-date": publicationDate,
      "publication-year": publicationYear,
      "page": getField(["page", "Page"]),
      "article-title": getField(["article-title", "Article Title", "article_title"]),
      "article-transcript": getField(["article-transcript", "Article Transcript", "article_transcript"]),
      "article-summary": getField(["article-summary", "Article Summary", "article_summary"]),
      "turabian-citation": getField(["turabian-citation", "Turabian Citation", "turabian_citation"]),
      "clip_url": getField(["clip_url", "Clip URL", "clip-url"]),
      "state": state || "",
      "decade": decade || "",
      "named-entities": getField(["named-entities", "Named Entities", "named_entities"])
    };
  }).filter(item => item["article-id"] && item["article-id"].trim()); // Filter out empty rows
}

/**
 * Fetch and parse lynchings data from Google Sheets
 */
export async function fetchLynchingsData(): Promise<any[]> {
  // Sheet ID from the URL: 18Bo9acVyuQTsdQ1baxSntSUZur50Yla8NcZKe2nZWyQ
  // Tab: "Public" (gid: 378919265)
  // Using the specific gid for the "Public" tab to ensure we get the correct data
  const csv = await fetchGoogleSheetCSV({
    sheetId: '18Bo9acVyuQTsdQ1baxSntSUZur50Yla8NcZKe2nZWyQ',
    gid: '378919265', // Public tab
  });
  
  const rows = parseCSV(csv);
  return convertToLynchingFormat(rows);
}

/**
 * Fetch and parse lynchings data from the Main tab
 */
export async function fetchLynchingsMainData(gid?: string): Promise<any[]> {
  // Sheet ID from the URL: 18Bo9acVyuQTsdQ1baxSntSUZur50Yla8NcZKe2nZWyQ
  // Tab: "Main" (use provided gid; default to 0)
  const csv = await fetchGoogleSheetCSV({
    sheetId: '18Bo9acVyuQTsdQ1baxSntSUZur50Yla8NcZKe2nZWyQ',
    gid: gid || '0',
  });

  const rows = parseCSV(csv);
  return convertToLynchingFormat(rows);
}

/**
 * Fetch and parse articles data from Google Sheets
 */
export async function fetchArticlesData(): Promise<any[]> {
  // Sheet ID from the URL: 1ZRNb-M7aO0-j58avDV9JyMsHMllKNmewWm7dmZy7JPw
  const csv = await fetchGoogleSheetCSV({
    sheetId: '1ZRNb-M7aO0-j58avDV9JyMsHMllKNmewWm7dmZy7JPw',
  });
  
  const rows = parseCSV(csv);
  return convertToArticleFormat(rows);
}

// ---------------------------------------------------------------------------
// Digital Docent tours from Google Sheets CSV (pub URLs)
// ---------------------------------------------------------------------------

// Use export URL (returns CSV). Pub URL can return HTML cookie wall when fetched server-side.
const DOCENT_SHEET_ID = '18Bo9acVyuQTsdQ1baxSntSUZur50Yla8NcZKe2nZWyQ';
const DOCENT_TOURS_GID = '363105803';
const DOCENT_STEPS_GID = '1633268045';
const DOCENT_TOURS_CSV_URL = `https://docs.google.com/spreadsheets/d/${DOCENT_SHEET_ID}/export?format=csv&gid=${DOCENT_TOURS_GID}`;
const DOCENT_STEPS_CSV_URL = `https://docs.google.com/spreadsheets/d/${DOCENT_SHEET_ID}/export?format=csv&gid=${DOCENT_STEPS_GID}`;

function getField(row: Record<string, string>, keys: string[]): string {
  const normalized: Record<string, string> = {};
  for (const k of Object.keys(row)) {
    const n = k.toLowerCase().trim().replace(/\s+/g, '_');
    normalized[n] = row[k];
  }
  for (const key of keys) {
    const n = key.toLowerCase().replace(/\s+/g, '_').trim();
    const v = normalized[n];
    if (v !== undefined && v !== '') return v;
  }
  return '';
}

function normalizeBool(val: string): boolean {
  if (val === undefined || val === null) return false;
  const t = String(val).trim().toUpperCase();
  return t === 'TRUE' || t === '1' || t === 'YES' || t === 'Y';
}

/** For optional flags like enabled: empty/missing = true (include row). */
function normalizeBoolOptional(val: string): boolean {
  if (val === undefined || val === null) return true;
  const t = String(val).trim();
  if (t === '') return true;
  return normalizeBool(t);
}

function normalizeHighlight(val: string): boolean | string | null {
  if (val === undefined || val === null) return null;
  const t = String(val).trim();
  if (t === '') return null;
  if (t.toLowerCase() === 'false') return false;
  return t;
}

export interface DocentTourRow {
  tour_id: string;
  title: string;
  subtitle: string;
  start_label: string;
  desktop_only: boolean;
  start_route: string;
  start_anchor: string;
  version: string | null;
  enabled: boolean;
  sort_order: number;
}

export interface DocentStepRow {
  tour_id: string;
  step_number: number;
  route: string;
  anchor: string;
  highlight: string | boolean | null;
  highlight_style: string | null;
  action_type: string | null;
  action_value: string | null;
  map_focus_ring: boolean;
  title: string;
  text: string;
  enabled: boolean;
}

function normalizeTourRow(row: Record<string, string>): DocentTourRow {
  const so = getField(row, ['sort_order', 'sort order']);
  const sortOrderNum = so.trim() === '' ? 0 : parseFloat(so);
  return {
    tour_id: getField(row, ['tour_id', 'tour id', 'tourid', 'id']).trim(),
    title: getField(row, ['title']),
    subtitle: getField(row, ['subtitle']),
    start_label: getField(row, ['start_label', 'start label']),
    desktop_only: normalizeBool(getField(row, ['desktop_only', 'desktop only'])),
    start_route: getField(row, ['start_route', 'start route']),
    start_anchor: getField(row, ['start_anchor', 'start anchor']),
    version: (v => (v ? v : null))(getField(row, ['version'])),
    enabled: normalizeBoolOptional(getField(row, ['enabled'])),
    sort_order: Number.isFinite(sortOrderNum) ? Math.floor(sortOrderNum) : 0,
  };
}

function normalizeStepRow(row: Record<string, string>): DocentStepRow {
  const sn = getField(row, ['step_number', 'step number']);
  const raw = String(sn).trim();
  const parsed = parseInt(raw, 10);
  const stepNum = Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
  const mfr = getField(row, ['map_focus_ring', 'map focus ring']);
  return {
    tour_id: getField(row, ['tour_id', 'tour id']).trim(),
    step_number: stepNum,
    route: getField(row, ['route']),
    anchor: getField(row, ['anchor']),
    highlight: normalizeHighlight(getField(row, ['highlight'])),
    highlight_style: (v => (v ? v : null))(getField(row, ['highlight_style', 'highlight style'])),
    action_type: (v => (v ? v : null))(getField(row, ['action_type', 'action type'])),
    action_value: (v => (v ? v : null))(getField(row, ['action_value', 'action value'])),
    map_focus_ring: normalizeBool(mfr),
    title: getField(row, ['title']),
    text: getField(row, ['text']),
    enabled: normalizeBool(getField(row, ['enabled'])),
  };
}

/**
 * Fetch and parse docent_tours CSV from Google Sheets (export URL; same workbook as lynchings).
 * Returns rows with enabled not FALSE and non-empty tour_id, sorted by sort_order ascending.
 */
export async function fetchDocentToursData(): Promise<DocentTourRow[]> {
  const res = await fetch(DOCENT_TOURS_CSV_URL);
  if (!res.ok) throw new Error(`Docent tours CSV failed: ${res.status}`);
  const csv = await res.text();
  const rows = parseCSV(csv);
  const normalized = rows.map(normalizeTourRow);
  const enabled = normalized.filter(r => r.enabled !== false && r.tour_id.trim() !== '');
  const out = enabled.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'development') {
    console.log('[fetchDocentToursData] url=%s, csvRows=%d, afterFilter=%d, tour_ids=%s', DOCENT_TOURS_CSV_URL.slice(0, 80) + '...', rows.length, out.length, out.map(r => r.tour_id).join(', '));
  }
  return out;
}

/**
 * Fetch and parse docent_steps CSV from Google Sheets (export URL).
 */
export async function fetchDocentStepsData(): Promise<DocentStepRow[]> {
  const res = await fetch(DOCENT_STEPS_CSV_URL);
  if (!res.ok) throw new Error(`Docent steps CSV failed: ${res.status}`);
  const csv = await res.text();
  const rows = parseCSV(csv);
  return rows.map(normalizeStepRow).filter(r => r.enabled && r.tour_id.trim() !== '');
}

/** Manifest step shape consumed by DocentSidebar (matches YAML step shape). */
export interface DocentManifestStep {
  id?: number;
  route: string;
  anchor?: string;
  scrollTarget?: string;
  highlight?: string | false;
  highlightStyle?: string;
  highlightTarget?: string;
  title: string;
  text: string;
  action?: { type: string; articleId?: string };
  mapFocusRing?: boolean;
}

/** Full manifest for one tour (matches YAML + steps array). */
export interface DocentManifest {
  id?: string;
  title?: string;
  subtitle?: string;
  version?: string | null;
  steps: DocentManifestStep[];
}

/**
 * Build a single docent manifest by tour_id from tours + steps data.
 * Caller can pass pre-fetched arrays or leave undefined to fetch.
 */
export async function buildDocentManifest(
  tourId: string,
  toursOverride?: DocentTourRow[],
  stepsOverride?: DocentStepRow[]
): Promise<DocentManifest | null> {
  const tours = toursOverride ?? (await fetchDocentToursData());
  const steps = stepsOverride ?? (await fetchDocentStepsData());
  const tour = tours.find(t => t.tour_id.trim() === tourId);
  if (!tour) return null;
  const stepRows = steps
    .filter(s => s.tour_id.trim() === tourId)
    .sort((a, b) => a.step_number - b.step_number);

  if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'development' && tourId === 'gold_mountain_to_delta') {
    console.log('[buildDocentManifest] gold_mountain_to_delta parsed steps:', JSON.stringify(
      stepRows.map(s => ({ step_number: s.step_number, title: s.title?.slice(0, 40), enabled: s.enabled })), null, 2
    ));
  }
  const stepsOut: DocentManifestStep[] = stepRows.map((s, i) => {
    const anchor = s.anchor || '';
    const scrollTarget = anchor ? (anchor.startsWith('#') ? anchor : '#' + anchor) : undefined;
    const step: DocentManifestStep = {
      id: s.step_number,
      route: s.route,
      anchor,
      scrollTarget,
      title: s.title,
      text: s.text,
    };
    if (s.highlight !== null && s.highlight !== undefined) {
      step.highlight = s.highlight as string | false;
    }
    if (s.highlight_style) step.highlightStyle = s.highlight_style;
    if (s.action_type && s.action_value) {
      const at = s.action_type.toLowerCase().replace(/\s+/g, '');
      if (at === 'openarticle' || at === 'open_article') {
        step.action = { type: 'openArticle', articleId: s.action_value };
      }
    }
    if (s.map_focus_ring) step.mapFocusRing = true;
    return step;
  });
  return {
    id: tour.tour_id,
    title: tour.title,
    subtitle: tour.subtitle,
    version: tour.version,
    steps: stepsOut,
  };
}
