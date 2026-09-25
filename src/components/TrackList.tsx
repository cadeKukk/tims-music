'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { Clock3, ListEnd, ListPlus, MoreHorizontal, Disc3, Play } from 'lucide-react';
import { usePlayer } from './player/PlayerProvider';
import { Cover } from './Cover';
import { formatTime } from '@/lib/cover';
import type { PlayerTrack } from '@/lib/types';

export type TrackRow = PlayerTrack & { disc?: number; trackNo?: number | null };

export function TrackList({
  tracks,
  mainArtist,
  showCover = false,
  showAlbum = false,
  numbered = true,
}: {
  tracks: TrackRow[];
  mainArtist?: string;
  showCover?: boolean;
  showAlbum?: boolean;
  numbered?: boolean;
}) {
  const { playTracks, current, playing, toggle } = usePlayer();
  const multiDisc = new Set(tracks.map((t) => t.disc ?? 1)).size > 1;

  return (
    <div className="px-2 md:px-6">
      <div className="hidden grid-cols-[2.5rem_minmax(0,1fr)_4rem_2.5rem] border-b border-line px-2 pb-2 text-xs uppercase tracking-wider text-faint md:grid">
        <span className="text-center">#</span>
        <span>Title</span>
        <span className="flex justify-end"><Clock3 className="size-4" /></span>
        <span />
      </div>
      <ol className="pt-2">
        {tracks.map((t, i) => {
          const isCurrent = current?.id === t.id;
          const discHeader = multiDisc && (i === 0 || tracks[i - 1].disc !== t.disc);
          return (
            <li key={t.id}>
              {discHeader && (
                <div className="flex items-center gap-2 px-2 pt-5 pb-2 text-sm font-semibold text-muted">
                  <Disc3 className="size-4" /> Disc {t.disc}
                </div>
              )}
              <div
                onDoubleClick={() => playTracks(tracks, i)}
                className={`group grid grid-cols-[2.5rem_minmax(0,1fr)_2.5rem] items-center rounded-lg px-2 py-2 transition hover:bg-hover md:grid-cols-[2.5rem_minmax(0,1fr)_4rem_2.5rem] ${
                  isCurrent ? 'bg-hover/60' : ''
                }`}
              >
                <button
                  onClick={() => (isCurrent ? toggle() : playTracks(tracks, i))}
                  aria-label={isCurrent && playing ? 'Pause' : `Play ${t.title}`}
                  className="grid h-8 place-items-center text-sm tabular-nums text-muted"
                >
                  {isCurrent ? (
                    <span className={`eq ${playing ? '' : 'paused'}`}><span /><span /><span /></span>
                  ) : (
                    <>
                      <span className="group-hover:hidden">
                        {showCover ? (
                          <Cover coverKey={t.cover} alt="" sizes="40px" className="size-9 rounded" />
                        ) : numbered ? (t.trackNo ?? i + 1) : i + 1}
                      </span>
                      <Play className="hidden size-4 text-fg group-hover:block" fill="currentColor" />
                    </>
                  )}
                </button>
                <button onClick={() => playTracks(tracks, i)} className="min-w-0 pl-2 text-left">
                  <div className={`truncate text-[15px] font-medium ${isCurrent ? 'text-accent' : ''}`}>{t.title}</div>
                  {(showAlbum || (mainArtist && t.artist !== mainArtist)) && (
                    <div className="truncate text-xs text-muted">
                      {t.artist !== mainArtist && t.artist}
                      {showAlbum && t.artist !== mainArtist && ' · '}
                      {showAlbum && t.albumTitle}
                    </div>
                  )}
                </button>
                <span className="hidden text-right text-sm tabular-nums text-muted md:block">{formatTime(t.duration)}</span>
                <TrackMenu track={t} />
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function TrackMenu({ track }: { track: PlayerTrack }) {
  const { playNext, addToQueue } = usePlayer();
  const [open, setOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 1400);
    return () => clearTimeout(id);
  }, [toast]);

  const act = (fn: () => void, msg: string) => () => { fn(); setOpen(false); setToast(msg); };

  return (
    <div ref={ref} className="relative flex justify-end">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="More options"
        className="grid size-8 place-items-center rounded-full text-muted transition hover:bg-white/10 hover:text-fg md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100"
      >
        <MoreHorizontal className="size-5" />
      </button>
      {toast && (
        <span className="pointer-events-none absolute right-9 top-1/2 -translate-y-1/2 whitespace-nowrap rounded-full bg-fg px-3 py-1 text-xs font-medium text-black">
          {toast}
        </span>
      )}
      {open && (
        <div className="fade-in absolute right-0 top-9 z-20 w-52 overflow-hidden rounded-xl border border-line bg-elevated py-1 text-sm shadow-2xl">
          <button onClick={act(() => playNext(track), 'Playing next')} className="flex w-full items-center gap-3 px-3 py-2 hover:bg-hover">
            <ListPlus className="size-4" /> Play next
          </button>
          <button onClick={act(() => addToQueue(track), 'Added to queue')} className="flex w-full items-center gap-3 px-3 py-2 hover:bg-hover">
            <ListEnd className="size-4" /> Add to queue
          </button>
          <Link href={`/album/${track.albumSlug}`} className="flex items-center gap-3 px-3 py-2 hover:bg-hover">
            <Disc3 className="size-4" /> Go to album
          </Link>
        </div>
      )}
    </div>
  );
}
