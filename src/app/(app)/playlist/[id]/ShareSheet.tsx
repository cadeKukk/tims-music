'use client';

import { useEffect, useMemo, useState } from 'react';
import { Check, ChevronDown, Copy, Globe, Link2, Lock, Search, X } from 'lucide-react';
import { Sheet, usePlaylists, type Visibility } from '@/components/playlists/PlaylistsProvider';
import { Avatar } from '@/components/account/AccountMenu';

export type Member = { user_id: string; username: string; role: 'viewer' | 'editor' };
type UserRow = { id: string; username: string };

const json = (body: unknown) => ({ headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

export function ShareSheet({
  playlistId, ownerId, visibility, shareToken, members, onClose, onChange,
}: {
  playlistId: string;
  ownerId: string;
  visibility: Visibility;
  shareToken: string | null;
  members: Member[];
  onClose: () => void;
  onChange: (patch: { visibility?: Visibility; shareToken?: string | null; members?: Member[] }) => void;
}) {
  const { toast } = usePlaylists();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [query, setQuery] = useState('');
  const [role, setRole] = useState<'viewer' | 'editor'>('viewer');
  const [copied, setCopied] = useState(false);
  const base = `/api/playlists/${playlistId}`;
  const link = shareToken && typeof window !== 'undefined' ? `${window.location.origin}/playlist/${playlistId}?t=${shareToken}` : null;

  useEffect(() => {
    fetch('/api/users').then((r) => (r.ok ? r.json() : [])).then(setUsers).catch(() => {});
  }, []);

  const memberIds = useMemo(() => new Set(members.map((m) => m.user_id)), [members]);
  const candidates = users
    .filter((u) => u.id !== ownerId && !memberIds.has(u.id))
    .filter((u) => u.username.toLowerCase().includes(query.trim().toLowerCase()));

  const fail = async (res: Response) => toast((await res.json().catch(() => null))?.error ?? 'Something went wrong');

  const setVisibility = async (v: Visibility) => {
    if (v === visibility) return;
    const res = await fetch(base, { method: 'PATCH', ...json({ visibility: v }) });
    if (!res.ok) return fail(res);
    onChange({ visibility: v });
    toast(v === 'public' ? 'Now public on your profile' : 'Now private');
  };

  const setLink = async (on: boolean) => {
    const res = await fetch(`${base}/share`, { method: 'POST', ...json({ link: on }) });
    if (!res.ok) return fail(res);
    onChange({ shareToken: (await res.json()).token });
    toast(on ? 'Link sharing on' : 'Link sharing off. Old links stop working.');
  };

  const setMember = async (userId: string, r: 'viewer' | 'editor' | null, username?: string) => {
    const res = await fetch(`${base}/share`, { method: 'PUT', ...json({ userId, role: r }) });
    if (!res.ok) return fail(res);
    onChange({ members: await res.json() });
    if (username) toast(`Shared with ${username}`);
  };

  const copy = async () => {
    if (!link) return;
    try {
      if (navigator.share && /Android|iPhone|iPad/.test(navigator.userAgent)) {
        await navigator.share({ url: link, title: 'Playlist on Echo Chamber' });
        return;
      }
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* share sheet dismissed */ }
  };

  return (
    <Sheet title="Share playlist" onClose={onClose}>
      {/* Visibility */}
      <section className="p-2">
        <h3 className="mb-2 text-sm font-semibold text-muted">Who can find it</h3>
        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Visibility">
          {([['private', Lock, 'Private', 'You and people below'], ['public', Globe, 'Public', 'Listed on your profile']] as const).map(([v, Icon, label, hint]) => (
            <button
              key={v}
              role="radio"
              aria-checked={visibility === v}
              onClick={() => setVisibility(v)}
              className={`rounded-xl border p-3 text-left transition ${visibility === v ? 'border-accent bg-accent/10' : 'border-line hover:border-white/25'}`}
            >
              <span className="flex items-center gap-2 font-semibold"><Icon className="size-4" /> {label}</span>
              <span className="mt-1 block text-xs text-muted">{hint}</span>
            </button>
          ))}
        </div>
      </section>

      {/* Link */}
      <section className="mt-3 p-2">
        <div className="flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-muted"><Link2 className="size-4" /> Share link</h3>
          <button
            role="switch"
            aria-checked={!!shareToken}
            aria-label="Link sharing"
            onClick={() => setLink(!shareToken)}
            className={`relative h-6 w-11 rounded-full transition ${shareToken ? 'bg-accent' : 'bg-white/20'}`}
          >
            <span className={`absolute top-0.5 size-5 rounded-full bg-white transition ${shareToken ? 'left-[22px]' : 'left-0.5'}`} />
          </button>
        </div>
        <p className="mt-1 text-xs text-muted">Anyone with the link can play it, even without an account. Only you can edit.</p>
        {link && (
          <div className="mt-2 flex items-center gap-2 rounded-xl border border-line bg-surface p-1.5 pl-3">
            <span className="min-w-0 flex-1 truncate font-mono text-xs text-muted">{link}</span>
            <button onClick={copy} className="flex shrink-0 items-center gap-1.5 rounded-lg bg-fg px-3 py-1.5 text-sm font-semibold text-black">
              {copied ? <Check className="size-4" /> : <Copy className="size-4" />} {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
        )}
      </section>

      {/* People */}
      <section className="mt-3 p-2">
        <h3 className="mb-2 text-sm font-semibold text-muted">Share with people</h3>
        <div className="flex gap-2">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Find a user"
              aria-label="Find a user"
              autoCapitalize="none"
              className="w-full rounded-xl border border-line bg-surface py-2.5 pr-3 pl-9 text-base outline-none focus:border-white/30"
            />
          </div>
          <RoleSelect value={role} onChange={setRole} />
        </div>
        <ul className="mt-2 max-h-48 overflow-y-auto rounded-xl border border-line bg-surface/60">
          {candidates.length === 0 && (
            <li className="p-3 text-sm text-muted">{users.length <= 1 ? 'No one else has an account yet.' : 'No matching users.'}</li>
          )}
          {candidates.slice(0, 50).map((u) => (
            <li key={u.id}>
              <button onClick={() => setMember(u.id, role, u.username)} className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-hover">
                <Avatar name={u.username} className="size-7 text-xs" />
                <span className="min-w-0 flex-1 truncate text-sm">{u.username}</span>
                <span className="text-xs font-semibold text-accent">Share</span>
              </button>
            </li>
          ))}
        </ul>

        {members.length > 0 && (
          <>
            <h3 className="mt-4 mb-1 text-sm font-semibold text-muted">Has access</h3>
            <ul>
              {members.map((m) => (
                <li key={m.user_id} className="flex items-center gap-3 py-2">
                  <Avatar name={m.username} className="size-8 text-sm" />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{m.username}</span>
                  <RoleSelect value={m.role} onChange={(r) => setMember(m.user_id, r)} />
                  <button onClick={() => setMember(m.user_id, null)} aria-label={`Remove ${m.username}`} className="grid size-8 place-items-center rounded-full text-muted hover:bg-hover hover:text-fg">
                    <X className="size-4" />
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </Sheet>
  );
}

function RoleSelect({ value, onChange }: { value: 'viewer' | 'editor'; onChange: (r: 'viewer' | 'editor') => void }) {
  return (
    <label className="relative flex shrink-0 items-center">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as 'viewer' | 'editor')}
        aria-label="Permission"
        className="appearance-none rounded-xl border border-line bg-surface py-2 pr-8 pl-3 text-sm outline-none focus:border-white/30"
      >
        <option value="viewer">Can view</option>
        <option value="editor">Can edit</option>
      </select>
      <ChevronDown className="pointer-events-none absolute right-2 size-4 text-muted" />
    </label>
  );
}
