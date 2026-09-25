// Scans the music folder, uploads audio to Cloudflare R2, writes album art into
// public/covers, and upserts the catalog into Supabase. Safe to re-run: audio is
// stored by content hash, so unchanged files are never re-uploaded.
//
//   npm run ingest                 # full run
//   npm run ingest -- --dry-run    # scan + covers only, no uploads or DB writes
//   npm run ingest -- --prune      # also delete DB rows for files no longer on disk
//   npm run ingest -- --root /path/to/music
//   npm run ingest -- --skip-upload # write the catalog to the DB without touching R2
//   npm run ingest -- --allow-paid # permit going past R2's 10 GB free storage tier

import { parseFile } from 'music-metadata';
import sharp from 'sharp';
import { AwsClient } from 'aws4fetch';
import { createClient } from '@supabase/supabase-js';
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { readdir, readFile, mkdir, access, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const flag = (f) => args.includes(f);
const opt = (f) => (args.includes(f) ? args[args.indexOf(f) + 1] : undefined);

const WEB_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ROOT = path.resolve(opt('--root') ?? path.join(WEB_DIR, '..'));
const COVERS_DIR = path.join(WEB_DIR, 'public', 'covers');
const DRY = flag('--dry-run');
const PRUNE = flag('--prune');
const FORCE_COVERS = flag('--force-covers');
const ALLOW_PAID = flag('--allow-paid');
const SKIP_UPLOAD = flag('--skip-upload');
// R2's free tier is 10 GB-month of storage; stop well short so the bill stays at $0.
const FREE_STORAGE_LIMIT = 9 * 1024 ** 3;
const COVER_SIZES = [300, 600, 1200];
const IMAGE_RE = /\.(jpe?g|jfif|png|webp)$/i;
const SKIP_DIRS = new Set(['web', 'node_modules']);

// ---------- helpers ----------

const slugify = (s) =>
  s.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

const sortName = (name) => name.replace(/^the\s+/i, '');

const EDITION_RE = /\s*[([]([^()[\]]*(deluxe|edition|anniversary|remaster|special|version|bonus|expanded)[^()[\]]*)[)\]]\s*$/i;
function splitEdition(title) {
  let base = title.trim();
  const editions = [];
  let m;
  while ((m = base.match(EDITION_RE))) {
    editions.unshift(m[1].trim());
    base = base.slice(0, m.index).trim();
  }
  return { base, edition: editions.join(' · ') || null };
}

async function exists(p) {
  try { await access(p); return true; } catch { return false; }
}

async function sha1(file) {
  const h = createHash('sha1');
  for await (const chunk of createReadStream(file)) h.update(chunk);
  return h.digest('hex');
}

async function walk(dir) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.') || SKIP_DIRS.has(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walk(p)));
    else out.push(p);
  }
  return out;
}

async function pool(items, n, fn) {
  let i = 0;
  const workers = Array.from({ length: n }, async () => {
    while (i < items.length) {
      const idx = i++;
      await fn(items[idx], idx);
    }
  });
  await Promise.all(workers);
}

