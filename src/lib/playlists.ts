import 'server-only';
import { db } from './db';
import { getAlbums, tracksByIds } from './catalog';
import type { PlayerTrack } from './types';

export type PlaylistSummary = {
  id: string;
  name: string;
  description: string | null;
  updated_at: string;
  trackCount: number;
  covers: string[]; // up to 4 distinct album covers, in playlist order
};

export type Playlist = PlaylistSummary & { tracks: PlayerTrack[] };

export const isUuid = (s: unknown): s is string =>
  typeof s === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);

function must<T>({ data, error }: { data: T | null; error: { message: string } | null }): T {
  if (error) throw new Error(error.message);
  return data as T;
}

async function coverLookup() {
  return new Map((await getAlbums()).map((a) => [a.id, a.cover_key]));
}

function distinctCovers(covers: (string | null | undefined)[]) {
  return [...new Set(covers.filter((c): c is string => !!c))].slice(0, 4);
}

export async function listPlaylists(): Promise<PlaylistSummary[]> {
  const [playlists, rows, covers] = await Promise.all([
    db.from('playlists').select('id, name, description, updated_at').order('updated_at', { ascending: false }).then(must),
    db.from('playlist_tracks').select('playlist_id, position, tracks(album_id)').order('position').then(must),
    coverLookup(),
  ]);
  const byPlaylist = new Map<string, string[]>();
  for (const r of rows as unknown as { playlist_id: string; tracks: { album_id: string } | null }[]) {
    const list = byPlaylist.get(r.playlist_id) ?? [];
    list.push(covers.get(r.tracks?.album_id ?? '') ?? '');
    byPlaylist.set(r.playlist_id, list);
  }
  return (playlists as Omit<PlaylistSummary, 'trackCount' | 'covers'>[]).map((p) => ({
    ...p,
    trackCount: byPlaylist.get(p.id)?.length ?? 0,
    covers: distinctCovers(byPlaylist.get(p.id) ?? []),
  }));
}

export async function getPlaylist(id: string): Promise<Playlist | null> {
  if (!isUuid(id)) return null;
  const playlist = must(await db.from('playlists').select('id, name, description, updated_at').eq('id', id).maybeSingle());
  if (!playlist) return null;
  const rows = must(await db.from('playlist_tracks').select('track_id').eq('playlist_id', id).order('position')) as { track_id: string }[];
  const tracks = await tracksByIds(rows.map((r) => r.track_id));
  return {
    ...(playlist as Omit<PlaylistSummary, 'trackCount' | 'covers'>),
    tracks,
    trackCount: tracks.length,
    covers: distinctCovers(tracks.map((t) => t.cover)),
  };
}

export async function createPlaylist(name: string, trackIds: string[] = []) {
  const row = must(await db.from('playlists').insert({ name: name.trim().slice(0, 100) }).select('id').single()) as { id: string };
  if (trackIds.length) await addTracks(row.id, trackIds);
  return row.id;
}

export async function updatePlaylist(id: string, fields: { name?: string; description?: string | null }) {
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof fields.name === 'string') patch.name = fields.name.trim().slice(0, 100);
  if (fields.description !== undefined) patch.description = fields.description?.trim().slice(0, 300) || null;
  must(await db.from('playlists').update(patch).eq('id', id));
}

export async function deletePlaylist(id: string) {
  must(await db.from('playlists').delete().eq('id', id));
}

/** Appends tracks to the end, skipping ones already in the playlist. Returns how many were added. */
export async function addTracks(id: string, trackIds: string[]) {
  const existing = must(
    await db.from('playlist_tracks').select('track_id, position').eq('playlist_id', id).order('position', { ascending: false }),
  ) as { track_id: string; position: number }[];
  const have = new Set(existing.map((r) => r.track_id));
  const fresh = [...new Set(trackIds)].filter((t) => isUuid(t) && !have.has(t));
  if (!fresh.length) return 0;
  const start = (existing[0]?.position ?? 0) + 1;
  must(await db.from('playlist_tracks').insert(fresh.map((track_id, i) => ({ playlist_id: id, track_id, position: start + i }))));
  return fresh.length;
}

export async function removeTrack(id: string, trackId: string) {
  must(await db.from('playlist_tracks').delete().eq('playlist_id', id).eq('track_id', trackId));
}

/** Rewrites the order to match `trackIds` (the full list, in the new order). */
export async function reorderTracks(id: string, trackIds: string[]) {
  const rows = trackIds.filter(isUuid).map((track_id, i) => ({ playlist_id: id, track_id, position: i + 1 }));
  if (rows.length) must(await db.from('playlist_tracks').upsert(rows, { onConflict: 'playlist_id,track_id' }));
}
