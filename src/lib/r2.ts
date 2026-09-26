import 'server-only';
import { AwsClient } from 'aws4fetch';

const r2 = new AwsClient({
  accessKeyId: process.env.R2_ACCESS_KEY_ID!,
  secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  service: 's3',
  region: 'auto',
});

const HOUR = 3600;

// Signs with the timestamp rounded down to the hour, so every request for a track within
// the same hour gets an identical URL and the browser's HTTP cache (and next-track preloading) works.
export async function signedAudioUrl(key: string) {
  const now = new Date();
  now.setUTCMinutes(0, 0, 0);
  const datetime = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const url = new URL(
    `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${process.env.R2_BUCKET}/${key}`,
  );
  url.searchParams.set('X-Amz-Expires', String(3 * HOUR));
  const signed = await r2.sign(new Request(url, { method: 'GET' }), {
    aws: { signQuery: true, datetime },
  });
  return signed.url;
}

const objectUrl = (key: string) =>
  `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${process.env.R2_BUCKET}/${key}`;

export async function putObject(key: string, body: ArrayBuffer | Uint8Array, contentType: string) {
  const res = await r2.fetch(objectUrl(key), {
    method: 'PUT',
    body: body as BodyInit,
    headers: { 'Content-Type': contentType, 'Cache-Control': 'public, max-age=31536000, immutable' },
  });
  if (!res.ok) throw new Error(`R2 upload failed: ${res.status}`);
}

export async function deleteObject(key: string) {
  await r2.fetch(objectUrl(key), { method: 'DELETE' });
}
