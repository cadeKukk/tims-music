'use client';

import Link from 'next/link';
import { Globe, Plus, Users } from 'lucide-react';
import { usePlaylists, type PlaylistSummary } from '@/components/playlists/PlaylistsProvider';
import { PlaylistCover } from '@/components/playlists/PlaylistCover';
import { useSession } from '@/components/account/SessionProvider';
import { AccountButton } from '@/components/account/AccountMenu';
import { Grid } from '@/components/Shelf';

function Card({ p, showOwner }: { p: PlaylistSummary; showOwner?: boolean }) {
  return (
    <Link href={`/playlist/${p.id}`} className="rounded-xl p-2 transition hover:bg-hover/70">
      <PlaylistCover covers={p.covers} custom={p.customCover} className="w-full rounded-lg shadow-lg shadow-black/40" />
      <div className="mt-2.5 flex items-center gap-1.5 text-sm font-semibold">
        <span className="truncate">{p.name}</span>
        {p.visibility === 'public' && p.role === 'owner' && <Globe className="size-3.5 shrink-0 text-muted" aria-label="Public" />}
      </div>
      <div className="truncate text-xs text-muted">
        {showOwner ? `by ${p.owner.username} · ` : ''}{p.trackCount} {p.trackCount === 1 ? 'song' : 'songs'}
      </div>
    </Link>
  );
}

export function PlaylistsIndex() {
  const { playlists, loaded, startNew } = usePlaylists();
  const { user, loaded: sessionLoaded } = useSession();
  const mine = playlists.filter((p) => p.role === 'owner');
  const shared = playlists.filter((p) => p.role === 'editor' || p.role === 'viewer');
  const saved = playlists.filter((p) => p.role !== 'owner' && p.role !== 'editor' && p.role !== 'viewer');

  return (
    <div className="fade-in">
      <div className="flex items-center justify-between px-4 pt-8 pb-4 md:px-8 md:pt-10">
        <h1 className="text-3xl font-bold tracking-tight md:text-4xl">Playlists</h1>
        <div className="flex items-center gap-3">
          <Link href="/people" className="flex items-center gap-1.5 rounded-full bg-white/10 px-4 py-2 text-sm font-semibold hover:bg-white/15">
            <Users className="size-4" /> People
          </Link>
          <AccountButton />
        </div>
      </div>

      <h2 className="px-4 pb-1 text-lg font-bold md:px-8">Your playlists</h2>
      <Grid>
        <button onClick={startNew} className="group rounded-xl p-2 text-left transition hover:bg-hover/70">
          <div className="grid aspect-square w-full place-items-center rounded-lg border-2 border-dashed border-white/15 text-muted transition group-hover:border-white/30 group-hover:text-fg">
            <Plus className="size-10" />
          </div>
          <div className="mt-2.5 text-sm font-semibold">New playlist</div>
          <div className="text-xs text-muted">{user ? 'Start from scratch' : 'Sign in to create'}</div>
        </button>
        {mine.map((p) => <Card key={p.id} p={p} />)}
      </Grid>
      {sessionLoaded && !user && (
        <p className="px-4 pt-4 text-sm text-muted md:px-8">
          <Link href="/signin?mode=signup&next=/playlists" className="font-semibold text-fg underline">Create a free account</Link> to make and share playlists.
        </p>
      )}
      {user && loaded && mine.length === 0 && (
        <p className="px-4 pt-4 text-sm text-muted md:px-8">No playlists yet. Make one above, or tap ⋯ on any song and choose “Add to playlist”.</p>
      )}

      {shared.length > 0 && (
        <>
          <h2 className="px-4 pt-8 pb-1 text-lg font-bold md:px-8">Shared with you</h2>
          <Grid>{shared.map((p) => <Card key={p.id} p={p} showOwner />)}</Grid>
        </>
      )}
      {saved.length > 0 && (
        <>
          <h2 className="px-4 pt-8 pb-1 text-lg font-bold md:px-8">Saved</h2>
          <Grid>{saved.map((p) => <Card key={p.id} p={p} showOwner />)}</Grid>
        </>
      )}
    </div>
  );
}
