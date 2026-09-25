'use client';

import { useMemo, useState } from 'react';
import { AlbumCard } from '@/components/AlbumCard';
import { Grid } from '@/components/Shelf';
import type { Album } from '@/lib/types';

const SORTS = {
  newest: { label: 'Newest', fn: (a: Album, b: Album) => (b.year ?? 0) - (a.year ?? 0) },
  oldest: { label: 'Oldest', fn: (a: Album, b: Album) => (a.year ?? 0) - (b.year ?? 0) },
  title: { label: 'Title', fn: (a: Album, b: Album) => a.title.localeCompare(b.title) },
  artist: { label: 'Artist', fn: (a: Album, b: Album) => a.artist.name.localeCompare(b.artist.name) || (a.year ?? 0) - (b.year ?? 0) },
} as const;
type SortKey = keyof typeof SORTS;

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'album', label: 'Studio' },
  { key: 'edition', label: 'Deluxe & special' },
  { key: 'live', label: 'Live' },
] as const;
type FilterKey = (typeof FILTERS)[number]['key'];

export function AlbumBrowser({ albums }: { albums: Album[] }) {
  const [sort, setSort] = useState<SortKey>('newest');
  const [filter, setFilter] = useState<FilterKey>('all');

  const shown = useMemo(() => {
    const list = albums.filter((a) =>
      filter === 'all' ? true
        : filter === 'edition' ? !!a.edition
        : filter === 'album' ? a.kind === 'album' && !a.edition
        : a.kind === filter);
    return [...list].sort(SORTS[sort].fn);
  }, [albums, sort, filter]);

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 px-4 md:px-8">
        <div className="no-scrollbar flex gap-2 overflow-x-auto">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-medium transition ${
                filter === f.key ? 'bg-fg text-black' : 'bg-elevated text-fg hover:bg-hover'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-sm text-muted">
          Sort
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="rounded-lg border border-line bg-elevated px-2 py-1.5 text-fg outline-none"
          >
            {Object.entries(SORTS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </label>
      </div>
      <Grid>
        {shown.map((a) => (
          <AlbumCard
            key={a.id}
            album={{ slug: a.slug, title: a.title, cover_key: a.cover_key, color_bg: a.color_bg, subtitle: `${a.year ?? ''} · ${a.artist.name}` }}
          />
        ))}
      </Grid>
    </>
  );
}
