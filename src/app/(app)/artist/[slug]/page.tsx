import { notFound } from 'next/navigation';
import { getArtist, getArtistPlayerTracks } from '@/lib/catalog';
import { AlbumCard } from '@/components/AlbumCard';
import { Shelf } from '@/components/Shelf';
import { TrackList } from '@/components/TrackList';
import { ArtistPlayButtons } from '@/components/PlayButtons';
import { coverUrl } from '@/lib/cover';
import type { Album } from '@/lib/types';

export const revalidate = 300;

export async function generateMetadata({ params }: PageProps<'/artist/[slug]'>) {
  const data = await getArtist((await params).slug);
  return { title: data?.artist.name ?? 'Artist' };
}

const card = (a: Album) => ({
  slug: a.slug, title: a.title, cover_key: a.cover_key, color_bg: a.color_bg, subtitle: String(a.year ?? ''),
});

export default async function ArtistPage({ params }: PageProps<'/artist/[slug]'>) {
  const { slug } = await params;
  const [data, allTracks] = await Promise.all([getArtist(slug), getArtistPlayerTracks(slug)]);
  if (!data) notFound();
  const { artist, popular, albums, editions, live, compilations, trackCount } = data;
  const all = [...albums, ...editions, ...live, ...compilations];
  const hero = [...albums, ...editions].sort((a, b) => (b.year ?? 0) - (a.year ?? 0))[0] ?? all[0];
  const mosaic = [...albums, ...editions].slice(0, 8);

  return (
    <div className="fade-in" style={{ '--color-accent': hero.color_accent ?? undefined } as React.CSSProperties}>
      <header className="relative flex min-h-[44vh] items-end overflow-hidden md:min-h-[52vh]" style={{ backgroundColor: hero.color_bg ?? '#1d1d21' }}>
        {/* Album-art mosaic banner */}
        <div className="absolute inset-0 grid grid-cols-4 opacity-70 md:grid-cols-8" aria-hidden>
          {mosaic.concat(mosaic).slice(0, 8).map((a, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={i} src={coverUrl(a.cover_key, 300) ?? ''} alt="" className={`size-full object-cover ${i >= 4 ? 'hidden md:block' : ''}`} />
          ))}
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/60 to-black/20" />
        <div className="relative w-full px-4 pb-6 md:px-8">
          <div className="text-xs font-semibold uppercase tracking-wider text-white/70">Artist</div>
          <h1 className="mt-1 text-5xl font-black tracking-tight md:text-7xl lg:text-8xl">{artist.name}</h1>
          <div className="mt-2 text-sm text-white/70">{all.length} releases · {trackCount} songs</div>
          <div className="mt-6">
            <ArtistPlayButtons all={allTracks ?? []} popular={popular} />
          </div>
        </div>
      </header>

      <section className="mt-6">
        <h2 className="mb-2 px-4 text-xl font-bold tracking-tight md:px-8">Popular</h2>
        <div className="max-w-4xl">
          <TrackList tracks={popular} mainArtist={artist.name} showCover showAlbum numbered={false} />
        </div>
      </section>

      {albums.length > 0 && <Shelf title="Albums">{albums.map((a) => <AlbumCard key={a.id} album={card(a)} />)}</Shelf>}
      {editions.length > 0 && (
        <Shelf title="Deluxe & special editions">
          {editions.map((a) => <AlbumCard key={a.id} album={{ ...card(a), subtitle: `${a.year} · ${a.edition}` }} />)}
        </Shelf>
      )}
      {live.length > 0 && <Shelf title="Live">{live.map((a) => <AlbumCard key={a.id} album={card(a)} />)}</Shelf>}
      {compilations.length > 0 && (
        <Shelf title="Compilations & B-sides">{compilations.map((a) => <AlbumCard key={a.id} album={card(a)} />)}</Shelf>
      )}
    </div>
  );
}
