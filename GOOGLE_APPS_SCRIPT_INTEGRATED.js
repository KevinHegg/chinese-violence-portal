/**
 * Integrated Google Apps Script for Chinese Lynchings Spreadsheet
 * 
 * Combines:
 * - Geocoding (generateCoordinates) - generates lat/lng from Location fields
 * - Map Image Generation - automatically creates map images when coordinates are updated
 * 
 * SETUP:
 * 1. Enable "Maps" service: Resources > Advanced Google Services > Maps
 * 2. Enable "Drive API" service: Resources > Advanced Google Services > Drive API
 * 3. Update configuration values below (MAPBOX_TOKEN, DRIVE_FOLDER_ID, etc.)
 * 4. Set up onEdit trigger (see instructions at bottom)
 */

// ==================== CONFIGURATION ====================
const APP_URL = 'https://www.appsheet.com/start/48f0e037-ce97-4c48-97d9-1531c7e14dd6?platform=desktop#appName=chinese-lynchings-master-370664303&vss=H4sIAAAAAAAAA6WPSwvCMBCE_8ueW6iIIrmJChbRg4qXpoe02WKwJqVJfVDy301aH2f1uLvzzc60cBF43RmWn4Ak7Wda4R0InBa29wopEAozJU2tSgoBhQ0798s508dMsZpTsGDT4GVgUANpv-TJn_8DEBylEYXA2pt51Jk8QXf2mFu8IbABnBvDshK7zB7SWGJukG_VNeZdiTUT0ttMB5PROIyGYRR5sMc6tVByKbRRtcuc9PrUWqcpVN5o5AfX6pc2OpaLW8UkXyvuwhWs1GgfV5KLnbMBAAA=&view=Dashboard';

// Mapbox configuration
const MAPBOX_STYLE = 'kevinhegg/cmd4pgf7p01ud01s4awo3b3yd';
const MAPBOX_TOKEN = 'pk.eyJ1Ijoia2V2aW5oZWdnIiwiYSI6ImNscmprbG80NzA0aW8ybm94bXFveG1qcmYifQ.z0za-koZbyVbgwJ5AVg9LA';

// Google Drive folder ID where images will be saved
// To get this: Open the folder in Drive, copy the ID from the URL
const DRIVE_FOLDER_ID = 'YOUR_DRIVE_FOLDER_ID_HERE';

// Column indices (1-based for getRange, 0-based for array access)
// Column A = 1 (Row ID / Identifier)
const COLUMN_ROW_ID = 1; // Column with identifier (e.g., "CA1853-02-21")
// Column M = 13 (Latitude)
const COLUMN_LATITUDE = 13;
// Column N = 14 (Longitude)
const COLUMN_LONGITUDE = 14;
// Column for storing Google Drive file ID (use an empty column, e.g., Column T = 20)
const COLUMN_MAP_IMAGE_FILE_ID = 20;

// Sheet name to monitor (usually "Main" or "Public")
const SHEET_NAME = 'Main';

// ==================== EXISTING FUNCTIONS ====================

function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu("Tools")
    .addItem('Open AppSheet', 'openAppSheet')
    .addItem("Generate Long/Lat Coordinates", "generateCoordinates")
    .addToUi();
}

/** Opens a small dialog that auto-opens AppSheet in a new tab, with a clickable fallback. */
function openAppSheet() {
  const tmpl = HtmlService.createTemplateFromFile('Launcher');
  tmpl.url = APP_URL;
  const html = tmpl.evaluate().setWidth(420).setHeight(140);
  SpreadsheetApp.getUi().showModalDialog(html, 'Open AppSheet');
}

