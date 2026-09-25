import { getArtistPlayerTracks } from '@/lib/catalog';

export async function GET(_req: Request, ctx: RouteContext<'/api/artists/[slug]'>) {
  const tracks = await getArtistPlayerTracks((await ctx.params).slug);
  if (!tracks) return Response.json({ error: 'not found' }, { status: 404 });
  return Response.json(tracks, { headers: { 'Cache-Control': 'private, max-age=600' } });
}
