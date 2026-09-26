import { handle, requireUser } from '@/lib/auth';
import { setSaved } from '@/lib/playlists';

// Save to / remove from your library: { saved: boolean }
export const POST = handle(async (req: Request, ctx: RouteContext<'/api/playlists/[id]/save'>) => {
  const user = await requireUser();
  const { saved } = await req.json().catch(() => ({}));
  await setSaved(user, (await ctx.params).id, !!saved);
  return new Response(null, { status: 204 });
});
