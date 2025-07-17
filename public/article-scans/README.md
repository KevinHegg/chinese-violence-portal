# Article Images Directory

This directory contains the newspaper article images referenced in the `articles.json` file.

## File Naming Convention

Article images should be named exactly as specified in the `image_name` field of the `articles.json` file. For example:

- `0001_1877-08-13_san-francisco-chronicle_reford-on-the-riots.jpg`
- `0002_1853-03-15_new-york-daily-herald_great-excitement-at-jacksonville-pursuit.jpg`

## Adding New Images

1. Place the image file in this directory
2. Ensure the filename matches exactly with the `image_name` field in `articles.json`
3. Use common web formats: JPG, PNG, or WebP
4. Optimize images for web use (recommended max width: 1200px)

## Image Requirements

- **Format**: JPG, PNG, or WebP
- **Size**: Optimized for web (max 1MB per image recommended)
- **Quality**: High enough to read newspaper text clearly
- **Naming**: Must match exactly with `image_name` in articles.json

## Fallback Behavior

If an image is not found, the system will display a "Image not available" placeholder instead of breaking the page layout. 