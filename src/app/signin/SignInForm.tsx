'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ArrowLeft } from 'lucide-react';

type Mode = 'signin' | 'signup';

export function SignInForm({ initialMode, next }: { initialMode: Mode; next: string }) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [username, setUsername] = useState('');
  const [pin, setPin] = useState('');
  const [pin2, setPin2] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!/^\d{6}$/.test(pin)) return setError('PIN must be exactly 6 digits.');
    if (mode === 'signup' && pin !== pin2) return setError("The PINs don't match.");
    setBusy(true);
    const res = await fetch(`/api/auth/${mode}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: username.trim(), pin }),
    });
    if (res.ok) {
      // Full navigation so every part of the app picks up the new session.
      window.location.href = next;
      return;
    }
    setBusy(false);
    setError((await res.json().catch(() => null))?.error ?? 'Something went wrong.');
    setPin('');
    setPin2('');
  };

  const pinInput = (value: string, set: (v: string) => void, label: string, autoComplete: string) => (
    <label className="block text-left">
      <span className="text-sm text-muted">{label}</span>
      <input
        value={value}
        onChange={(e) => set(e.target.value.replace(/\D/g, '').slice(0, 6))}
        inputMode="numeric"
        pattern="\d{6}"
        autoComplete={autoComplete}
        type="password"
        required
        placeholder="••••••"
        className="mt-1 w-full rounded-xl border border-line bg-surface px-4 py-3 text-center font-mono text-2xl tracking-[0.5em] outline-none focus:border-white/30"
      />
    </label>
  );

  return (
    <div className="w-full max-w-sm">
      <Link href="/" className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted hover:text-fg">
        <ArrowLeft className="size-4" /> Keep listening as a guest
      </Link>
      <div className="rounded-3xl border border-line bg-elevated/80 p-6 shadow-2xl backdrop-blur">
        <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-accent text-2xl text-black">♪</div>
        <h1 className="mt-4 text-center text-2xl font-bold">{mode === 'signup' ? 'Create your account' : 'Welcome back'}</h1>
        <p className="mt-1 text-center text-sm text-muted">
          {mode === 'signup' ? 'Playlists, sharing, and listening across your devices.' : 'Sign in to Echo Chamber.'}
        </p>

        <div className="mt-5 grid grid-cols-2 rounded-full bg-surface p-1 text-sm font-medium">
          {(['signin', 'signup'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => { setMode(m); setError(null); }}
              className={`rounded-full py-2 transition ${mode === m ? 'bg-fg text-black' : 'text-muted hover:text-fg'}`}
            >
              {m === 'signin' ? 'Sign in' : 'Create account'}
            </button>
          ))}
        </div>

        <form onSubmit={submit} className="mt-5 space-y-4">
          <label className="block text-left">
            <span className="text-sm text-muted">Username</span>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value.replace(/\s/g, ''))}
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              maxLength={20}
              required
              className="mt-1 w-full rounded-xl border border-line bg-surface px-4 py-3 text-base outline-none focus:border-white/30"
            />
            {mode === 'signup' && <span className="mt-1 block text-xs text-faint">3–20 characters: letters, numbers, _ or .</span>}
          </label>
          {pinInput(pin, setPin, mode === 'signup' ? 'Choose a 6-digit PIN' : '6-digit PIN', mode === 'signup' ? 'new-password' : 'current-password')}
          {mode === 'signup' && pinInput(pin2, setPin2, 'Confirm PIN', 'new-password')}
          <p className="min-h-5 text-sm text-red-400" aria-live="polite">{error}</p>
          <button disabled={busy} className="w-full rounded-full bg-accent py-3 font-semibold text-black transition hover:scale-[1.02] disabled:opacity-60">
            {busy ? 'One sec…' : mode === 'signup' ? 'Create account' : 'Sign in'}
          </button>
        </form>
        {mode === 'signin' && <p className="mt-4 text-center text-xs text-faint">Forgot your PIN? Ask the site admin to reset it.</p>}
      </div>
    </div>
  );
}
