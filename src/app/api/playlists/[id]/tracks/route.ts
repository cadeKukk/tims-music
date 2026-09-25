import { addTracks, isUuid, removeTrack, reorderTracks } from '@/lib/playlists';

type Ctx = RouteContext<'/api/playlists/[id]/tracks'>;

async function parse(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  return { id: isUuid(id) ? id : null, body };
}

// Add tracks: { trackIds: string[] } -> { added }
export async function POST(req: Request, ctx: Ctx) {
  const { id, body } = await parse(req, ctx);
  if (!id || !Array.isArray(body.trackIds)) return Response.json({ error: 'bad request' }, { status: 400 });
  return Response.json({ added: await addTracks(id, body.trackIds.slice(0, 1000)) });
}

// Remove one track: { trackId }
export async function DELETE(req: Request, ctx: Ctx) {
  const { id, body } = await parse(req, ctx);
  if (!id || !isUuid(body.trackId)) return Response.json({ error: 'bad request' }, { status: 400 });
  await removeTrack(id, body.trackId);
  return new Response(null, { status: 204 });
}

// Reorder: { trackIds } in the new order
export async function PUT(req: Request, ctx: Ctx) {
  const { id, body } = await parse(req, ctx);
  if (!id || !Array.isArray(body.trackIds)) return Response.json({ error: 'bad request' }, { status: 400 });
  await reorderTracks(id, body.trackIds);
  return new Response(null, { status: 204 });
}
