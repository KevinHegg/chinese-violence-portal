import type { APIRoute } from 'astro';
import { fetchLynchingsData, fetchLynchingsMainData } from '../../utils/googleSheets';

// Cache for 1 minute so spreadsheet edits show up quickly
const cache: Record<string, { data: any[]; time: number }> = {};
const CACHE_DURATION = 60 * 1000; // 1 minute

export const GET: APIRoute = async ({ request }) => {
  try {
    const url = new URL(request.url);
    const gid = url.searchParams.get('gid');
    const nocache = url.searchParams.get('nocache') === '1';
    const cacheKey = gid || 'default';
    
    // Check cache (skip if nocache=1 for immediate spreadsheet updates)
    const now = Date.now();
    if (!nocache && cache[cacheKey] && (now - cache[cacheKey].time) < CACHE_DURATION) {
      return new Response(JSON.stringify(cache[cacheKey].data), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=60, must-revalidate', // 5 minutes
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
        'Cache-Control': 'public, max-age=60, must-revalidate',
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
