import { db } from '@/lib/db';
import { getUser, handle, HttpError, requireUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';
const MAX_BYTES = 400_000;

// The user's last playback state (queue, position, …) so another device can pick up where they left off.
export const GET = handle(async () => {
  const user = await getUser();
  if (!user) return Response.json(null);
  const { data } = await db.from('playback_state').select('device_id, device_name, state, updated_at').eq('user_id', user.id).maybeSingle();
  return Response.json(data ?? null, { headers: { 'Cache-Control': 'no-store' } });
});

// Written by whichever device is playing. Accepts JSON or a sendBeacon text body.
export const PUT = handle(async (req: Request) => {
  const user = await requireUser();
  const raw = await req.text();
  if (raw.length > MAX_BYTES) throw new HttpError(413, 'Queue too large to sync.');
  const body = JSON.parse(raw || '{}');
  if (!body.state || typeof body.state !== 'object') throw new HttpError(400, 'state required.');
  await db.from('playback_state').upsert({
    user_id: user.id,
    device_id: String(body.deviceId ?? '').slice(0, 64),
    device_name: String(body.deviceName ?? '').slice(0, 80),
    state: body.state,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' });
  return new Response(null, { status: 204 });
});
// sendBeacon can only POST.
export const POST = PUT;
