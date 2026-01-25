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
