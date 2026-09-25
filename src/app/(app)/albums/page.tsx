import { getAlbums } from '@/lib/catalog';
import { PageTitle } from '@/components/Shelf';
import { AlbumBrowser } from './AlbumBrowser';

export const metadata = { title: 'Albums' };
export const revalidate = 600;

export default async function AlbumsPage() {
  const albums = await getAlbums();
  return (
    <div className="fade-in">
      <PageTitle>Albums</PageTitle>
      <AlbumBrowser albums={albums} />
    </div>
  );
}
