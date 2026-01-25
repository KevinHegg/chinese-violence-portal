# Fix Source Column - Step by Step

## Problem
The Apps Script wrote Google Drive file IDs to your Source column (column 20), overwriting your source data.

## Solution

### Step 1: Create New Column for File IDs
1. In your Google Sheet, add a new column (Column U = 21)
2. Name it "Map Image File ID" in the header row
3. Leave it empty for now

### Step 2: Copy File IDs from Source to New Column
1. Select all the file IDs in your Source column (column 20)
2. Copy them (Ctrl+C / Cmd+C)
3. Paste them into the new "Map Image File ID" column (column 21)
4. This preserves the file IDs while we restore Source data

### Step 3: Update the Script
1. Open `GOOGLE_APPS_SCRIPT_INTEGRATED.js` in Apps Script editor
2. The script is already updated to use column 21
3. No changes needed - just verify: `const COLUMN_MAP_IMAGE_FILE_ID = 21;`

### Step 4: Restore Your Source Data
1. If you have a backup of your Source data, paste it back into column 20
2. If you don't have a backup, you'll need to re-enter the source information

### Step 5: Verify It Works
1. Visit a record page on localhost: `http://localhost:4321/records/CA1853-02-21`
2. Check the browser's developer tools (F12) → Network tab
3. Look for image requests to `drive.google.com`
4. The map image should load from Google Drive

## Current Status
- ✅ Script updated to use column 21
- ✅ Map images are displaying (using Mapbox fallback currently)
- ⚠️ Need to move file IDs from Source column to new column
- ⚠️ Need to restore Source data

## Testing
After moving the file IDs:
1. The website will read file IDs from column 21
2. It will construct Drive URLs like: `https://drive.google.com/uc?export=view&id={FILE_ID}`
3. Images should load from your Drive folder
