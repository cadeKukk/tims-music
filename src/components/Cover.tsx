/* eslint-disable @next/next/no-img-element -- covers are pre-sized WebP files; next/image adds nothing here */
import { coverSrcSet, coverUrl } from '@/lib/cover';

export function Cover({
  coverKey,
  alt,
  sizes = '200px',
  className = '',
  priority = false,
  bg,
}: {
  coverKey: string | null;
  alt: string;
  sizes?: string;
  className?: string;
  priority?: boolean;
  bg?: string | null;
}) {
  if (!coverKey) {
    return (
      <div className={`grid aspect-square place-items-center bg-elevated text-4xl text-faint ${className}`}>♪</div>
    );
  }
  return (
    <img
      src={coverUrl(coverKey, 600)!}
      srcSet={coverSrcSet(coverKey)}
      sizes={sizes}
      alt={alt}
      loading={priority ? 'eager' : 'lazy'}
      fetchPriority={priority ? 'high' : undefined}
      decoding="async"
      style={{ backgroundColor: bg ?? undefined }}
      className={`aspect-square object-cover ${className}`}
    />
  );
}
