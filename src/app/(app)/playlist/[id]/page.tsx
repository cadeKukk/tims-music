import { notFound } from 'next/navigation';
import { getUser } from '@/lib/auth';
import { getPlaylist } from '@/lib/playlists';
import { PlaylistView } from './PlaylistView';

// Playlists change whenever someone edits them, and access depends on who's viewing.
export const dynamic = 'force-dynamic';

async function load({ params, searchParams }: PageProps<'/playlist/[id]'>) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const token = typeof sp.t === 'string' ? sp.t : null;
  return { playlist: await getPlaylist(id, await getUser(), token), token };
}

export async function generateMetadata(props: PageProps<'/playlist/[id]'>) {
  const { playlist } = await load(props);
  return { title: playlist?.name ?? 'Playlist' };
}

export default async function PlaylistPage(props: PageProps<'/playlist/[id]'>) {
  const { playlist, token } = await load(props);
  if (!playlist) notFound();
  return <PlaylistView key={playlist.id} initial={playlist} shareToken={token} />;
}
