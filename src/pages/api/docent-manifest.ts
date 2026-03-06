import type { APIRoute } from 'astro';
import { buildDocentManifest } from '../../utils/googleSheets';

const cache: Record<string, { data: any; time: number }> = {};
const CACHE_DURATION = 2 * 60 * 1000; // 2 minutes

export const GET: APIRoute = async ({ request }) => {
  try {
    const url = new URL(request.url);
    const tourId = url.searchParams.get('tourId') || url.searchParams.get('tour_id') || '';
    const nocache = url.searchParams.get('nocache') === '1';
    if (!tourId) {
      return new Response(JSON.stringify({ error: 'Missing tourId' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    const now = Date.now();
    if (!nocache && cache[tourId] && now - cache[tourId].time < CACHE_DURATION) {
      return new Response(JSON.stringify(cache[tourId].data), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=120, must-revalidate',
        },
      });
    }
    const manifest = await buildDocentManifest(tourId);
    if (!manifest || !manifest.steps?.length) {
      return new Response(JSON.stringify({ error: 'Tour not found or has no steps' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    cache[tourId] = { data: manifest, time: now };
    return new Response(JSON.stringify(manifest), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=120, must-revalidate',
      },
    });
  } catch (error) {
    console.error('Error fetching docent manifest:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to fetch docent manifest' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
