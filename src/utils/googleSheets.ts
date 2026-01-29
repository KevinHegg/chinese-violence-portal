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
      "pretext-grouped": getField(["Pretext Grouped", "pretext-grouped", "Pretext_Grouped"]),
      "accusation": getField(["Accusation or Pretext", "Accusation or Pretext", "accusation"]),
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
