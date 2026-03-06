import type { APIRoute } from 'astro';
import { fetchDocentToursData } from '../../utils/googleSheets';

let cache: { data: any[]; time: number } | null = null;
const CACHE_DURATION = 2 * 60 * 1000; // 2 minutes

export const GET: APIRoute = async ({ request }) => {
  try {
    const url = new URL(request.url);
    const nocache = url.searchParams.get('nocache') === '1';
    const now = Date.now();
    let data: any[];
    if (!nocache && cache && now - cache.time < CACHE_DURATION) {
      data = cache.data;
    } else {
      const tours = await fetchDocentToursData();
      data = tours.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
      cache = { data, time: now };
    }
    return new Response(JSON.stringify({ tours: data }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=120, must-revalidate',
      },
    });
  } catch (error) {
    console.error('Error fetching docent tours:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to fetch docent tours' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
