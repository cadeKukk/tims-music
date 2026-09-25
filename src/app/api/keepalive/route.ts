import { db } from '@/lib/db';

// Hit daily by a Vercel cron (vercel.json) so the free Supabase project never idles into a pause.
export async function GET() {
  const { error } = await db.from('artists').select('id', { head: true, count: 'exact' });
  return Response.json({ ok: !error }, { status: error ? 500 : 200 });
}
