import { db } from '@/lib/db';
import { signedAudioUrl } from '@/lib/r2';

// track id -> R2 key; ids never change meaning, so this can live for the life of the instance.
const keyCache = new Map<string, string>();

// The <audio> element points here; we answer with a redirect to a short-lived signed R2 URL,
// so audio bytes (and range/seek requests) go straight from Cloudflare to the browser.
export async function GET(_req: Request, ctx: RouteContext<'/api/stream/[id]'>) {
  const { id } = await ctx.params;
  let key = keyCache.get(id);
  if (!key) {
    const { data } = await db.from('tracks').select('file_key').eq('id', id).maybeSingle();
    if (!data) return new Response('Not found', { status: 404 });
    key = data.file_key as string;
    keyCache.set(id, key);
  }
  return new Response(null, {
    status: 302,
    headers: {
      Location: await signedAudioUrl(key),
      'Cache-Control': 'private, max-age=1800',
    },
  });
}
