import { randomInt, randomUUID } from 'node:crypto';
import { db } from '@/lib/db';
import { handle, hashPin, HttpError, requireAdmin } from '@/lib/auth';

type Ctx = RouteContext<'/api/admin/users/[id]'>;

// { action: 'reset-pin' | 'unlock' | 'make-admin' | 'remove-admin' }
export const POST = handle(async (req: Request, ctx: Ctx) => {
  const admin = await requireAdmin();
  const { id } = await ctx.params;
  const { action } = await req.json().catch(() => ({}));
  if (action === 'reset-pin') {
    const pin = String(randomInt(0, 1_000_000)).padStart(6, '0');
    await db.from('users').update({
      pin_hash: await hashPin(pin), failed_attempts: 0, locked_until: null, sync_key: randomUUID(),
    }).eq('id', id);
    await db.from('sessions').delete().eq('user_id', id);
    return Response.json({ pin }); // shown to the admin once
  }
  if (action === 'unlock') {
    await db.from('users').update({ failed_attempts: 0, locked_until: null }).eq('id', id);
  } else if (action === 'make-admin' || action === 'remove-admin') {
    if (id === admin.id && action === 'remove-admin') throw new HttpError(400, "You can't remove your own admin access.");
    await db.from('users').update({ is_admin: action === 'make-admin' }).eq('id', id);
  } else {
    throw new HttpError(400, 'Unknown action.');
  }
  return new Response(null, { status: 204 });
});

export const DELETE = handle(async (_req: Request, ctx: Ctx) => {
  const admin = await requireAdmin();
  const { id } = await ctx.params;
  if (id === admin.id) throw new HttpError(400, "You can't delete your own account here.");
  await db.from('users').delete().eq('id', id);
  return new Response(null, { status: 204 });
});
