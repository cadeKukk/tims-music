'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Disc3, Home, ListMusic, Mic2, Plus, Search, Users } from 'lucide-react';
import { AccountMenu } from './account/AccountMenu';
import { coverUrl } from '@/lib/cover';
import { usePlaylists } from './playlists/PlaylistsProvider';
import { PlaylistCover } from './playlists/PlaylistCover';

const LINKS = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/search', label: 'Search', icon: Search },
  { href: '/albums', label: 'Albums', icon: Disc3 },
  { href: '/playlists', label: 'Playlists', icon: ListMusic },
  { href: '/artists', label: 'Artists', icon: Mic2 },
] as const;

const isActive = (path: string, href: string) => (href === '/' ? path === '/' : path.startsWith(href));

type SidebarArtist = { slug: string; name: string; cover: string | null };

export function Sidebar({ artists }: { artists: SidebarArtist[] }) {
  const path = usePathname();
  const { playlists, startNew } = usePlaylists();
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-line bg-surface/60 pb-[var(--player-h)] backdrop-blur md:flex">
      <Link href="/" className="flex items-center gap-2.5 px-6 pt-6 pb-5">
        <span className="grid size-8 place-items-center rounded-lg bg-accent text-lg text-black">♪</span>
        <span className="text-lg font-bold tracking-tight">Echo Chamber</span>
      </Link>
      <nav className="space-y-0.5 px-3">
        {LINKS.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
              isActive(path, href) ? 'bg-hover text-fg' : 'text-muted hover:text-fg'
            }`}
          >
            <Icon className="size-[18px]" strokeWidth={2.2} />
            {label}
          </Link>
        ))}
        <Link
          href="/people"
          className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
            path.startsWith('/people') || path.startsWith('/u/') ? 'bg-hover text-fg' : 'text-muted hover:text-fg'
          }`}
        >
          <Users className="size-[18px]" strokeWidth={2.2} />
          People
        </Link>
      </nav>
      <div className="flex-1 overflow-y-auto px-3 pb-4">
        <div className="mt-6 flex items-center justify-between px-3 pb-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-faint">Playlists</span>
          <button onClick={startNew} title="New playlist" aria-label="New playlist" className="grid size-6 place-items-center rounded-md text-muted hover:bg-hover hover:text-fg">
            <Plus className="size-4" />
          </button>
        </div>
        {playlists.length === 0 && <p className="px-3 pb-1 text-xs text-faint">Create one with + or from any song&apos;s ⋯ menu.</p>}
        {playlists.map((p) => (
          <Link
            key={p.id}
            href={`/playlist/${p.id}`}
            className={`flex items-center gap-3 rounded-lg px-2 py-1.5 text-sm transition ${
              path === `/playlist/${p.id}` ? 'bg-hover text-fg' : 'text-muted hover:bg-hover/60 hover:text-fg'
            }`}
          >
            <PlaylistCover covers={p.covers} custom={p.customCover} className="size-8 shrink-0 rounded" />
            <span className="min-w-0">
              <span className="block truncate">{p.name}</span>
              {p.role !== 'owner' && (
                <span className="block truncate text-[11px] text-faint">
                  {p.role === 'editor' ? 'Shared · can edit' : p.role === 'viewer' ? 'Shared with you' : 'Saved'} · {p.owner.username}
                </span>
              )}
            </span>
          </Link>
        ))}
        <div className="mt-6 px-3 pb-2 text-xs font-semibold uppercase tracking-wider text-faint">Artists</div>
        {artists.map((a) => (
          <Link
            key={a.slug}
            href={`/artist/${a.slug}`}
            className={`flex items-center gap-3 rounded-lg px-2 py-1.5 text-sm transition ${
              path === `/artist/${a.slug}` ? 'bg-hover text-fg' : 'text-muted hover:bg-hover/60 hover:text-fg'
            }`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={coverUrl(a.cover, 300) ?? ''} alt="" className="size-8 rounded-full object-cover" loading="lazy" />
            <span className="truncate">{a.name}</span>
          </Link>
        ))}
      </div>
      <div className="border-t border-line p-3">
        <AccountMenu />
      </div>
    </aside>
  );
}

export function MobileNav() {
  const path = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 flex h-[calc(var(--mobile-nav-h)+env(safe-area-inset-bottom))] border-t border-line bg-bg/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden">
      {LINKS.map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          className={`flex flex-1 flex-col items-center justify-center gap-1 text-[11px] font-medium ${
            isActive(path, href) ? 'text-fg' : 'text-faint'
          }`}
        >
          <Icon className="size-5" strokeWidth={isActive(path, href) ? 2.6 : 2} />
          {label}
        </Link>
      ))}
    </nav>
  );
}
