'use client';

import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode,
} from 'react';
import type { PlayerTrack } from '@/lib/types';
import { coverUrl } from '@/lib/cover';

type Repeat = 'off' | 'all' | 'one';
export type NowPlayingTab = 'lyrics' | 'queue';
export type RecentAlbum = { slug: string; title: string; artist: string; cover: string | null };

type PlayerState = {
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

type PlayerActions = {
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

const PlayerContext = createContext<(PlayerState & PlayerActions) | null>(null);
// Time lives in its own context so the ~4Hz timeupdate only re-renders the progress UI.
const TimeContext = createContext<{ time: number; duration: number }>({ time: 0, duration: 0 });

export const usePlayer = () => {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error('usePlayer must be used inside <PlayerProvider>');
  return ctx;
};
export const usePlaybackTime = () => useContext(TimeContext);

const STORAGE_KEY = 'tm_player_v1';
const RECENT_KEY = 'tm_recent_albums_v1';
const streamUrl = (id: string) => `/api/stream/${id}`;

function readStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function writeStorage(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* private mode / quota */ }
}

function shuffled<T>(items: T[], keepFirst?: T): T[] {
  const rest = items.filter((x) => x !== keepFirst);
  for (let i = rest.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [rest[i], rest[j]] = [rest[j], rest[i]];
  }
  return keepFirst ? [keepFirst, ...rest] : rest;
}

export function PlayerProvider({ children }: { children: ReactNode }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const preloadRef = useRef<HTMLAudioElement>(null);

  const [queue, setQueue] = useState<PlayerTrack[]>([]);
  const [original, setOriginal] = useState<PlayerTrack[]>([]);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [buffering, setBuffering] = useState(false);
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState<Repeat>('off');
  const [volume, setVolumeState] = useState(1);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [nowPlayingOpen, setNowPlayingOpen] = useState(false);
  const [nowPlayingTab, setNowPlayingTab] = useState<NowPlayingTab>('lyrics');
  const openNowPlaying = useCallback((tab?: NowPlayingTab) => {
    if (tab) setNowPlayingTab(tab);
    setNowPlayingOpen(true);
  }, []);
  const [recentAlbums, setRecentAlbums] = useState<RecentAlbum[]>([]);

  const current = queue[index] ?? null;
  const wantPlay = useRef(false);
  const resumeAt = useRef<number | null>(null);
  const restored = useRef(false);
  const listened = useRef({ id: '', secs: 0, lastT: 0, logged: false });
  const retried = useRef<string | null>(null);

  // ---- restore last session (queue, position, settings) ----
  useEffect(() => {
    const saved = readStorage<{
      queue?: PlayerTrack[]; original?: PlayerTrack[]; index?: number; time?: number;
      shuffle?: boolean; repeat?: Repeat; volume?: number;
    }>(STORAGE_KEY, {});
    /* eslint-disable react-hooks/set-state-in-effect -- one-time hydration from localStorage */
    if (saved.queue?.length) {
      setQueue(saved.queue);
      setOriginal(saved.original?.length ? saved.original : saved.queue);
      setIndex(Math.min(saved.index ?? 0, saved.queue.length - 1));
      resumeAt.current = saved.time ?? 0;
    }
    if (saved.shuffle) setShuffle(true);
    if (saved.repeat) setRepeat(saved.repeat);
    if (typeof saved.volume === 'number') setVolumeState(saved.volume);
    setRecentAlbums(readStorage<RecentAlbum[]>(RECENT_KEY, []));
    /* eslint-enable react-hooks/set-state-in-effect */
    restored.current = true;
  }, []);

  // ---- persist ----
  useEffect(() => {
    if (!restored.current) return;
    const save = () => writeStorage(STORAGE_KEY, { queue, original, index, time: resumeAt.current ?? audioRef.current?.currentTime ?? 0, shuffle, repeat, volume });
    save();
    const id = setInterval(save, 5000);
    window.addEventListener('pagehide', save);
    return () => { clearInterval(id); window.removeEventListener('pagehide', save); };
  }, [queue, original, index, shuffle, repeat, volume]);

  // ---- loading tracks ----
  // Track changes start audio synchronously inside the tap / 'ended' handler. iOS Safari only
  // allows play() from a user gesture, and while the phone is locked a deferred React effect
  // may not run until the screen wakes, which would stall auto-advance.
  const loadTrack = useCallback((track: PlayerTrack | undefined, play: boolean) => {
    const audio = audioRef.current;
    if (!audio || !track) return;
    wantPlay.current = play;
    resumeAt.current = null;
    audio.src = streamUrl(track.id);
    if (play) audio.play().catch(() => setPlaying(false));
  }, []);

  // Fallback for index changes that didn't go through loadTrack (e.g. restoring the last session).
  const currentId = current?.id;
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !currentId) return;
    listened.current = { id: currentId, secs: 0, lastT: 0, logged: false };
    retried.current = null;
    if (audio.src.endsWith(streamUrl(currentId))) return;
    audio.src = streamUrl(currentId);
    if (wantPlay.current) audio.play().catch(() => setPlaying(false));
  }, [currentId]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
  }, [volume]);

  // ---- remember recently played albums for "Jump back in" ----
  const rememberAlbum = () => {
    if (!current) return;
    setRecentAlbums((prev) => {
      if (prev[0]?.slug === current.albumSlug) return prev;
      const entry = { slug: current.albumSlug, title: current.albumTitle, artist: current.artist, cover: current.cover };
      const nextList = [entry, ...prev.filter((a) => a.slug !== current.albumSlug)].slice(0, 20);
      writeStorage(RECENT_KEY, nextList);
      return nextList;
    });
  };

  // ---- actions ----
  const playTracks = useCallback<PlayerActions['playTracks']>((tracks, start = 0, opts) => {
    if (!tracks.length) return;
    // An explicit Shuffle button randomises everything; clicking a song while shuffle is on
    // plays that song first and shuffles the rest (like Spotify).
    const doShuffle = opts?.shuffle ?? shuffle;
    const first = tracks[Math.min(start, tracks.length - 1)];
    const order = doShuffle ? shuffled(tracks, opts?.shuffle ? undefined : first) : tracks;
    setOriginal(tracks);
    setQueue(order);
    setShuffle(doShuffle);
    const i = doShuffle ? 0 : Math.min(start, tracks.length - 1);
    setIndex(i);
    loadTrack(order[i], true);
  }, [shuffle, loadTrack]);

  const playNext = useCallback((track: PlayerTrack) => {
    setQueue((q) => (q.length ? [...q.slice(0, index + 1), track, ...q.slice(index + 1)] : [track]));
    setOriginal((o) => [...o, track]);
    if (!queue.length) loadTrack(track, true);
  }, [index, queue.length, loadTrack]);

  const addToQueue = useCallback((track: PlayerTrack) => {
    setQueue((q) => [...q, track]);
    setOriginal((o) => [...o, track]);
    if (!queue.length) loadTrack(track, true);
  }, [queue.length, loadTrack]);

  const jumpTo = useCallback((i: number) => {
    setIndex(i);
    loadTrack(queue[i], true);
  }, [queue, loadTrack]);

  const removeAt = useCallback((i: number) => {
    if (i === index) return;
    setQueue((q) => q.filter((_, j) => j !== i));
    if (i < index) setIndex((x) => x - 1);
  }, [index]);

  const toggle = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !current) return;
    if (audio.paused) {
      wantPlay.current = true;
      audio.play().catch(() => {});
    } else {
      wantPlay.current = false;
      audio.pause();
    }
  }, [current]);

  const next = useCallback((auto = false) => {
    if (!queue.length) return;
    if (auto && repeat === 'one') {
      audioRef.current!.currentTime = 0;
      audioRef.current!.play().catch(() => {});
      return;
    }
    if (index + 1 < queue.length) {
      setIndex(index + 1);
      loadTrack(queue[index + 1], true);
    } else if (repeat === 'all' || !auto) {
      const order = shuffle ? shuffled(queue) : queue;
      if (shuffle) setQueue(order);
      setIndex(0);
      loadTrack(order[0], true);
    } else {
      wantPlay.current = false;
      setPlaying(false);
    }
  }, [queue, index, repeat, shuffle, loadTrack]);

  const prev = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.currentTime > 3 || index === 0) {
      audio.currentTime = 0;
    } else {
      setIndex(index - 1);
      loadTrack(queue[index - 1], !audio.paused);
    }
  }, [index, queue, loadTrack]);

  const seek = useCallback((t: number) => {
    const audio = audioRef.current;
    if (!audio || !Number.isFinite(t)) return;
    audio.currentTime = Math.max(0, Math.min(t, audio.duration || t));
    setTime(audio.currentTime);
  }, []);

  const setVolume = useCallback((v: number) => setVolumeState(Math.max(0, Math.min(1, v))), []);

  const toggleShuffle = useCallback(() => {
    if (!current) { setShuffle((s) => !s); return; }
    if (shuffle) {
      const i = original.findIndex((t) => t.id === current.id);
      setQueue(original);
      setIndex(Math.max(0, i));
    } else {
      const rest = shuffled(queue.filter((_, j) => j !== index));
      setQueue([current, ...rest]);
      setIndex(0);
    }
    setShuffle(!shuffle);
  }, [shuffle, original, queue, index, current]);

  const cycleRepeat = useCallback(() => {
    setRepeat((r) => (r === 'off' ? 'all' : r === 'all' ? 'one' : 'off'));
  }, []);

  // ---- audio element events ----
  const onTimeUpdate = () => {
    const audio = audioRef.current!;
    const t = audio.currentTime;
    setTime(t);

    // Count real listening time (ignores seeks) and log a play at 30s or halfway.
    const l = listened.current;
    const delta = t - l.lastT;
    if (delta > 0 && delta < 2) l.secs += delta;
    l.lastT = t;
    const threshold = Math.min(30, (audio.duration || 60) / 2);
    if (!l.logged && l.secs >= threshold && l.id) {
      l.logged = true;
      fetch('/api/play', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trackId: l.id }),
        keepalive: true,
      }).catch(() => {});
    }

    // Warm up the next track ~20s before the end for a near-gapless transition.
    const upcoming = queue[index + 1];
    const pre = preloadRef.current;
    if (upcoming && pre && audio.duration - t < 20 && !pre.src.endsWith(streamUrl(upcoming.id))) {
      pre.src = streamUrl(upcoming.id);
      pre.load();
    }
  };

  const onLoadedMetadata = () => {
    const audio = audioRef.current!;
    setDuration(audio.duration);
    if (resumeAt.current != null) {
      audio.currentTime = resumeAt.current;
      setTime(resumeAt.current);
      resumeAt.current = null;
    }
  };

  const onError = () => {
    // Signed URLs expire; if a long-paused track fails, fetch a fresh URL once and resume.
    const audio = audioRef.current!;
    if (!current || retried.current === current.id) return;
    retried.current = current.id;
    resumeAt.current = audio.currentTime;
    audio.src = `${streamUrl(current.id)}?r=${Date.now()}`;
    audio.load();
    if (wantPlay.current) audio.play().catch(() => {});
  };

  // ---- Media Session: lock screen, headphones, keyboard media keys ----
  useEffect(() => {
    if (!('mediaSession' in navigator) || !current) return;
    const art = current.cover
      ? ([300, 600, 1200] as const).map((s) => ({ src: coverUrl(current.cover, s)!, sizes: `${s}x${s}`, type: 'image/webp' }))
      : [];
    navigator.mediaSession.metadata = new MediaMetadata({
      title: current.title, artist: current.artist, album: current.albumTitle, artwork: art,
    });
  }, [current]);

  useEffect(() => {
    if (!('mediaSession' in navigator)) return;
    const ms = navigator.mediaSession;
    const handlers: [MediaSessionAction, MediaSessionActionHandler][] = [
      ['play', () => toggle()],
      ['pause', () => toggle()],
      ['nexttrack', () => next()],
      ['previoustrack', () => prev()],
      ['seekto', (d) => d.seekTime != null && seek(d.seekTime)],
      ['seekforward', (d) => seek((audioRef.current?.currentTime ?? 0) + (d.seekOffset ?? 10))],
      ['seekbackward', (d) => seek((audioRef.current?.currentTime ?? 0) - (d.seekOffset ?? 10))],
    ];
    for (const [a, h] of handlers) {
      try { ms.setActionHandler(a, h); } catch { /* unsupported action */ }
    }
  }, [toggle, next, prev, seek]);

  useEffect(() => {
    if (!('mediaSession' in navigator)) return;
    navigator.mediaSession.playbackState = playing ? 'playing' : 'paused';
    if (duration && Number.isFinite(duration) && time <= duration) {
      try { navigator.mediaSession.setPositionState({ duration, position: time, playbackRate: 1 }); } catch { /* noop */ }
    }
  }, [playing, duration, time]);

  // ---- tab title ----
  useEffect(() => {
    if (current && playing) document.title = `${current.title} · ${current.artist}`;
    else document.title = "Tim's Music";
  }, [current, playing]);

  // ---- keyboard shortcuts ----
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el.closest('input, textarea, select, [contenteditable="true"]') || e.metaKey || e.ctrlKey || e.altKey) return;
      const audio = audioRef.current;
      if (e.code === 'Space') { e.preventDefault(); toggle(); }
      else if (e.key === 'ArrowRight' && e.shiftKey) next();
      else if (e.key === 'ArrowLeft' && e.shiftKey) prev();
      else if (e.key === 'ArrowRight' && audio) seek(audio.currentTime + 5);
      else if (e.key === 'ArrowLeft' && audio) seek(audio.currentTime - 5);
      else if (e.key === 'ArrowUp') { e.preventDefault(); setVolume(volume + 0.1); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); setVolume(volume - 0.1); }
      else if (e.key.toLowerCase() === 's') toggleShuffle();
      else if (e.key.toLowerCase() === 'r') cycleRepeat();
      else if (e.key === 'Escape') setNowPlayingOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggle, next, prev, seek, setVolume, volume, toggleShuffle, cycleRepeat]);

  const value = useMemo(() => ({
    queue, index, current, playing, buffering, shuffle, repeat, volume, nowPlayingOpen, nowPlayingTab, recentAlbums,
    playTracks, playNext, addToQueue, jumpTo, removeAt, toggle, next: () => next(), prev, seek, setVolume,
    toggleShuffle, cycleRepeat, setNowPlayingOpen, openNowPlaying, setNowPlayingTab,
  }), [queue, index, current, playing, buffering, shuffle, repeat, volume, nowPlayingOpen, nowPlayingTab, recentAlbums,
    playTracks, playNext, addToQueue, jumpTo, removeAt, toggle, next, prev, seek, setVolume, toggleShuffle, cycleRepeat, openNowPlaying]);

  const timeValue = useMemo(() => ({ time, duration }), [time, duration]);

  return (
    <PlayerContext.Provider value={value}>
      <TimeContext.Provider value={timeValue}>
        {children}
        <audio
          ref={audioRef}
          preload="auto"
          onPlay={() => { setPlaying(true); rememberAlbum(); }}
          onPause={() => setPlaying(false)}
          onWaiting={() => setBuffering(true)}
          onPlaying={() => setBuffering(false)}
          onCanPlay={() => setBuffering(false)}
          onTimeUpdate={onTimeUpdate}
          onLoadedMetadata={onLoadedMetadata}
          onDurationChange={() => setDuration(audioRef.current!.duration)}
          onEnded={() => next(true)}
          onError={onError}
        />
        <audio ref={preloadRef} preload="auto" muted aria-hidden />
      </TimeContext.Provider>
    </PlayerContext.Provider>
  );
}
