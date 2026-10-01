// scripts/sweep-513-scrypto-101-community-hosted.mjs
//
// Blog rotation, run 513. Re-reading the citations on the stalest blog post,
// building-radixs-developer-pipeline-nine-events-and-counting, found that its
// "Scrypto 101" and "Step by Step" links both pointed at /developers, and checking
// where the course now lives found it has moved:
//   - academy.radixdlt.com, at every path, now serves a "Community Hosted" page for
//     "Scrypto Academy". Its config.json lists one option, Scrypto 101 at
//     scrypto101.vercel.app, maintained by octo.xrd (repo gguuttss/scrypto101), with
//     the footer "not officially maintained by the Radix Foundation". Read 07:0x UTC
//     1 Oct 2026.
//   - The repo README says the app was "scraped from the Radix DLT Academy
//     LearnWorlds course before it was taken offline": 6 chapters, 55 lessons,
//     quizzes for chapters 1-5. Repo created 19 Mar 2026.
//   - docs.radixdlt.com/docs/learning-step-by-step still answers 200 ("Learning
//     Step-by-Step").
// Three pages edited:
//   - /ecosystem/academia-scrypto called the academy course "officially maintained"
//     and listed it in External Links as "Scrypto 101 - Radix Academy".
//   - /developers lists community-hosted infrastructure and lacked the course.
//   - the blog post: course links repointed, St Mary's linked to its event page.
//
//   node scripts/sweep-513-scrypto-101-community-hosted.mjs --dry-run
//   node scripts/sweep-513-scrypto-101-community-hosted.mjs
//
// Idempotent per page: a page already carrying the sentinel is skipped.

import pg from 'pg';
import { config } from 'dotenv';
import { cuid, AUTHOR_ID, isLockedPage, assertLinkShapes } from './seed-utils.mjs';
config({ quiet: true });

const DRY = process.argv.includes('--dry-run');
const SENTINEL = 'scrypto101.vercel.app';
const COURSE = 'https://scrypto101.vercel.app/';
const REPO = 'https://github.com/gguuttss/scrypto101';
const ACADEMY = 'https://academy.radixdlt.com/';
const STEPS = 'https://docs.radixdlt.com/docs/learning-step-by-step';
const A = (href, text) => `<a href="${href}" target="_blank" rel="noopener">${text}</a>`;

