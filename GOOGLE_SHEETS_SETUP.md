# Google Sheets Integration Setup

This website now fetches data directly from Google Sheets instead of using static JSON files. When you update your Google Sheets, the website will automatically reflect those changes.

## Required Setup

### 1. Publish Your Google Sheets

Both sheets must be published to the web for the export URLs to work:

#### For Lynchings Sheet (18Bo9acVyuQTsdQ1baxSntSUZur50Yla8NcZKe2nZWyQ):
1. Open the sheet: https://docs.google.com/spreadsheets/d/18Bo9acVyuQTsdQ1baxSntSUZur50Yla8NcZKe2nZWyQ/edit
2. Go to **File → Share → Publish to web**
3. Select the **"Public"** tab
4. Choose **"Comma-separated values (.csv)"** format
5. Click **"Publish"**
6. Copy the published URL (you may need the gid parameter)

#### For Articles Sheet (1ZRNb-M7aO0-j58avDV9JyMsHMllKNmewWm7dmZy7JPw):
1. Open the sheet: https://docs.google.com/spreadsheets/d/1ZRNb-M7aO0-j58avDV9JyMsHMllKNmewWm7dmZy7JPw/edit
2. Go to **File → Share → Publish to web**
3. Select the appropriate tab (usually the first/main tab)
4. Choose **"Comma-separated values (.csv)"** format
5. Click **"Publish"**

### 2. Finding the Tab ID (gid)

If you need to specify a specific tab (not the first one):

1. Open your Google Sheet
2. Click on the tab you want to use
3. Look at the URL - it will contain `#gid=XXXXXXX` where XXXXXXX is the tab ID
4. Or use the published URL which includes the gid parameter

### 3. Update Sheet IDs (if needed)

If your sheet IDs change, update them in:
- `src/utils/googleSheets.ts` in the `fetchLynchingsData()` and `fetchArticlesData()` functions

## How It Works

1. **Server-Side Rendering**: Pages fetch data from Google Sheets at request time
2. **API Endpoints**: `/api/lynchings` and `/api/articles` provide cached JSON data
3. **Caching**: Data is cached for 5 minutes to reduce API calls
4. **Automatic Updates**: Changes to Google Sheets appear on the website within 5 minutes

## Column Mapping

The system automatically maps Google Sheets columns to JSON fields. The mapping handles:
- Case variations (e.g., "Name" vs "name")
- Space/dash variations (e.g., "article-id" vs "article_id" vs "Article ID")

### Lynchings Sheet Columns:
- `Identifier` → `lynching-id`
- `Newspaper IDs` → `article-ids` (comma-separated)
- `Name` → `victim-names` (comma-separated)
- `Gender` → `victim-gender`
- `Number of Victims` → `number-of-victims`
- `Date` → `date`
- `Year` → `year`
- `Decade` → `decade`
- `State` → `state`
- `County` → `county`
- `City` → `city`
- `Latitude` → `latitude`
- `Longitude` → `longitude`
- `Category of Violence` → `event-type`
- `Accusation or Pretext` → `accusation`
- `Job` → `job`
- `Newly Documented` → `newly-documented`
- `Source` → `source`
- `Narrative Title` → `narrative-title`
- `Narrative Short Title` → `narrative-short-title`
- `Narrative Summary` → `narrative-body`
- `Notes` → `narrative-summary`

### Articles Sheet Columns:
- `article-id` → `article-id`
- `lynching-id` → `lynching-id`
- `image_name` → `image_name`
- `newspaper` → `newspaper`
- `newspaper-location` → `newspaper-location`
- `publication-date-expanded` → `publication-date-expanded`
- `publication-date` → `publication-date`
- `page` → `page`
- `article-title` → `article-title`
- `article-transcript` → `article-transcript`
- `article-summary` → `article-summary`
- `turabian-citation` → `turabian-citation`

## Troubleshooting

### Data Not Updating
- Check that sheets are published to web
- Verify the sheet IDs are correct
- Check browser console for errors
- Clear cache (data is cached for 5 minutes)

### Missing Data
- Verify column headers match expected names (case-insensitive)
- Check that rows have required fields (lynching-id or article-id)
- Empty rows are automatically filtered out

### Performance Issues
- Data is cached for 5 minutes
- Consider increasing cache duration if sheets don't change frequently
- For high-traffic sites, consider using a database instead

## Testing

To test the integration:

1. Make a small change to your Google Sheet
2. Wait up to 5 minutes (cache duration)
3. Refresh the website - changes should appear

Or force a refresh by:
- Clearing the cache in `src/pages/api/lynchings.ts` and `src/pages/api/articles.ts`
- Restarting the development server

## Migration Notes

The old JSON files (`src/data/lynchings.json` and `src/data/articles.json`) have been removed from the codebase. All lynching and article data now comes exclusively from Google Sheets via the API endpoints.
