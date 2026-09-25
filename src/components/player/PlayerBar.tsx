'use client';

import Link from 'next/link';
import { ListMusic, ListPlus, MicVocal, Volume1, Volume2, VolumeX, SkipForward } from 'lucide-react';
import { usePlaylists } from '../playlists/PlaylistsProvider';
import { usePlaybackTime, usePlayer } from './PlayerProvider';
import { Controls, PlayPauseIcon, SeekBar } from './Controls';
import { Cover } from '../Cover';
import { useState } from 'react';

export function PlayerBar() {
  const { current, setNowPlayingOpen, openNowPlaying, nowPlayingOpen, nowPlayingTab, volume, setVolume, toggle, next } = usePlayer();
  const { pick } = usePlaylists();
  const [lastVolume, setLastVolume] = useState(1);
  if (!current) return null;
  const VolIcon = volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2;

  return (
    <div
      className="fixed inset-x-0 z-40 bottom-[calc(var(--mobile-nav-h)+env(safe-area-inset-bottom))] md:bottom-0"
      style={{ '--color-accent': current.accent ?? undefined } as React.CSSProperties}
    >
      {/* Mobile: compact bar, tap to open Now Playing */}
      <div className="mx-2 mb-1 overflow-hidden rounded-xl shadow-2xl md:hidden" style={{ backgroundColor: current.bg ?? '#1d1d21' }}>
        <div className="flex h-[calc(var(--player-h)-8px)] items-center gap-3 px-2">
          <button className="flex min-w-0 flex-1 items-center gap-3 text-left" onClick={() => setNowPlayingOpen(true)}>
            <Cover coverKey={current.cover} alt="" sizes="48px" className="size-11 rounded-md" />
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold">{current.title}</div>
              <div className="truncate text-xs text-white/70">{current.artist}</div>
            </div>
          </button>
          <button onClick={toggle} aria-label="Play or pause" className="grid size-10 place-items-center">
            <PlayPauseIcon className="size-6" />
          </button>
          <button onClick={next} aria-label="Next" className="grid size-10 place-items-center">
            <SkipForward className="size-6" fill="currentColor" />
          </button>
        </div>
        <MiniProgress />
      </div>

      {/* Desktop */}
      <div className="hidden h-[var(--player-h)] grid-cols-[1fr_minmax(0,40rem)_1fr] items-center gap-6 border-t border-line bg-surface/95 px-4 backdrop-blur-xl md:grid">
        <div className="flex min-w-0 items-center gap-3">
          <button onClick={() => setNowPlayingOpen(true)} aria-label="Open now playing" className="shrink-0 transition hover:scale-105">
            <Cover coverKey={current.cover} alt="" sizes="56px" className="size-14 rounded-md shadow-lg" />
          </button>
          <div className="min-w-0">
            <Link href={`/album/${current.albumSlug}`} className="block truncate text-sm font-semibold hover:underline">
              {current.title}
            </Link>
            <Link href={`/artist/${current.artistSlug}`} className="block truncate text-xs text-muted hover:text-fg hover:underline">
              {current.artist}
            </Link>
          </div>
          <button
            onClick={() => pick([current.id], current.title)}
            title="Add to playlist"
            aria-label="Add to playlist"
            className="shrink-0 p-1 text-muted transition hover:text-fg"
          >
            <ListPlus className="size-[18px]" />
          </button>
        </div>
        <div className="flex flex-col gap-1.5">
          <Controls />
          <SeekBar />
        </div>
        <div className="flex items-center justify-end gap-4 text-muted">
          {([['lyrics', MicVocal, 'Lyrics'], ['queue', ListMusic, 'Up next']] as const).map(([tab, Icon, label]) => {
            const active = nowPlayingOpen && nowPlayingTab === tab;
            return (
              <button
                key={tab}
                onClick={() => openNowPlaying(tab)}
                title={label}
                aria-label={label}
                aria-pressed={active}
                className={active ? 'text-accent' : 'hover:text-fg'}
              >
                <Icon className="size-[18px]" />
              </button>
            );
          })}
          <div className="flex w-36 items-center gap-2">
            <button
              aria-label="Mute"
              className="hover:text-fg"
              onClick={() => {
                if (volume > 0) { setLastVolume(volume); setVolume(0); } else setVolume(lastVolume || 1);
              }}
            >
              <VolIcon className="size-[18px]" />
            </button>
            <input
              type="range"
              className="range flex-1"
              min={0}
              max={1}
              step={0.01}
              value={volume}
              onChange={(e) => setVolume(Number(e.target.value))}
              aria-label="Volume"
              style={{ '--pct': `${volume * 100}%` } as React.CSSProperties}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function MiniProgress() {
  const { time, duration } = usePlaybackTime();
  return (
    <div className="h-0.5 bg-white/15">
      <div className="h-full bg-white" style={{ width: `${duration ? (time / duration) * 100 : 0}%` }} />
    </div>
  );
}
