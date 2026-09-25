import 'server-only';
import { unstable_cache } from 'next/cache';
import { db } from './db';
import type { Album, ArtistRef, PlayerTrack, Track } from './types';

const ALBUM_COLS =
  'id, slug, title, base_title, edition, kind, year, cover_key, color_bg, color_accent, disc_count, track_count, duration_sec, added_at, artist:artists!inner(id, slug, name)';
const TRACK_COLS = 'id, title, artist_credit, disc, track_no, duration_sec';

// The catalog only changes when the ingest script runs, so cache it hard.
const CATALOG = { revalidate: 600, tags: ['catalog'] };

function must<T>({ data, error }: { data: T | null; error: { message: string } | null }): T {
  if (error) throw new Error(error.message);
  return data as T;
}

export function toPlayerTrack(t: Track, album: Album): PlayerTrack {
  return {
    id: t.id,
    title: t.title,
    artist: t.artist_credit,
    artistSlug: album.artist.slug,
    albumTitle: album.title,
    albumSlug: album.slug,
    cover: album.cover_key,
    duration: t.duration_sec,
    accent: album.color_accent,
    bg: album.color_bg,
  };
}

export const getAlbums = unstable_cache(async (): Promise<Album[]> => {
  const rows = must(await db.from('albums').select(ALBUM_COLS).order('year', { ascending: false }));
  return rows as unknown as Album[];
}, ['albums'], CATALOG);

export const getArtists = unstable_cache(async () => {
  const albums = await getAlbums();
  const map = new Map<string, ArtistRef & { albumCount: number; cover: string | null; bg: string | null }>();
  // Albums are newest-first, so the first album seen per artist becomes their picture.
  for (const a of albums) {
    const cur = map.get(a.artist.id);
    if (cur) cur.albumCount++;
    else map.set(a.artist.id, { ...a.artist, albumCount: 1, cover: a.cover_key, bg: a.color_bg });
  }
  return [...map.values()].sort((x, y) =>
    x.name.replace(/^the /i, '').localeCompare(y.name.replace(/^the /i, '')),
  );
}, ['artists'], CATALOG);

export const getAlbumWithTracks = unstable_cache(async (slug: string) => {
  const albums = await getAlbums();
  const album = albums.find((a) => a.slug === slug);
  if (!album) return null;
  const tracks = must(
    await db.from('tracks').select(TRACK_COLS).eq('album_id', album.id)
      .order('disc').order('track_no', { nullsFirst: false }),
  ) as Track[];
  const sameArtist = albums.filter((a) => a.artist.id === album.artist.id && a.id !== album.id);
  return {
    album,
    tracks,
    editions: sameArtist.filter((a) => a.base_title.toLowerCase() === album.base_title.toLowerCase()),
    moreByArtist: sameArtist.filter((a) => a.base_title.toLowerCase() !== album.base_title.toLowerCase()),
  };
}, ['album'], CATALOG);

async function playCounts(since: string) {
  const rows = must(await db.rpc('top_tracks', { since, lim: 200 })) as { track_id: string; plays: number }[];
  return new Map(rows.map((r) => [r.track_id, Number(r.plays)]));
}

async function tracksByIds(ids: string[]) {
  if (!ids.length) return [];
  const rows = must(
    await db.from('tracks').select(`${TRACK_COLS}, album_id`).in('id', ids),
  ) as (Track & { album_id: string })[];
  const albums = new Map((await getAlbums()).map((a) => [a.id, a]));
  const byId = new Map(rows.map((t) => [t.id, t]));
  return ids.flatMap((id) => {
    const t = byId.get(id);
    const album = t && albums.get(t.album_id);
    return t && album ? [toPlayerTrack(t, album)] : [];
  });
}

