import { db } from '@/lib/db';
import { handle, requireAdmin } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export const GET = handle(async () => {
  await requireAdmin();
  const [{ data: users }, { data: sessions }, { data: lists }] = await Promise.all([
    db.from('users').select('id, username, is_admin, locked_until, created_at, last_seen_at').order('created_at'),
    db.from('sessions').select('user_id'),
    db.from('playlists').select('owner_id'),
  ]);
  const count = (rows: { [k: string]: string }[] | null, key: string) => {
    const m = new Map<string, number>();
    for (const r of rows ?? []) m.set(r[key], (m.get(r[key]) ?? 0) + 1);
    return m;
  };
  const devices = count(sessions, 'user_id');
  const playlists = count(lists, 'owner_id');
  return Response.json((users ?? []).map((u) => ({
    ...u,
    locked: !!u.locked_until && new Date(u.locked_until) > new Date(),
    devices: devices.get(u.id) ?? 0,
    playlists: playlists.get(u.id) ?? 0,
  })));
});
