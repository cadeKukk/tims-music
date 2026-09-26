import { cookies } from 'next/headers';
import { db } from '@/lib/db';
import { getUser } from '@/lib/auth';

// Anonymous per-browser id so plays can later be split per listener without accounts.
const LISTENER_COOKIE = 'tm_listener';

// Called by the player once a track has been listened to for 30s (or half its length).
export async function POST(req: Request) {
  const { trackId } = await req.json().catch(() => ({}));
  if (typeof trackId !== 'string' || !/^[0-9a-f-]{36}$/i.test(trackId)) {
    return Response.json({ error: 'bad track id' }, { status: 400 });
  }
  const jar = await cookies();
  let listener = jar.get(LISTENER_COOKIE)?.value;
  if (!listener) {
    listener = crypto.randomUUID();
    jar.set(LISTENER_COOKIE, listener, {
      httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 60 * 60 * 24 * 365, path: '/',
    });
  }
  const user = await getUser();
  const { error } = await db.from('plays').insert({ track_id: trackId, listener_id: listener, user_id: user?.id ?? null });
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return new Response(null, { status: 204 });
}
