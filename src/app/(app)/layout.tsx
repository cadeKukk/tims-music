import { PlayerProvider } from '@/components/player/PlayerProvider';
import { PlaylistsProvider } from '@/components/playlists/PlaylistsProvider';
import { PlayerBar } from '@/components/player/PlayerBar';
import { NowPlaying } from '@/components/player/NowPlaying';
import { Sidebar, MobileNav } from '@/components/Nav';
import { getArtists } from '@/lib/catalog';

export default async function AppLayout({ children }: LayoutProps<'/'>) {
  const artists = await getArtists();
  return (
    <PlayerProvider>
      <PlaylistsProvider>
      {/* Solid strip behind the iOS status bar when installed to the home screen */}
      <div aria-hidden className="fixed inset-x-0 top-0 z-50 h-[env(safe-area-inset-top)] bg-bg md:hidden" />
      <Sidebar artists={artists.map(({ slug, name, cover }) => ({ slug, name, cover }))} />
      <main className="min-h-dvh pt-[env(safe-area-inset-top)] md:pl-64 pb-[calc(var(--player-h)+var(--mobile-nav-h)+env(safe-area-inset-bottom)+24px)]">
        {children}
      </main>
      <PlayerBar />
      <MobileNav />
      <NowPlaying />
      </PlaylistsProvider>
    </PlayerProvider>
  );
}
