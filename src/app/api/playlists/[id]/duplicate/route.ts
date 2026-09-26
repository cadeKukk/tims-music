import { handle, requireUser } from '@/lib/auth';
import { duplicatePlaylist } from '@/lib/playlists';

// Makes an editable private copy in your library: { t?: share token } -> { id }
export const POST = handle(async (req: Request, ctx: RouteContext<'/api/playlists/[id]/duplicate'>) => {
  const user = await requireUser();
  const { t } = await req.json().catch(() => ({}));
  const id = await duplicatePlaylist(user, (await ctx.params).id, typeof t === 'string' ? t : null);
  return Response.json({ id }, { status: 201 });
});
