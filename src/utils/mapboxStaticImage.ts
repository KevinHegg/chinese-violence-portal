/**
 * Generate Mapbox Static Images API URL for a location
 * Uses the same style as the interactive map for consistency
 */

export function getMapboxStaticImageUrl(
  longitude: number,
  latitude: number,
  options: {
    width?: number;
    height?: number;
    zoom?: number;
    token?: string;
    style?: string;
  } = {}
): string | null {
  // Validate coordinates
  if (!longitude || !latitude || longitude === 0 || latitude === 0) {
    return null;
  }

  // Default options
  const width = options.width || 300;
  const height = options.height || 300;
  const zoom = options.zoom || 13; // Good zoom level for city/town view
  const token = options.token || import.meta.env.PUBLIC_MAPBOX_TOKEN || 'pk.eyJ1Ijoia2V2aW5oZWdnIiwiYSI6ImNscmprbG80NzA0aW8ybm94bXFveG1qcmYifQ.z0za-koZbyVbgwJ5AVg9LA';
  const style = options.style || 'kevinhegg/cmd4pgf7p01ud01s4awo3b3yd';

  // Mapbox Static Images API format with marker overlay:
  // https://api.mapbox.com/styles/v1/{username}/{style_id}/static/{overlay}/{lon},{lat},{zoom}/{width}x{height}@2x?access_token={token}
  // Overlay format: pin-s-{color}({lon},{lat}) for small red pin marker
  // Using pin-m-red for medium-sized red marker to match interactive map's circle markers
  const baseUrl = 'https://api.mapbox.com/styles/v1';
  const markerOverlay = `pin-m-red(${longitude},${latitude})`;
  const url = `${baseUrl}/${style}/static/${markerOverlay}/${longitude},${latitude},${zoom}/${width}x${height}@2x?access_token=${token}`;

  return url;
}

/**
 * Get map image URL - tries static file first, falls back to Mapbox API
 */
export function getMapImageUrl(
  lynchingId: string,
  longitude: number,
  latitude: number
): string {
  // First, try the static file (if it exists, it will load)
  // If it doesn't exist, the onerror handler will trigger
  const staticUrl = `/mapimages/${lynchingId}.png`;
  
  // Return static URL - the browser will try it first
  // If it fails, we'll use JavaScript to switch to Mapbox API
  return staticUrl;
}

/**
 * Generate Mapbox API URL for fallback
 */
export function getMapboxFallbackUrl(
  longitude: number,
  latitude: number
): string | null {
  return getMapboxStaticImageUrl(longitude, latitude);
}