function generateCoordinates() {
  // Use the active sheet (e.g., 'Main') to ensure it runs on the data you are viewing.
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet(); 
  
  if (!sheet) {
    SpreadsheetApp.getUi().alert("Error: Could not find the active sheet.");
    return;
  }

  const data = sheet.getDataRange().getValues();
  
  // 1-based column indices for writing:
  // Column M (Latitude) is the 13th column.
  const latCol = 13; 
  // Column N (Longitude) is the 14th column.
  const lngCol = 14; 
  
  let updated = 0;
  let imagesGenerated = 0;
  
  // Start loop from i=1 to skip the header row (i=0).
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    
    // 0-based array indices for reading:
    // State (Column J) is the 10th column, so index 9 in the 0-based array.
    const state = row[9];
    // City (Column L) is the 12th column, so index 11 in the 0-based array.
    const city = row[11];
    
    // Skip if City or State is empty.
    if (!city || !state) continue;
    
    const address = `${city}, ${state}`;
    
    try {
      // NOTE: Maps.newGeocoder() requires the "Advanced Geocoding" service to be enabled in the Apps Script project.
      const geo = Maps.newGeocoder().geocode(address);
      
      if (geo.status === "OK" && geo.results && geo.results.length > 0) {
        const location = geo.results[0].geometry.location;
        
        // i + 1 is the 1-based row number. latCol/lngCol are 1-based column numbers.
        sheet.getRange(i + 1, latCol).setValue(location.lat);
        sheet.getRange(i + 1, lngCol).setValue(location.lng);
        updated++;
        
        // Generate map image for this row (if row ID exists)
        const rowId = row[COLUMN_ROW_ID - 1]; // Convert to 0-based index
        if (rowId) {
          const imageGenerated = generateMapImageForRow(sheet, i + 1, rowId, location.lat, location.lng);
          if (imageGenerated) {
            imagesGenerated++;
          }
        }
      }
    } catch (err) {
      Logger.log(`Error geocoding row ${i + 1}: ${err}`);
      continue;
    }
  }
  
  let message = `Geocoding complete. Updated ${updated} row(s) on sheet '${sheet.getName()}'.`;
  if (imagesGenerated > 0) {
    message += ` Generated ${imagesGenerated} map image(s).`;
  }
  SpreadsheetApp.getUi().alert(message);
}

function submitTestIncident() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Submissions");

  const timestamp = new Date(); // Auto-filled timestamp

  const formSubmission = {
    yourName: "Kevin Hegg",
    yourEmail: "kevin@example.com",
    victimName: "Unknown (Community-wide attack)",
    eventDate: "March 11–12, 1889",
    eventYear: "1889",
    city: "Milwaukee",
    state: "Wisconsin",
    category: "Riot",
    pretext: "Accused of assaulting white girls",
    vocation: "Laundrymen",
    sources: "https://www.wuwm.com/2022-05-12/how-milwaukees-anti-chinese-riot-of-1889-drove-out-an-entire-community",
    additionalDetails: "Mob violence over two nights targeted Chinese laundries across Milwaukee. Most of the Chinese community fled the city.",
  };

  // Arrange values to match column order in sheet
  const row = [
    timestamp,
    formSubmission.yourName,
    formSubmission.yourEmail,
    formSubmission.victimName,
    formSubmission.eventDate,
    formSubmission.eventYear,
    formSubmission.city,
    formSubmission.state,
    formSubmission.category,
    formSubmission.pretext,
    formSubmission.vocation,
    formSubmission.sources,
    formSubmission.additionalDetails,
    formSubmission.latitude,
    formSubmission.longitude
  ];

  sheet.appendRow(row);
}

