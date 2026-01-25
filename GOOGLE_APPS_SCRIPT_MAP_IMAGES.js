/**
 * Google Apps Script for Automatic Map Image Generation
 * 
 * This script automatically generates and saves map images when:
 * - A new row is added with latitude/longitude coordinates
 * - Latitude or longitude values are updated in existing rows
 * 
 * SETUP INSTRUCTIONS:
 * 1. Open your Chinese Lynchings Google Sheet
 * 2. Go to Extensions > Apps Script
 * 3. Paste this code
 * 4. Update the configuration values below (MAPBOX_TOKEN, DRIVE_FOLDER_ID, etc.)
 * 5. Save the script
 * 6. Set up triggers (see instructions at bottom)
 */

// ==================== CONFIGURATION ====================
const MAPBOX_STYLE = 'kevinhegg/cmd4pgf7p01ud01s4awo3b3yd';
const MAPBOX_TOKEN = 'pk.eyJ1Ijoia2V2aW5oZWdnIiwiYSI6ImNscmprbG80NzA0aW8ybm94bXFveG1qcmYifQ.z0za-koZbyVbgwJ5AVg9LA';

// Google Drive folder ID where images will be saved
// To get this: Open the folder in Drive, copy the ID from the URL
const DRIVE_FOLDER_ID = 'YOUR_DRIVE_FOLDER_ID_HERE';

// Column indices (adjust based on your sheet structure)
// Column A = 1, B = 2, C = 3, etc.
const COLUMN_IDENTIFIER = 1; // Column with lynching-id (e.g., "CA1853-02-21)
const COLUMN_LATITUDE = 15; // Adjust to your Latitude column
const COLUMN_LONGITUDE = 16; // Adjust to your Longitude column

// Sheet name to monitor (usually "Public" or "Main")
const SHEET_NAME = 'Public';

// ==================== HELPER FUNCTIONS ====================

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
 */
function downloadAndSaveImage(imageUrl, fileName, folderId) {
  try {
    const response = UrlFetchApp.fetch(imageUrl);
    const blob = response.getBlob();
    blob.setName(fileName);
    
    const folder = DriveApp.getFolderById(folderId);
    
    // Check if file already exists and delete it
    const existingFiles = folder.getFilesByName(fileName);
    while (existingFiles.hasNext()) {
      existingFiles.next().setTrashed(true);
    }
    
    // Create new file
    const file = folder.createFile(blob);
    return file.getUrl();
  } catch (error) {
    Logger.log(`Error downloading ${fileName}: ${error.toString()}`);
    return null;
  }
}

/**
 * Generate map image for a specific row
 */
function generateMapImageForRow(sheet, row) {
  try {
    // Get values from the row
    const identifier = sheet.getRange(row, COLUMN_IDENTIFIER).getValue();
    const latitude = sheet.getRange(row, COLUMN_LATITUDE).getValue();
    const longitude = sheet.getRange(row, COLUMN_LONGITUDE).getValue();
    
    // Validate data
    if (!identifier || !latitude || !longitude || latitude === 0 || longitude === 0) {
      return false;
    }
    
    // Generate Mapbox URL
    const mapboxUrl = generateMapboxUrl(longitude, latitude);
    if (!mapboxUrl) {
      return false;
    }
    
    // Download and save image
    const fileName = `${identifier}.png`;
    const fileUrl = downloadAndSaveImage(mapboxUrl, fileName, DRIVE_FOLDER_ID);
    
    if (fileUrl) {
      Logger.log(`✅ Generated map image for ${identifier}: ${fileUrl}`);
      return true;
    } else {
      Logger.log(`❌ Failed to generate map image for ${identifier}`);
      return false;
    }
  } catch (error) {
    Logger.log(`Error processing row ${row}: ${error.toString()}`);
    return false;
  }
}

// ==================== TRIGGER FUNCTIONS ====================

/**
 * Triggered when a cell is edited
 * Checks if latitude or longitude columns were edited, then generates image
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
  
  // Check if latitude or longitude column was edited
  if (column === COLUMN_LATITUDE || column === COLUMN_LONGITUDE) {
    // Small delay to ensure sheet values are saved
    Utilities.sleep(500);
    
    // Generate map image for this row
    generateMapImageForRow(sheet, row);
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
  
  const lastRow = sheet.getLastRow();
  let successCount = 0;
  let skipCount = 0;
  
  Logger.log(`Processing ${lastRow - 1} rows...`);
  
  // Start from row 2 (skip header)
  for (let row = 2; row <= lastRow; row++) {
    const identifier = sheet.getRange(row, COLUMN_IDENTIFIER).getValue();
    const latitude = sheet.getRange(row, COLUMN_LATITUDE).getValue();
    const longitude = sheet.getRange(row, COLUMN_LONGITUDE).getValue();
    
    if (!identifier || !latitude || !longitude || latitude === 0 || longitude === 0) {
      skipCount++;
      continue;
    }
    
    if (generateMapImageForRow(sheet, row)) {
      successCount++;
    }
    
    // Small delay to avoid rate limiting
    Utilities.sleep(200);
  }
  
  Logger.log(`✅ Complete! Generated: ${successCount}, Skipped: ${skipCount}`);
}

/**
 * Generate map image for a specific identifier (useful for testing)
 */
function generateMapImageForIdentifier(identifier) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAME);
  
  if (!sheet) {
    Logger.log(`Sheet "${SHEET_NAME}" not found`);
    return;
  }
  
  // Find the row with this identifier
  const lastRow = sheet.getLastRow();
  for (let row = 2; row <= lastRow; row++) {
    const rowIdentifier = sheet.getRange(row, COLUMN_IDENTIFIER).getValue();
    if (rowIdentifier === identifier) {
      generateMapImageForRow(sheet, row);
      return;
    }
  }
  
  Logger.log(`Identifier "${identifier}" not found`);
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
