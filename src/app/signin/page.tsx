import { SignInForm } from './SignInForm';

export const metadata = { title: 'Sign in' };

export default async function SignInPage({ searchParams }: PageProps<'/signin'>) {
  const sp = await searchParams;
  const next = typeof sp.next === 'string' && sp.next.startsWith('/') && !sp.next.startsWith('//') ? sp.next : '/';
  return (
    <main className="flex min-h-dvh items-center justify-center bg-[radial-gradient(60rem_40rem_at_20%_0%,color-mix(in_srgb,var(--color-accent)_22%,transparent),transparent_60%),radial-gradient(50rem_40rem_at_100%_100%,rgb(88_80_236/0.18),transparent_60%)] px-4 py-10">
      <SignInForm initialMode={sp.mode === 'signup' ? 'signup' : 'signin'} next={next} />
    </main>
  );
}
