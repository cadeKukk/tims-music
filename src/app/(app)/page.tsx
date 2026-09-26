import Link from 'next/link';
import { getHome } from '@/lib/catalog';
import { AlbumCard } from '@/components/AlbumCard';
import { Shelf } from '@/components/Shelf';
import { TrackList } from '@/components/TrackList';
import { Cover } from '@/components/Cover';
import { Greeting, JumpBackIn, YourPlaylists } from './HomeClient';
import { AccountButton } from '@/components/account/AccountMenu';
import type { Album } from '@/lib/types';

export const revalidate = 60;

const card = (a: Album, sub?: string) => ({
  slug: a.slug, title: a.title, cover_key: a.cover_key, color_bg: a.color_bg,
  subtitle: sub ?? `${a.year ?? ''} · ${a.artist.name}`,
});

export default async function HomePage() {
  const home = await getHome();
  return (
    <div className="fade-in">
      <div className="flex items-center justify-between bg-gradient-to-b from-accent/15 to-transparent px-4 pt-8 pb-2 md:px-8 md:pt-10">
        <Greeting />
        <AccountButton />
      </div>

      <JumpBackIn />

      <YourPlaylists />

      {home.mostPlayed.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-2 px-4 text-xl font-bold tracking-tight md:px-8">Most played this month</h2>
          <div className="max-w-4xl">
            <TrackList tracks={home.mostPlayed.slice(0, 8)} showCover showAlbum numbered={false} />
          </div>
        </section>
      )}

      <Shelf title="Latest releases" href="/albums">
        {home.newest.map((a) => <AlbumCard key={a.id} album={card(a)} />)}
      </Shelf>

      <Shelf title="Rediscover">
        {home.rediscover.map((a) => <AlbumCard key={a.id} album={card(a)} />)}
      </Shelf>

      <section className="mt-8">
        <div className="mb-2 flex items-baseline justify-between px-4 md:px-8">
          <h2 className="text-xl font-bold tracking-tight">Artists</h2>
          <Link href="/artists" className="text-xs font-semibold uppercase tracking-wider text-muted hover:text-fg">See all</Link>
        </div>
        <div className="no-scrollbar flex gap-2 overflow-x-auto px-2 md:px-6">
          {home.artists.map((a) => (
            <Link key={a.id} href={`/artist/${a.slug}`} className="group w-32 shrink-0 rounded-xl p-2 text-center transition hover:bg-hover/70 md:w-40">
              <Cover coverKey={a.cover} alt={a.name} sizes="160px" bg={a.bg} className="w-full rounded-full shadow-lg shadow-black/40" />
              <div className="mt-2 truncate text-sm font-semibold">{a.name}</div>
              <div className="text-xs text-muted">{a.albumCount} albums</div>
            </Link>
          ))}
        </div>
      </section>

      {home.decades.map(([decade, albums]) => (
        <Shelf key={decade} title={`The ${String(decade).slice(2)}s`}>
          {albums.sort((a, b) => (a.year ?? 0) - (b.year ?? 0)).map((a) => <AlbumCard key={a.id} album={card(a)} />)}
        </Shelf>
      ))}
    </div>
  );
}
