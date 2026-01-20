import type { APIRoute } from 'astro';
import { fetchArticlesData } from '../../utils/googleSheets';

// Cache for 5 minutes to reduce API calls
let cachedData: any[] | null = null;
let cacheTime = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export const GET: APIRoute = async ({ request }) => {
  try {
    // Check cache
    const now = Date.now();
    if (cachedData && (now - cacheTime) < CACHE_DURATION) {
      return new Response(JSON.stringify(cachedData), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=300', // 5 minutes
        },
      });
    }

    // Fetch fresh data from Google Sheets
    const data = await fetchArticlesData();
    
    // Update cache
    cachedData = data;
    cacheTime = now;

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=300',
      },
    });
  } catch (error) {
    console.error('Error fetching articles data:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to fetch articles data' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
};