const edits = [
  {
    tagPath: 'ecosystem',
    slug: 'academia-scrypto',
    version: '3.3.0',
    changeType: 'minor',
    message: 'Sweep 513: the Radix Academy Scrypto 101 course is offline; academy.radixdlt.com now points to a community-hosted copy (scrypto101.vercel.app, octo.xrd), read 1 Oct 2026. "Officially maintained" wording and the External Links entry corrected.',
    subs: [
      [
        'Developers looking for an up-to-date learning path should use the officially maintained resources: the <a href="https://docs.radixdlt.com/docs" target="_blank" rel="noopener">Radix documentation</a>, the interactive <a href="https://academy.radixdlt.com/course/scrypto101" target="_blank" rel="noopener">Scrypto 101 course</a>, and',
        `Developers looking for an up-to-date learning path can use the <a href="https://docs.radixdlt.com/docs" target="_blank" rel="noopener">Radix documentation</a>, the ${A(COURSE, 'Scrypto 101 course')}, and`,
      ],
      [
        'tutorials.</p>',
        `tutorials. The Radix Academy course that Scrypto 101 came from has been taken offline. ${A(ACADEMY, 'academy.radixdlt.com')} now lists a single community-hosted copy, rebuilt from the original lessons by octo.xrd (${A(REPO, 'source')}), and notes that the Radix Foundation does not maintain it (read 1 October 2026).</p>`,
      ],
      [
        '<a href="https://academy.radixdlt.com/course/scrypto101" target="_blank" rel="noopener">Scrypto 101 – Radix Academy</a>',
        `${A(COURSE, 'Scrypto 101 (community-hosted copy of the Radix Academy course)')}`,
      ],
    ],
  },
  {
    tagPath: 'developers',
    slug: '',
    version: '3.4.0',
    changeType: 'minor',
    message: 'Sweep 513: Scrypto 101 added to Community tools. The Radix Academy course is offline and academy.radixdlt.com points to a community-hosted copy maintained by octo.xrd, read 1 Oct 2026.',
    subs: [
      [
        '<li><p><a target="_blank" rel="noopener noreferrer" class="link" href="https://console.radixscan.io/">RadixScan Console</a>',
        `<li><p>${A(COURSE, 'Scrypto 101')} (${A(REPO, 'GitHub')}) &ndash; the six-chapter Scrypto course from the former Radix Academy, with its quizzes, rebuilt as a standalone site by octo.xrd after the original was taken offline. ${A(ACADEMY, 'academy.radixdlt.com')} now points here.</p></li>\n<li><p><a target="_blank" rel="noopener noreferrer" class="link" href="https://console.radixscan.io/">RadixScan Console</a>`,
      ],
    ],
  },
  {
    tagPath: 'blog',
    slug: 'building-radixs-developer-pipeline-nine-events-and-counting',
    version: '2.7.6',
    changeType: 'patch',
    message: 'Sweep 513: "Scrypto 101" and "Step by Step" linked to the courses themselves rather than /developers (Scrypto 101 now community-hosted at scrypto101.vercel.app, read 1 Oct 2026); St Mary\'s linked to its event page. Essay text unchanged.',
    subs: [
      [
        '<a rel="noopener" class="link" href="/developers">Scrypto 101</a> and <a rel="noopener" class="link" href="/developers">Step by Step</a> courses',
        `${A(COURSE, 'Scrypto 101')} and ${A(STEPS, 'Step by Step')} courses`,
      ],
      [
        "Westminster</a>, St Mary's, and",
        `Westminster</a>, <a rel="noopener" class="link" href="/contents/history/dapp-in-a-day-workshop-2-st-marys-university">St Mary's</a>, and`,
      ],
    ],
  },
];

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();
const leaves = (bs) => bs.flatMap((b) => [b, ...(b.blocks || [])]);

try {
  for (const e of edits) {
    const where = `${e.tagPath}/${e.slug}`;
    if (isLockedPage(e.tagPath, e.slug)) throw new Error(`${where} is LOCKED`);
    const { rows } = await client.query(
      'SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2', [e.tagPath, e.slug]);
    if (!rows.length) throw new Error(`${where} not found`);
    const page = rows[0];
    const blocks = JSON.parse(JSON.stringify(page.content));
    if (leaves(blocks).some((b) => (b.text || '').includes(SENTINEL))) {
      console.log(`  ${where}: already applied - no write`);
      continue;
    }
    for (const [from, to] of e.subs) {
      const hits = leaves(blocks).filter((b) => (b.text || '').includes(from));
      if (hits.length !== 1) throw new Error(`${where}: expected 1 match, got ${hits.length}: ${from.slice(0, 70)}`);
      if (hits[0].text.split(from).length !== 2) throw new Error(`${where}: string repeats in block: ${from.slice(0, 70)}`);
      hits[0].text = hits[0].text.replace(from, () => to);
    }
    assertLinkShapes(blocks, where);
    if (/[\u2014\u00a0]/.test(e.subs.map(([, to]) => to).join(''))) throw new Error(`${where}: em dash or nbsp in new text`);
    console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${e.version}  (${e.subs.length} substitutions)`);
    if (!DRY) {
      const now = new Date().toISOString();
      const json = JSON.stringify(blocks);
      await client.query('BEGIN');
      await client.query(
        'UPDATE pages SET content=$1, version=$2, updated_at=$3, last_verified_at=$3 WHERE id=$4',
        [json, e.version, now, page.id]);
      await client.query(
        `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [cuid(), page.id, json, page.title, e.version, e.changeType, AUTHOR_ID, e.message, now]);
      await client.query('COMMIT');
      console.log('  written');
    }
  }
} catch (err) {
  try { await client.query('ROLLBACK'); } catch {}
  console.error('  FAILED:', err.message);
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
