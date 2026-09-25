'use client';

import { useSyncExternalStore } from 'react';
import { usePlayer } from '@/components/player/PlayerProvider';
import { AlbumCard } from '@/components/AlbumCard';
import { Shelf } from '@/components/Shelf';

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
