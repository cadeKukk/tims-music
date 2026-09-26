'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { ChevronUp, LogOut, MonitorSmartphone, Shield, UserRound } from 'lucide-react';
import { useSession } from './SessionProvider';

const HUES = [350, 20, 45, 150, 190, 215, 260, 290];

/** A coloured circle with the username's first letter; the colour is stable per username. */
export function Avatar({ name, className = 'size-8 text-sm' }: { name: string; className?: string }) {
  let h = 0;
  for (const c of name.toLowerCase()) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const hue = HUES[h % HUES.length];
  return (
    <span
      aria-hidden
      className={`grid shrink-0 place-items-center rounded-full font-bold text-black ${className}`}
      style={{ background: `hsl(${hue} 80% 68%)` }}
    >
      {name.slice(0, 1).toUpperCase()}
    </span>
  );
}

/** Sidebar footer: sign-in buttons for guests, or the user's menu. */
export function AccountMenu() {
  const { user, loaded, signOut } = useSession();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  if (!loaded) return <div className="h-10" />;
  if (!user) {
    return (
      <div className="grid grid-cols-2 gap-2">
        <Link href="/signin?mode=signup" className="rounded-full bg-accent py-2 text-center text-sm font-semibold text-black">Sign up</Link>
        <Link href="/signin" className="rounded-full bg-white/10 py-2 text-center text-sm font-semibold hover:bg-white/15">Sign in</Link>
      </div>
    );
  }

  const item = 'flex w-full items-center gap-3 px-3 py-2 text-sm hover:bg-hover';
  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-3 rounded-lg p-2 text-left hover:bg-hover">
        <Avatar name={user.username} />
        <span className="min-w-0 flex-1 truncate text-sm font-semibold">{user.username}</span>
        <ChevronUp className={`size-4 text-muted transition ${open ? '' : 'rotate-180'}`} />
      </button>
      {open && (
        <div className="fade-in absolute right-0 bottom-12 left-0 overflow-hidden rounded-xl border border-line bg-elevated py-1 shadow-2xl">
          <Link onClick={() => setOpen(false)} href={`/u/${user.username}`} className={item}><UserRound className="size-4" /> Profile</Link>
          <Link onClick={() => setOpen(false)} href="/account" className={item}><MonitorSmartphone className="size-4" /> Account & devices</Link>
          {user.isAdmin && <Link onClick={() => setOpen(false)} href="/admin" className={item}><Shield className="size-4" /> Admin</Link>}
          <button onClick={signOut} className={`${item} text-red-400`}><LogOut className="size-4" /> Sign out</button>
        </div>
      )}
    </div>
  );
}

/** Compact avatar/sign-in button for page headers on phones (no sidebar there). */
export function AccountButton() {
  const { user, loaded } = useSession();
  if (!loaded) return <span className="size-9" />;
  if (!user) {
    return (
      <Link href="/signin" className="rounded-full bg-white/10 px-4 py-2 text-sm font-semibold hover:bg-white/15 md:hidden">
        Sign in
      </Link>
    );
  }
  return (
    <Link href="/account" aria-label="Account" className="md:hidden">
      <Avatar name={user.username} className="size-9 text-base" />
    </Link>
  );
}
