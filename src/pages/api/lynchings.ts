import type { APIRoute } from 'astro';
import { fetchLynchingsData, fetchLynchingsMainData } from '../../utils/googleSheets';

// Cache for 5 minutes to reduce API calls
const cache: Record<string, { data: any[]; time: number }> = {};
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export const GET: APIRoute = async ({ request }) => {
  try {
    const url = new URL(request.url);
    const gid = url.searchParams.get('gid');
    const cacheKey = gid || 'default';
    
    // Check cache
    const now = Date.now();
    if (cache[cacheKey] && (now - cache[cacheKey].time) < CACHE_DURATION) {
      return new Response(JSON.stringify(cache[cacheKey].data), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=300', // 5 minutes
        },
      });
    }

    // Fetch fresh data from Google Sheets
    let data;
    if (gid) {
      // Fetch from specific tab (e.g., Main tab with gid=760826284)
      data = await fetchLynchingsMainData(gid);
    } else {
      data = await fetchLynchingsData();
    }
    
    // Update cache
    cache[cacheKey] = { data, time: now };

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=300',
      },
    });
  } catch (error) {
    console.error('Error fetching lynchings data:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to fetch lynchings data' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
};
