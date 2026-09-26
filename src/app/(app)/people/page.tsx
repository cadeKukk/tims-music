import Link from 'next/link';
import { db } from '@/lib/db';
import { PageTitle } from '@/components/Shelf';
import { Avatar } from '@/components/account/AccountMenu';

export const metadata = { title: 'People' };
export const dynamic = 'force-dynamic';

export default async function PeoplePage() {
  const [{ data: users }, { data: lists }] = await Promise.all([
    db.from('users').select('id, username').order('username'),
    db.from('playlists').select('owner_id').eq('visibility', 'public'),
  ]);
  const counts = new Map<string, number>();
  for (const l of lists ?? []) counts.set(l.owner_id, (counts.get(l.owner_id) ?? 0) + 1);
  return (
    <div className="fade-in">
      <PageTitle>People</PageTitle>
      {!users?.length && <p className="px-4 text-muted md:px-8">No one has signed up yet.</p>}
      <div className="grid grid-cols-2 gap-1 px-2 sm:grid-cols-3 md:px-6 lg:grid-cols-5 xl:grid-cols-6">
        {users?.map((u) => (
          <Link key={u.id} href={`/u/${u.username}`} className="rounded-xl p-4 text-center transition hover:bg-hover/70">
            <Avatar name={u.username} className="mx-auto size-24 text-4xl" />
            <div className="mt-3 truncate font-semibold">{u.username}</div>
            <div className="text-xs text-muted">{counts.get(u.id) ?? 0} public playlist{counts.get(u.id) === 1 ? '' : 's'}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
