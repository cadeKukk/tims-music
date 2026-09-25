'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';
import { AlbumCard } from '@/components/AlbumCard';
import { Cover } from '@/components/Cover';
import { Grid } from '@/components/Shelf';
import { TrackList } from '@/components/TrackList';
import type { PlayerTrack } from '@/lib/types';

type Results = {
  artists: { id: string; slug: string; name: string; cover_key: string | null }[];
  albums: { id: string; slug: string; title: string; year: number | null; cover_key: string | null; color_bg: string | null; artist_name: string }[];
  tracks: {
    id: string; title: string; artist_credit: string; duration_sec: number; album_slug: string; album_title: string;
    cover_key: string | null; color_bg: string | null; color_accent: string | null; artist_slug: string;
  }[];
};

type BrowseArtist = { slug: string; name: string; cover: string | null; bg: string | null };

export function SearchClient({ artists }: { artists: BrowseArtist[] }) {
  const [q, setQ] = useState('');
  const [latest, setResults] = useState<Results | null>(null);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Restore ?q= on load and keep it in the URL so searches are shareable/back-button friendly.
  useEffect(() => {
    const initial = new URLSearchParams(window.location.search).get('q');
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sync from URL once on mount
    if (initial) setQ(initial);
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const term = q.trim();
    const url = new URL(window.location.href);
    if (term) url.searchParams.set('q', term); else url.searchParams.delete('q');
    window.history.replaceState(null, '', url);
    if (term.length < 2) return;
    const ctrl = new AbortController();
    const id = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(term)}`, { signal: ctrl.signal });
        if (res.ok) setResults(await res.json());
      } catch { /* aborted */ } finally {
        setLoading(false);
      }
    }, 180);
    return () => { clearTimeout(id); ctrl.abort(); };
  }, [q]);

  // Results for a too-short query are hidden rather than cleared, so no state reset is needed.
  const results = q.trim().length >= 2 ? latest : null;
  const tracks: PlayerTrack[] = (results?.tracks ?? []).map((t) => ({
    id: t.id, title: t.title, artist: t.artist_credit, artistSlug: t.artist_slug,
    albumTitle: t.album_title, albumSlug: t.album_slug, cover: t.cover_key, duration: t.duration_sec,
    accent: t.color_accent, bg: t.color_bg,
  }));
  const empty = results && !results.artists.length && !results.albums.length && !results.tracks.length;

  return (
    <div className="fade-in">
      <div className="sticky top-[env(safe-area-inset-top)] z-20 bg-bg/85 px-4 pt-6 pb-4 backdrop-blur-xl md:px-8 md:pt-8">
        <div className="relative max-w-xl">
          <Search className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Songs, albums, artists"
            aria-label="Search"
            type="search"
            enterKeyHint="search"
            className="w-full rounded-full border border-line bg-elevated py-3 pr-11 pl-12 text-base outline-none transition placeholder:text-faint focus:border-white/30 focus:bg-hover [&::-webkit-search-cancel-button]:hidden"
          />
          {q && (
            <button onClick={() => { setQ(''); inputRef.current?.focus(); }} aria-label="Clear" className="absolute top-1/2 right-3 -translate-y-1/2 p-1 text-muted hover:text-fg">
              <X className="size-5" />
            </button>
          )}
        </div>
      </div>

      {!results && (
        <section>
          <h2 className="px-4 pb-3 text-xl font-bold md:px-8">Browse artists</h2>
          <div className="grid grid-cols-2 gap-3 px-4 sm:grid-cols-3 md:px-8 lg:grid-cols-4">
            {artists.map((a) => (
              <Link
                key={a.slug}
                href={`/artist/${a.slug}`}
                className="relative h-28 overflow-hidden rounded-xl p-4 transition hover:scale-[1.02] md:h-36"
                style={{ backgroundColor: a.bg ?? '#333' }}
              >
                <span className="relative z-10 text-lg font-bold md:text-xl">{a.name}</span>
                <Cover coverKey={a.cover} alt="" sizes="120px" className="absolute -right-4 -bottom-3 w-20 rotate-[20deg] rounded shadow-xl md:w-28" />
              </Link>
            ))}
          </div>
        </section>
      )}

      {empty && !loading && <p className="px-4 pt-6 text-muted md:px-8">No results for “{q}”. Check the spelling or try fewer words.</p>}

      {results && !empty && (
        <div className="space-y-8 pb-6">
          {results.artists.length > 0 && (
            <section>
              <h2 className="px-4 pb-2 text-xl font-bold md:px-8">Artists</h2>
              <div className="no-scrollbar flex gap-2 overflow-x-auto px-2 md:px-6">
                {results.artists.map((a) => (
                  <Link key={a.id} href={`/artist/${a.slug}`} className="w-32 shrink-0 rounded-xl p-2 text-center hover:bg-hover/70 md:w-40">
                    <Cover coverKey={a.cover_key} alt={a.name} sizes="160px" className="w-full rounded-full" />
                    <div className="mt-2 truncate text-sm font-semibold">{a.name}</div>
                  </Link>
                ))}
              </div>
            </section>
          )}
          {tracks.length > 0 && (
            <section>
              <h2 className="px-4 pb-2 text-xl font-bold md:px-8">Songs</h2>
              <div className="max-w-4xl">
                <TrackList tracks={tracks} showCover showAlbum numbered={false} mainArtist="" />
              </div>
            </section>
          )}
          {results.albums.length > 0 && (
            <section>
              <h2 className="px-4 pb-2 text-xl font-bold md:px-8">Albums</h2>
              <Grid>
                {results.albums.map((a) => (
                  <AlbumCard key={a.id} album={{ slug: a.slug, title: a.title, cover_key: a.cover_key, color_bg: a.color_bg, subtitle: `${a.year ?? ''} · ${a.artist_name}` }} />
                ))}
              </Grid>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
