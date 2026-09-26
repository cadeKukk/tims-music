'use client';

import { createContext, useContext } from 'react';
import type { PlayerTrack } from '@/lib/types';

export type Repeat = 'off' | 'all' | 'one';
export type NowPlayingTab = 'lyrics' | 'queue';
export type RecentAlbum = { slug: string; title: string; artist: string; cover: string | null };

export type PlayerState = {
  queue: PlayerTrack[];
  index: number;
  current: PlayerTrack | null;
  playing: boolean;
  buffering: boolean;
  shuffle: boolean;
  repeat: Repeat;
  volume: number;
  nowPlayingOpen: boolean;
  nowPlayingTab: NowPlayingTab;
  recentAlbums: RecentAlbum[];
};

export type PlayerActions = {
  playTracks: (tracks: PlayerTrack[], start?: number, opts?: { shuffle?: boolean }) => void;
  playNext: (track: PlayerTrack) => void;
  addToQueue: (track: PlayerTrack) => void;
  jumpTo: (index: number) => void;
  removeAt: (index: number) => void;
  toggle: () => void;
  next: () => void;
  prev: () => void;
  seek: (t: number) => void;
  setVolume: (v: number) => void;
  toggleShuffle: () => void;
  cycleRepeat: () => void;
  setNowPlayingOpen: (open: boolean) => void;
  /** Opens Now Playing, optionally on a specific tab. */
  openNowPlaying: (tab?: NowPlayingTab) => void;
  setNowPlayingTab: (tab: NowPlayingTab) => void;
};

export type PlayerValue = PlayerState & PlayerActions;
export type TimeValue = { time: number; duration: number };

/** Everything needed to recreate playback on another device. */
export type Snapshot = {
  queue: PlayerTrack[];
  original: PlayerTrack[];
  index: number;
  position: number;
  shuffle: boolean;
  repeat: Repeat;
  playing: boolean;
};

/** Extra controls on the local audio engine that only the device-sync layer uses. */
export type LocalExtras = {
  snapshot: () => Snapshot;
  loadSnapshot: (s: Snapshot, play: boolean) => void;
  play: () => void;
  pause: () => void;
  /** Unlocks audio inside a tap so a later async play() is allowed (iOS). */
  prime: () => void;
  /** When the queue/track last changed on this device (ms), for deciding whose resume state is newer. */
  changedAt: () => number;
  currentTime: () => number;
};

// What UI components read. On a remote device these reflect the device that's actually playing.
export const PlayerContext = createContext<PlayerValue | null>(null);
// Time lives in its own context so the ~4Hz timeupdate only re-renders the progress UI.
export const TimeContext = createContext<TimeValue>({ time: 0, duration: 0 });

export const usePlayer = () => {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error('usePlayer must be used inside <PlayerProvider>');
  return ctx;
};
export const usePlaybackTime = () => useContext(TimeContext);
