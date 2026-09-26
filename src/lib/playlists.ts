import 'server-only';
import { randomBytes } from 'node:crypto';
import { db } from './db';
import { getAlbums, tracksByIds } from './catalog';
import { HttpError, type User } from './auth';
import type { PlayerTrack } from './types';

/** How the viewer relates to a playlist. owner/editor can edit tracks; only owner manages settings. */
export type Role = 'owner' | 'editor' | 'viewer' | 'public' | 'link';
export type Visibility = 'private' | 'public';

export type PlaylistSummary = {
  id: string;
  name: string;
  description: string | null;
  updated_at: string;
  visibility: Visibility;
  owner: { id: string; username: string };
  trackCount: number;
  covers: string[];          // up to 4 album covers for the mosaic
  customCover: string | null; // uploaded cover URL, overrides the mosaic
  role?: Role;
  saved?: boolean;
};

export type Member = { user_id: string; username: string; role: 'viewer' | 'editor' };

export type Playlist = PlaylistSummary & {
  tracks: PlayerTrack[];
  role: Role;
  canEdit: boolean;
  shareToken: string | null; // owner only
  members: Member[];         // owner only
  saved: boolean;
};

type Row = {
  id: string; name: string; description: string | null; updated_at: string; visibility: Visibility;
  owner_id: string; share_token: string | null; cover_key: string | null;
  owner: { id: string; username: string } | null;
};

const COLS = 'id, name, description, updated_at, visibility, owner_id, share_token, cover_key, owner:users!playlists_owner_id_fkey(id, username)';

export const isUuid = (s: unknown): s is string =>
  typeof s === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);

function must<T>({ data, error }: { data: T | null; error: { message: string } | null }): T {
  if (error) throw new Error(error.message);
  return data as T;
}

const coverRoute = (r: Pick<Row, 'id' | 'cover_key' | 'updated_at'>) =>
  r.cover_key ? `/api/playlists/${r.id}/cover?v=${encodeURIComponent(r.cover_key)}` : null;

/** Builds summaries (track counts + cover mosaics) for a set of playlist rows in two queries. */
async function summarize(rows: Row[], extra: (r: Row) => Partial<PlaylistSummary> = () => ({})): Promise<PlaylistSummary[]> {
  if (!rows.length) return [];
  const [tracks, albums] = await Promise.all([
    db.from('playlist_tracks').select('playlist_id, position, tracks(album_id)')
      .in('playlist_id', rows.map((r) => r.id)).order('position').then(must),
    getAlbums(),
  ]);
  const coverOf = new Map(albums.map((a) => [a.id, a.cover_key]));
  const byPlaylist = new Map<string, string[]>();
  for (const t of tracks as unknown as { playlist_id: string; tracks: { album_id: string } | null }[]) {
    const list = byPlaylist.get(t.playlist_id) ?? [];
    list.push(coverOf.get(t.tracks?.album_id ?? '') ?? '');
    byPlaylist.set(t.playlist_id, list);
  }
  return rows.map((r) => ({
    id: r.id, name: r.name, description: r.description, updated_at: r.updated_at, visibility: r.visibility,
    owner: r.owner ?? { id: r.owner_id, username: 'unknown' },
    trackCount: byPlaylist.get(r.id)?.length ?? 0,
    covers: distinctCovers(byPlaylist.get(r.id) ?? []),
    customCover: coverRoute(r),
    ...extra(r),
  }));
}

function distinctCovers(covers: (string | null | undefined)[]) {
  return [...new Set(covers.filter((c): c is string => !!c))].slice(0, 4);
}

async function loadRow(id: string): Promise<Row | null> {
  if (!isUuid(id)) return null;
  return must(await db.from('playlists').select(COLS).eq('id', id).maybeSingle()) as unknown as Row | null;
}

/** Works out what `user` (or a guest holding `token`) may do with a playlist. */
async function resolveAccess(row: Row, user: User | null, token?: string | null): Promise<Role | null> {
  if (user && row.owner_id === user.id) return 'owner';
  if (user) {
    const m = must(await db.from('playlist_members').select('role').eq('playlist_id', row.id).eq('user_id', user.id).maybeSingle()) as { role: 'viewer' | 'editor' } | null;
    if (m) return m.role;
  }
  if (row.visibility === 'public') return 'public';
  if (token && row.share_token && token === row.share_token) return 'link';
  return null;
}

export async function access(id: string, user: User | null, token?: string | null) {
  const row = await loadRow(id);
  const role = row && (await resolveAccess(row, user, token));
  if (!row || !role) throw new HttpError(404, "That playlist doesn't exist or isn't shared with you.");
  return { row, role, canEdit: role === 'owner' || role === 'editor' };
}