export const getArtist = unstable_cache(async (slug: string) => {
  const albums = (await getAlbums()).filter((a) => a.artist.slug === slug);
  if (!albums.length) return null;
  const artist = albums[0].artist;
  const counts = await playCounts('365 days');
  const tracks = must(
    await db.from('tracks').select(`${TRACK_COLS}, album_id`).eq('artist_id', artist.id),
  ) as (Track & { album_id: string })[];
  const albumById = new Map(albums.map((a) => [a.id, a]));

  // "Popular": most played, then fall back to singles-ish heuristics (early tracks on studio albums),
  // de-duplicated by title so deluxe editions don't repeat songs.
  const studio = new Set(albums.filter((a) => a.kind === 'album').map((a) => a.id));
  const scored = tracks
    .map((t) => ({
      t,
      score: (counts.get(t.id) ?? 0) * 100
        + (studio.has(t.album_id) ? 5 : 0)
        + (t.disc === 1 && (t.track_no ?? 99) <= 4 ? 3 : 0)
        - (albumById.get(t.album_id)?.edition ? 2 : 0),
    }))
    .sort((a, b) => b.score - a.score || a.t.title.localeCompare(b.t.title));
  const seen = new Set<string>();
  const popular: PlayerTrack[] = [];
  for (const { t } of scored) {
    const key = t.title.toLowerCase().replace(/\s*[([].*$/, '');
    if (seen.has(key)) continue;
    seen.add(key);
    popular.push(toPlayerTrack(t, albumById.get(t.album_id)!));
    if (popular.length === 10) break;
  }

  return {
    artist,
    popular,
    albums: albums.filter((a) => a.kind === 'album' && !a.edition),
    editions: albums.filter((a) => a.kind === 'album' && a.edition),
    live: albums.filter((a) => a.kind === 'live'),
    compilations: albums.filter((a) => a.kind === 'compilation'),
    trackCount: tracks.length,
  };
}, ['artist'], { revalidate: 300, tags: ['catalog'] });

export async function getAlbumPlayerTracks(slug: string) {
  const data = await getAlbumWithTracks(slug);
  return data ? data.tracks.map((t) => toPlayerTrack(t, data.album)) : null;
}

export async function getArtistPlayerTracks(slug: string) {
  const albums = (await getAlbums()).filter((a) => a.artist.slug === slug);
  if (!albums.length) return null;
  const tracks = must(
    await db.from('tracks').select(`${TRACK_COLS}, album_id`).eq('artist_id', albums[0].artist.id),
  ) as (Track & { album_id: string })[];
  const albumById = new Map(albums.map((a) => [a.id, a]));
  // For radio/shuffle, skip duplicate titles across editions.
  const seen = new Set<string>();
  return tracks.flatMap((t) => {
    const key = t.title.toLowerCase().replace(/\s*[([].*$/, '');
    if (seen.has(key)) return [];
    seen.add(key);
    return [toPlayerTrack(t, albumById.get(t.album_id)!)];
  });
}

export const getHome = unstable_cache(async () => {
  const albums = await getAlbums();
  const top = must(await db.rpc('top_tracks', { since: '30 days', lim: 12 })) as { track_id: string }[];
  const recentlyAdded = [...albums].sort((a, b) => b.added_at.localeCompare(a.added_at) || (b.year ?? 0) - (a.year ?? 0));
  // Deterministic-per-day "random" picks so the page is stable across refreshes.
  const day = Math.floor(Date.now() / 86_400_000);
  const shuffled = [...albums].sort((a, b) => hash(a.id + day) - hash(b.id + day));
  const decades = new Map<number, Album[]>();
  for (const a of albums.filter((x) => x.kind === 'album' && x.year)) {
    const d = Math.floor(a.year! / 10) * 10;
    decades.set(d, [...(decades.get(d) ?? []), a]);
  }
  return {
    mostPlayed: await tracksByIds(top.map((t) => t.track_id)),
    newest: albums.filter((a) => a.kind !== 'compilation').slice(0, 12),
    recentlyAdded: recentlyAdded.slice(0, 12),
    rediscover: shuffled.slice(0, 12),
    decades: [...decades.entries()].sort((a, b) => a[0] - b[0]),
    artists: await getArtists(),
  };
}, ['home'], { revalidate: 60, tags: ['catalog'] });

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}
