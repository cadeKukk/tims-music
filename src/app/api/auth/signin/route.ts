import { db } from '@/lib/db';
import { handle, hashPin, HttpError, LOCK_MINUTES, MAX_ATTEMPTS, startSession, verifyPin } from '@/lib/auth';

// Used to spend the same scrypt time on unknown usernames, so timing doesn't reveal which exist.
let dummyHash: Promise<string> | null = null;

export const POST = handle(async (req: Request) => {
  const { username, pin } = await req.json().catch(() => ({}));
  if (typeof username !== 'string' || typeof pin !== 'string') throw new HttpError(400, 'Enter your username and PIN.');

  const { data: user } = await db
    .from('users')
    .select('id, username, pin_hash, failed_attempts, locked_until')
    .eq('username', username)
    .maybeSingle();

  if (!user) {
    await verifyPin(pin, await (dummyHash ??= hashPin('000000')));
    throw new HttpError(401, 'Wrong username or PIN.');
  }
  if (user.locked_until && new Date(user.locked_until) > new Date()) {
    const mins = Math.ceil((new Date(user.locked_until).getTime() - Date.now()) / 60000);
    throw new HttpError(423, `Too many wrong PINs. Try again in ${mins} minute${mins === 1 ? '' : 's'}.`);
  }

  if (!(await verifyPin(pin, user.pin_hash))) {
    const attempts = user.failed_attempts + 1;
    const locked = attempts >= MAX_ATTEMPTS;
    await db.from('users').update({
      failed_attempts: locked ? 0 : attempts,
      locked_until: locked ? new Date(Date.now() + LOCK_MINUTES * 60000).toISOString() : null,
    }).eq('id', user.id);
    throw new HttpError(
      locked ? 423 : 401,
      locked
        ? `Too many wrong PINs. This account is locked for ${LOCK_MINUTES} minutes.`
        : `Wrong username or PIN. ${MAX_ATTEMPTS - attempts} ${MAX_ATTEMPTS - attempts === 1 ? 'try' : 'tries'} left.`,
    );
  }

  await db.from('users').update({ failed_attempts: 0, locked_until: null }).eq('id', user.id);
  await startSession(user.id);
  return Response.json({ username: user.username });
});
