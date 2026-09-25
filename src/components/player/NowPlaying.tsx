'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { ChevronDown, ListMusic, ListPlus, MicVocal, X } from 'lucide-react';
import { usePlaylists } from '../playlists/PlaylistsProvider';
import { usePlaybackTime, usePlayer, type NowPlayingTab } from './PlayerProvider';
import { Controls, SeekBar } from './Controls';
import { Cover } from '../Cover';
import { coverUrl } from '@/lib/cover';

type Tab = NowPlayingTab;

const DESKTOP = '(min-width: 768px)';
function useIsDesktop() {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia(DESKTOP);
      mq.addEventListener('change', cb);
      return () => mq.removeEventListener('change', cb);
    },
    () => window.matchMedia(DESKTOP).matches,
    () => true,
  );
}

export function NowPlaying() {
  const { current, nowPlayingOpen, setNowPlayingOpen, nowPlayingTab: tab, setNowPlayingTab: setTab } = usePlayer();
  const isDesktop = useIsDesktop();
  // Phones show artwork by default; tapping Lyrics / Up next swaps it for that panel.
  const [mobilePanel, setMobilePanel] = useState(false);
  const [dragY, setDragY] = useState(0);
  const dragStart = useRef<number | null>(null);

  useEffect(() => {
    document.body.style.overflow = nowPlayingOpen ? 'hidden' : '';
  }, [nowPlayingOpen]);

  if (!current || !nowPlayingOpen) return null;
  const close = () => { setDragY(0); setNowPlayingOpen(false); };
  const showPanel = isDesktop || mobilePanel;
  const pickMobile = (t: Tab) => {
    if (mobilePanel && tab === t) setMobilePanel(false);
    else { setTab(t); setMobilePanel(true); }
  };

  // Swipe down to dismiss (phones). Ignored when the gesture starts inside a scrolling panel.
  const onTouchStart = (e: React.TouchEvent) => {
    if (isDesktop || (e.target as HTMLElement).closest('[data-scroll-panel], input')) return;
    dragStart.current = e.touches[0].clientY;
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (dragStart.current == null) return;
    setDragY(Math.max(0, e.touches[0].clientY - dragStart.current));
  };
  const onTouchEnd = () => {
    if (dragStart.current == null) return;
    dragStart.current = null;
    if (dragY > 120) close(); else setDragY(0);
  };

  const panel = tab === 'lyrics' ? <Lyrics /> : <Queue onNavigate={close} />;

  return (
    <div
      role="dialog"
      aria-label="Now playing"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      className="fade-in fixed inset-0 z-50 overflow-hidden overscroll-none"
      style={{
        '--color-accent': current.accent ?? undefined,
        backgroundColor: current.bg ?? '#111',
        transform: dragY ? `translateY(${dragY}px)` : undefined,
        transition: dragY ? 'none' : 'transform 0.2s ease-out',
        borderRadius: dragY ? 24 : undefined,
      } as React.CSSProperties}
    >
      {/* Blurred artwork backdrop */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={coverUrl(current.cover, 300) ?? ''} alt="" aria-hidden className="absolute inset-0 size-full scale-125 object-cover opacity-40 blur-3xl" />
      <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/40 to-black/80" />

      <div className="relative mx-auto flex h-full w-full max-w-[100vw] flex-col px-5 pt-[max(env(safe-area-inset-top),12px)] pb-[max(env(safe-area-inset-bottom),16px)] md:px-10">
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between">
          <button onClick={close} aria-label="Close" className="grid size-11 place-items-center rounded-full hover:bg-white/10">
            <ChevronDown className="size-7 md:hidden" />
            <X className="hidden size-6 md:block" />
          </button>
          <div className="hidden rounded-full bg-black/30 p-1 text-sm font-medium md:flex">
            {(['lyrics', 'queue'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`rounded-full px-4 py-1.5 transition ${tab === t ? 'bg-white/90 text-black' : 'text-white/70 hover:text-white'}`}
              >
                {t === 'queue' ? 'Up next' : 'Lyrics'}
              </button>
            ))}
          </div>
          <div className="mx-3 min-w-0 flex-1 truncate text-center text-xs font-semibold uppercase tracking-wider text-white/60 md:hidden">
            {current.albumTitle}
          </div>
          <div className="size-11" />
        </div>
        {/* Grab handle hint for swipe-to-close */}
        <div className="mx-auto -mt-1 h-1 w-10 shrink-0 rounded-full bg-white/25 md:hidden" aria-hidden />

        <div className="flex min-h-0 flex-1 flex-col md:grid md:grid-cols-[minmax(0,34rem)_minmax(0,1fr)] md:gap-14 md:pt-10">
          <div className="flex min-h-0 min-w-0 flex-1 flex-col md:justify-center">
            {showPanel && !isDesktop ? (
              <>
                {/* Compact now-playing row above the panel */}
                <div className="flex shrink-0 items-center gap-3 pt-4 pb-3">
                  <Cover coverKey={current.cover} alt="" sizes="56px" className="size-14 rounded-md shadow-lg" />
                  <TitleBlock onNavigate={close} compact />
                </div>
                <div className="-mx-2 min-h-0 flex-1 overflow-hidden">{panel}</div>
              </>
            ) : (
              <div className="flex min-h-0 flex-1 flex-col justify-center gap-6 pt-4 md:flex-none md:pt-0">
                <Cover
                  coverKey={current.cover}
                  alt={current.albumTitle}
                  sizes="(min-width: 768px) 544px, 85vw"
                  priority
                  className="mx-auto w-full max-w-[min(100%,48vh)] rounded-xl shadow-2xl shadow-black/50 md:max-w-none"
                />
              </div>
            )}

            <div className="shrink-0 space-y-4 pt-5 md:pt-6">
              {!(showPanel && !isDesktop) && <TitleBlock onNavigate={close} />}
              <SeekBar className="text-white/70" />
              <Controls size="lg" />
            </div>

            {/* Phone: Lyrics / Up next toggles */}
            <div className="flex shrink-0 items-center justify-around pt-5 md:hidden">
              {([['lyrics', MicVocal, 'Lyrics'], ['queue', ListMusic, 'Up next']] as const).map(([t, Icon, label]) => {
                const active = mobilePanel && tab === t;
                return (
                  <button
                    key={t}
                    onClick={() => pickMobile(t)}
                    aria-pressed={active}
                    className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition ${active ? 'bg-white/90 text-black' : 'text-white/70'}`}
                  >
                    <Icon className="size-5" /> {label}
                  </button>
                );
              })}
            </div>
          </div>

          {isDesktop && <div className="min-h-0 overflow-hidden rounded-2xl bg-black/15">{panel}</div>}
        </div>
      </div>
    </div>
  );
}

function TitleBlock({ onNavigate, compact = false }: { onNavigate: () => void; compact?: boolean }) {
  const { current } = usePlayer();
  const { pick } = usePlaylists();
  if (!current) return null;
  return (
    <div className="flex min-w-0 flex-1 items-center gap-3">
    <div className="min-w-0 flex-1">
      <div className={`truncate font-bold ${compact ? 'text-base' : 'text-xl md:text-2xl'}`}>{current.title}</div>
      <div className={`truncate text-white/70 ${compact ? 'text-sm' : ''}`}>
        <Link onClick={onNavigate} href={`/artist/${current.artistSlug}`} className="hover:underline">{current.artist}</Link>
        {!compact && (
          <>
            {' — '}
            <Link onClick={onNavigate} href={`/album/${current.albumSlug}`} className="hover:underline">{current.albumTitle}</Link>
          </>
        )}
      </div>
    </div>
    <button
      onClick={() => pick([current.id], current.title)}
      title="Add to playlist"
      aria-label="Add to playlist"
      className="grid size-10 shrink-0 place-items-center rounded-full text-white/70 transition hover:bg-white/10 hover:text-white"
    >
      <ListPlus className="size-6" />
    </button>
    </div>
  );
}

type LyricsData = { lines: { t: number; text: string }[] | null; plain: string | null; instrumental: boolean };

function Lyrics() {
  const { current, seek } = usePlayer();
  const { time } = usePlaybackTime();
  const [data, setData] = useState<{ id: string; lyrics: LyricsData | null }>({ id: '', lyrics: null });
  const activeRef = useRef<HTMLButtonElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!current) return;
    const ctrl = new AbortController();
    const p = new URLSearchParams({
      artist: current.artist, title: current.title, album: current.albumTitle, duration: String(current.duration),
    });
    fetch(`/api/lyrics?${p}`, { signal: ctrl.signal })
      .then((r) => r.json())
      .then((lyrics: LyricsData) => setData({ id: current.id, lyrics }))
      .catch(() => {});
    return () => ctrl.abort();
  }, [current]);

  const lyrics = data.id === current?.id ? data.lyrics : null;
  const lines = lyrics?.lines;
  let active = -1;
  if (lines) for (let i = 0; i < lines.length && lines[i].t <= time + 0.25; i++) active = i;

  useEffect(() => {
    const el = activeRef.current;
    const box = boxRef.current;
    if (el && box) box.scrollTo({ top: el.offsetTop - box.clientHeight / 3, behavior: 'smooth' });
  }, [active]);

  if (!lyrics) return <div className="grid h-full place-items-center text-white/50">Loading lyrics…</div>;
  if (lyrics.instrumental) return <div className="grid h-full place-items-center text-2xl font-bold text-white/60">♪ Instrumental ♪</div>;
  if (!lines && !lyrics.plain) return <div className="grid h-full place-items-center text-white/50">No lyrics found for this song.</div>;

  return (
    <div ref={boxRef} data-scroll-panel className="no-scrollbar relative h-full overflow-y-auto overscroll-contain px-2 pt-6 pb-[40%] md:px-8 md:py-[30vh]">
      {lines ? (
        lines.map((l, i) => (
          <button
            key={i}
            ref={i === active ? activeRef : undefined}
            onClick={() => seek(l.t)}
            className={`block w-full origin-left py-2 text-left text-[1.4rem] font-bold leading-snug transition-all duration-300 md:text-3xl ${
              i === active ? 'scale-[1.02] text-white' : i < active ? 'text-white/35' : 'text-white/45 hover:text-white/70'
            }`}
          >
            {l.text || '♪'}
          </button>
        ))
      ) : (
        <p className="whitespace-pre-line text-xl font-semibold leading-relaxed text-white/80">{lyrics.plain}</p>
      )}
      <p className="pt-8 text-xs text-white/40">Lyrics from LRCLIB</p>
    </div>
  );
}

function Queue({ onNavigate }: { onNavigate: () => void }) {
  const { queue, index, jumpTo, removeAt } = usePlayer();
  const upcoming = queue.slice(index + 1);
  return (
    <div data-scroll-panel className="h-full overflow-y-auto overscroll-contain p-2 md:p-4">
      <div className="px-2 pb-2 text-xs font-semibold uppercase tracking-wider text-white/50">Now playing</div>
      <QueueRow track={queue[index]} active />
      <div className="mt-4 flex items-baseline justify-between px-2 pb-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-white/50">Next up</span>
        <span className="text-xs text-white/40">{upcoming.length} songs</span>
      </div>
      {upcoming.length === 0 && <p className="px-2 text-sm text-white/50">Nothing queued. Pick an album or hit shuffle on an artist.</p>}
      {upcoming.slice(0, 200).map((t, i) => (
        <QueueRow
          key={`${t.id}-${i}`}
          track={t}
          onPlay={() => jumpTo(index + 1 + i)}
          onRemove={() => removeAt(index + 1 + i)}
        />
      ))}
      <Link href="/search" onClick={onNavigate} className="mt-4 block px-2 text-sm text-white/50 hover:text-white">
        Find something else →
      </Link>
    </div>
  );
}

function QueueRow({
  track, active, onPlay, onRemove,
}: {
  track: ReturnType<typeof usePlayer>['queue'][number];
  active?: boolean;
  onPlay?: () => void;
  onRemove?: () => void;
}) {
  return (
    <div className="group flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-white/10">
      <button onClick={onPlay} disabled={!onPlay} className="flex min-w-0 flex-1 items-center gap-3 text-left">
        <Cover coverKey={track.cover} alt="" sizes="40px" className="size-10 rounded" />
        <div className="min-w-0">
          <div className={`truncate text-sm font-medium ${active ? 'text-accent' : ''}`}>{track.title}</div>
          <div className="truncate text-xs text-white/60">{track.artist} · {track.albumTitle}</div>
        </div>
      </button>
      {onRemove && (
        <button onClick={onRemove} aria-label="Remove from queue" className="p-2 text-white/40 opacity-0 transition hover:text-white group-hover:opacity-100 [@media(hover:none)]:opacity-100">
          <X className="size-4" />
        </button>
      )}
    </div>
  );
}
