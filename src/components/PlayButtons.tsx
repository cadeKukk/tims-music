'use client';

import { ListPlus, Play, Shuffle, Pause, Radio } from 'lucide-react';
import { usePlayer } from './player/PlayerProvider';
import { usePlaylists } from './playlists/PlaylistsProvider';
import type { PlayerTrack } from '@/lib/types';

/** Play / Shuffle for a known track list (album page). */
export function PlayButtons({ tracks, albumSlug, addLabel }: { tracks: PlayerTrack[]; albumSlug?: string; addLabel?: string }) {
  const { playTracks, current, playing, toggle } = usePlayer();
  const { pick } = usePlaylists();
  const isCurrent = albumSlug && current?.albumSlug === albumSlug;
  return (
    <div className="flex items-center gap-3">
      <button
        onClick={() => (isCurrent ? toggle() : playTracks(tracks, 0, { shuffle: false }))}
        className="flex items-center gap-2 rounded-full bg-accent px-6 py-3 font-semibold text-black shadow-lg transition hover:scale-[1.03] active:scale-100"
      >
        {isCurrent && playing ? <Pause className="size-5" fill="currentColor" /> : <Play className="size-5" fill="currentColor" />}
        {isCurrent && playing ? 'Pause' : 'Play'}
      </button>
      <button
        onClick={() => playTracks(tracks, 0, { shuffle: true })}
        className="flex items-center gap-2 rounded-full bg-white/10 px-5 py-3 font-semibold backdrop-blur transition hover:bg-white/20"
      >
        <Shuffle className="size-5" /> Shuffle
      </button>
      {addLabel && (
        <button
          onClick={() => pick(tracks.map((t) => t.id), addLabel)}
          title="Add to playlist"
          aria-label="Add to playlist"
          className="grid size-12 place-items-center rounded-full bg-white/10 backdrop-blur transition hover:bg-white/20"
        >
          <ListPlus className="size-5" />
        </button>
      )}
    </div>
  );
}

/** Shuffle-all and radio for an artist. The catalogue comes with the page so taps start audio
 *  synchronously (iOS blocks play() that happens after an await). */
export function ArtistPlayButtons({ all, popular }: { all: PlayerTrack[]; popular: PlayerTrack[] }) {
  const { playTracks } = usePlayer();
  // Radio: popular songs first, then the rest of the catalogue shuffled in.
  const radio = () => {
    const popularIds = new Set(popular.map((t) => t.id));
    const rest = all.filter((t) => !popularIds.has(t.id)).sort(() => Math.random() - 0.5);
    const mixed: PlayerTrack[] = [];
    const pop = [...popular].sort(() => Math.random() - 0.5);
    while (pop.length || rest.length) {
      if (pop.length) mixed.push(pop.shift()!);
      mixed.push(...rest.splice(0, 2));
    }
    playTracks(mixed, 0, { shuffle: false });
  };
  return (
    <div className="flex items-center gap-3">
      <button
        onClick={() => playTracks(all, 0, { shuffle: true })}
        className="flex items-center gap-2 rounded-full bg-accent px-6 py-3 font-semibold text-black shadow-lg transition hover:scale-[1.03] active:scale-100"
      >
        <Shuffle className="size-5" /> Shuffle
      </button>
      <button
        onClick={radio}
        className="flex items-center gap-2 rounded-full bg-white/10 px-5 py-3 font-semibold backdrop-blur transition hover:bg-white/20"
      >
        <Radio className="size-5" /> Radio
      </button>
    </div>
  );
}
