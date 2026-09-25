'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Check, ListPlus, Plus, X } from 'lucide-react';
import { PlaylistCover } from './PlaylistCover';

export type PlaylistSummary = {
  id: string;
  name: string;
  description: string | null;
  updated_at: string;
  trackCount: number;
  covers: string[];
};

type Ctx = {
  playlists: PlaylistSummary[];
  loaded: boolean;
  refresh: () => Promise<void>;
  create: (name: string, trackIds?: string[]) => Promise<string | null>;
  addTo: (playlistId: string, trackIds: string[]) => Promise<void>;
  /** Opens the "Add to playlist" picker for these tracks. */
  pick: (trackIds: string[], label?: string) => void;
  toast: (message: string) => void;
};

const PlaylistsContext = createContext<Ctx | null>(null);

export function usePlaylists() {
  const ctx = useContext(PlaylistsContext);
  if (!ctx) throw new Error('usePlaylists must be used inside <PlaylistsProvider>');
  return ctx;
}

export function PlaylistsProvider({ children }: { children: ReactNode }) {
  const [playlists, setPlaylists] = useState<PlaylistSummary[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [picker, setPicker] = useState<{ trackIds: string[]; label?: string } | null>(null);
  const [toastMsg, setToastMsg] = useState<{ text: string; key: number } | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/playlists', { cache: 'no-store' });
      if (res.ok) setPlaylists(await res.json());
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const toast = useCallback((text: string) => setToastMsg({ text, key: Date.now() }), []);

  useEffect(() => {
    if (!toastMsg) return;
    const id = setTimeout(() => setToastMsg(null), 2200);
    return () => clearTimeout(id);
  }, [toastMsg]);

  const create = useCallback(async (name: string, trackIds: string[] = []) => {
    const res = await fetch('/api/playlists', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, trackIds }),
    });
    if (!res.ok) { toast("Couldn't create playlist"); return null; }
    const { id } = await res.json();
    await refresh();
    return id as string;
  }, [refresh, toast]);

  const addTo = useCallback(async (playlistId: string, trackIds: string[]) => {
    const name = playlists.find((p) => p.id === playlistId)?.name ?? 'playlist';
    const res = await fetch(`/api/playlists/${playlistId}/tracks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ trackIds }),
    });
    if (!res.ok) { toast("Couldn't add to playlist"); return; }
    const { added } = await res.json();
    toast(added === 0 ? `Already in ${name}` : `Added ${added === 1 ? '' : `${added} songs `}to ${name}`);
    refresh();
  }, [playlists, refresh, toast]);

  const pick = useCallback((trackIds: string[], label?: string) => setPicker({ trackIds, label }), []);

  const value = useMemo(
    () => ({ playlists, loaded, refresh, create, addTo, pick, toast }),
    [playlists, loaded, refresh, create, addTo, pick, toast],
  );

  return (
    <PlaylistsContext.Provider value={value}>
      {children}
      {picker && <PlaylistPicker {...picker} onClose={() => setPicker(null)} />}
      {toastMsg && (
        <div
          key={toastMsg.key}
          role="status"
          className="fade-in pointer-events-none fixed inset-x-0 z-[60] flex justify-center px-4 bottom-[calc(var(--player-h)+var(--mobile-nav-h)+env(safe-area-inset-bottom)+16px)]"
        >
          <span className="flex items-center gap-2 rounded-full bg-fg px-4 py-2 text-sm font-medium text-black shadow-2xl">
            <Check className="size-4" /> {toastMsg.text}
          </span>
        </div>
      )}
    </PlaylistsContext.Provider>
  );
}

function PlaylistPicker({ trackIds, label, onClose }: { trackIds: string[]; label?: string; onClose: () => void }) {
  const { playlists, create, addTo, toast } = usePlaylists();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const choose = async (id: string) => {
    setBusy(true);
    await addTo(id, trackIds);
    onClose();
  };

  const submitNew = async (e: React.FormEvent) => {
    e.preventDefault();
    const n = name.trim() || `My playlist #${playlists.length + 1}`;
    setBusy(true);
    const id = await create(n, trackIds);
    if (id) toast(`Added to ${n}`);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center md:items-center" role="dialog" aria-label="Add to playlist">
      <button aria-label="Close" onClick={onClose} className="fade-in absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div className="fade-in relative flex max-h-[80dvh] w-full flex-col overflow-hidden rounded-t-3xl border border-line bg-elevated pb-[env(safe-area-inset-bottom)] shadow-2xl md:w-[26rem] md:rounded-3xl md:pb-0">
        <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-white/20 md:hidden" aria-hidden />
        <div className="flex items-center justify-between px-5 pt-3 pb-2 md:pt-5">
          <div className="min-w-0">
            <h2 className="text-lg font-bold">Add to playlist</h2>
            {label && <p className="truncate text-sm text-muted">{label}</p>}
          </div>
          <button onClick={onClose} aria-label="Close" className="grid size-9 place-items-center rounded-full text-muted hover:bg-hover hover:text-fg">
            <X className="size-5" />
          </button>
        </div>

        <div className="overflow-y-auto overscroll-contain px-3 pb-4">
          {creating ? (
            <form onSubmit={submitNew} className="flex items-center gap-2 p-2">
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={`My playlist #${playlists.length + 1}`}
                maxLength={100}
                aria-label="Playlist name"
                className="min-w-0 flex-1 rounded-xl border border-line bg-surface px-3 py-2.5 text-base outline-none focus:border-white/30"
              />
              <button disabled={busy} className="rounded-xl bg-accent px-4 py-2.5 font-semibold text-black disabled:opacity-60">
                Create
              </button>
            </form>
          ) : (
            <button onClick={() => setCreating(true)} className="flex w-full items-center gap-3 rounded-xl p-2 text-left hover:bg-hover">
              <span className="grid size-12 place-items-center rounded-lg bg-surface text-fg"><Plus className="size-6" /></span>
              <span className="font-semibold">New playlist</span>
            </button>
          )}

          {playlists.map((p) => (
            <button
              key={p.id}
              disabled={busy}
              onClick={() => choose(p.id)}
              className="flex w-full items-center gap-3 rounded-xl p-2 text-left hover:bg-hover disabled:opacity-60"
            >
              <PlaylistCover covers={p.covers} className="size-12 rounded-lg" />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{p.name}</span>
                <span className="block text-xs text-muted">{p.trackCount} {p.trackCount === 1 ? 'song' : 'songs'}</span>
              </span>
              <ListPlus className="size-5 text-muted" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
