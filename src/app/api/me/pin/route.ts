import { db } from '@/lib/db';
import { handle, hashPin, HttpError, requireUser, validatePin, verifyPin } from '@/lib/auth';

export const PATCH = handle(async (req: Request) => {
  const user = await requireUser();
  const { currentPin, newPin } = await req.json().catch(() => ({}));
  const problem = validatePin(newPin);
  if (problem) throw new HttpError(400, problem);
  const { data } = await db.from('users').select('pin_hash').eq('id', user.id).single();
  if (typeof currentPin !== 'string' || !data || !(await verifyPin(currentPin, data.pin_hash))) {
    throw new HttpError(401, 'Your current PIN is wrong.');
  }
  await db.from('users').update({ pin_hash: await hashPin(newPin) }).eq('id', user.id);
  // Changing the PIN signs out every other device.
  await db.from('sessions').delete().eq('user_id', user.id).neq('id', user.sessionId);
  return new Response(null, { status: 204 });
});
