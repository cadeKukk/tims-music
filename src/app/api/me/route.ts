import { getUser, handle } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// Who's signed in on this device. The sync key names this user's private realtime channel.
export const GET = handle(async () => {
  const user = await getUser();
  if (!user) return Response.json({ user: null }, { headers: { 'Cache-Control': 'no-store' } });
  return Response.json(
    { user: { id: user.id, username: user.username, isAdmin: user.is_admin }, syncKey: user.sync_key, sessionId: user.sessionId },
    { headers: { 'Cache-Control': 'no-store' } },
  );
});
