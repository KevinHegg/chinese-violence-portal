/**
 * Generate Google Drive image URL using file ID
 * 
 * When Apps Script saves an image to Google Drive, it stores the file ID
 * in a sheet column. We use that file ID to construct a public URL.
 * 
 * Google Drive public file URL format:
 * https://drive.google.com/uc?export=view&id=FILE_ID
 * 
 * This requires the file to be set to "Anyone with the link can view"
 * (which Apps Script does automatically).
 */

/**
 * Generate Google Drive image URL from file ID
 * 
 * @param fileId - The Google Drive file ID (stored in sheet by Apps Script)
 * @returns Google Drive public URL or null if no file ID
 */
export function getGoogleDriveImageUrl(fileId?: string | null): string | null {
  if (!fileId || fileId.trim() === '') {
    return null;
  }
  
  // Google Drive public file URL
  // The file must be set to "Anyone with the link can view"
  return `https://drive.google.com/uc?export=view&id=${fileId}`;
}

/**
 * Get map image URL with fallback chain:
 * 1. Google Drive (if file ID exists in data)
 * 2. Local static file (/mapimages/{id}.png)
 * 3. Mapbox API (on-demand generation)
 * 
 * @param identifier - The lynching identifier
 * @param driveFileId - Optional Google Drive file ID (from sheet column)
 * @param longitude - Longitude for Mapbox fallback
 * @param latitude - Latitude for Mapbox fallback
 * @returns Object with primary URL and fallback URL
 */
export function getMapImageUrlWithFallback(
  identifier: string,
  driveFileId?: string | null,
  longitude?: number,
  latitude?: number
): { primary: string; fallback: string | null } {
  // Try Google Drive first (if file ID exists)
  const driveUrl = getGoogleDriveImageUrl(driveFileId);
  if (driveUrl) {
    return {
      primary: driveUrl,
      fallback: `/mapimages/${identifier}.png` // Fallback to local
    };
  }
  
  // Fallback to local static file
  const localUrl = `/mapimages/${identifier}.png`;
  
  // Mapbox API as final fallback (if coordinates exist)
  const mapboxUrl = (longitude && latitude && longitude !== 0 && latitude !== 0)
    ? getMapboxStaticImageUrl(longitude, latitude)
    : null;
  
  return {
    primary: localUrl,
    fallback: mapboxUrl
  };
}

import { getMapboxStaticImageUrl } from './mapboxStaticImage';
