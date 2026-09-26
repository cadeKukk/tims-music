import { db } from '@/lib/db';
import { handle, HttpError } from '@/lib/auth';
import { listPublicByOwner } from '@/lib/playlists';

export const dynamic = 'force-dynamic';

export const GET = handle(async (_req: Request, ctx: RouteContext<'/api/profiles/[username]'>) => {
  const { username } = await ctx.params;
  const { data: user } = await db.from('users').select('id, username, created_at').eq('username', username).maybeSingle();
  if (!user) throw new HttpError(404, 'No one has that username.');
  return Response.json({ user, playlists: await listPublicByOwner(user.id) });
});
