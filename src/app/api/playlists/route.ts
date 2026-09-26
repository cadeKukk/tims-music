import { getUser, handle, requireUser } from '@/lib/auth';
import { createPlaylist, listLibrary } from '@/lib/playlists';

export const dynamic = 'force-dynamic';

// The signed-in user's library (own + shared + saved). Guests have none.
export const GET = handle(async () => {
  const user = await getUser();
  return Response.json(user ? await listLibrary(user) : []);
});

export const POST = handle(async (req: Request) => {
  const user = await requireUser();
  const body = await req.json().catch(() => ({}));
  const id = await createPlaylist(
    user,
    typeof body.name === 'string' ? body.name : '',
    body.visibility === 'public' ? 'public' : 'private',
    Array.isArray(body.trackIds) ? body.trackIds.slice(0, 1000) : [],
  );
  return Response.json({ id }, { status: 201 });
});
