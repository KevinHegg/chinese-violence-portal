# Data & Assets Operations

## Column Mapping Guide

# Google Sheet Column Mapping Guide

## Important: Column Conflicts

The Apps Script stores Google Drive file IDs in a column. Make sure this column doesn't conflict with your existing data columns.

## Current Configuration

- **File ID Column**: Column 21 (U) - `COLUMN_MAP_IMAGE_FILE_ID = 21`
- **Source Column**: Check which column your "Source" field is in

## How to Find Your Column Numbers

1. Open your Google Sheet
2. Look at the column headers (A, B, C, D, etc.)
3. Count from left to right:
   - Column A = 1
   - Column B = 2
   - Column C = 3
   - ...
   - Column T = 20
   - Column U = 21
   - Column V = 22

## If Source Column Was Overwritten

If the script accidentally wrote file IDs to your Source column:

1. **Backup your Source data** (if you have it elsewhere)
2. **Create a new column** for "Map Image File ID" (e.g., Column U = 21)
3. **Update the script** to use the new column number
4. **Re-run the script** to populate file IDs in the correct column
5. **Restore your Source data** to the original Source column

## Recommended Column Layout

- Column 1 (A): Identifier / Row ID
- Column 13 (M): Latitude
- Column 14 (N): Longitude
- Column 20 (T) or earlier: Source (your original source data)
- Column 21 (U): Map Image File ID (new column for file IDs)

## Updating the Script

If you need to change the file ID column, edit `GOOGLE_APPS_SCRIPT_INTEGRATED.js`:

```javascript
const COLUMN_MAP_IMAGE_FILE_ID = 21; // Change this number to your desired column
```

Then re-run the script to populate file IDs in the correct column.

---

## Fallback Image Workflow

# Fallback Image Setup Instructions

## Overview

The Apps Script expects a fallback image named `no-map-thumbnail-available.png` to be uploaded to your Google Drive folder. This image is used for records that don't have location information.

## Image Specifications

- **Filename:** `no-map-thumbnail-available.png` (exact name required)
- **Size:** 300x300 pixels (recommended)
- **Format:** PNG (with transparency support)
- **Content:** Should display "No map thumbnail currently available" or similar message

## Upload Instructions

1. **Create or obtain the image:**
   - Use the provided `no-map-thumbnail-available.svg` as a starting point
   - Convert SVG to PNG (300x300px) using any image editor
   - Or create your own design matching your site's aesthetic

2. **Upload to Google Drive:**
   - Open your Drive folder: `1WcC8CIAGv4HtRiBNFLjLAm7MkeMeGZto`
   - Upload the image file
   - **Rename it exactly to:** `no-map-thumbnail-available.png`
   - Make sure it's publicly viewable (right-click → Share → "Anyone with the link can view")

3. **Verify:**
   - The file should be visible in your Drive folder
   - The filename must match exactly (case-sensitive)
   - The file should be publicly accessible

## Using the SVG Template

If you want to use the provided SVG template:

1. Open `no-map-thumbnail-available.svg` in a vector graphics editor (Inkscape, Adobe Illustrator, etc.)
2. Customize colors/text to match your site design
3. Export as PNG at 300x300 pixels
4. Upload to Drive folder with the exact filename

## Alternative: Quick PNG Creation

You can also create a simple placeholder using any image editor:
- Background: Light beige/cream (#faf9f6 or similar)
- Border: Amber/brown (#d4a574 or similar)
- Icon: Simple map pin or location marker
- Text: "No map thumbnail currently available"

The script will automatically use this image for any records without location data.

---

## Source Column Fix / Migration Notes

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

