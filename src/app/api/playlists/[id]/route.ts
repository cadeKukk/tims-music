import { deletePlaylist, getPlaylist, isUuid, updatePlaylist } from '@/lib/playlists';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, ctx: RouteContext<'/api/playlists/[id]'>) {
  const playlist = await getPlaylist((await ctx.params).id);
  if (!playlist) return Response.json({ error: 'not found' }, { status: 404 });
  return Response.json(playlist);
}

export async function PATCH(req: Request, ctx: RouteContext<'/api/playlists/[id]'>) {
  const { id } = await ctx.params;
  if (!isUuid(id)) return Response.json({ error: 'not found' }, { status: 404 });
  const body = await req.json().catch(() => ({}));
  if (body.name !== undefined && (typeof body.name !== 'string' || !body.name.trim())) {
    return Response.json({ error: 'name required' }, { status: 400 });
  }
  await updatePlaylist(id, { name: body.name, description: body.description });
  return new Response(null, { status: 204 });
}

export async function DELETE(_req: Request, ctx: RouteContext<'/api/playlists/[id]'>) {
  const { id } = await ctx.params;
  if (!isUuid(id)) return Response.json({ error: 'not found' }, { status: 404 });
  await deletePlaylist(id);
  return new Response(null, { status: 204 });
}
