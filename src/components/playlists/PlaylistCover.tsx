/* eslint-disable @next/next/no-img-element -- pre-sized WebP covers */
import { ListMusic } from 'lucide-react';
import { coverUrl } from '@/lib/cover';

/** A 2x2 mosaic of album covers (or a single cover / placeholder when there are fewer). */
export function PlaylistCover({ covers, className = '', large = false }: { covers: string[]; className?: string; large?: boolean }) {
  const size = large ? 600 : 300;
  if (covers.length === 0) {
    return (
      <div className={`grid aspect-square place-items-center bg-gradient-to-br from-accent/60 to-indigo-600/60 ${className}`}>
        <ListMusic className="size-1/3 text-white/90" />
      </div>
    );
  }
  if (covers.length < 4) {
    return <img src={coverUrl(covers[0], size)!} alt="" className={`aspect-square object-cover ${className}`} />;
  }
  return (
    <div className={`grid aspect-square grid-cols-2 overflow-hidden ${className}`}>
      {covers.slice(0, 4).map((c) => (
        <img key={c} src={coverUrl(c, 300)!} alt="" className="size-full object-cover" />
      ))}
    </div>
  );
}
