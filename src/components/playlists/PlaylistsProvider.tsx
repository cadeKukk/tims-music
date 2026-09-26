'use client';

import { useRouter } from 'next/navigation';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Check, Globe, ListPlus, Lock, Plus, X } from 'lucide-react';
import { PlaylistCover } from './PlaylistCover';
import { useSession } from '../account/SessionProvider';

export type Visibility = 'private' | 'public';
export type Role = 'owner' | 'editor' | 'viewer' | 'public' | 'link';

export type PlaylistSummary = {
  id: string;
  name: string;
  description: string | null;
  updated_at: string;
  visibility: Visibility;
  owner: { id: string; username: string };
  trackCount: number;
  covers: string[];
  customCover: string | null;
  role?: Role;
  saved?: boolean;
};

type Ctx = {
  playlists: PlaylistSummary[];
  loaded: boolean;
  refresh: () => Promise<void>;
  addTo: (playlistId: string, trackIds: string[]) => Promise<void>;
  /** Opens the "Add to playlist" picker for these tracks (guests get a sign-in prompt). */
  pick: (trackIds: string[], label?: string) => void;
  /** Opens the "New playlist" dialog; navigates to the new playlist when done. */
  startNew: () => void;
  toast: (message: string) => void;
};

const PlaylistsContext = createContext<Ctx | null>(null);

export function usePlaylists() {
  const ctx = useContext(PlaylistsContext);
  if (!ctx) throw new Error('usePlaylists must be used inside <PlaylistsProvider>');
  return ctx;
}

const post = (url: string, body: unknown) =>
  fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

export function PlaylistsProvider({ children }: { children: ReactNode }) {
  const { user, loaded: sessionLoaded, requireSignIn } = useSession();
  const router = useRouter();
  const [playlists, setPlaylists] = useState<PlaylistSummary[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [picker, setPicker] = useState<{ trackIds: string[]; label?: string } | null>(null);
  const [creating, setCreating] = useState(false);
  const [toastMsg, setToastMsg] = useState<{ text: string; key: number } | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/playlists', { cache: 'no-store' });
      if (res.ok) setPlaylists(await res.json());
    } finally {
      setLoaded(true);
    }
  }, []);

  // Reload whenever the signed-in user changes (including sign-out → empty library).
  const userId = user?.id;
  useEffect(() => {
    if (sessionLoaded) refresh();
  }, [sessionLoaded, userId, refresh]);

  const toast = useCallback((text: string) => setToastMsg({ text, key: Date.now() }), []);

  useEffect(() => {
    if (!toastMsg) return;
    const id = setTimeout(() => setToastMsg(null), 2200);
    return () => clearTimeout(id);
  }, [toastMsg]);

  const addTo = useCallback(async (playlistId: string, trackIds: string[]) => {
    const name = playlists.find((p) => p.id === playlistId)?.name ?? 'playlist';
    const res = await post(`/api/playlists/${playlistId}/tracks`, { trackIds });
    if (!res.ok) { toast((await res.json().catch(() => null))?.error ?? "Couldn't add to playlist"); return; }
    const { added } = await res.json();
    toast(added === 0 ? `Already in ${name}` : `Added ${added === 1 ? '' : `${added} songs `}to ${name}`);
    refresh();
  }, [playlists, refresh, toast]);

  const pick = useCallback((trackIds: string[], label?: string) => {
    if (requireSignIn('add songs to playlists')) setPicker({ trackIds, label });
  }, [requireSignIn]);

  const startNew = useCallback(() => {
    if (requireSignIn('make playlists')) setCreating(true);
  }, [requireSignIn]);

  const value = useMemo(
    () => ({ playlists, loaded, refresh, addTo, pick, startNew, toast }),
    [playlists, loaded, refresh, addTo, pick, startNew, toast],
  );

  return (
    <PlaylistsContext.Provider value={value}>
      {children}
      {picker && <PlaylistPicker {...picker} onClose={() => setPicker(null)} />}
      {creating && (
        <Sheet title="New playlist" onClose={() => setCreating(false)}>
          <NewPlaylistForm
            suggested={`My playlist #${playlists.filter((p) => p.role === 'owner').length + 1}`}
            onCreated={(id) => { setCreating(false); refresh(); router.push(`/playlist/${id}`); }}
          />
        </Sheet>
      )}
      {toastMsg && (
        <div
          key={toastMsg.key}
          role="status"
          className="fade-in pointer-events-none fixed inset-x-0 z-[80] flex justify-center px-4 bottom-[calc(var(--player-h)+var(--mobile-nav-h)+env(safe-area-inset-bottom)+16px)]"
        >
          <span className="flex items-center gap-2 rounded-full bg-fg px-4 py-2 text-sm font-medium text-black shadow-2xl">
            <Check className="size-4" /> {toastMsg.text}
          </span>
        </div>
      )}
    </PlaylistsContext.Provider>
  );
}

