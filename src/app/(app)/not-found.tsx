import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="grid min-h-[60vh] place-items-center px-4 text-center">
      <div>
        <div className="text-6xl">🎧</div>
        <h1 className="mt-4 text-2xl font-bold">Couldn&apos;t find that</h1>
        <p className="mt-2 text-muted">It may have been renamed or removed from the library.</p>
        <Link href="/" className="mt-6 inline-block rounded-full bg-fg px-6 py-2.5 font-semibold text-black">Back home</Link>
      </div>
    </div>
  );
}
