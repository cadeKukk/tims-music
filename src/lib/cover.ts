export type CoverSize = 300 | 600 | 1200;

export const coverUrl = (key: string | null | undefined, size: CoverSize) =>
  key ? `${key}_${size}.webp` : null;

export const coverSrcSet = (key: string | null | undefined) =>
  key ? `${key}_300.webp 300w, ${key}_600.webp 600w, ${key}_1200.webp 1200w` : undefined;

export function formatTime(sec: number) {
  if (!Number.isFinite(sec) || sec < 0) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function formatLength(sec: number) {
  const h = Math.floor(sec / 3600);
  const m = Math.round((sec % 3600) / 60);
  return h ? `${h} hr ${m} min` : `${m} min`;
}
