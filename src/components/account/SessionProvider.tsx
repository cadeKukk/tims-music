'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { UserRound, X } from 'lucide-react';

export type SessionUser = { id: string; username: string; isAdmin: boolean };

type Ctx = {
  user: SessionUser | null;
  syncKey: string | null;
  loaded: boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
  /** For guests: shows a "sign in to …" prompt and returns false. For users: returns true. */
  requireSignIn: (reason: string) => boolean;
};

const SessionContext = createContext<Ctx | null>(null);

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used inside <SessionProvider>');
  return ctx;
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [syncKey, setSyncKey] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [prompt, setPrompt] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/me', { cache: 'no-store' });
      const data = res.ok ? await res.json() : { user: null };
      setUser(data.user);
      setSyncKey(data.syncKey ?? null);
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const signOut = useCallback(async () => {
    await fetch('/api/auth/signout', { method: 'POST' });
    // A full reload clears every per-user cache (playlists, sync connection, player).
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- intentional full reload
    window.location.href = '/';
  }, []);

  const requireSignIn = useCallback((reason: string) => {
    if (user) return true;
    setPrompt(reason);
    return false;
  }, [user]);

  const value = useMemo(
    () => ({ user, syncKey, loaded, refresh, signOut, requireSignIn }),
    [user, syncKey, loaded, refresh, signOut, requireSignIn],
  );

  return (
    <SessionContext.Provider value={value}>
      {children}
      {prompt && <SignInPrompt reason={prompt} onClose={() => setPrompt(null)} />}
    </SessionContext.Provider>
  );
}

function SignInPrompt({ reason, onClose }: { reason: string; onClose: () => void }) {
  const path = usePathname();
  const next = encodeURIComponent(path + (typeof window !== 'undefined' ? window.location.search : ''));
  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center md:items-center" role="dialog" aria-label="Sign in">
      <button aria-label="Close" onClick={onClose} className="fade-in absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div className="fade-in relative w-full rounded-t-3xl border border-line bg-elevated p-6 pb-[max(env(safe-area-inset-bottom),24px)] text-center shadow-2xl md:w-96 md:rounded-3xl">
        <button onClick={onClose} aria-label="Close" className="absolute top-3 right-3 grid size-9 place-items-center rounded-full text-muted hover:bg-hover">
          <X className="size-5" />
        </button>
        <div className="mx-auto grid size-14 place-items-center rounded-full bg-accent/20 text-accent"><UserRound className="size-7" /></div>
        <h2 className="mt-4 text-xl font-bold">Sign in to {reason}</h2>
        <p className="mt-1 text-sm text-muted">Accounts are free and just need a username and a 6-digit PIN.</p>
        <div className="mt-6 grid gap-2">
          <Link href={`/signin?mode=signup&next=${next}`} onClick={onClose} className="rounded-full bg-accent py-3 font-semibold text-black">
            Create account
          </Link>
          <Link href={`/signin?next=${next}`} onClick={onClose} className="rounded-full bg-white/10 py-3 font-semibold hover:bg-white/15">
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
