'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { KeyRound, Lock, Shield, Trash2, Unlock } from 'lucide-react';
import { useSession } from '@/components/account/SessionProvider';
import { Avatar } from '@/components/account/AccountMenu';
import { usePlaylists } from '@/components/playlists/PlaylistsProvider';

type AdminUser = {
  id: string; username: string; is_admin: boolean; locked: boolean;
  created_at: string; last_seen_at: string; devices: number; playlists: number;
};

export function AdminView() {
  const { user, loaded } = useSession();
  const { toast } = usePlaylists();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [revealed, setRevealed] = useState<{ username: string; pin: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch('/api/admin/users', { cache: 'no-store' });
    if (res.ok) setUsers(await res.json());
  }, []);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch on mount; setState happens after the await
  useEffect(() => { if (user?.isAdmin) load(); }, [user, load]);

  if (!loaded) return null;
  if (!user?.isAdmin) return <p className="px-4 pt-16 text-center text-muted md:px-8">This page is for admins.</p>;

  const act = async (u: AdminUser, action: string) => {
    const res = await fetch(`/api/admin/users/${u.id}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }),
    });
    if (!res.ok) { toast((await res.json().catch(() => null))?.error ?? 'Failed'); return; }
    if (action === 'reset-pin') setRevealed({ username: u.username, pin: (await res.json()).pin });
    else toast(action === 'unlock' ? `Unlocked ${u.username}` : `Updated ${u.username}`);
    load();
  };

  const remove = async (u: AdminUser) => {
    const res = await fetch(`/api/admin/users/${u.id}`, { method: 'DELETE' });
    setConfirmDelete(null);
    if (!res.ok) { toast((await res.json().catch(() => null))?.error ?? 'Failed'); return; }
    toast(`Deleted ${u.username}`);
    load();
  };

  const btn = 'flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-xs font-medium hover:bg-white/15';
  return (
    <div className="fade-in px-4 pt-8 md:px-8 md:pt-12">
      <h1 className="flex items-center gap-2 text-3xl font-bold"><Shield className="size-7" /> Admin</h1>
      <p className="mt-1 text-sm text-muted">{users.length} accounts</p>

      {revealed && (
        <div className="mt-6 rounded-2xl border border-accent/40 bg-accent/10 p-4">
          <p className="text-sm">New PIN for <b>{revealed.username}</b> (shown once, send it to them):</p>
          <p className="mt-2 font-mono text-3xl tracking-[0.4em]">{revealed.pin}</p>
          <p className="mt-2 text-xs text-muted">They&apos;ve been signed out everywhere and can change it from their Account page.</p>
          <button onClick={() => setRevealed(null)} className="mt-3 text-sm text-muted hover:text-fg">Done</button>
        </div>
      )}

      <ul className="mt-6 divide-y divide-line rounded-2xl border border-line bg-surface">
        {users.map((u) => (
          <li key={u.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
            <Link href={`/u/${u.username}`} className="flex min-w-0 flex-1 items-center gap-3">
              <Avatar name={u.username} />
              <div className="min-w-0">
                <div className="flex items-center gap-2 truncate font-medium">
                  {u.username}
                  {u.is_admin && <span className="rounded-full bg-accent/20 px-2 py-0.5 text-[10px] font-semibold uppercase text-accent">Admin</span>}
                  {u.locked && <span className="flex items-center gap-1 rounded-full bg-red-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase text-red-400"><Lock className="size-3" /> Locked</span>}
                </div>
                <div className="text-xs text-muted">
                  Joined {new Date(u.created_at).toLocaleDateString()} · {u.devices} device{u.devices === 1 ? '' : 's'} · {u.playlists} playlist{u.playlists === 1 ? '' : 's'}
                </div>
              </div>
            </Link>
            <div className="flex flex-wrap gap-2">
              {u.locked && <button onClick={() => act(u, 'unlock')} className={btn}><Unlock className="size-3.5" /> Unlock</button>}
              <button onClick={() => act(u, 'reset-pin')} className={btn}><KeyRound className="size-3.5" /> Reset PIN</button>
              {u.id !== user.id && (
                <button onClick={() => act(u, u.is_admin ? 'remove-admin' : 'make-admin')} className={btn}>
                  <Shield className="size-3.5" /> {u.is_admin ? 'Remove admin' : 'Make admin'}
                </button>
              )}
              {u.id !== user.id && (confirmDelete === u.id ? (
                <span className="flex items-center gap-1">
                  <button onClick={() => remove(u)} className="rounded-full bg-red-500 px-3 py-1.5 text-xs font-semibold text-white">Delete {u.username}</button>
                  <button onClick={() => setConfirmDelete(null)} className="px-2 text-xs text-muted">Cancel</button>
                </span>
              ) : (
                <button onClick={() => setConfirmDelete(u.id)} className={`${btn} text-red-400`}><Trash2 className="size-3.5" /> Delete</button>
              ))}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
