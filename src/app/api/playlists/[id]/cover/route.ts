import sharp from 'sharp';
import { handle, HttpError, requireUser } from '@/lib/auth';
import { coverKeyFor, setCoverKey } from '@/lib/playlists';
import { deleteObject, putObject, signedAudioUrl } from '@/lib/r2';

type Ctx = RouteContext<'/api/playlists/[id]/cover'>;
const MAX_BYTES = 8 * 1024 * 1024;

// Serves the custom cover: redirects to a short-lived signed R2 URL (the bucket stays private).
export const GET = handle(async (_req: Request, ctx: Ctx) => {
  const key = await coverKeyFor((await ctx.params).id);
  if (!key) throw new HttpError(404, 'No custom cover.');
  return new Response(null, {
    status: 302,
    headers: { Location: await signedAudioUrl(key), 'Cache-Control': 'public, max-age=3600' },
  });
});

// Upload: multipart form with a "file" field. Resized to a 600px square WebP.
export const POST = handle(async (req: Request, ctx: Ctx) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  const file = (await req.formData().catch(() => null))?.get('file');
  if (!(file instanceof File)) throw new HttpError(400, 'Choose an image.');
  if (file.size > MAX_BYTES) throw new HttpError(413, 'Images must be under 8 MB.');
  let webp: Buffer;
  try {
    webp = await sharp(Buffer.from(await file.arrayBuffer())).rotate().resize(600, 600, { fit: 'cover' }).webp({ quality: 82 }).toBuffer();
  } catch {
    throw new HttpError(400, "That file isn't an image we can read.");
  }
  const key = `playlist-covers/${id}-${Date.now()}.webp`;
  await putObject(key, webp, 'image/webp');
  const previous = await setCoverKey(user, id, key);
  if (previous) await deleteObject(previous);
  return Response.json({ cover: `/api/playlists/${id}/cover?v=${encodeURIComponent(key)}` });
});

// Back to the automatic album-art mosaic.
export const DELETE = handle(async (_req: Request, ctx: Ctx) => {
  const user = await requireUser();
  const previous = await setCoverKey(user, (await ctx.params).id, null);
  if (previous) await deleteObject(previous);
  return new Response(null, { status: 204 });
});
