import type { APIRoute } from 'astro';
import { fetchTimelineData } from '../../utils/googleSheets';

let cache: { data: any[]; time: number } | null = null;
const CACHE_DURATION = 60 * 1000; // 1 minute

export const GET: APIRoute = async ({ request }) => {
  try {
    const url = new URL(request.url);
    const nocache = url.searchParams.get('nocache') === '1';
    const now = Date.now();

    let data: any[];
    if (!nocache && cache && now - cache.time < CACHE_DURATION) {
      data = cache.data;
    } else {
      data = await fetchTimelineData();
      cache = { data, time: now };
    }

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=60, must-revalidate',
      },
    });
  } catch (error) {
    console.error('Error fetching timeline data:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to fetch timeline data' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
};