// Picks a background (dark enough for white text) and an accent colour from the art.
async function extractColors(imgBuf) {
  const { data } = await sharp(imgBuf).resize(48, 48, { fit: 'cover' }).removeAlpha().raw()
    .toBuffer({ resolveWithObject: true });
  const bins = new Map();
  for (let i = 0; i < data.length; i += 3) {
    const [r, g, b] = [data[i], data[i + 1], data[i + 2]];
    const key = (r >> 4) * 256 + (g >> 4) * 16 + (b >> 4);
    const bin = bins.get(key) ?? { n: 0, r: 0, g: 0, b: 0 };
    bin.n++; bin.r += r; bin.g += g; bin.b += b;
    bins.set(key, bin);
  }
  const colors = [...bins.values()].map(({ n, r, g, b }) => {
    const c = [r / n, g / n, b / n];
    const max = Math.max(...c), min = Math.min(...c);
    const sat = max === 0 ? 0 : (max - min) / max;
    const lum = (0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]) / 255;
    return { n, c, sat, lum };
  });
  // Favour colourful bins over the (usually dominant) black/grey ones, unless the art is basically monochrome.
  const bgScore = (x) => x.n * (0.12 + x.sat * 1.5) * (x.lum < 0.03 || x.lum > 0.95 ? 0.4 : 1);
  const bg = colors.reduce((a, b) => (bgScore(b) > bgScore(a) ? b : a));
  const accentPool = colors.filter((x) => x.lum > 0.2 && x.n > 3);
  const accent = (accentPool.length ? accentPool : colors)
    .reduce((a, b) => (b.sat * Math.sqrt(b.n) > a.sat * Math.sqrt(a.n) ? b : a));

  const scaleTo = (c, maxLum) => {
    const lum = (0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]) / 255;
    const k = lum > maxLum ? maxLum / lum : 1;
    return c.map((v) => v * k);
  };
  const lift = (c, minLum) => {
    let out = c;
    for (let i = 0; i < 20; i++) {
      const lum = (0.2126 * out[0] + 0.7152 * out[1] + 0.0722 * out[2]) / 255;
      if (lum >= minLum) break;
      out = out.map((v) => v + (255 - v) * 0.15);
    }
    return out;
  };
  const hex = (c) => '#' + c.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');
  return { bg: hex(scaleTo(bg.c, 0.12)), fg: '#ffffff', accent: hex(lift(accent.c, 0.45)) };
}

// ---------- scan ----------

console.log(`Scanning ${ROOT}`);
const allFiles = await walk(ROOT);
const audioFiles = allFiles.filter((f) => /\.mp3$/i.test(f));
const imageFiles = allFiles.filter((f) => IMAGE_RE.test(f));

const albumsByDir = new Map(); // "<Artist>/<Album folder>" -> album
let scanned = 0;
await pool(audioFiles, 8, async (file) => {
  const rel = path.relative(ROOT, file).split(path.sep);
  if (rel.length < 3) {
    console.warn(`  ! skipping ${rel.join('/')} (expected Artist/Album/track.mp3)`);
    return;
  }
  const albumDir = path.join(ROOT, rel[0], rel[1]);
  const meta = await parseFile(file, { duration: true, skipCovers: false });
  const c = meta.common;

  const folderMatch = rel[1].match(/^\((\d{4})\)\s*-?\s*(.+?)\s*-\s*[^-]+$/);
  const discFromFolder = rel.length > 3 ? Number(rel[2].match(/disc\s*(\d+)/i)?.[1]) || null : null;
  const trackFromName = Number(path.basename(file).match(/_(\d{1,3})_/)?.[1]) || null;

  if (!albumsByDir.has(albumDir)) {
    const artistName = (c.albumartist || c.artist || rel[0]).trim();
    const title = (c.album || folderMatch?.[2] || rel[1]).trim();
    albumsByDir.set(albumDir, {
      dir: albumDir,
      folderName: rel[1],
      artistName,
      title,
      year: Number(folderMatch?.[1]) || c.year || null,
      tracks: [],
      embeddedPicture: null,
    });
  }
  const album = albumsByDir.get(albumDir);
  if (!album.embeddedPicture && c.picture?.length) {
    const front = c.picture.find((p) => /front/i.test(p.type ?? '')) ?? c.picture[0];
    album.embeddedPicture = Buffer.from(front.data);
  }
  album.tracks.push({
    file,
    title: (c.title || path.basename(file, path.extname(file))).trim(),
    artistCredit: (c.artist || album.artistName).trim(),
    disc: c.disk?.no || discFromFolder || 1,
    trackNo: c.track?.no || trackFromName,
    duration: meta.format.duration ?? 0,
    bitrate: meta.format.bitrate ? Math.round(meta.format.bitrate / 1000) : null,
    size: (await stat(file)).size,
    hash: await sha1(file),
  });
  if (++scanned % 100 === 0) console.log(`  scanned ${scanned}/${audioFiles.length}`);
});