async function requireRole(id: string, user: User, roles: Role[]) {
  const a = await access(id, user);
  if (!roles.includes(a.role)) {
    throw new HttpError(403, a.role === 'editor' ? 'Only the owner can change that.' : "You can't edit this playlist.");
  }
  return a;
}

// ---------- reading ----------

/** Everything in a user's library: their own, ones shared with them, and ones they saved. */
export async function listLibrary(user: User) {
  const [owned, memberRows, saveRows] = await Promise.all([
    db.from('playlists').select(COLS).eq('owner_id', user.id).order('updated_at', { ascending: false }).then(must),
    db.from('playlist_members').select('role, playlists(' + COLS + ')').eq('user_id', user.id).then(must),
    db.from('playlist_saves').select('saved_at, playlists(' + COLS + ')').eq('user_id', user.id).order('saved_at', { ascending: false }).then(must),
  ]);
  const shared = (memberRows as unknown as { role: Role; playlists: Row | null }[]).filter((m) => m.playlists);
  const saved = (saveRows as unknown as { playlists: Row | null }[]).map((s) => s.playlists).filter((p): p is Row => !!p);
  const roleOf = new Map<string, Role>(shared.map((m) => [m.playlists!.id, m.role]));
  const seen = new Set<string>();
  const all: Row[] = [];
  for (const r of [...(owned as unknown as Row[]), ...shared.map((m) => m.playlists!), ...saved]) {
    if (!seen.has(r.id)) { seen.add(r.id); all.push(r); }
  }
  const savedIds = new Set(saved.map((s) => s.id));
  return summarize(all, (r) => ({
    role: r.owner_id === user.id ? 'owner' : roleOf.get(r.id) ?? (r.visibility === 'public' ? 'public' : 'link'),
    saved: savedIds.has(r.id),
  }));
}

export async function listPublicByOwner(ownerId: string) {
  const rows = must(await db.from('playlists').select(COLS).eq('owner_id', ownerId).eq('visibility', 'public')
    .order('updated_at', { ascending: false })) as unknown as Row[];
  return summarize(rows);
}

export async function getPlaylist(id: string, user: User | null, token?: string | null): Promise<Playlist | null> {
  let a;
  try { a = await access(id, user, token); } catch { return null; }
  const { row, role, canEdit } = a;
  const trackRows = must(await db.from('playlist_tracks').select('track_id').eq('playlist_id', id).order('position')) as { track_id: string }[];
  const [tracks, members, save] = await Promise.all([
    tracksByIds(trackRows.map((r) => r.track_id)),
    role === 'owner' ? listMembers(id) : Promise.resolve([]),
    user ? db.from('playlist_saves').select('playlist_id').eq('user_id', user.id).eq('playlist_id', id).maybeSingle().then(must) : null,
  ]);
  const [summary] = await summarize([row]);
  return {
    ...summary,
    tracks,
    trackCount: tracks.length,
    covers: distinctCovers(tracks.map((t) => t.cover)),
    role,
    canEdit,
    shareToken: role === 'owner' ? row.share_token : null,
    members,
    saved: !!save,
  };
}

async function listMembers(id: string): Promise<Member[]> {
  const rows = must(await db.from('playlist_members').select('user_id, role, users(username)').eq('playlist_id', id).order('added_at')) as unknown as
    { user_id: string; role: 'viewer' | 'editor'; users: { username: string } | null }[];
  return rows.map((r) => ({ user_id: r.user_id, role: r.role, username: r.users?.username ?? 'unknown' }));
}

// ---------- writing ----------

export async function createPlaylist(user: User, name: string, visibility: Visibility, trackIds: string[] = []) {
  const row = must(await db.from('playlists').insert({
    name: name.trim().slice(0, 100) || 'New playlist',
    owner_id: user.id,
    visibility: visibility === 'public' ? 'public' : 'private',
  }).select('id').single()) as { id: string };
  if (trackIds.length) await insertTracks(row.id, trackIds);
  return row.id;
}

export async function updatePlaylist(user: User, id: string, fields: { name?: string; description?: string | null; visibility?: Visibility }) {
  await requireRole(id, user, ['owner']);
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof fields.name === 'string') {
    if (!fields.name.trim()) throw new HttpError(400, 'Name required.');
    patch.name = fields.name.trim().slice(0, 100);
  }
  if (fields.description !== undefined) patch.description = fields.description?.trim().slice(0, 300) || null;
  if (fields.visibility === 'public' || fields.visibility === 'private') patch.visibility = fields.visibility;
  must(await db.from('playlists').update(patch).eq('id', id));
}

