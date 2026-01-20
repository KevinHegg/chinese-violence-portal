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
 * Parse CSV string to array of objects
 * Handles quoted fields, commas within quotes, etc.
 */
export function parseCSV(csvText: string): Record<string, string>[] {
  const lines = csvText.split('\n').filter(line => line.trim());
  
  if (lines.length < 2) {
    return [];
  }
  
  // Parse header row
  const headers = parseCSVLine(lines[0]);
  
  // Parse data rows
  const data: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const row: Record<string, string> = {};
    
    headers.forEach((header, index) => {
      row[header] = values[index] || '';
    });
    
    // Skip completely empty rows
    if (Object.values(row).some(val => val.trim())) {
      data.push(row);
    }
  }
  
  return data;
}

/**
 * Parse a single CSV line, handling quoted fields
 */
function parseCSVLine(line: string): string[] {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];
    
    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // Escaped quote
        current += '"';
        i++; // Skip next quote
      } else {
        // Toggle quote state
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      // Field separator
      values.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  // Add last field
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
    // Helper to get field value (case-insensitive, handles spaces/dashes)
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
    
    // Parse article IDs (comma-separated)
    const articleIdsStr = getField(["Newspaper IDs", "Newspaper IDs", "article-ids"]);
    const articleIds = articleIdsStr 
      ? articleIdsStr.split(',').map((id: string) => id.trim()).filter(Boolean)
      : [];
    
    // Parse victim names (comma-separated)
    const namesStr = getField(["Name", "name", "victim-names"]);
    const victimNames = namesStr
      ? namesStr.split(',').map((name: string) => name.trim()).filter(Boolean)
      : [];
    
    return {
      "lynching-id": getField(["Identifier", "identifier", "lynching-id"]),
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
      "accusation": getField(["Accusation or Pretext", "Accusation or Pretext", "accusation"]),
      "job": getField(["Job", "job"]),
      "newly-documented": getField(["Newly Documented", "Newly Documented", "newly-documented"]) === "TRUE" ? "Yes" : "No",
      "source": getField(["Source", "source"]),
      "narrative-title": getField(["Narrative Title", "Narrative Title", "narrative-title"]),
      "narrative-short-title": getField(["Narrative Short Title", "Narrative Short Title", "narrative-short-title"]),
      "narrative-body": getField(["Narrative Summary", "Narrative Summary", "narrative-body", "Notes"]),
      "narrative-summary": getField(["Notes", "notes", "narrative-summary"])
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
      "state": getField(["state", "State"]),
      "decade": getField(["decade", "Decade"]),
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
