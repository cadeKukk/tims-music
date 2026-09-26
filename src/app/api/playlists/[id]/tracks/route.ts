import { handle, HttpError, requireUser } from '@/lib/auth';
import { addTracks, isUuid, removeTrack, reorderTracks } from '@/lib/playlists';

type Ctx = RouteContext<'/api/playlists/[id]/tracks'>;

// Add tracks: { trackIds } -> { added }
export const POST = handle(async (req: Request, ctx: Ctx) => {
  const user = await requireUser();
  const { trackIds } = await req.json().catch(() => ({}));
  if (!Array.isArray(trackIds)) throw new HttpError(400, 'trackIds required.');
  return Response.json({ added: await addTracks(user, (await ctx.params).id, trackIds.slice(0, 1000)) });
});

// Remove one track: { trackId }
export const DELETE = handle(async (req: Request, ctx: Ctx) => {
  const user = await requireUser();
  const { trackId } = await req.json().catch(() => ({}));
  if (!isUuid(trackId)) throw new HttpError(400, 'trackId required.');
  await removeTrack(user, (await ctx.params).id, trackId);
  return new Response(null, { status: 204 });
});

// Reorder: { trackIds } in the new order
export const PUT = handle(async (req: Request, ctx: Ctx) => {
  const user = await requireUser();
  const { trackIds } = await req.json().catch(() => ({}));
  if (!Array.isArray(trackIds)) throw new HttpError(400, 'trackIds required.');
  await reorderTracks(user, (await ctx.params).id, trackIds);
  return new Response(null, { status: 204 });
});