const albums = [...albumsByDir.values()];
const slugsSeen = new Set();
for (const a of albums) {
  a.tracks.sort((x, y) => x.disc - y.disc || (x.trackNo ?? 999) - (y.trackNo ?? 999) || x.title.localeCompare(y.title));
  const { base, edition } = splitEdition(a.title);
  a.baseTitle = base;
  a.edition = edition;
  a.kind = /\blive\b/i.test(`${a.title} ${a.folderName}`) ? 'live'
    : /b-sides|rarities|greatest hits|best of/i.test(a.title) ? 'compilation' : 'album';
  let slug = slugify(`${a.artistName} ${a.title}`);
  if (slugsSeen.has(slug)) slug = `${slug}-${a.year}`;
  slugsSeen.add(slug);
  a.slug = slug;
  a.discCount = Math.max(...a.tracks.map((t) => t.disc));
}
console.log(`Found ${albums.length} albums, ${audioFiles.length} tracks`);

// ---------- covers ----------

await mkdir(COVERS_DIR, { recursive: true });
const imgRank = (f) => (/(cover|front|folder)/i.test(path.basename(f)) ? 0 : 1);
await pool(albums, 4, async (a) => {
  const inAlbumDir = imageFiles.filter((f) => path.dirname(f) === a.dir).sort((x, y) => imgRank(x) - imgRank(y));
  const inDiscDirs = imageFiles.filter((f) => f.startsWith(a.dir + path.sep) && path.dirname(f) !== a.dir);
  let source = null;
  for (const f of [...inAlbumDir, ...inDiscDirs]) {
    const buf = await readFile(f);
    const m = await sharp(buf).metadata().catch(() => null);
    if (m?.width >= 300) { source = buf; break; }
  }
  source ??= a.embeddedPicture;
  a.embeddedPicture = null;
  if (!source) {
    console.warn(`  ! no cover art for ${a.artistName} – ${a.title}`);
    a.coverKey = null;
    return;
  }
  a.coverKey = `/covers/${a.slug}`;
  const need = FORCE_COVERS || !(await exists(path.join(COVERS_DIR, `${a.slug}_1200.webp`)));
  if (need) {
    for (const size of COVER_SIZES) {
      await sharp(source).resize(size, size, { fit: 'cover', withoutEnlargement: false })
        .webp({ quality: size > 600 ? 82 : 78 })
        .toFile(path.join(COVERS_DIR, `${a.slug}_${size}.webp`));
    }
  }
  Object.assign(a, { colors: await extractColors(source) });
});
console.log(`Covers written to public/covers`);

if (DRY) {
  for (const a of albums.sort((x, y) => x.artistName.localeCompare(y.artistName) || x.year - y.year)) {
    console.log(`  ${a.year} ${a.artistName} – ${a.baseTitle}${a.edition ? ` [${a.edition}]` : ''} (${a.kind}, ${a.tracks.length} tracks, ${a.discCount} disc) bg ${a.colors?.bg} accent ${a.colors?.accent}`);
  }
  console.log('Dry run: skipping upload and database.');
  process.exit(0);
}

// ---------- upload to R2 ----------

const totalBytes = albums.flatMap((a) => a.tracks).reduce((sum, t) => sum + t.size, 0);
console.log(`Library size: ${(totalBytes / 1024 ** 3).toFixed(2)} GB (R2 free tier: 10 GB)`);
if (totalBytes > FREE_STORAGE_LIMIT && !ALLOW_PAID) {
  console.error('Stopping: this would exceed the 9 GB safety limit under R2\'s free tier. Remove music or re-run with --allow-paid.');
  process.exit(1);
}

const env = (k) => {
  const v = process.env[k];
  if (!v) throw new Error(`Missing ${k} in .env.local`);
  return v;
};
const r2 = new AwsClient({
  accessKeyId: env('R2_ACCESS_KEY_ID'),
  secretAccessKey: env('R2_SECRET_ACCESS_KEY'),
  service: 's3',
  region: 'auto',
});
const R2_BASE = `https://${env('R2_ACCOUNT_ID')}.r2.cloudflarestorage.com/${env('R2_BUCKET')}`;

