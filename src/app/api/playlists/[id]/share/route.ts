import { handle, HttpError, requireUser } from '@/lib/auth';
import { isUuid, setMember, setShareLink } from '@/lib/playlists';

type Ctx = RouteContext<'/api/playlists/[id]/share'>;

// Link sharing on/off: { link: boolean } -> { token }
export const POST = handle(async (req: Request, ctx: Ctx) => {
  const user = await requireUser();
  const { link } = await req.json().catch(() => ({}));
  return Response.json({ token: await setShareLink(user, (await ctx.params).id, !!link) });
});

// Share with / update / remove a person: { userId, role: 'viewer' | 'editor' | null } -> members
export const PUT = handle(async (req: Request, ctx: Ctx) => {
  const user = await requireUser();
  const { userId, role } = await req.json().catch(() => ({}));
  if (!isUuid(userId) || ![null, 'viewer', 'editor'].includes(role)) throw new HttpError(400, 'userId and role required.');
  return Response.json(await setMember(user, (await ctx.params).id, userId, role));
});
