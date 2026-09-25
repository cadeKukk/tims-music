import Link from 'next/link';
import type { ReactNode } from 'react';

export function Shelf({ title, href, children }: { title: string; href?: string; children: ReactNode }) {
  return (
    <section className="mt-8">
      <div className="mb-2 flex items-baseline justify-between px-4 md:px-8">
        <h2 className="text-xl font-bold tracking-tight">{title}</h2>
        {href && (
          <Link href={href} className="text-xs font-semibold uppercase tracking-wider text-muted hover:text-fg">
            See all
          </Link>
        )}
      </div>
      <div className="no-scrollbar flex snap-x snap-mandatory scroll-px-4 gap-1 overflow-x-auto px-2 md:scroll-px-8 md:px-6 [&>*]:w-[44vw] [&>*]:shrink-0 [&>*]:snap-start sm:[&>*]:w-48 md:[&>*]:w-52">
        {children}
      </div>
    </section>
  );
}

export function Grid({ children }: { children: ReactNode }) {
  return (
    <div className="grid grid-cols-2 gap-1 px-2 sm:grid-cols-3 md:px-6 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
      {children}
    </div>
  );
}

export function PageTitle({ children }: { children: ReactNode }) {
  return <h1 className="px-4 pt-8 pb-4 text-3xl font-bold tracking-tight md:px-8 md:pt-10 md:text-4xl">{children}</h1>;
}
