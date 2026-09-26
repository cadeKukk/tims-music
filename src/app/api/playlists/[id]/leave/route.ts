import { handle, requireUser } from '@/lib/auth';
import { leave } from '@/lib/playlists';

// Removes a playlist someone shared with you from your library.
export const POST = handle(async (_req: Request, ctx: RouteContext<'/api/playlists/[id]/leave'>) => {
  const user = await requireUser();
  await leave(user, (await ctx.params).id);
  return new Response(null, { status: 204 });
});
