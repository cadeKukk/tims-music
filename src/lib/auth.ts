import 'server-only';
import { cache } from 'react';
import { cookies, headers } from 'next/headers';
import { createHash, randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { db } from './db';
import { deviceName } from './device';

const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>;

export const SESSION_COOKIE = 'ec_session';
const SESSION_DAYS = 365;
export const MAX_ATTEMPTS = 5;
export const LOCK_MINUTES = 15;

export const USERNAME_RE = /^[a-zA-Z0-9_.]{3,20}$/;
export const PIN_RE = /^\d{6}$/;
const RESERVED = new Set(['admin', 'administrator', 'api', 'root', 'support', 'echochamber', 'echo_chamber', 'guest', 'me', 'null', 'undefined']);

export type User = { id: string; username: string; is_admin: boolean; sync_key: string };

export function validateUsername(name: unknown): string | null {
  if (typeof name !== 'string' || !USERNAME_RE.test(name)) {
    return 'Usernames are 3–20 characters: letters, numbers, _ or .';
  }
  if (RESERVED.has(name.toLowerCase())) return 'That username is reserved.';
  return null;
}

export function validatePin(pin: unknown): string | null {
  return typeof pin === 'string' && PIN_RE.test(pin) ? null : 'PIN must be exactly 6 digits.';
}

export async function hashPin(pin: string) {
  const salt = randomBytes(16);
  const hash = await scrypt(pin, salt, 32);
  return `scrypt$${salt.toString('base64')}$${hash.toString('base64')}`;
}

export async function verifyPin(pin: string, stored: string) {
  const [, saltB64, hashB64] = stored.split('$');
  const expected = Buffer.from(hashB64, 'base64');
  const actual = await scrypt(pin, Buffer.from(saltB64, 'base64'), expected.length);
  return timingSafeEqual(actual, expected);
}

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

/** Creates a session row and sets the cookie. Call from a route handler or server action. */
export async function startSession(userId: string) {
  const token = randomBytes(32).toString('base64url');
  const ua = (await headers()).get('user-agent');
  const { error } = await db.from('sessions').insert({
    user_id: userId,
    token_hash: sha256(token),
    user_agent: ua?.slice(0, 400) ?? null,
    device_name: deviceName(ua),
  });
  if (error) throw new Error(error.message);
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: SESSION_DAYS * 86400,
    path: '/',
  });
}

export async function endSession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await db.from('sessions').delete().eq('token_hash', sha256(token));
  jar.delete(SESSION_COOKIE);
}

/** The signed-in user for this request, or null for guests. Cached per request. */
export const getUser = cache(async (): Promise<(User & { sessionId: string }) | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const { data } = await db
    .from('sessions')
    .select('id, last_seen_at, expires_at, users(id, username, is_admin, sync_key)')
    .eq('token_hash', sha256(token))
    .maybeSingle();
  const row = data as unknown as {
    id: string; last_seen_at: string; expires_at: string;
    users: { id: string; username: string; is_admin: boolean; sync_key: string } | null;
  } | null;
  if (!row?.users || new Date(row.expires_at) < new Date()) return null;
  // Touch last_seen at most hourly to keep writes low.
  if (Date.now() - new Date(row.last_seen_at).getTime() > 3600_000) {
    const now = new Date().toISOString();
    void db.from('sessions').update({ last_seen_at: now }).eq('id', row.id).then(() => {});
    void db.from('users').update({ last_seen_at: now }).eq('id', row.users.id).then(() => {});
  }
  return { ...row.users, sessionId: row.id };
});

export async function requireUser() {
  const user = await getUser();
  if (!user) throw new HttpError(401, 'Sign in to do that.');
  return user;
}

export async function requireAdmin() {
  const user = await requireUser();
  if (!user.is_admin) throw new HttpError(403, 'Admins only.');
  return user;
}

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/** Wraps a route handler so thrown HttpErrors become JSON responses. */
export function handle<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A) => {
    try {
      return await fn(...args);
    } catch (e) {
      if (e instanceof HttpError) return Response.json({ error: e.message }, { status: e.status });
      console.error(e);
      return Response.json({ error: 'Something went wrong.' }, { status: 500 });
    }
  };
}
