/**
 * Generate Mapbox Static Images API URL for a location
 * Uses the same style as the interactive map (src/pages/visualize/map.astro) for consistency
 */

// Mapbox configuration - matches src/pages/visualize/map.astro exactly
const DEFAULT_MAPBOX_STYLE = 'kevinhegg/cmd4pgf7p01ud01s4awo3b3yd';
const DEFAULT_MAPBOX_TOKEN = 'pk.eyJ1Ijoia2V2aW5oZWdnIiwiYSI6ImNscmprbG80NzA0aW8ybm94bXFveG1qcmYifQ.z0za-koZbyVbgwJ5AVg9LA';

export function getMapboxStaticImageUrl(
  longitude: number,
  latitude: number,
  options: {
    width?: number;
    height?: number;
    zoom?: number;
    token?: string;
    style?: string;
    offsetRight?: boolean; // Offset center to the right to account for left panel
  } = {}
): string | null {
  // Validate coordinates
  if (!longitude || !latitude || longitude === 0 || latitude === 0) {
    return null;
  }

  // Default options - using same style and token as interactive map page
  const width = options.width || 300;
  const height = options.height || 300;
  const zoom = options.zoom || 13; // Good zoom level for city/town view
  const token = options.token || import.meta.env.PUBLIC_MAPBOX_TOKEN || DEFAULT_MAPBOX_TOKEN;
  const style = options.style || DEFAULT_MAPBOX_STYLE;

  // Calculate center offset to account for left metadata panel
  // Offset longitude to the right (increase) so marker appears centered when left panel is visible
  // Offset amount depends on zoom level - higher zoom needs less offset
  const offsetAmount = options.offsetRight !== false ? (0.15 / Math.pow(2, zoom - 10)) : 0;
  const centerLongitude = longitude + offsetAmount;
  const centerLatitude = latitude;

  // Mapbox Static Images API format with marker overlay:
  // https://api.mapbox.com/styles/v1/{username}/{style_id}/static/{overlay}/{lon},{lat},{zoom}/{width}x{height}@2x?access_token={token}
  // Marker overlay format: pin-{size}-{label}+{color}({lon},{lat})
  // Options: pin-s (small) or pin-l (large)
  // For red pin without label: pin-l+ff0000(lon,lat) or pin-l+red(lon,lat)
  const baseUrl = 'https://api.mapbox.com/styles/v1';
  
  // Use large red pin marker to match interactive map's visible circle markers
  // Format: pin-l+ff0000(lon,lat) - large pin, red color (#ff0000), no label
  // Marker stays at actual coordinates, but center is offset
  const markerOverlay = `pin-l+ff0000(${longitude},${latitude})`;
  
  // URL format: /static/{overlay}/{lon},{lat},{zoom}/{width}x{height}@2x?access_token={token}
  // Center point is offset to the right, but marker stays at original coordinates
  const url = `${baseUrl}/${style}/static/${markerOverlay}/${centerLongitude},${centerLatitude},${zoom}/${width}x${height}@2x?access_token=${token}`;

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