export async function deletePlaylist(user: User, id: string) {
  const { row } = await requireRole(id, user, ['owner']);
  must(await db.from('playlists').delete().eq('id', id));
  return row.cover_key;
}

/** Turns link sharing on (returns the token) or off (returns null). */
export async function setShareLink(user: User, id: string, enabled: boolean) {
  const { row } = await requireRole(id, user, ['owner']);
  const token = enabled ? row.share_token ?? randomBytes(12).toString('base64url') : null;
  must(await db.from('playlists').update({ share_token: token }).eq('id', id));
  return token;
}

export async function setMember(user: User, id: string, memberId: string, role: 'viewer' | 'editor' | null) {
  await requireRole(id, user, ['owner']);
  if (memberId === user.id) throw new HttpError(400, "You already own this playlist.");
  if (role === null) {
    must(await db.from('playlist_members').delete().eq('playlist_id', id).eq('user_id', memberId));
  } else {
    must(await db.from('playlist_members').upsert({ playlist_id: id, user_id: memberId, role }, { onConflict: 'playlist_id,user_id' }));
  }
  return listMembers(id);
}

export async function setSaved(user: User, id: string, saved: boolean) {
  const { role } = await access(id, user);
  if (role === 'owner') throw new HttpError(400, "It's already your playlist.");
  if (saved) must(await db.from('playlist_saves').upsert({ user_id: user.id, playlist_id: id }, { onConflict: 'user_id,playlist_id' }));
  else must(await db.from('playlist_saves').delete().eq('user_id', user.id).eq('playlist_id', id));
}

/** Leaving a playlist someone shared with you. */
export async function leave(user: User, id: string) {
  must(await db.from('playlist_members').delete().eq('playlist_id', id).eq('user_id', user.id));
  must(await db.from('playlist_saves').delete().eq('playlist_id', id).eq('user_id', user.id));
}

export async function duplicatePlaylist(user: User, id: string, token?: string | null) {
  const { row } = await access(id, user, token);
  const trackRows = must(await db.from('playlist_tracks').select('track_id').eq('playlist_id', id).order('position')) as { track_id: string }[];
  const copy = must(await db.from('playlists').insert({
    name: `${row.name} (copy)`.slice(0, 100),
    description: row.description,
    owner_id: user.id,
    visibility: 'private',
    copied_from: row.id,
  }).select('id').single()) as { id: string };
  await insertTracks(copy.id, trackRows.map((r) => r.track_id));
  return copy.id;
}

export async function setCoverKey(user: User, id: string, key: string | null) {
  const { row } = await requireRole(id, user, ['owner']);
  must(await db.from('playlists').update({ cover_key: key, updated_at: new Date().toISOString() }).eq('id', id));
  return row.cover_key; // previous key, so the caller can delete the old file
}

export async function coverKeyFor(id: string) {
  const row = await loadRow(id);
  return row?.cover_key ?? null;
}

// ---------- tracks ----------

async function insertTracks(id: string, trackIds: string[]) {
  const existing = must(await db.from('playlist_tracks').select('track_id, position').eq('playlist_id', id)
    .order('position', { ascending: false })) as { track_id: string; position: number }[];
  const have = new Set(existing.map((r) => r.track_id));
  const fresh = [...new Set(trackIds)].filter((t) => isUuid(t) && !have.has(t));
  if (!fresh.length) return 0;
  const start = (existing[0]?.position ?? 0) + 1;
  must(await db.from('playlist_tracks').insert(fresh.map((track_id, i) => ({ playlist_id: id, track_id, position: start + i }))));
  return fresh.length;
}

export async function addTracks(user: User, id: string, trackIds: string[]) {
  await requireRole(id, user, ['owner', 'editor']);
  return insertTracks(id, trackIds);
}

export async function removeTrack(user: User, id: string, trackId: string) {
  await requireRole(id, user, ['owner', 'editor']);
  must(await db.from('playlist_tracks').delete().eq('playlist_id', id).eq('track_id', trackId));
}

export async function reorderTracks(user: User, id: string, trackIds: string[]) {
  await requireRole(id, user, ['owner', 'editor']);
  const rows = trackIds.filter(isUuid).map((track_id, i) => ({ playlist_id: id, track_id, position: i + 1 }));
  if (rows.length) must(await db.from('playlist_tracks').upsert(rows, { onConflict: 'playlist_id,track_id' }));
}
