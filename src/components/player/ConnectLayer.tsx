'use client';
/* eslint-disable react-hooks/refs, react-hooks/preserve-manual-memoization --
   Realtime callbacks and transfer helpers deliberately read the latest player state through a
   ref (L), so the channel doesn't have to be torn down and re-subscribed on every render. */

/**
 * Spotify Connect-style device sync for signed-in users.
 *
 * All of a user's open devices join a private Supabase Realtime channel (named by their secret
 * sync key). One device plays at a time; it broadcasts its state, and every other device renders
 * that state and sends commands back, so any device works as a remote. Playback can be moved
 * between devices, and the last state is saved server-side so a fresh device can resume.
 *
 * Messages (broadcast): state, claim, cmd, handoff, hello. Presence: the list of online devices.
 */

import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode,
} from 'react';
import { createClient, type RealtimeChannel, type SupabaseClient } from '@supabase/supabase-js';
import { useSession } from '../account/SessionProvider';
import { deviceKind, deviceName } from '@/lib/device';
import type { PlayerTrack } from '@/lib/types';
import {
  PlayerContext, TimeContext, type LocalExtras, type PlayerValue, type Repeat, type Snapshot, type TimeValue,
} from './context';

export type Device = { id: string; name: string; kind: 'phone' | 'tablet' | 'computer' };

type RemoteState = {
  from: string;
  name: string;
  track: PlayerTrack | null;
  playing: boolean;
  position: number;
  duration: number;
  index: number;
  upcoming: PlayerTrack[];
  shuffle: boolean;
  repeat: Repeat;
  volume: number;
  receivedAt: number; // local clock, so clock skew between devices doesn't matter
};

type ConnectValue = {
  enabled: boolean;
  me: Device | null;
  devices: (Device & { isMe: boolean; isActive: boolean })[];
  isRemote: boolean;
  activeName: string | null;
  transferTo: (deviceId: string) => void;
};

const ConnectContext = createContext<ConnectValue>({
  enabled: false, me: null, devices: [], isRemote: false, activeName: null, transferTo: () => {},
});
export const useConnect = () => useContext(ConnectContext);

// ---------- this device's identity (per browser tab, stable across reloads) ----------

let meCache: Device | null = null;
function getMe(): Device {
  if (meCache) return meCache;
  let id: string | null = null;
  // Dev-only: ?device=<name> lets two frames in one tab act as separate devices for testing.
  const devOverride = process.env.NODE_ENV !== 'production' && new URLSearchParams(location.search).get('device');
  if (devOverride) {
    meCache = { id: `dev-${devOverride}`, name: `Test ${devOverride}`, kind: 'computer' };
    return meCache;
  }
  try { id = sessionStorage.getItem('ec_device_id'); } catch { /* storage blocked */ }
  if (!id) {
    id = crypto.randomUUID();
    try { sessionStorage.setItem('ec_device_id', id); } catch { /* storage blocked */ }
  }
  meCache = { id, name: deviceName(navigator.userAgent), kind: deviceKind(navigator.userAgent) };
  return meCache;
}
const noopSubscribe = () => () => {};

let supabase: SupabaseClient | null = null;
function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;
  supabase ??= createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return supabase;
}

const STALE_MS = 5 * 60_000;     // a paused remote device stops "owning" playback after 5 minutes
const HEARTBEAT_MS = 10_000;     // state broadcast while playing (only when another device is online)
const SAVE_MS = 20_000;          // resume-state save to the server while playing
const MAX_SYNC_TRACKS = 500;     // cap queue sizes sent over the wire

/** Trims a very long queue around the current track so it fits in a message / DB row. */
function trimSnapshot(s: Snapshot): Snapshot {
  if (s.queue.length <= MAX_SYNC_TRACKS) return s;
  const start = Math.max(0, s.index - 50);
  const queue = s.queue.slice(start, start + MAX_SYNC_TRACKS);
  return { ...s, queue, original: queue, index: s.index - start };
}

