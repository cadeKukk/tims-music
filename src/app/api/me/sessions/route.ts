import { db } from '@/lib/db';
import { handle, HttpError, requireUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export const GET = handle(async () => {
  const user = await requireUser();
  const { data } = await db
    .from('sessions')
    .select('id, device_name, created_at, last_seen_at')
    .eq('user_id', user.id)
    .order('last_seen_at', { ascending: false });
  return Response.json((data ?? []).map((s) => ({ ...s, current: s.id === user.sessionId })));
});

// { id } signs out one device; { others: true } signs out everything except this one.
export const DELETE = handle(async (req: Request) => {
  const user = await requireUser();
  const { id, others } = await req.json().catch(() => ({}));
  let q = db.from('sessions').delete().eq('user_id', user.id);
  if (others) q = q.neq('id', user.sessionId);
  else if (typeof id === 'string') q = q.eq('id', id);
  else throw new HttpError(400, 'Nothing to sign out.');
  await q;
  return new Response(null, { status: 204 });
});
