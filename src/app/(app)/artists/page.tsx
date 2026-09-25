import Link from 'next/link';
import { getArtists } from '@/lib/catalog';
import { Cover } from '@/components/Cover';
import { Grid, PageTitle } from '@/components/Shelf';

export const metadata = { title: 'Artists' };
export const revalidate = 600;

export default async function ArtistsPage() {
  const artists = await getArtists();
  return (
    <div className="fade-in">
      <PageTitle>Artists</PageTitle>
      <Grid>
        {artists.map((a) => (
          <Link key={a.id} href={`/artist/${a.slug}`} className="rounded-xl p-3 text-center transition hover:bg-hover/70">
            <Cover coverKey={a.cover} alt={a.name} sizes="(min-width: 768px) 200px, 45vw" bg={a.bg} className="w-full rounded-full shadow-lg shadow-black/40" />
            <div className="mt-3 truncate font-semibold">{a.name}</div>
            <div className="text-xs text-muted">{a.albumCount} albums</div>
          </Link>
        ))}
      </Grid>
    </div>
  );
}
