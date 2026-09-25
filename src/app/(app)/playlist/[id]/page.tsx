import { notFound } from 'next/navigation';
import { getPlaylist } from '@/lib/playlists';
import { PlaylistView } from './PlaylistView';

// Playlists change whenever you edit them, so always render fresh.
export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: PageProps<'/playlist/[id]'>) {
  const playlist = await getPlaylist((await params).id);
  return { title: playlist?.name ?? 'Playlist' };
}

export default async function PlaylistPage({ params }: PageProps<'/playlist/[id]'>) {
  const playlist = await getPlaylist((await params).id);
  if (!playlist) notFound();
  return <PlaylistView key={playlist.id} initial={playlist} />;
}
