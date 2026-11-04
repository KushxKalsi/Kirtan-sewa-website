// Photos, videos and audio for posts.
//
// With Cloudflare R2 set up (R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET; R2_PUBLIC_URL when the
// bucket has a public r2.dev or custom domain), the browser uploads straight to R2 with a short-lived signed link and
// files are served from R2. Without it they are stored like the other files (Postgres or DATA_DIR), which is fine for a
// handful of posts but not for many videos.
import crypto from 'node:crypto';
import { kv } from './db.js';

const R2 = {
  account: process.env.R2_ACCOUNT_ID,
  keyId: process.env.R2_ACCESS_KEY_ID,
  secret: process.env.R2_SECRET_ACCESS_KEY,
  bucket: process.env.R2_BUCKET,
  publicUrl: (process.env.R2_PUBLIC_URL || '').replace(/\/$/, ''),
};
export const r2On = !!(R2.account && R2.keyId && R2.secret && R2.bucket);
export const storageName = r2On ? `Cloudflare R2 (${R2.bucket})` : 'built-in';

// What may be uploaded, and how big. Without R2 the limits are lower: every byte goes through the server and database.
export const MEDIA_KINDS = {
  image: { types: ['image/jpeg', 'image/png', 'image/webp'], max: (r2On ? 15 : 6) * 1024 * 1024 },
  video: { types: ['video/mp4', 'video/webm', 'video/quicktime'], max: (r2On ? 80 : 30) * 1024 * 1024 },
  audio: { types: ['audio/mpeg', 'audio/mp4', 'audio/x-m4a', 'audio/aac', 'audio/webm', 'audio/ogg', 'audio/wav', 'audio/x-wav'], max: 12 * 1024 * 1024 },
};
export const kindOfType = (type) => Object.keys(MEDIA_KINDS).find((k) => MEDIA_KINDS[k].types.includes(type)) || '';

const objectKey = (id) => `media/${id}`;
const sha256 = (data) => crypto.createHash('sha256').update(data).digest('hex');
const hmac = (key, data) => crypto.createHmac('sha256', key).update(data).digest();
const rfc3986 = (s) => encodeURIComponent(s).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);

// An S3 (SigV4) presigned URL for one object in the R2 bucket.
function presign(method, key, expires = 900) {
  const host = `${R2.account}.r2.cloudflarestorage.com`;
  const pathName = `/${R2.bucket}/${key.split('/').map(rfc3986).join('/')}`;
  const amzDate = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const scope = `${amzDate.slice(0, 8)}/auto/s3/aws4_request`;
  const params = {
    'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
    'X-Amz-Credential': `${R2.keyId}/${scope}`,
    'X-Amz-Date': amzDate,
    'X-Amz-Expires': String(expires),
    'X-Amz-SignedHeaders': 'host',
  };
  const query = Object.keys(params)
    .sort()
    .map((k) => `${rfc3986(k)}=${rfc3986(params[k])}`)
    .join('&');
  const request = [method, pathName, query, `host:${host}\n`, 'host', 'UNSIGNED-PAYLOAD'].join('\n');
  const toSign = ['AWS4-HMAC-SHA256', amzDate, scope, sha256(request)].join('\n');
  let k = hmac(`AWS4${R2.secret}`, amzDate.slice(0, 8));
  for (const part of ['auto', 's3', 'aws4_request']) k = hmac(k, part);
  return `https://${host}${pathName}?${query}&X-Amz-Signature=${hmac(k, toSign).toString('hex')}`;
}

// Where the browser sends the file: R2 directly, or our own upload route (with the upload's one-time key).
export const uploadTarget = (id, key) => (r2On ? { url: presign('PUT', objectKey(id)), direct: true } : { url: `/api/media/${id}?key=${key}`, direct: false });

// Without R2: the bytes the browser sent to /api/media/:id.
export const storeLocal = (id, type, buffer) => kv.set(`media-${id}`, { type, data: buffer.toString('base64') });

// A link to show the file: R2's public domain, a signed R2 link, or null (served from storage by readLocal).
export const mediaRedirect = (id) => (!r2On ? null : R2.publicUrl ? `${R2.publicUrl}/${objectKey(id)}` : presign('GET', objectKey(id), 6 * 3600));
export async function readLocal(id) {
  const file = await kv.get(`media-${id}`);
  return file && { type: file.type, buffer: Buffer.from(file.data, 'base64') };
}

// local: the file was uploaded before R2 was set up, so it is in the built-in storage.
export async function removeMedia(id, local = !r2On) {
  if (local) return kv.set(`media-${id}`, null);
  await fetch(presign('DELETE', objectKey(id)), { method: 'DELETE' }).catch(() => {});
}
