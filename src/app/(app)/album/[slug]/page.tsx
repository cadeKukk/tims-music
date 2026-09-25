import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getAlbumWithTracks, toPlayerTrack } from '@/lib/catalog';
import { Cover } from '@/components/Cover';
import { AlbumCard } from '@/components/AlbumCard';
import { Shelf } from '@/components/Shelf';
import { TrackList } from '@/components/TrackList';
import { PlayButtons } from '@/components/PlayButtons';
import { formatLength } from '@/lib/cover';

export const revalidate = 600;

const KIND_LABEL = { album: 'Album', live: 'Live album', compilation: 'Compilation', single: 'Single' } as const;

export async function generateMetadata({ params }: PageProps<'/album/[slug]'>) {
  const data = await getAlbumWithTracks((await params).slug);
  return { title: data ? `${data.album.title} – ${data.album.artist.name}` : 'Album' };
}

export default async function AlbumPage({ params }: PageProps<'/album/[slug]'>) {
  const data = await getAlbumWithTracks((await params).slug);
  if (!data) notFound();
  const { album, tracks, editions, moreByArtist } = data;
  const rows = tracks.map((t) => ({ ...toPlayerTrack(t, album), disc: t.disc, trackNo: t.track_no }));
  const bg = album.color_bg ?? '#1d1d21';

  return (
    <div className="fade-in" style={{ '--color-accent': album.color_accent ?? undefined } as React.CSSProperties}>
      <header
        className="relative px-4 pt-10 pb-6 md:px-8 md:pt-16"
        style={{ background: `linear-gradient(to bottom, ${bg}, color-mix(in srgb, ${bg} 50%, var(--color-bg)) 70%, var(--color-bg))` }}
      >
        <div className="flex flex-col items-center gap-6 md:flex-row md:items-end md:gap-8">
          <Cover
            coverKey={album.cover_key}
            alt={album.title}
            priority
            sizes="(min-width: 768px) 240px, 65vw"
            className="w-[65vw] max-w-72 rounded-xl shadow-2xl shadow-black/60 md:w-60"
          />
          <div className="min-w-0 text-center md:text-left">
            <div className="text-xs font-semibold uppercase tracking-wider text-white/70">
              {KIND_LABEL[album.kind]}
              {album.edition && <span className="ml-2 rounded-full bg-white/15 px-2 py-0.5 normal-case tracking-normal">{album.edition}</span>}
            </div>
            <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-balance md:text-5xl lg:text-6xl">{album.base_title}</h1>
            <div className="mt-3 text-sm text-white/80">
              <Link href={`/artist/${album.artist.slug}`} className="font-semibold text-white hover:underline">{album.artist.name}</Link>
              <span className="text-white/60">
                {album.year && ` · ${album.year}`} · {album.track_count} songs, {formatLength(album.duration_sec)}
                {album.disc_count > 1 && ` · ${album.disc_count} discs`}
              </span>
            </div>
          </div>
        </div>
        <div className="mt-6 flex justify-center md:justify-start">
          <PlayButtons tracks={rows} albumSlug={album.slug} addLabel={album.title} />
        </div>
      </header>

      <TrackList tracks={rows} mainArtist={album.artist.name} />

      {editions.length > 0 && (
        <Shelf title="Other versions">
          {editions.map((a) => (
            <AlbumCard key={a.id} album={{ slug: a.slug, title: a.title, cover_key: a.cover_key, color_bg: a.color_bg, subtitle: `${a.year} · ${a.edition ?? 'Original'}` }} />
          ))}
        </Shelf>
      )}
      {moreByArtist.length > 0 && (
        <Shelf title={`More by ${album.artist.name}`} href={`/artist/${album.artist.slug}`}>
          {moreByArtist.map((a) => (
            <AlbumCard key={a.id} album={{ slug: a.slug, title: a.title, cover_key: a.cover_key, color_bg: a.color_bg, subtitle: String(a.year ?? '') }} />
          ))}
        </Shelf>
      )}
    </div>
  );
}
