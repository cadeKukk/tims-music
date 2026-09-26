import { endSession, handle } from '@/lib/auth';

export const POST = handle(async () => {
  await endSession();
  return new Response(null, { status: 204 });
});
