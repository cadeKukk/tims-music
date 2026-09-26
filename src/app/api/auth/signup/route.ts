import { db } from '@/lib/db';
import { handle, hashPin, HttpError, startSession, validatePin, validateUsername } from '@/lib/auth';

export const POST = handle(async (req: Request) => {
  const { username, pin } = await req.json().catch(() => ({}));
  const problem = validateUsername(username) ?? validatePin(pin);
  if (problem) throw new HttpError(400, problem);
  const { data, error } = await db
    .from('users')
    .insert({ username, pin_hash: await hashPin(pin) })
    .select('id, username')
    .single();
  if (error?.code === '23505') throw new HttpError(409, 'That username is taken.');
  if (error) throw new Error(error.message);
  await startSession(data.id);
  return Response.json({ username: data.username }, { status: 201 });
});
