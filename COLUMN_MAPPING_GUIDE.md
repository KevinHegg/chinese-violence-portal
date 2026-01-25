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
