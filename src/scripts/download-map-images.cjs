#!/usr/bin/env node

/**
 * Download and save static map images for all lynching records with coordinates
 * Uses Mapbox Static Images API to generate images and saves them to public/mapimages/
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

// Mapbox configuration - matches src/utils/mapboxStaticImage.ts
const MAPBOX_STYLE = 'kevinhegg/cmd4pgf7p01ud01s4awo3b3yd';
const MAPBOX_TOKEN = process.env.PUBLIC_MAPBOX_TOKEN || 'pk.eyJ1Ijoia2V2aW5oZWdnIiwiYSI6ImNscmprbG80NzA0aW8ybm94bXFveG1qcmYifQ.z0za-koZbyVbgwJ5AVg9LA';

// Google Sheets configuration
const SHEET_ID = '18Bo9acVyuQTsdQ1baxSntSUZur50Yla8NcZKe2nZWyQ';
const PUBLIC_TAB_GID = '378919265';

const MAPIMAGES_DIR = path.join(process.cwd(), 'public', 'mapimages');

// Ensure directory exists
if (!fs.existsSync(MAPIMAGES_DIR)) {
  fs.mkdirSync(MAPIMAGES_DIR, { recursive: true });
}

/**
 * Fetch CSV from Google Sheets
 */
function fetchGoogleSheetCSV(sheetId, gid) {
  return new Promise((resolve, reject) => {
    const fetchUrl = (url) => {
      https.get(url, (response) => {
        // Handle redirects
        if (response.statusCode === 301 || response.statusCode === 302 || response.statusCode === 307 || response.statusCode === 308) {
          const redirectUrl = response.headers.location;
          if (redirectUrl) {
            return fetchUrl(redirectUrl);
          }
        }
        
        if (response.statusCode !== 200) {
          reject(new Error(`Failed to fetch: ${response.statusCode}`));
          return;
        }
        
        let data = '';
        response.on('data', (chunk) => {
          data += chunk;
        });
        
        response.on('end', () => {
          resolve(data);
        });
      }).on('error', (err) => {
        reject(err);
      });
    };
    
    const url = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`;
    fetchUrl(url);
  });
}

/**
 * Parse CSV line handling quoted fields
 */
function parseCSVLine(line) {
  const values = [];
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
    } else if (char === ',' && !inQuotes) {
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
 * Parse CSV to array of objects
 */
function parseCSV(csvText) {
  const lines = csvText.split('\n').filter(line => line.trim());
  
  if (lines.length < 2) {
    return [];
  }
  
  const headers = parseCSVLine(lines[0]);
  const data = [];
  
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const row = {};
    
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
 * Convert row to lynching format
 */
function convertToLynchingFormat(rows) {
  if (rows.length === 0) return [];
  
  const getField = (row, possibleNames) => {
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
  
  return rows.map(row => {
    const namesStr = getField(row, ["Name", "name", "victim-names"]);
    const victimNames = namesStr
      ? namesStr.split(',').map(name => name.trim()).filter(Boolean)
      : [];
    
    return {
      "lynching-id": getField(row, ["Identifier", "identifier", "lynching-id"]),
      "victim-names": victimNames.length > 0 ? victimNames : [getField(row, ["Name", "name"]) || "Unnamed"],
      "latitude": parseFloat(getField(row, ["Latitude", "latitude"])) || 0,
      "longitude": parseFloat(getField(row, ["Longitude", "longitude"])) || 0,
    };
  }).filter(item => item["lynching-id"] && item["lynching-id"].trim());
}

/**
 * Generate Mapbox Static Images API URL
 */
function getMapboxStaticImageUrl(longitude, latitude, zoom = 13, width = 300, height = 300) {
  if (!longitude || !latitude || longitude === 0 || latitude === 0) {
    return null;
  }
  
  const markerOverlay = `pin-l+ff0000(${longitude},${latitude})`;
  const baseUrl = 'https://api.mapbox.com/styles/v1';
  const url = `${baseUrl}/${MAPBOX_STYLE}/static/${markerOverlay}/${longitude},${latitude},${zoom}/${width}x${height}@2x?access_token=${MAPBOX_TOKEN}`;
  
  return url;
}

/**
 * Download image from URL and save to file
 */
function downloadImage(url, filepath) {
  return new Promise((resolve, reject) => {
    https.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download: ${response.statusCode} ${response.statusMessage}`));
        return;
      }
      
      const fileStream = fs.createWriteStream(filepath);
      response.pipe(fileStream);
      
      fileStream.on('finish', () => {
        fileStream.close();
        resolve();
      });
      
      fileStream.on('error', (err) => {
        fs.unlink(filepath, () => {}); // Delete the file on error
        reject(err);
      });
    }).on('error', (err) => {
      reject(err);
    });
  });
}

/**
 * Main function
 */
async function main() {
  console.log('Fetching lynching records from Google Sheets...');
  
  try {
    const csv = await fetchGoogleSheetCSV(SHEET_ID, PUBLIC_TAB_GID);
    const rows = parseCSV(csv);
    const records = convertToLynchingFormat(rows);
    
    console.log(`Found ${records.length} records`);
    
    // Filter records with valid coordinates
    const recordsWithCoords = records.filter(record => {
      const lat = record.latitude;
      const lon = record.longitude;
      return lat && lon && lat !== 0 && lon !== 0 && record['lynching-id'];
    });
    
    console.log(`Found ${recordsWithCoords.length} records with coordinates`);
    console.log(`Downloading map images to ${MAPIMAGES_DIR}...\n`);
    
    let successCount = 0;
    let skipCount = 0;
    let errorCount = 0;
    
    for (const record of recordsWithCoords) {
      const lynchingId = record['lynching-id'];
      const filepath = path.join(MAPIMAGES_DIR, `${lynchingId}.png`);
      
      // Skip if file already exists
      if (fs.existsSync(filepath)) {
        console.log(`⏭️  Skipping ${lynchingId}.png (already exists)`);
        skipCount++;
        continue;
      }
      
      const imageUrl = getMapboxStaticImageUrl(record.longitude, record.latitude);
      
      if (!imageUrl) {
        console.log(`❌ Skipping ${lynchingId}.png (invalid coordinates)`);
        errorCount++;
        continue;
      }
      
      try {
        await downloadImage(imageUrl, filepath);
        console.log(`✅ Downloaded ${lynchingId}.png`);
        successCount++;
        
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        console.error(`❌ Error downloading ${lynchingId}.png:`, error.message);
        errorCount++;
      }
    }
    
    console.log(`\n✅ Complete!`);
    console.log(`   Success: ${successCount}`);
    console.log(`   Skipped: ${skipCount} (already exist)`);
    console.log(`   Errors: ${errorCount}`);
    
  } catch (error) {
    console.error('Error fetching data:', error);
    process.exit(1);
  }
}

// Run the script
main();