function createForm() {
  const formTitle = "Anti-Chinese Violence Incident Submission";
  const sheetId = "18Bo9acVyuQTsdQ1baxSntSUZur50Yla8NcZKe2nZWyQ";
  const sheetName = "Submissions";

  // Create the form
  const form = FormApp.create(formTitle);
  form.setDescription("Please use this form to submit information about incidents of anti-Chinese violence.");

  // Add form fields
  form.addTextItem().setTitle("Your Name").setRequired(true);
  form.addTextItem().setTitle("Your Email Address").setRequired(true);
  form.addTextItem().setTitle("Victim Name").setRequired(true);
  form.addDateItem().setTitle("Event Date").setRequired(true);
  form.addTextItem().setTitle("City").setRequired(true);

  // Add US States dropdown
  const states = ["Alabama","Alaska","Arizona","Arkansas","California","Colorado","Connecticut","Delaware",
                  "Florida","Georgia","Hawaii","Idaho","Illinois","Indiana","Iowa","Kansas","Kentucky","Louisiana",
                  "Maine","Maryland","Massachusetts","Michigan","Minnesota","Mississippi","Missouri","Montana",
                  "Nebraska","Nevada","New Hampshire","New Jersey","New Mexico","New York","North Carolina",
                  "North Dakota","Ohio","Oklahoma","Oregon","Pennsylvania","Rhode Island","South Carolina",
                  "South Dakota","Tennessee","Texas","Utah","Vermont","Virginia","Washington","West Virginia",
                  "Wisconsin","Wyoming"];
  form.addListItem()
      .setTitle("State")
      .setChoiceValues(states)
      .setRequired(true);

  // Add Category of Violence dropdown
  const categories = ["Lynching", "Possible Lynching", "Riot", "Massacre", "Other"];
  form.addListItem()
      .setTitle("Category of Violence")
      .setChoiceValues(categories)
      .setRequired(true);

  form.addTextItem().setTitle("Pretext").setRequired(false);
  form.addTextItem().setTitle("Victim's Vocation").setRequired(false);

  form.addParagraphTextItem().setTitle("Primary Sources (include links)").setRequired(false);

  // Link form responses to the "Submissions" sheet
  const sheet = SpreadsheetApp.openById(sheetId);
  const formSheet = sheet.getSheetByName(sheetName);
  form.setDestination(FormApp.DestinationType.SPREADSHEET, sheetId);

  Logger.log("Form created: " + form.getEditUrl());
  Logger.log("Public Form URL: " + form.getPublishedUrl());
}

// ==================== MAP IMAGE GENERATION FUNCTIONS ====================

/**
 * Generate Mapbox Static Images API URL
 */
function generateMapboxUrl(longitude, latitude, zoom = 13, width = 300, height = 300) {
  if (!longitude || !latitude || longitude === 0 || latitude === 0) {
    return null;
  }
  
  const markerOverlay = `pin-l+ff0000(${longitude},${latitude})`;
  const baseUrl = 'https://api.mapbox.com/styles/v1';
  const url = `${baseUrl}/${MAPBOX_STYLE}/static/${markerOverlay}/${longitude},${latitude},${zoom}/${width}x${height}@2x?access_token=${MAPBOX_TOKEN}`;
  
  return url;
}

/**
 * Download image from URL and save to Google Drive
 * Returns the file ID for constructing public Drive URLs
 * Overwrites existing files with the same name
 */
function downloadAndSaveImage(imageUrl, fileName, folderId) {
  try {
    const response = UrlFetchApp.fetch(imageUrl);
    const blob = response.getBlob();
    blob.setName(fileName);
    
    const folder = DriveApp.getFolderById(folderId);
    
    // Check if file already exists and delete it (overwrite behavior)
    const existingFiles = folder.getFilesByName(fileName);
    while (existingFiles.hasNext()) {
      existingFiles.next().setTrashed(true);
    }
    
    // Create new file
    const file = folder.createFile(blob);
    
    // Make file publicly viewable (required for direct URL access)
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    
    // Return file ID (not URL) - we'll use this to construct the public URL
    return file.getId();
  } catch (error) {
    Logger.log(`Error downloading ${fileName}: ${error.toString()}`);
    return null;
  }
}

/**
 * Generate map image for a specific row
 * Only called when coordinates are updated
 */
function generateMapImageForRow(sheet, rowNumber, rowId, latitude, longitude) {
  try {
    // Validate data
    if (!rowId || !latitude || !longitude || latitude === 0 || longitude === 0) {
      return false;
    }
    
    // Generate Mapbox URL
    const mapboxUrl = generateMapboxUrl(longitude, latitude);
    if (!mapboxUrl) {
      return false;
    }
    
    // Download and save image (named by Row ID)
    const fileName = `${rowId}.png`;
    const fileId = downloadAndSaveImage(mapboxUrl, fileName, DRIVE_FOLDER_ID);
    
    if (fileId) {
      // Store file ID in the sheet for easy URL construction
      // Check if column header exists, create if needed
      const headerRange = sheet.getRange(1, COLUMN_MAP_IMAGE_FILE_ID);
      if (!headerRange.getValue() || headerRange.getValue().toString().trim() === '') {
        headerRange.setValue('Map Image File ID');
      }
      
      // Store file ID in the row
      sheet.getRange(rowNumber, COLUMN_MAP_IMAGE_FILE_ID).setValue(fileId);
      
      Logger.log(`✅ Generated map image for ${rowId}: File ID ${fileId}`);
      return true;
    } else {
      Logger.log(`❌ Failed to generate map image for ${rowId}`);
      return false;
    }
  } catch (error) {
    Logger.log(`Error processing row ${rowNumber}: ${error.toString()}`);
    return false;
  }
}

