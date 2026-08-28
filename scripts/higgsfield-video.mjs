// ═══════════════════════════════════════════════════════════════════════════
//  higgsfield-video — image-to-video via the Higgsfield platform API.
//
//  Takes a local still (a film reference plate from radix-studio, or any
//  image), hosts it on Vercel Blob so the API can fetch it, submits an
//  image-to-video job, polls to completion and downloads the MP4.
//
//  The film engine never depends on this: it renders and stops. This script is
//  the separate, optional handoff, so a missing credential degrades to a clear
//  error here rather than breaking a render there.
//
//    node scripts/higgsfield-video.mjs <image> "<prompt>" [--out f.mp4]
//                                      [--model M] [--duration 5] [--dry-run]
// ═══════════════════════════════════════════════════════════════════════════
import { readFile, writeFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import { put } from '@vercel/blob';
import { config } from 'dotenv';

// Credentials are split by ownership: the Higgsfield keys are marketing/ops, so
// they live in radix-studio/.env with the rest of them; BLOB_READ_WRITE_TOKEN is
// this app's, and stays here. Disjoint keys, so load order doesn't matter.
config();
config({ path: resolve(import.meta.dirname, '../../radix-studio/.env') });

const BASE = 'https://platform.higgsfield.ai';
const arg = (flag, def) => { const i = process.argv.indexOf(flag); return i > -1 ? process.argv[i + 1] : def; };

const image = process.argv[2];
const prompt = process.argv[3];
const DRY = process.argv.includes('--dry-run');
const model = arg('--model', 'higgsfield-ai/dop/standard');
const duration = Number(arg('--duration', 5));
const out = arg('--out', `films-${Date.now?.() ?? 'out'}.mp4`);

if (!image || !prompt) {
  console.error('usage: node scripts/higgsfield-video.mjs <image> "<prompt>" [--out f.mp4] [--model M] [--duration 5] [--dry-run]');
  process.exit(1);
}

const KEY = process.env.HIGGSFIELD_API_KEY;
const SECRET = process.env.HIGGSFIELD_API_SECRET;
if (!KEY || !SECRET) {
  console.error('HIGGSFIELD_API_KEY / HIGGSFIELD_API_SECRET missing from the environment.');
  process.exit(1);
}
const auth = { Authorization: `Key ${KEY}:${SECRET}` };

// ── 1. host the prompt frame ───────────────────────────────────────────────
const bytes = await readFile(image);
console.log(`  plate  ${basename(image)}  ${(bytes.length / 1024).toFixed(0)} KB`);

if (DRY) {
  console.log(`  [dry] would upload, then POST ${BASE}/${model}`);
  console.log(`  [dry] prompt: ${prompt}`);
  console.log(`  [dry] duration: ${duration}s`);
  process.exit(0);
}

const blob = await put(`film-plates/${basename(image)}`, bytes, {
  access: 'public',
  contentType: 'image/png',
  addRandomSuffix: true,
});
console.log(`  hosted ${blob.url}`);

// ── 2. submit ──────────────────────────────────────────────────────────────
const submit = await fetch(`${BASE}/${model}`, {
  method: 'POST',
  headers: { ...auth, 'Content-Type': 'application/json' },
  body: JSON.stringify({ image_url: blob.url, prompt, duration }),
});
const submitBody = await submit.text();
if (!submit.ok) {
  console.error(`  submit failed  ${submit.status} ${submit.statusText}\n${submitBody.slice(0, 1200)}`);
  process.exit(1);
}
let job;
try { job = JSON.parse(submitBody); } catch { console.error(`  unparseable submit response:\n${submitBody.slice(0, 1200)}`); process.exit(1); }
console.log(`  submitted\n${JSON.stringify(job, null, 2).slice(0, 1200)}`);

const id = job.request_id ?? job.id;
const statusUrl = job.status_url ?? (id ? `${BASE}/requests/${id}/status` : null);
if (!statusUrl) { console.error('  no request id or status_url in the response – cannot poll'); process.exit(1); }

// ── 3. poll ────────────────────────────────────────────────────────────────
const findVideoUrl = (o) => {
  if (!o || typeof o !== 'object') return null;
  if (typeof o.url === 'string' && /\.(mp4|mov|webm)(\?|$)/i.test(o.url)) return o.url;
  for (const v of Object.values(o)) { const hit = findVideoUrl(v); if (hit) return hit; }
  return null;
};

let state = null;
for (let i = 0; i < 120; i++) {
  await new Promise((r) => setTimeout(r, 5000));
  const res = await fetch(statusUrl, { headers: auth });
  const text = await res.text();
  if (!res.ok) { console.error(`  poll failed  ${res.status}\n${text.slice(0, 600)}`); process.exit(1); }
  try { state = JSON.parse(text); } catch { console.error(`  unparseable status:\n${text.slice(0, 600)}`); process.exit(1); }

  const status = String(state.status ?? '').toLowerCase();
  process.stdout.write(`│ ${status || 'unknown'} `);
  if (['completed', 'succeeded', 'success'].includes(status)) break;
  if (['failed', 'error', 'nsfw', 'cancelled', 'canceled'].includes(status)) {
    console.error(`\n  job ended as "${status}"\n${JSON.stringify(state, null, 2).slice(0, 1200)}`);
    process.exit(1);
  }
}

// ── 4. download ────────────────────────────────────────────────────────────
const videoUrl = findVideoUrl(state);
if (!videoUrl) {
  console.error(`\n  no video url in the final payload:\n${JSON.stringify(state, null, 2).slice(0, 1500)}`);
  process.exit(1);
}
const mp4 = await fetch(videoUrl);
if (!mp4.ok) { console.error(`\n  download failed ${mp4.status}`); process.exit(1); }
await writeFile(out, Buffer.from(await mp4.arrayBuffer()));
console.log(`\n✓ ${out}`);
