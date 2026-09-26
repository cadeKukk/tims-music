'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Check, Copy, ImagePlus, ImageOff, Globe, Lock, LogOut, MoreHorizontal, Pencil, Plus, Search, Share2, Trash2, Heart,
} from 'lucide-react';
import { usePlaylists, type Role, type Visibility } from '@/components/playlists/PlaylistsProvider';
import { useSession } from '@/components/account/SessionProvider';
import { PlaylistCover } from '@/components/playlists/PlaylistCover';
import { PlayButtons } from '@/components/PlayButtons';
import { TrackList } from '@/components/TrackList';
import { Cover } from '@/components/Cover';
import { formatLength, formatTime } from '@/lib/cover';
import type { PlayerTrack } from '@/lib/types';
import { ShareSheet, type Member } from './ShareSheet';

export type PlaylistData = {
  id: string;
  name: string;
  description: string | null;
  visibility: Visibility;
  owner: { id: string; username: string };
  tracks: PlayerTrack[];
  covers: string[];
  customCover: string | null;
  role: Role;
  canEdit: boolean;
  shareToken: string | null;
  members: Member[];
  saved: boolean;
};

const json = (body: unknown) => ({ headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

export function PlaylistView({ initial, shareToken }: { initial: PlaylistData; shareToken: string | null }) {
  const router = useRouter();
  const { refresh, toast } = usePlaylists();
  const { requireSignIn } = useSession();
  const [pl, setPl] = useState(initial);
  const [editing, setEditing] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const url = `/api/playlists/${pl.id}`;
  const isOwner = pl.role === 'owner';
  const bg = pl.tracks[0]?.bg ?? '#2a1d3a';
  const totalSec = pl.tracks.reduce((s, t) => s + t.duration, 0);

  const reload = async () => {
    const res = await fetch(`${url}${shareToken ? `?t=${encodeURIComponent(shareToken)}` : ''}`, { cache: 'no-store' });
    if (res.ok) setPl(await res.json());
    refresh();
  };

  const fail = async (res: Response) => toast((await res.json().catch(() => null))?.error ?? 'Something went wrong');

  const saveDetails = async (name: string, description: string) => {
    const clean = name.trim() || pl.name;
    setPl((p) => ({ ...p, name: clean, description: description.trim() || null }));
    setEditing(false);
    const res = await fetch(url, { method: 'PATCH', ...json({ name: clean, description }) });
    if (!res.ok) fail(res);
    refresh();
  };

  const remove = async (track: PlayerTrack) => {
    setPl((p) => ({ ...p, tracks: p.tracks.filter((t) => t.id !== track.id) }));
    const res = await fetch(`${url}/tracks`, { method: 'DELETE', ...json({ trackId: track.id }) });
    if (!res.ok) return fail(res);
    toast(`Removed “${track.title}”`);
    reload();
  };

  const move = async (index: number, delta: -1 | 1) => {
    const tracks = [...pl.tracks];
    const [t] = tracks.splice(index, 1);
    tracks.splice(index + delta, 0, t);
    setPl((p) => ({ ...p, tracks }));
    const res = await fetch(`${url}/tracks`, { method: 'PUT', ...json({ trackIds: tracks.map((x) => x.id) }) });
    if (!res.ok) fail(res);
    refresh();
  };

  const add = async (track: PlayerTrack) => {
    const res = await fetch(`${url}/tracks`, { method: 'POST', ...json({ trackIds: [track.id] }) });
    if (!res.ok) return fail(res);
    toast(`Added “${track.title}”`);
    reload();
  };

  const destroy = async () => {
    const res = await fetch(url, { method: 'DELETE' });
    if (!res.ok) return fail(res);
    await refresh();
    toast(`Deleted ${pl.name}`);
    router.push('/playlists');
  };

  const toggleSave = async () => {
    if (!requireSignIn('save playlists')) return;
    const res = await fetch(`${url}/save`, { method: 'POST', ...json({ saved: !pl.saved }) });
    if (!res.ok) return fail(res);
    setPl((p) => ({ ...p, saved: !p.saved }));
    toast(pl.saved ? 'Removed from your library' : 'Saved to your library');
    refresh();
  };

  const duplicate = async () => {
    if (!requireSignIn('copy playlists')) return;
    const res = await fetch(`${url}/duplicate`, { method: 'POST', ...json({ t: shareToken }) });
    if (!res.ok) return fail(res);
    const { id } = await res.json();
    await refresh();
    toast('Copied to your playlists');
    router.push(`/playlist/${id}`);
  };

  const leave = async () => {
    const res = await fetch(`${url}/leave`, { method: 'POST' });
    if (!res.ok) return fail(res);
    await refresh();
    toast(`Removed ${pl.name} from your library`);
    router.push('/playlists');
  };

  const uploadCover = async (file: File) => {
    const form = new FormData();
    form.append('file', file);
    toast('Uploading cover…');
    const res = await fetch(`${url}/cover`, { method: 'POST', body: form });
    if (!res.ok) return fail(res);
    const { cover } = await res.json();
    setPl((p) => ({ ...p, customCover: cover }));
    toast('Cover updated');
    refresh();
  };

  const removeCover = async () => {
    const res = await fetch(`${url}/cover`, { method: 'DELETE' });
    if (!res.ok) return fail(res);
    setPl((p) => ({ ...p, customCover: null }));
    toast('Back to the album-art cover');
    refresh();
  };

  const menuItems: MenuItem[] = [
    ...(isOwner ? [
      { icon: Pencil, label: 'Edit details', onClick: () => setEditing(true) },
      { icon: ImagePlus, label: pl.customCover ? 'Change cover image' : 'Upload cover image', onClick: () => fileRef.current?.click() },
      ...(pl.customCover ? [{ icon: ImageOff, label: 'Use album-art cover', onClick: removeCover }] : []),
    ] : []),
    { icon: Copy, label: 'Make a copy', onClick: duplicate },
    ...(pl.role === 'editor' || pl.role === 'viewer' ? [{ icon: LogOut, label: 'Leave playlist', onClick: leave, danger: true }] : []),
    ...(isOwner ? [{ icon: Trash2, label: 'Delete playlist', onClick: () => setConfirmDelete(true), danger: true }] : []),
  ];

  return (
    <div className="fade-in">
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadCover(f); e.target.value = ''; }}
      />
      <header
        className="px-4 pt-10 pb-6 md:px-8 md:pt-16"
        style={{ background: `linear-gradient(to bottom, ${bg}, color-mix(in srgb, ${bg} 50%, var(--color-bg)) 70%, var(--color-bg))` }}
      >
        <div className="flex flex-col items-center gap-6 md:flex-row md:items-end md:gap-8">
          <div className="group relative w-[60vw] max-w-64 md:w-56">
            <PlaylistCover covers={pl.covers} custom={pl.customCover} large className="w-full rounded-xl shadow-2xl shadow-black/60" />
            {isOwner && (
              <button
                onClick={() => fileRef.current?.click()}
                className="absolute inset-0 grid place-items-center rounded-xl bg-black/50 opacity-0 transition group-hover:opacity-100 focus-visible:opacity-100"
                aria-label="Change cover image"
              >
                <span className="flex flex-col items-center gap-1 text-sm font-semibold"><ImagePlus className="size-7" /> Choose image</span>
              </button>
            )}
          </div>
          <div className="w-full min-w-0 text-center md:text-left">
            <div className="flex items-center justify-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-white/70 md:justify-start">
              {pl.visibility === 'public' ? <Globe className="size-3.5" /> : <Lock className="size-3.5" />}
              {pl.visibility === 'public' ? 'Public playlist' : 'Private playlist'}
            </div>
            {editing ? (
              <DetailsForm name={pl.name} description={pl.description ?? ''} onSave={saveDetails} onCancel={() => setEditing(false)} />
            ) : (
              <button onClick={() => isOwner && setEditing(true)} disabled={!isOwner} className="group mt-2 block w-full text-center md:text-left" title={isOwner ? 'Rename' : undefined}>
                <h1 className="inline text-3xl font-extrabold tracking-tight text-balance break-words md:text-5xl lg:text-6xl">{pl.name}</h1>
                {isOwner && <Pencil className="ml-2 inline size-5 align-middle text-white/40 opacity-0 transition group-hover:opacity-100 [@media(hover:none)]:opacity-100" />}
                {pl.description && <p className="mt-2 text-sm text-white/70">{pl.description}</p>}
              </button>
            )}
            <div className="mt-3 text-sm text-white/60">
              <Link href={`/u/${pl.owner.username}`} className="font-semibold text-white hover:underline">{pl.owner.username}</Link>
              {' · '}{pl.tracks.length} {pl.tracks.length === 1 ? 'song' : 'songs'}
              {totalSec > 0 && `, ${formatLength(totalSec)}`}
              {isOwner && pl.members.length > 0 && ` · shared with ${pl.members.length}`}
              {pl.role === 'editor' && ' · you can edit'}
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-3 md:justify-start">
          {pl.tracks.length > 0 && <PlayButtons tracks={pl.tracks} />}
          {isOwner && (
            <button onClick={() => setSharing(true)} className="flex items-center gap-2 rounded-full bg-white/10 px-5 py-3 font-semibold backdrop-blur transition hover:bg-white/20">
              <Share2 className="size-5" /> Share
            </button>
          )}
          {!isOwner && pl.role !== 'editor' && pl.role !== 'viewer' && (
            <button
              onClick={toggleSave}
              aria-pressed={pl.saved}
              title={pl.saved ? 'Remove from your library' : 'Save to your library'}
              className={`grid size-12 place-items-center rounded-full bg-white/10 backdrop-blur transition hover:bg-white/20 ${pl.saved ? 'text-accent' : ''}`}
            >
              <Heart className="size-5" fill={pl.saved ? 'currentColor' : 'none'} />
            </button>
          )}
          <Menu items={menuItems} />
        </div>
        {confirmDelete && (
          <div className="mt-4 flex items-center justify-center gap-2 text-sm md:justify-start">
            Delete “{pl.name}” for everyone?
            <button onClick={destroy} className="rounded-full bg-red-500 px-3 py-1.5 font-semibold text-white">Delete</button>
            <button onClick={() => setConfirmDelete(false)} className="rounded-full px-3 py-1.5 text-white/70 hover:text-white">Cancel</button>
          </div>
        )}
      </header>

      {pl.tracks.length > 0 ? (
        <TrackList
          tracks={pl.tracks}
          showCover
          showAlbum
          numbered={false}
          mainArtist=""
          onRemove={pl.canEdit ? remove : undefined}
          onMove={pl.canEdit ? move : undefined}
        />
      ) : (
        <p className="px-4 text-muted md:px-8">
          {pl.canEdit ? 'This playlist is empty. Search below, or use ⋯ → “Add to playlist” on any song.' : 'This playlist is empty.'}
        </p>
      )}

      {pl.canEdit && <AddSongs existing={new Set(pl.tracks.map((t) => t.id))} onAdd={add} />}

      {sharing && (
        <ShareSheet
          playlistId={pl.id}
          ownerId={pl.owner.id}
          visibility={pl.visibility}
          shareToken={pl.shareToken}
          members={pl.members}
          onClose={() => setSharing(false)}
          onChange={(patch) => { setPl((p) => ({ ...p, ...patch })); refresh(); }}
        />
      )}
    </div>
  );
}

