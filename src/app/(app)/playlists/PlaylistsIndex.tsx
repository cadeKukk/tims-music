'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { usePlaylists } from '@/components/playlists/PlaylistsProvider';
import { PlaylistCover } from '@/components/playlists/PlaylistCover';
import { Grid, PageTitle } from '@/components/Shelf';

export function PlaylistsIndex() {
  const { playlists, loaded, create } = usePlaylists();
  const router = useRouter();

  const newPlaylist = async () => {
    const id = await create(`My playlist #${playlists.length + 1}`);
    if (id) router.push(`/playlist/${id}`);
  };

  return (
    <div className="fade-in">
      <PageTitle>Playlists</PageTitle>
      <Grid>
        <button onClick={newPlaylist} className="group rounded-xl p-2 text-left transition hover:bg-hover/70">
          <div className="grid aspect-square w-full place-items-center rounded-lg border-2 border-dashed border-white/15 text-muted transition group-hover:border-white/30 group-hover:text-fg">
            <Plus className="size-10" />
          </div>
          <div className="mt-2.5 text-sm font-semibold">New playlist</div>
          <div className="text-xs text-muted">Start from scratch</div>
        </button>
        {playlists.map((p) => (
          <Link key={p.id} href={`/playlist/${p.id}`} className="rounded-xl p-2 transition hover:bg-hover/70">
            <PlaylistCover covers={p.covers} className="w-full rounded-lg shadow-lg shadow-black/40" />
            <div className="mt-2.5 truncate text-sm font-semibold">{p.name}</div>
            <div className="truncate text-xs text-muted">{p.trackCount} {p.trackCount === 1 ? 'song' : 'songs'}</div>
          </Link>
        ))}
      </Grid>
      {loaded && playlists.length === 0 && (
        <p className="px-4 pt-6 text-sm text-muted md:px-8">
          No playlists yet. Make one above, or tap ⋯ on any song and choose “Add to playlist”.
        </p>
      )}
    </div>
  );
}
