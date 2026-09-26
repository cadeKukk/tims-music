import Link from 'next/link';
import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { listPublicByOwner } from '@/lib/playlists';
import { Avatar } from '@/components/account/AccountMenu';
import { PlaylistCover } from '@/components/playlists/PlaylistCover';
import { Grid } from '@/components/Shelf';

export const dynamic = 'force-dynamic';

async function load(username: string) {
  const { data: user } = await db.from('users').select('id, username, created_at').eq('username', username).maybeSingle();
  return user;
}

export async function generateMetadata({ params }: PageProps<'/u/[username]'>) {
  const user = await load((await params).username);
  return { title: user?.username ?? 'Profile' };
}

export default async function ProfilePage({ params }: PageProps<'/u/[username]'>) {
  const user = await load((await params).username);
  if (!user) notFound();
  const playlists = await listPublicByOwner(user.id);
  return (
    <div className="fade-in">
      <header className="flex flex-col items-center gap-5 bg-gradient-to-b from-accent/20 to-transparent px-4 pt-12 pb-8 md:flex-row md:items-end md:px-8 md:pt-16">
        <Avatar name={user.username} className="size-32 text-5xl shadow-2xl md:size-44 md:text-7xl" />
        <div className="text-center md:text-left">
          <div className="text-xs font-semibold uppercase tracking-wider text-white/70">Profile</div>
          <h1 className="mt-1 text-4xl font-black tracking-tight md:text-6xl">{user.username}</h1>
          <p className="mt-2 text-sm text-white/60">
            {playlists.length} public playlist{playlists.length === 1 ? '' : 's'} · joined {new Date(user.created_at).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
          </p>
        </div>
      </header>
      <h2 className="px-4 pb-2 text-xl font-bold md:px-8">Public playlists</h2>
      {playlists.length === 0 ? (
        <p className="px-4 text-muted md:px-8">Nothing public yet.</p>
      ) : (
        <Grid>
          {playlists.map((p) => (
            <Link key={p.id} href={`/playlist/${p.id}`} className="rounded-xl p-2 transition hover:bg-hover/70">
              <PlaylistCover covers={p.covers} custom={p.customCover} className="w-full rounded-lg shadow-lg shadow-black/40" />
              <div className="mt-2.5 truncate text-sm font-semibold">{p.name}</div>
              <div className="truncate text-xs text-muted">{p.trackCount} {p.trackCount === 1 ? 'song' : 'songs'}</div>
            </Link>
          ))}
        </Grid>
      )}
    </div>
  );
}