const allTracks = albums.flatMap((a) => a.tracks);
for (const t of allTracks) t.key = `audio/${t.hash}.mp3`;
let uploaded = 0, skipped = 0, done = 0;
if (!SKIP_UPLOAD) await pool(allTracks, 6, async (t) => {
  const url = `${R2_BASE}/${t.key}`;
  const head = await r2.fetch(url, { method: 'HEAD' });
  if (head.ok) {
    skipped++;
  } else {
    const body = await readFile(t.file);
    for (let attempt = 1; ; attempt++) {
      const res = await r2.fetch(url, {
        method: 'PUT',
        body,
        headers: { 'Content-Type': 'audio/mpeg', 'Cache-Control': 'public, max-age=31536000, immutable' },
      });
      if (res.ok) break;
      if (attempt >= 3) throw new Error(`Upload failed for ${t.file}: ${res.status} ${await res.text()}`);
    }
    uploaded++;
  }
  if (++done % 50 === 0 || done === allTracks.length) {
    console.log(`  audio ${done}/${allTracks.length} (${uploaded} uploaded, ${skipped} already there)`);
  }
});

// ---------- database ----------

const db = createClient(env('SUPABASE_URL'), env('SUPABASE_SECRET_KEY'), { auth: { persistSession: false } });
const must = ({ data, error }) => {
  if (error) throw new Error(error.message);
  return data;
};

const artistNames = [...new Set(albums.map((a) => a.artistName))];
const artistRows = must(await db.from('artists').upsert(
  artistNames.map((name) => ({ slug: slugify(name), name, sort_name: sortName(name) })),
  { onConflict: 'slug' },
).select('id, name'));
const artistId = Object.fromEntries(artistRows.map((r) => [r.name, r.id]));

const albumRows = must(await db.from('albums').upsert(albums.map((a) => ({
  slug: a.slug,
  artist_id: artistId[a.artistName],
  title: a.title,
  base_title: a.baseTitle,
  edition: a.edition,
  kind: a.kind,
  year: a.year,
  cover_key: a.coverKey,
  color_bg: a.colors?.bg ?? null,
  color_fg: a.colors?.fg ?? null,
  color_accent: a.colors?.accent ?? null,
  disc_count: a.discCount,
  track_count: a.tracks.length,
  duration_sec: Math.round(a.tracks.reduce((s, t) => s + t.duration, 0)),
})), { onConflict: 'slug' }).select('id, slug'));
const albumId = Object.fromEntries(albumRows.map((r) => [r.slug, r.id]));

const trackRows = albums.flatMap((a) => a.tracks.map((t) => ({
  album_id: albumId[a.slug],
  artist_id: artistId[a.artistName],
  title: t.title,
  artist_credit: t.artistCredit,
  disc: t.disc,
  track_no: t.trackNo,
  duration_sec: t.duration,
  bitrate: t.bitrate,
  file_key: t.key,
  file_size: t.size,
  content_hash: t.hash,
})));
for (let i = 0; i < trackRows.length; i += 200) {
  must(await db.from('tracks').upsert(trackRows.slice(i, i + 200), { onConflict: 'content_hash' }));
}
console.log(`Database: ${artistRows.length} artists, ${albumRows.length} albums, ${trackRows.length} tracks upserted`);

if (PRUNE) {
  const keep = new Set(trackRows.map((t) => t.content_hash));
  const existing = must(await db.from('tracks').select('id, content_hash, file_key'));
  const staleRows = existing.filter((t) => !keep.has(t.content_hash));
  const stale = staleRows.map((t) => t.id);
  for (const t of staleRows) await r2.fetch(`${R2_BASE}/${t.file_key}`, { method: 'DELETE' });
  for (let i = 0; i < stale.length; i += 200) must(await db.from('tracks').delete().in('id', stale.slice(i, i + 200)));
  const keepAlbums = albumRows.map((a) => a.id);
  must(await db.from('albums').delete().not('id', 'in', `(${keepAlbums.join(',')})`));
  const keepArtists = artistRows.map((a) => a.id);
  must(await db.from('artists').delete().not('id', 'in', `(${keepArtists.join(',')})`));
  console.log(`Pruned ${stale.length} stale tracks`);
}

console.log('Done. Redeploy the site so new cover art in public/covers goes live.');