/** Bottom sheet on phones, centred dialog on desktop. */
export function Sheet({ title, subtitle, onClose, children }: { title: string; subtitle?: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  // Portal to <body>: an ancestor with backdrop-filter (e.g. the player bar) would otherwise trap position:fixed.
  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-end justify-center md:items-center" role="dialog" aria-label={title}>
      <button aria-label="Close" onClick={onClose} className="fade-in absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div className="fade-in relative flex max-h-[85dvh] w-full flex-col overflow-hidden rounded-t-3xl border border-line bg-elevated pb-[env(safe-area-inset-bottom)] shadow-2xl md:w-[28rem] md:rounded-3xl md:pb-0">
        <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-white/20 md:hidden" aria-hidden />
        <div className="flex shrink-0 items-center justify-between px-5 pt-3 pb-2 md:pt-5">
          <div className="min-w-0">
            <h2 className="text-lg font-bold">{title}</h2>
            {subtitle && <p className="truncate text-sm text-muted">{subtitle}</p>}
          </div>
          <button onClick={onClose} aria-label="Close" className="grid size-9 place-items-center rounded-full text-muted hover:bg-hover hover:text-fg">
            <X className="size-5" />
          </button>
        </div>
        <div className="min-h-0 overflow-y-auto overscroll-contain px-3 pb-4">{children}</div>
      </div>
    </div>,
    document.body,
  );
}

/** Name + Private/Public choice, asked every time a playlist is created. */
function NewPlaylistForm({ suggested, trackIds = [], onCreated }: { suggested: string; trackIds?: string[]; onCreated: (id: string, name: string) => void }) {
  const [name, setName] = useState('');
  const [visibility, setVisibility] = useState<Visibility>('private');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const finalName = name.trim() || suggested;
    const res = await post('/api/playlists', { name: finalName, visibility, trackIds });
    if (!res.ok) { setBusy(false); setError((await res.json().catch(() => null))?.error ?? "Couldn't create playlist"); return; }
    onCreated((await res.json()).id, finalName);
  };

  return (
    <form onSubmit={submit} className="space-y-3 p-2">
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={suggested}
        maxLength={100}
        aria-label="Playlist name"
        className="w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-base outline-none focus:border-white/30"
      />
      <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Who can see it">
        {([
          ['private', Lock, 'Private', 'Only you and people you share with'],
          ['public', Globe, 'Public', 'Shown on your profile'],
        ] as const).map(([v, Icon, label, hint]) => (
          <button
            key={v}
            type="button"
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
      {error && <p className="text-sm text-red-400">{error}</p>}
      <button disabled={busy} className="w-full rounded-full bg-accent py-2.5 font-semibold text-black disabled:opacity-60">
        {busy ? 'Creating…' : 'Create playlist'}
      </button>
    </form>
  );
}

function PlaylistPicker({ trackIds, label, onClose }: { trackIds: string[]; label?: string; onClose: () => void }) {
  const { playlists, addTo, toast, refresh } = usePlaylists();
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const editable = playlists.filter((p) => p.role === 'owner' || p.role === 'editor');

  const choose = async (id: string) => {
    setBusy(true);
    await addTo(id, trackIds);
    onClose();
  };

  return (
    <Sheet title="Add to playlist" subtitle={label} onClose={onClose}>
      {creating ? (
        <NewPlaylistForm
          suggested={`My playlist #${playlists.filter((p) => p.role === 'owner').length + 1}`}
          trackIds={trackIds}
          onCreated={(_id, name) => { toast(`Added to ${name}`); refresh(); onClose(); }}
        />
      ) : (
        <button onClick={() => setCreating(true)} className="flex w-full items-center gap-3 rounded-xl p-2 text-left hover:bg-hover">
          <span className="grid size-12 place-items-center rounded-lg bg-surface text-fg"><Plus className="size-6" /></span>
          <span className="font-semibold">New playlist</span>
        </button>
      )}
      {!creating && editable.map((p) => (
        <button
          key={p.id}
          disabled={busy}
          onClick={() => choose(p.id)}
          className="flex w-full items-center gap-3 rounded-xl p-2 text-left hover:bg-hover disabled:opacity-60"
        >
          <PlaylistCover covers={p.covers} custom={p.customCover} className="size-12 rounded-lg" />
          <span className="min-w-0 flex-1">
            <span className="block truncate font-medium">{p.name}</span>
            <span className="block truncate text-xs text-muted">
              {p.role === 'editor' ? `${p.owner.username}'s · ` : ''}{p.trackCount} {p.trackCount === 1 ? 'song' : 'songs'}
            </span>
          </span>
          <ListPlus className="size-5 text-muted" />
        </button>
      ))}
    </Sheet>
  );
}