// ==================== TRIGGER FUNCTIONS ====================

/**
 * Triggered when a cell is edited
 * Only generates map images when latitude or longitude columns are updated
 */
function onEdit(e) {
  const range = e.range;
  const sheet = range.getSheet();
  
  // Only process the specified sheet
  if (sheet.getName() !== SHEET_NAME) {
    return;
  }
  
  const row = range.getRow();
  const column = range.getColumn();
  
  // Skip header row
  if (row === 1) {
    return;
  }
  
  // Only trigger if latitude or longitude column was edited
  if (column === COLUMN_LATITUDE || column === COLUMN_LONGITUDE) {
    // Small delay to ensure sheet values are saved
    Utilities.sleep(500);
    
    // Get the row data
    const rowId = sheet.getRange(row, COLUMN_ROW_ID).getValue();
    const latitude = sheet.getRange(row, COLUMN_LATITUDE).getValue();
    const longitude = sheet.getRange(row, COLUMN_LONGITUDE).getValue();
    
    // Only generate if we have valid coordinates and a row ID
    if (rowId && latitude && longitude && latitude !== 0 && longitude !== 0) {
      generateMapImageForRow(sheet, row, rowId, latitude, longitude);
    }
  }
}

/**
 * Manual function to generate images for all rows with coordinates
 * Run this once to generate images for existing records
 */
function generateAllMapImages() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAME);
  
  if (!sheet) {
    Logger.log(`Sheet "${SHEET_NAME}" not found`);
    return;
  }
  
  const data = sheet.getDataRange().getValues();
  let successCount = 0;
  let skipCount = 0;
  
  Logger.log(`Processing ${data.length - 1} rows...`);
  
  // Start from row 2 (skip header)
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const rowId = row[COLUMN_ROW_ID - 1]; // Convert to 0-based index
    const latitude = row[COLUMN_LATITUDE - 1]; // Convert to 0-based index
    const longitude = row[COLUMN_LONGITUDE - 1]; // Convert to 0-based index
    
    if (!rowId || !latitude || !longitude || latitude === 0 || longitude === 0) {
      skipCount++;
      continue;
    }
    
    if (generateMapImageForRow(sheet, i + 1, rowId, latitude, longitude)) {
      successCount++;
    }
    
    // Small delay to avoid rate limiting
    Utilities.sleep(200);
  }
  
  Logger.log(`✅ Complete! Generated: ${successCount}, Skipped: ${skipCount}`);
}

/**
 * Generate map image for a specific row ID (useful for testing)
 */
function generateMapImageForRowId(rowId) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAME);
  
  if (!sheet) {
    Logger.log(`Sheet "${SHEET_NAME}" not found`);
    return;
  }
  
  // Find the row with this ID
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    const currentRowId = data[i][COLUMN_ROW_ID - 1];
    if (currentRowId === rowId) {
      const latitude = data[i][COLUMN_LATITUDE - 1];
      const longitude = data[i][COLUMN_LONGITUDE - 1];
      if (latitude && longitude && latitude !== 0 && longitude !== 0) {
        generateMapImageForRow(sheet, i + 1, rowId, latitude, longitude);
        return;
      }
    }
  }
  
  Logger.log(`Row ID "${rowId}" not found or missing coordinates`);
}

// ==================== SETUP TRIGGERS ====================
/**
 * To set up automatic triggers:
 * 
 * 1. In Apps Script editor, click the clock icon (Triggers) in the left sidebar
 * 2. Click "+ Add Trigger" at bottom right
 * 3. Configure:
 *    - Function: onEdit
 *    - Event source: From spreadsheet
 *    - Event type: On edit
 *    - Click Save
 * 
 * OPTIONAL: Set up time-driven trigger to regenerate all images periodically:
 * 1. Add Trigger
 * 2. Function: generateAllMapImages
 *    - Event source: Time-driven
 *    - Type: Day timer
 *    - Time: 3am to 4am (or your preference)
 *    - Click Save
 */
