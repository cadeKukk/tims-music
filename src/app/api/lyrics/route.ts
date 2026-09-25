// Lyrics from LRCLIB (free, no key). Returns time-synced lines when available.
const UA = "TimsMusic/1.0 (private listening site)";

type LrcLibResult = { syncedLyrics: string | null; plainLyrics: string | null; instrumental: boolean; duration: number };

export async function GET(req: Request) {
  const p = new URL(req.url).searchParams;
  const artist = p.get('artist') ?? '';
  const title = p.get('title') ?? '';
  const album = p.get('album') ?? '';
  const duration = Number(p.get('duration') ?? 0);
  if (!artist || !title) return Response.json({ error: 'missing params' }, { status: 400 });

  const cleanTitle = title.replace(/\s*[([](live|remaster|demo|bonus|feat)[^)\]]*[)\]]/gi, '').trim();
  const opts = { headers: { 'User-Agent': UA }, next: { revalidate: 60 * 60 * 24 * 7 } };

  let hit: LrcLibResult | null = null;
  const exact = new URLSearchParams({ artist_name: artist, track_name: cleanTitle, album_name: album, duration: String(Math.round(duration)) });
  const res = await fetch(`https://lrclib.net/api/get?${exact}`, opts).catch(() => null);
  if (res?.ok) hit = await res.json();

  if (!hit || (!hit.syncedLyrics && !hit.plainLyrics)) {
    const search = new URLSearchParams({ artist_name: artist, track_name: cleanTitle });
    const sres = await fetch(`https://lrclib.net/api/search?${search}`, opts).catch(() => null);
    if (sres?.ok) {
      const results = (await sres.json()) as LrcLibResult[];
      hit = results
        .filter((r) => r.syncedLyrics || r.plainLyrics)
        .sort((a, b) => Number(!!b.syncedLyrics) - Number(!!a.syncedLyrics) || Math.abs(a.duration - duration) - Math.abs(b.duration - duration))[0] ?? null;
    }
  }

  if (!hit) return Response.json({ lines: null, plain: null, instrumental: false });
  const lines = hit.syncedLyrics
    ? hit.syncedLyrics.split('\n').flatMap((l) => {
        const m = l.match(/^\[(\d+):(\d+(?:\.\d+)?)\]\s?(.*)$/);
        return m ? [{ t: Number(m[1]) * 60 + Number(m[2]), text: m[3] }] : [];
      })
    : null;
  return Response.json(
    { lines, plain: hit.plainLyrics, instrumental: hit.instrumental },
    { headers: { 'Cache-Control': 'private, max-age=86400' } },
  );
}
