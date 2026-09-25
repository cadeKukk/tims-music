'use client';

import Link from 'next/link';
import { Play } from 'lucide-react';
import { Cover } from './Cover';
import { usePlayer } from './player/PlayerProvider';
import type { PlayerTrack } from '@/lib/types';

export type AlbumCardData = {
  slug: string;
  title: string;
  cover_key: string | null;
  color_bg?: string | null;
  subtitle: string;
};

// Album track lists are fetched when a pointer/finger lands on the card, so by the time the
// click fires they're usually ready and play() can run inside the gesture (required on iOS).
const pending = new Map<string, Promise<PlayerTrack[]>>();
const ready = new Map<string, PlayerTrack[]>();

function prefetchAlbum(slug: string) {
  if (!pending.has(slug)) {
    pending.set(slug, fetch(`/api/albums/${slug}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((tracks: PlayerTrack[]) => { ready.set(slug, tracks); return tracks; })
      .catch(() => { pending.delete(slug); return []; }));
  }
  return pending.get(slug)!;
}

export function AlbumCard({ album, sizes = '(min-width: 768px) 200px, 45vw' }: { album: AlbumCardData; sizes?: string }) {
  const { playTracks, current, playing, toggle } = usePlayer();
  const isCurrent = current?.albumSlug === album.slug;

  const onPlay = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isCurrent) return toggle();
    const tracks = ready.get(album.slug) ?? (await prefetchAlbum(album.slug));
    playTracks(tracks, 0, { shuffle: false });
  };

  return (
    <Link
      href={`/album/${album.slug}`}
      onPointerEnter={() => prefetchAlbum(album.slug)}
      className="group block rounded-xl p-2 transition hover:bg-hover/70"
    >
      <div className="relative">
        <Cover coverKey={album.cover_key} alt={album.title} sizes={sizes} bg={album.color_bg} className="w-full rounded-lg shadow-lg shadow-black/40" />
        <button
          onClick={onPlay}
          onPointerDown={() => prefetchAlbum(album.slug)}
          aria-label={`Play ${album.title}`}
          className={`absolute right-2 bottom-2 grid size-11 place-items-center rounded-full bg-accent text-black shadow-xl transition-all duration-200 hover:scale-105 ${
            isCurrent && playing
              ? 'translate-y-0 opacity-100'
              : 'pointer-events-none translate-y-2 opacity-0 group-hover:pointer-events-auto group-hover:translate-y-0 group-hover:opacity-100 focus-visible:pointer-events-auto focus-visible:opacity-100'
          }`}
        >
          {isCurrent && playing ? (
            <span className="eq"><span /><span /><span /></span>
          ) : (
            <Play className="size-5 translate-x-[1px]" fill="currentColor" />
          )}
        </button>
      </div>
      <div className="mt-2.5 truncate text-sm font-semibold">{album.title}</div>
      <div className="truncate text-xs text-muted">{album.subtitle}</div>
    </Link>
  );
}
