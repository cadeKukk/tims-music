import { getArtists } from '@/lib/catalog';
import { SearchClient } from './SearchClient';

export const metadata = { title: 'Search' };
export const revalidate = 600;

export default async function SearchPage() {
  const artists = await getArtists();
  return <SearchClient artists={artists.map(({ slug, name, cover, bg }) => ({ slug, name, cover, bg }))} />;
}
