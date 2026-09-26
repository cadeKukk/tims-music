import { getUser, handle, HttpError, requireUser } from '@/lib/auth';
import { deletePlaylist, getPlaylist, updatePlaylist } from '@/lib/playlists';
import { deleteObject } from '@/lib/r2';

export const dynamic = 'force-dynamic';
type Ctx = RouteContext<'/api/playlists/[id]'>;

// ?t=<share token> lets guests open link-shared playlists.
export const GET = handle(async (req: Request, ctx: Ctx) => {
  const token = new URL(req.url).searchParams.get('t');
  const playlist = await getPlaylist((await ctx.params).id, await getUser(), token);
  if (!playlist) throw new HttpError(404, "That playlist doesn't exist or isn't shared with you.");
  return Response.json(playlist);
});

export const PATCH = handle(async (req: Request, ctx: Ctx) => {
  const user = await requireUser();
  const body = await req.json().catch(() => ({}));
  await updatePlaylist(user, (await ctx.params).id, { name: body.name, description: body.description, visibility: body.visibility });
  return new Response(null, { status: 204 });
});

export const DELETE = handle(async (_req: Request, ctx: Ctx) => {
  const user = await requireUser();
  const coverKey = await deletePlaylist(user, (await ctx.params).id);
  if (coverKey) await deleteObject(coverKey);
  return new Response(null, { status: 204 });
});
