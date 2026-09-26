'use client';

import { useSyncExternalStore } from 'react';
import { usePlayer } from '@/components/player/PlayerProvider';
import { AlbumCard } from '@/components/AlbumCard';
import { Shelf } from '@/components/Shelf';
import Link from 'next/link';
import { usePlaylists } from '@/components/playlists/PlaylistsProvider';
import { PlaylistCover } from '@/components/playlists/PlaylistCover';

const subscribe = () => () => {};

export function Greeting() {
  // Uses the visitor's local clock, so it's computed on the client only.
  const hour = useSyncExternalStore(subscribe, () => new Date().getHours(), () => null);
  const text = hour == null ? 'Welcome back' : hour < 5 ? 'Up late?' : hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  return <h1 className="text-3xl font-bold tracking-tight md:text-4xl">{text}</h1>;
}

export function JumpBackIn() {
  const { recentAlbums } = usePlayer();
  if (!recentAlbums.length) return null;
  return (
    <Shelf title="Jump back in">
      {recentAlbums.slice(0, 12).map((a) => (
        <AlbumCard key={a.slug} album={{ slug: a.slug, title: a.title, cover_key: a.cover, subtitle: a.artist }} />
      ))}
    </Shelf>
  );
}

export function YourPlaylists() {
  const { playlists } = usePlaylists();
  if (!playlists.length) return null;
  return (
    <Shelf title="Your playlists" href="/playlists">
      {playlists.slice(0, 12).map((p) => (
        <Link key={p.id} href={`/playlist/${p.id}`} className="block rounded-xl p-2 transition hover:bg-hover/70">
          <PlaylistCover covers={p.covers} custom={p.customCover} className="w-full rounded-lg shadow-lg shadow-black/40" />
          <div className="mt-2.5 truncate text-sm font-semibold">{p.name}</div>
          <div className="truncate text-xs text-muted">{p.trackCount} {p.trackCount === 1 ? 'song' : 'songs'}</div>
        </Link>
      ))}
    </Shelf>
  );
}