export function ConnectLayer({
  local, localTime, extras, children,
}: { local: PlayerValue; localTime: TimeValue; extras: LocalExtras; children: ReactNode }) {
  const { user, syncKey } = useSession();
  const me = useSyncExternalStore(noopSubscribe, getMe, () => null);
  const enabled = !!(user && syncKey && me && getSupabase());

  const [devices, setDevices] = useState<Device[]>([]);
  const [remote, setRemote] = useState<RemoteState | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [now, setNow] = useState(0);

  const channelRef = useRef<RealtimeChannel | null>(null);
  // Latest values for use inside long-lived realtime callbacks.
  const L = useRef({ local, localTime, extras, devices, activeId });
  useEffect(() => { L.current = { local, localTime, extras, devices, activeId }; });

  const send = useCallback((event: string, payload: Record<string, unknown>) => {
    const me = getMe();
    channelRef.current?.send({ type: 'broadcast', event, payload: { ...payload, from: me.id } });
  }, []);

  // ---------- this device as the player ----------

  const broadcastState = useCallback(() => {
    const { local, extras } = L.current;
    const me = getMe();
    send('state', {
      name: me.name,
      track: local.current,
      playing: local.playing,
      position: extras.currentTime(),
      duration: L.current.localTime.duration || local.current?.duration || 0,
      index: local.index,
      upcoming: local.queue.slice(local.index + 1, local.index + 31),
      shuffle: local.shuffle,
      repeat: local.repeat,
      volume: local.volume,
    });
  }, [send]);

  const saveState = useCallback(async (beacon = false) => {
    const { local, extras } = L.current;
    if (!local.current) return;
    const me = getMe();
    const body = JSON.stringify({ deviceId: me.id, deviceName: me.name, state: trimSnapshot(extras.snapshot()) });
    if (beacon && navigator.sendBeacon) navigator.sendBeacon('/api/playback', new Blob([body], { type: 'application/json' }));
    else await fetch('/api/playback', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body, keepalive: true }).catch(() => {});
  }, []);

  /** Loads the account's saved state. `at` pins the exact position the previous device stopped at. */
  const loadFromServer = useCallback(async (play: boolean, at?: { trackId?: string; position?: number }) => {
    const res = await fetch('/api/playback', { cache: 'no-store' });
    const data = res.ok ? await res.json() : null;
    const state = data?.state as Snapshot | undefined;
    if (!state?.queue?.length) return data;
    if (at?.trackId && state.queue[state.index]?.id === at.trackId && typeof at.position === 'number') state.position = at.position;
    L.current.extras.loadSnapshot(state, play);
    return data;
  }, []);

  /** Move playback from this device to another one. */
  const handOff = useCallback(async (to: string) => {
    const { local, extras } = L.current;
    if (!local.current) return;
    const position = extras.currentTime();
    extras.pause();
    setActiveId(to);
    await saveState(); // make sure the queue is saved before the other device reads it
    send('handoff', { to, trackId: local.current.id, position });
  }, [saveState, send]);

  const execute = useCallback((action: string, args: Record<string, unknown> = {}) => {
    const { local, extras } = L.current;
    switch (action) {
      case 'toggle': local.toggle(); break;
      case 'play': extras.play(); break;
      case 'pause': extras.pause(); break;
      case 'next': local.next(); break;
      case 'prev': local.prev(); break;
      case 'seek': local.seek(Number(args.t)); setTimeout(broadcastState, 150); break;
      case 'setVolume': local.setVolume(Number(args.v)); break;
      case 'toggleShuffle': local.toggleShuffle(); break;
      case 'cycleRepeat': local.cycleRepeat(); break;
      case 'playTracks': local.playTracks(args.tracks as PlayerTrack[], Number(args.start ?? 0), args.opts as { shuffle?: boolean }); break;
      case 'playNext': local.playNext(args.track as PlayerTrack); break;
      case 'addToQueue': local.addToQueue(args.track as PlayerTrack); break;
      case 'jumpTo': local.jumpTo(Number(args.i)); break;
      case 'removeAt': local.removeAt(Number(args.i)); break;
      case 'handoff': handOff(String(args.to)); break;
    }
  }, [broadcastState, handOff]);

  // ---------- channel lifecycle ----------

  useEffect(() => {
    if (!enabled || !syncKey) return;
    const sb = getSupabase()!;
    const me = getMe();
    const ch = sb.channel(`ec-${syncKey}`, { config: { presence: { key: me.id }, broadcast: { self: false } } });

    ch.on('presence', { event: 'sync' }, () => {
      const state = ch.presenceState<Device>();
      setDevices(Object.values(state).map((metas) => metas[0]).filter(Boolean).map(({ id, name, kind }) => ({ id, name, kind })));
    });
    ch.on('broadcast', { event: 'state' }, ({ payload }) => {
      if (payload.from === me.id) return;
      setRemote({ ...(payload as Omit<RemoteState, 'receivedAt'>), receivedAt: Date.now() });
      if (payload.playing) setActiveId(payload.from);
      else setActiveId((cur) => cur ?? payload.from);
    });
    ch.on('broadcast', { event: 'claim' }, ({ payload }) => {
      if (payload.from === me.id) return;
      setActiveId(payload.from);
      // Only one device plays at a time: whoever pressed play last wins.
      if (L.current.local.playing) L.current.extras.pause();
    });
    ch.on('broadcast', { event: 'cmd' }, ({ payload }) => {
      if (payload.to === me.id) execute(payload.action, payload.args);
    });
    ch.on('broadcast', { event: 'handoff' }, ({ payload }) => {
      if (payload.to !== me.id) return;
      setRemote(null);
      setActiveId(me.id);
      loadFromServer(true, { trackId: payload.trackId, position: payload.position });
    });
    ch.on('broadcast', { event: 'hello' }, () => {
      const { local, activeId } = L.current;
      if (local.playing || (activeId === me.id && local.current)) broadcastState();
    });

    ch.subscribe(async (status) => {
      if (status !== 'SUBSCRIBED') return;
      await ch.track({ id: me.id, name: me.name, kind: me.kind });
      ch.send({ type: 'broadcast', event: 'hello', payload: { from: me.id } });
    });
    channelRef.current = ch;

    // Resume: a device with nothing (or older) queued picks up the account's last state, paused.
    loadFromServerIfNewer();
    async function loadFromServerIfNewer() {
      const res = await fetch('/api/playback', { cache: 'no-store' }).catch(() => null);
      const data = res?.ok ? await res.json() : null;
      if (!data?.state?.queue?.length) return;
      const { local, extras } = L.current;
      const serverNewer = new Date(data.updated_at).getTime() > extras.changedAt();
      if (!local.playing && (!local.current || (serverNewer && data.device_id !== me.id))) {
        extras.loadSnapshot(data.state, false);
      }
    }

    return () => {
      channelRef.current = null;
      sb.removeChannel(ch);
    };
  }, [enabled, syncKey, execute, broadcastState, loadFromServer]);

  // ---------- react to local playback ----------

  const othersOnline = devices.some((d) => d.id !== me?.id);

  // Pressing play here makes this the active device and pauses the others.
  useEffect(() => {
    if (!enabled || !local.playing) return;
    const me = getMe();
    /* eslint-disable react-hooks/set-state-in-effect -- reacting to the audio element (an external system) starting */
    setActiveId(me.id);
    setRemote(null);
    /* eslint-enable react-hooks/set-state-in-effect */
    send('claim', {});
    broadcastState();
    saveState();
  }, [enabled, local.playing, send, broadcastState, saveState]);

  // Tell remotes about track / setting changes, and save when pausing or changing track.
  const trackId = local.current?.id;
  useEffect(() => {
    if (!enabled || activeId !== me?.id || !trackId) return;
    const t = setTimeout(() => { if (othersOnline) broadcastState(); saveState(); }, 200);
    return () => clearTimeout(t);
  }, [enabled, activeId, me?.id, trackId, local.playing, local.shuffle, local.repeat, local.volume, local.queue.length, othersOnline, broadcastState, saveState]);

  // Heartbeat while playing so remotes' progress bars stay accurate, plus periodic resume saves.
  useEffect(() => {
    if (!enabled || !local.playing) return;
    const hb = setInterval(() => { if (L.current.devices.length > 1) broadcastState(); }, HEARTBEAT_MS);
    const sv = setInterval(() => saveState(), SAVE_MS);
    const onHide = () => saveState(true);
    window.addEventListener('pagehide', onHide);
    return () => { clearInterval(hb); clearInterval(sv); window.removeEventListener('pagehide', onHide); };
  }, [enabled, local.playing, broadcastState, saveState]);

  // ---------- remote mode ----------

  // Clock for extrapolating the remote's position and expiring stale remote state.
  useEffect(() => {
    if (!remote) return;
    const id = setInterval(() => setNow(Date.now()), remote.playing ? 500 : 5000);
    return () => clearInterval(id);
  }, [remote]);

  const activePresent = !!activeId && activeId !== me?.id && devices.some((d) => d.id === activeId);
  const isRemote = enabled && !local.playing && activePresent && !!remote && remote.from === activeId && !!remote.track
    && (remote.playing || now - remote.receivedAt < STALE_MS);

  const cmd = useCallback((action: string, args: Record<string, unknown> = {}) => {
    send('cmd', { to: activeId, action, args });
  }, [send, activeId]);

  // Optimistic local update so remote controls feel instant.
  const nudge = useCallback((patch: Partial<RemoteState>) => {
    setRemote((r) => {
      if (!r) return r;
      const elapsed = r.playing ? (Date.now() - r.receivedAt) / 1000 : 0;
      return { ...r, position: r.position + elapsed, receivedAt: Date.now(), ...patch };
    });
  }, []);

  const value: PlayerValue = useMemo(() => {
    if (!isRemote || !remote) return local;
    return {
      ...local,
      queue: remote.track ? [remote.track, ...remote.upcoming] : [],
      index: 0,
      current: remote.track,
      playing: remote.playing,
      buffering: false,
      shuffle: remote.shuffle,
      repeat: remote.repeat,
      volume: remote.volume,
      toggle: () => { nudge({ playing: !remote.playing }); cmd('toggle'); },
      next: () => cmd('next'),
      prev: () => cmd('prev'),
      seek: (t) => { nudge({ position: t, receivedAt: Date.now() }); cmd('seek', { t }); },
      setVolume: (v) => { nudge({ volume: v }); cmd('setVolume', { v }); },
      toggleShuffle: () => { nudge({ shuffle: !remote.shuffle }); cmd('toggleShuffle'); },
      cycleRepeat: () => cmd('cycleRepeat'),
      playTracks: (tracks, start = 0, opts) => {
        const s = Math.min(start, tracks.length - 1);
        const from = Math.max(0, s - 50);
        cmd('playTracks', { tracks: tracks.slice(from, from + MAX_SYNC_TRACKS), start: s - from, opts });
      },
      playNext: (track) => cmd('playNext', { track }),
      addToQueue: (track) => cmd('addToQueue', { track }),
      jumpTo: (i) => cmd('jumpTo', { i: remote.index + i }),
      removeAt: (i) => cmd('removeAt', { i: remote.index + i }),
    };
  }, [isRemote, remote, local, cmd, nudge]);

  const timeValue: TimeValue = useMemo(() => {
    if (!isRemote || !remote) return localTime;
    const elapsed = remote.playing ? Math.max(0, (now - remote.receivedAt) / 1000) : 0;
    return { time: Math.min(remote.position + elapsed, remote.duration || Infinity), duration: remote.duration };
  }, [isRemote, remote, now, localTime]);

  // ---------- moving playback ----------

  const transferTo = useCallback((target: string) => {
    if (!enabled || !me) return;
    const activeIsMe = local.playing || activeId === me.id;
    if (target === me.id) {
      if (local.playing) return;
      extras.prime(); // we're inside the tap; unlock audio for the async play below
      if (activePresent) cmd('handoff', { to: me.id });
      else loadFromServer(true);
    } else if (activeIsMe && local.current) {
      handOff(target);
    } else if (activePresent) {
      cmd('handoff', { to: target });
    } else {
      send('handoff', { to: target }); // nothing playing anywhere: the target resumes the saved state
    }
  }, [enabled, me, local, extras, activeId, activePresent, cmd, handOff, loadFromServer, send]);

  const connect: ConnectValue = useMemo(() => ({
    enabled,
    me,
    isRemote,
    activeName: isRemote ? remote?.name ?? null : null,
    devices: (enabled ? devices : []).map((d) => ({
      ...d,
      isMe: d.id === me?.id,
      isActive: d.id === me?.id ? local.playing || (!isRemote && activeId === me?.id && !!local.current) : isRemote && d.id === activeId,
    })),
    transferTo,
  }), [enabled, me, isRemote, remote?.name, devices, local, activeId, transferTo]);

  // ---------- keyboard shortcuts (drive whichever device is playing) ----------

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el.closest('input, textarea, select, [contenteditable="true"]') || e.metaKey || e.ctrlKey || e.altKey) return;
      const v = value;
      const t = timeValue.time;
      if (e.code === 'Space') { e.preventDefault(); v.toggle(); }
      else if (e.key === 'ArrowRight' && e.shiftKey) v.next();
      else if (e.key === 'ArrowLeft' && e.shiftKey) v.prev();
      else if (e.key === 'ArrowRight') v.seek(t + 5);
      else if (e.key === 'ArrowLeft') v.seek(t - 5);
      else if (e.key === 'ArrowUp') { e.preventDefault(); v.setVolume(v.volume + 0.1); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); v.setVolume(v.volume - 0.1); }
      else if (e.key.toLowerCase() === 's') v.toggleShuffle();
      else if (e.key.toLowerCase() === 'r') v.cycleRepeat();
      else if (e.key === 'Escape') v.setNowPlayingOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [value, timeValue.time]);

  return (
    <ConnectContext.Provider value={connect}>
      <PlayerContext.Provider value={value}>
        <TimeContext.Provider value={timeValue}>{children}</TimeContext.Provider>
      </PlayerContext.Provider>
    </ConnectContext.Provider>
  );
}