type MenuItem = { icon: React.ComponentType<{ className?: string }>; label: string; onClick: () => void; danger?: boolean };

function Menu({ items }: { items: MenuItem[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);
  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen((o) => !o)} aria-label="More options" className="grid size-12 place-items-center rounded-full bg-white/10 backdrop-blur transition hover:bg-white/20">
        <MoreHorizontal className="size-5" />
      </button>
      {open && (
        <div className="fade-in absolute top-14 left-1/2 z-30 w-56 -translate-x-1/2 overflow-hidden rounded-xl border border-line bg-elevated py-1 text-sm shadow-2xl md:left-0 md:translate-x-0">
          {items.map(({ icon: Icon, label, onClick, danger }) => (
            <button key={label} onClick={() => { setOpen(false); onClick(); }} className={`flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-hover ${danger ? 'text-red-400' : ''}`}>
              <Icon className="size-4" /> {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function DetailsForm({
  name, description, onSave, onCancel,
}: { name: string; description: string; onSave: (n: string, d: string) => void; onCancel: () => void }) {
  const [n, setN] = useState(name);
  const [d, setD] = useState(description);
  return (
    <form
      onSubmit={(e) => { e.preventDefault(); onSave(n, d); }}
      onKeyDown={(e) => e.key === 'Escape' && onCancel()}
      className="mt-2 space-y-2"
    >
      <input
        autoFocus
        value={n}
        onChange={(e) => setN(e.target.value)}
        maxLength={100}
        aria-label="Playlist name"
        className="w-full rounded-xl border border-white/20 bg-black/30 px-3 py-2 text-2xl font-bold outline-none focus:border-white/50 md:text-3xl"
      />
      <input
        value={d}
        onChange={(e) => setD(e.target.value)}
        maxLength={300}
        placeholder="Add a description (optional)"
        aria-label="Description"
        className="w-full rounded-xl border border-white/20 bg-black/30 px-3 py-2 text-base outline-none focus:border-white/50"
      />
      <div className="flex justify-center gap-2 md:justify-start">
        <button className="flex items-center gap-1.5 rounded-full bg-fg px-4 py-2 text-sm font-semibold text-black"><Check className="size-4" /> Save</button>
        <button type="button" onClick={onCancel} className="rounded-full px-4 py-2 text-sm text-white/70 hover:text-white">Cancel</button>
      </div>
    </form>
  );
}

type SearchTrack = {
  id: string; title: string; artist_credit: string; duration_sec: number; album_slug: string; album_title: string;
  cover_key: string | null; color_bg: string | null; color_accent: string | null; artist_slug: string;
};

/** Inline search to add songs without leaving the playlist. */
function AddSongs({ existing, onAdd }: { existing: Set<string>; onAdd: (t: PlayerTrack) => void }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<PlayerTrack[]>([]);
  const lastQ = useRef('');

  useEffect(() => {
    const term = q.trim();
    lastQ.current = term;
    if (term.length < 2) return;
    const ctrl = new AbortController();
    const id = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(term)}`, { signal: ctrl.signal });
        if (!res.ok || lastQ.current !== term) return;
        const data = (await res.json()) as { tracks: SearchTrack[] };
        setResults(data.tracks.map((t) => ({
          id: t.id, title: t.title, artist: t.artist_credit, artistSlug: t.artist_slug, albumTitle: t.album_title,
          albumSlug: t.album_slug, cover: t.cover_key, duration: t.duration_sec, accent: t.color_accent, bg: t.color_bg,
        })));
      } catch { /* aborted */ }
    }, 200);
    return () => { clearTimeout(id); ctrl.abort(); };
  }, [q]);

  const shown = q.trim().length >= 2 ? results : [];

  return (
    <section className="mt-10 px-4 md:px-8">
      <h2 className="text-xl font-bold tracking-tight">Add songs</h2>
      <div className="relative mt-3 max-w-xl">
        <Search className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search for songs"
          aria-label="Search for songs to add"
          type="search"
          className="w-full rounded-full border border-line bg-elevated py-3 pr-4 pl-12 text-base outline-none placeholder:text-faint focus:border-white/30"
        />
      </div>
      <ul className="mt-3 max-w-4xl">
        {shown.map((t) => {
          const added = existing.has(t.id);
          return (
            <li key={t.id} className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-hover">
              <Cover coverKey={t.cover} alt="" sizes="40px" className="size-10 shrink-0 rounded" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[15px] font-medium">{t.title}</div>
                <div className="truncate text-xs text-muted">{t.artist} · {t.albumTitle}</div>
              </div>
              <span className="hidden text-sm tabular-nums text-muted sm:block">{formatTime(t.duration)}</span>
              <button
                onClick={() => !added && onAdd(t)}
                disabled={added}
                aria-label={added ? 'Already in playlist' : `Add ${t.title}`}
                className={`grid size-9 shrink-0 place-items-center rounded-full border transition ${
                  added ? 'border-transparent text-accent' : 'border-white/20 text-fg hover:border-white/50 hover:bg-white/10'
                }`}
              >
                {added ? <Check className="size-5" /> : <Plus className="size-5" />}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

