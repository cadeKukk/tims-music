import { db } from '@/lib/db';

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get('q')?.trim() ?? '';
  if (q.length < 2) return Response.json({ artists: [], albums: [], tracks: [] });
  const { data, error } = await db.rpc('search_catalog', { q: q.slice(0, 80), lim: 20 });
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json(data, { headers: { 'Cache-Control': 'private, max-age=60' } });
}
