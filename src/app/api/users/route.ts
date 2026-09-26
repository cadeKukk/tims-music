import { db } from '@/lib/db';
import { handle } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// Everyone with an account, for the share dropdown and the People page.
export const GET = handle(async () => {
  const [{ data: users }, { data: lists }] = await Promise.all([
    db.from('users').select('id, username, created_at').order('username'),
    db.from('playlists').select('owner_id').eq('visibility', 'public'),
  ]);
  const counts = new Map<string, number>();
  for (const l of lists ?? []) counts.set(l.owner_id, (counts.get(l.owner_id) ?? 0) + 1);
  return Response.json((users ?? []).map((u) => ({ ...u, publicPlaylists: counts.get(u.id) ?? 0 })));
});
