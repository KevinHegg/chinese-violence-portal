# Google Apps Script Setup for Automatic Map Image Generation

This guide explains how to set up automatic map image generation in your Google Sheet using Apps Script.

## Overview

The Apps Script will:
- **Automatically generate** map images when you add/update latitude/longitude coordinates
- **Save images** to a Google Drive folder
- **Trigger on edit** - runs immediately when coordinates are changed

## Setup Steps

### 1. Open Apps Script Editor

1. Open your Chinese Lynchings Google Sheet
2. Go to **Extensions** → **Apps Script**
3. Delete any existing code in the editor

### 2. Copy the Script

1. Open `GOOGLE_APPS_SCRIPT_MAP_IMAGES.js` from this repository
2. Copy the entire contents
3. Paste into the Apps Script editor

### 3. Configure the Script

Update these values at the top of the script:

```javascript
// Google Drive folder ID where images will be saved
const DRIVE_FOLDER_ID = 'YOUR_DRIVE_FOLDER_ID_HERE';

// Column indices (adjust based on your sheet structure)
const COLUMN_IDENTIFIER = 1; // Column with lynching-id
const COLUMN_LATITUDE = 15;  // Your Latitude column number
const COLUMN_LONGITUDE = 16; // Your Longitude column number

// Sheet name to monitor
const SHEET_NAME = 'Public'; // or 'Main' if that's where coordinates are
```

**To find your Drive Folder ID:**
1. Create a folder in Google Drive (or use an existing one)
2. Open the folder
3. Look at the URL: `https://drive.google.com/drive/folders/FOLDER_ID_HERE`
4. Copy the `FOLDER_ID_HERE` part

**To find column numbers:**
- Column A = 1, B = 2, C = 3, D = 4, etc.
- Count from left to right to find your Identifier, Latitude, and Longitude columns

### 4. Save the Script

1. Click **Save** (💾 icon) or press `Ctrl+S` / `Cmd+S`
2. Give it a name like "Map Image Generator"

### 5. Set Up Triggers

**For automatic generation on edit:**

1. Click the **Triggers** icon (⏰ clock) in the left sidebar
2. Click **+ Add Trigger** (bottom right)
3. Configure:
   - **Function to run:** `onEdit`
   - **Event source:** `From spreadsheet`
   - **Event type:** `On edit`
4. Click **Save**
5. Authorize the script when prompted (first time only)

**Optional: Generate all existing images:**

1. In Apps Script editor, select function `generateAllMapImages`
2. Click **Run** (▶️ icon)
3. Authorize if prompted
4. Check execution log to see progress

### 6. Test It

1. Edit a latitude or longitude value in your sheet
2. Wait a few seconds
3. Check your Google Drive folder - you should see a new `.png` file named after the record identifier

## How It Works

1. **When you edit coordinates:** The `onEdit` trigger fires
2. **Script checks:** Was latitude or longitude column edited?
3. **If yes:** Generates Mapbox URL, downloads image, saves to Drive
4. **File naming:** Uses the identifier (e.g., `CA1853-02-21.png`)

## Integration with Your Website

You have two options for using these Drive images:

### Option A: Use Google Drive as Image Source

1. Make the Drive folder public (or share with "Anyone with the link")
2. Get the public URL format for images
3. Update your website to use Drive URLs instead of local files

### Option B: Sync Drive to Repository

1. Use a GitHub Action or similar to periodically sync Drive folder to `public/mapimages/`
2. Or manually download from Drive and commit to repo

### Option C: Keep Current System

- Apps Script generates images in Drive (backup/archive)
- Netlify build script downloads to repo during deployment
- Website uses repo images

## Troubleshooting

**Script not running?**
- Check that triggers are set up correctly
- Check execution log for errors
- Ensure you've authorized the script

**Images not generating?**
- Verify column numbers are correct
- Check that coordinates are valid (not 0, not empty)
- Check execution log for error messages

**Rate limiting?**
- Mapbox has rate limits on API calls
- The script includes delays to avoid this
- If you hit limits, wait a few minutes and try again

## Manual Functions

You can also run these functions manually from the Apps Script editor:

- `generateAllMapImages()` - Generate images for all rows with coordinates
- `generateMapImageForIdentifier('CA1853-02-21')` - Generate image for specific record
