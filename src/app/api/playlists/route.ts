import { createPlaylist, listPlaylists } from '@/lib/playlists';

export const dynamic = 'force-dynamic';

export async function GET() {
  return Response.json(await listPlaylists());
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const name = typeof body.name === 'string' && body.name.trim() ? body.name : 'New playlist';
  const trackIds = Array.isArray(body.trackIds) ? body.trackIds.slice(0, 1000) : [];
  const id = await createPlaylist(name, trackIds);
  return Response.json({ id }, { status: 201 });
}
