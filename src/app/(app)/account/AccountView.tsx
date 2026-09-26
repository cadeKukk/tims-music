'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { LogOut, Monitor, Shield, Smartphone, UserRound } from 'lucide-react';
import { useSession } from '@/components/account/SessionProvider';
import { Avatar } from '@/components/account/AccountMenu';
import { usePlaylists } from '@/components/playlists/PlaylistsProvider';

type Session = { id: string; device_name: string | null; created_at: string; last_seen_at: string; current: boolean };

const ago = (iso: string) => {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 60) return m <= 1 ? 'just now' : `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h} hr ago`;
  return new Date(iso).toLocaleDateString();
};

export function AccountView() {
  const { user, loaded, signOut } = useSession();
  const { toast } = usePlaylists();
  const [sessions, setSessions] = useState<Session[]>([]);

  const load = useCallback(async () => {
    const res = await fetch('/api/me/sessions', { cache: 'no-store' });
    if (res.ok) setSessions(await res.json());
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch on mount; setState happens after the await
  useEffect(() => { if (user) load(); }, [user, load]);

  if (!loaded) return null;
  if (!user) {
    return (
      <div className="px-4 pt-16 text-center md:px-8">
        <UserRound className="mx-auto size-12 text-muted" />
        <h1 className="mt-4 text-2xl font-bold">You&apos;re listening as a guest</h1>
        <p className="mt-2 text-muted">Sign in to make playlists, share them, and keep listening across your devices.</p>
        <div className="mt-6 flex justify-center gap-3">
          <Link href="/signin?mode=signup&next=/account" className="rounded-full bg-accent px-6 py-3 font-semibold text-black">Create account</Link>
          <Link href="/signin?next=/account" className="rounded-full bg-white/10 px-6 py-3 font-semibold">Sign in</Link>
        </div>
      </div>
    );
  }

  const signOutDevice = async (id: string | 'others') => {
    await fetch('/api/me/sessions', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(id === 'others' ? { others: true } : { id }),
    });
    toast(id === 'others' ? 'Signed out of other devices' : 'Device signed out');
    load();
  };

  return (
    <div className="fade-in mx-auto max-w-2xl px-4 pt-8 md:px-8 md:pt-12">
      <div className="flex items-center gap-4">
        <Avatar name={user.username} className="size-16 text-2xl" />
        <div className="min-w-0">
          <h1 className="truncate text-3xl font-bold">{user.username}</h1>
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm">
            <Link href={`/u/${user.username}`} className="text-muted hover:text-fg">View profile</Link>
            {user.isAdmin && <Link href="/admin" className="flex items-center gap-1 text-muted hover:text-fg"><Shield className="size-3.5" /> Admin</Link>}
          </div>
        </div>
      </div>

      <section className="mt-10">
        <div className="flex items-baseline justify-between">
          <h2 className="text-xl font-bold">Signed-in devices</h2>
          {sessions.length > 1 && (
            <button onClick={() => signOutDevice('others')} className="text-sm text-muted hover:text-fg">Sign out all others</button>
          )}
        </div>
        <ul className="mt-3 divide-y divide-line rounded-2xl border border-line bg-surface">
          {sessions.map((s) => {
            const phone = /iPhone|Android|iPad/.test(s.device_name ?? '');
            const Icon = phone ? Smartphone : Monitor;
            return (
              <li key={s.id} className="flex items-center gap-3 p-4">
                <Icon className="size-6 shrink-0 text-muted" />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">
                    {s.device_name ?? 'Unknown device'}
                    {s.current && <span className="ml-2 rounded-full bg-accent/20 px-2 py-0.5 text-xs text-accent">This device</span>}
                  </div>
                  <div className="text-xs text-muted">Signed in {new Date(s.created_at).toLocaleDateString()} · active {ago(s.last_seen_at)}</div>
                </div>
                {!s.current && (
                  <button onClick={() => signOutDevice(s.id)} className="rounded-full px-3 py-1.5 text-sm text-muted hover:bg-hover hover:text-fg">Sign out</button>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      <ChangePin />

      <button onClick={signOut} className="mt-10 mb-6 flex items-center gap-2 rounded-full bg-white/10 px-5 py-3 font-semibold text-red-400 hover:bg-white/15">
        <LogOut className="size-5" /> Sign out
      </button>
    </div>
  );
}

function ChangePin() {
  const { toast } = usePlaylists();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [error, setError] = useState<string | null>(null);
  const digits = (v: string) => v.replace(/\D/g, '').slice(0, 6);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const res = await fetch('/api/me/pin', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPin: current, newPin: next }),
    });
    if (!res.ok) { setError((await res.json().catch(() => null))?.error ?? 'Something went wrong.'); return; }
    setCurrent(''); setNext('');
    toast('PIN changed. Other devices were signed out.');
  };

  const field = 'w-full rounded-xl border border-line bg-surface px-4 py-3 text-center font-mono text-xl tracking-[0.4em] outline-none focus:border-white/30';
  return (
    <section className="mt-10">
      <h2 className="text-xl font-bold">Change PIN</h2>
      <p className="mt-1 text-sm text-muted">Changing your PIN signs out your other devices.</p>
      <form onSubmit={submit} className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
        <input value={current} onChange={(e) => setCurrent(digits(e.target.value))} type="password" inputMode="numeric" autoComplete="current-password" placeholder="Current" aria-label="Current PIN" className={field} />
        <input value={next} onChange={(e) => setNext(digits(e.target.value))} type="password" inputMode="numeric" autoComplete="new-password" placeholder="New" aria-label="New PIN" className={field} />
        <button disabled={current.length !== 6 || next.length !== 6} className="rounded-full bg-fg px-6 py-3 font-semibold text-black disabled:opacity-40">Save</button>
      </form>
      {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
    </section>
  );
}
