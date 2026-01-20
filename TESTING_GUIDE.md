# Testing Guide for Google Sheets Integration

## Quick Start

1. **Start the dev server:**
   ```bash
   npm run dev
   ```

2. **Open your browser** to `http://localhost:4321` (or the port shown in terminal)

3. **Open browser console** (F12 or Cmd+Option+I) to check for JavaScript errors

## Pages to Test

### 1. Homepage (`/`)
- ✅ Should load without errors
- ✅ Check console for any fetch errors

### 2. Explore Records (`/explore`)
- ✅ Page should load with filter dropdowns populated
- ✅ Check console for: `Failed to fetch lynchings data` errors
- ✅ Filters should work (decades, states, event types)

### 3. Records Detail Page (`/records/CA1853-02-11`)
- ✅ Should load a specific lynching record
- ✅ Check console for Google Sheets fetch errors
- ✅ Related articles should appear if available
- ✅ Navigation (prev/next) should work

### 4. Articles (`/articles/0001`)
- ✅ Should load article details
- ✅ Check console for fetch errors
- ✅ Image should load (if available)

### 5. Visualize - News (`/visualize/news`)
- ✅ Should load with article filters
- ✅ Check console for errors
- ✅ Filtering should work

### 6. Visualize - News Cloud (`/visualize/newscloud`)
- ✅ Should load word cloud
- ✅ Check console for errors

### 7. Visualize - Charts (`/visualize/charts`)
- ✅ Charts should load
- ✅ Check console for: `Failed to fetch /api/lynchings` errors
- ✅ Data should appear in charts

### 8. Map (`/visualize/map` or `/map.html`)
- ✅ Map should load
- ✅ Markers should appear
- ✅ Check console for: `Failed to fetch /api/lynchings` errors

## Common Errors to Look For

### In Browser Console:

1. **CORS Errors:**
   ```
   Access to fetch at 'https://docs.google.com/...' from origin 'http://localhost:4321' has been blocked by CORS policy
   ```
   **Fix:** Make sure Google Sheets are published to web

2. **404 Errors:**
   ```
   Failed to fetch Google Sheet: 404 Not Found
   ```
   **Fix:** Check sheet IDs in `src/utils/googleSheets.ts`

3. **CSV Parse Errors:**
   ```
   Error parsing CSV data
   ```
   **Fix:** Check CSV format, ensure proper headers

4. **Empty Data:**
   ```
   No data returned from Google Sheets
   ```
   **Fix:** Check column mapping in `convertToLynchingFormat()` or `convertToArticleFormat()`

5. **Type Errors:**
   ```
   Cannot read property 'find' of undefined
   ```
   **Fix:** Data fetching failed, check network tab

## Network Tab Checks

1. Open DevTools → Network tab
2. Filter by "Fetch/XHR"
3. Look for:
   - `/api/lynchings` - should return 200 with JSON data
   - `/api/articles` - should return 200 with JSON data
   - Google Sheets URLs - should return CSV data

## Expected Behavior

- **First Load:** May take 2-5 seconds as it fetches from Google Sheets
- **Subsequent Loads:** Should be faster (5-minute cache)
- **Data Updates:** Changes in Google Sheets appear within 5 minutes

## Debugging Steps

1. **Check API endpoints directly:**
   - Visit `http://localhost:4321/api/lynchings`
   - Visit `http://localhost:4321/api/articles`
   - Should return JSON arrays

2. **Check Google Sheets URLs:**
   - Test the export URLs in browser:
     - `https://docs.google.com/spreadsheets/d/18Bo9acVyuQTsdQ1baxSntSUZur50Yla8NcZKe2nZWyQ/export?format=csv`
     - `https://docs.google.com/spreadsheets/d/1ZRNb-M7aO0-j58avDV9JyMsHMllKNmewWm7dmZy7JPw/export?format=csv`

3. **Check Server Logs:**
   - Look for errors in terminal where `npm run dev` is running
   - Check for TypeScript compilation errors

## Fallback Testing

If Google Sheets aren't published yet, the pages will fail. You can temporarily:

1. Keep the old JSON files in `src/data/`
2. Modify pages to fallback to JSON if Google Sheets fetch fails
3. Or test with published sheets first

## Success Indicators

✅ No console errors  
✅ Pages load with data  
✅ Filters work  
✅ Navigation works  
✅ Charts/maps display data  
✅ API endpoints return JSON  
