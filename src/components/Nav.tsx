'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Disc3, Home, Mic2, Search } from 'lucide-react';
import { coverUrl } from '@/lib/cover';

const LINKS = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/search', label: 'Search', icon: Search },
  { href: '/albums', label: 'Albums', icon: Disc3 },
  { href: '/artists', label: 'Artists', icon: Mic2 },
] as const;

const isActive = (path: string, href: string) => (href === '/' ? path === '/' : path.startsWith(href));

type SidebarArtist = { slug: string; name: string; cover: string | null };

export function Sidebar({ artists }: { artists: SidebarArtist[] }) {
  const path = usePathname();
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
      </nav>
      <div className="mt-6 px-6 pb-2 text-xs font-semibold uppercase tracking-wider text-faint">Artists</div>
      <div className="flex-1 space-y-0.5 overflow-y-auto px-3 pb-4">
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
