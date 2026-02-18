// scripts/seed-legacy-docs.mjs
// Seed script to import radix-docs GitHub repo as Legacy Docs wiki pages
// Preserves folder structure via tag_path hierarchy
import pg from 'pg';
import { randomUUID } from 'crypto';
import { config } from 'dotenv';
import { readFileSync, existsSync } from 'fs';
import { marked } from 'marked';
import { resolve, dirname } from 'path';

config();

const uid = () => randomUUID();
const AUTHOR_ID = 'cmk5t48vx0000005zc5se4dqz'; // Hydrate
const TAG_BASE = 'developers/legacy-docs';
const DOCS_ROOT = '/tmp/radix-docs';
const GITHUB_BASE = 'https://github.com/gguuttss/radix-docs/blob/master';

// Parse SUMMARY.md to get ordered pages with titles and hierarchy
function parseSummary() {
  const summary = readFileSync(resolve(DOCS_ROOT, 'SUMMARY.md'), 'utf-8');
  const pages = [];
  const lines = summary.split('\n');

  for (const line of lines) {
    const match = line.match(/^(\s*)-\s*\[(.+?)\]\((.+?)\)/);
    if (!match) continue;
    const [, indent, title, path] = match;
    const depth = indent.length / 2;
    if (path === 'welcome.md') continue;
    pages.push({ title, path, depth });
  }
  return pages;
}

// Compute tag_path from file path
// e.g. "build/scrypto-1/auth/using-proofs.md" -> "developers/legacy-docs/build/scrypto-1/auth"
// e.g. "build/scrypto-1/auth/README.md" -> "developers/legacy-docs/build/scrypto-1/auth"
// e.g. "essentials/asset-oriented.md" -> "developers/legacy-docs/essentials"
// e.g. "essentials/README.md" -> "developers/legacy-docs/essentials"
function computeTagPath(filePath) {
  // Get the directory of the file
  const dir = dirname(filePath);
  if (dir === '.') return TAG_BASE;
  return `${TAG_BASE}/${dir}`;
}

// Build a slug from just the filename (not the full path, since tag_path has the folder)
function buildSlug(filePath) {
  const filename = filePath.split('/').pop();
  if (filename === 'README.md') {
    // For README files, use the parent folder name as slug
    const parts = filePath.split('/');
    if (parts.length >= 2) {
      return parts[parts.length - 2];
    }
    return 'index';
  }
  return filename
    .replace(/\.md$/, '')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

// Convert markdown content to clean HTML suitable for TipTap blocks
function mdToHtml(mdContent, filePath) {
  let content = mdContent
    // Remove gitbook hints/tags
    .replace(/{% hint style="[^"]*" %}/g, '')
    .replace(/{% endhint %}/g, '')
    .replace(/{% content-ref url="[^"]*" %}/g, '')
    .replace(/{% endcontent-ref %}/g, '')
    .replace(/{% embed url="([^"]*)" %}/g, '[$1]($1)')
    .replace(/{% tabs %}/g, '')
    .replace(/{% endtabs %}/g, '')
    .replace(/{% tab title="([^"]*)" %}/g, '\n**$1:**\n')
    .replace(/{% endtab %}/g, '')
    .replace(/{% code[^%]*%}/g, '')
    .replace(/{% endcode %}/g, '')
    // Fix image paths to point to GitHub raw content
    .replace(/!\[([^\]]*)\]\((?:\.\.\/)*\.gitbook\/assets\/([^)]+)\)/g,
      `![$1](https://raw.githubusercontent.com/gguuttss/radix-docs/master/.gitbook/assets/$2)`)
    .replace(/!\[([^\]]*)\]\(<(?:\.\.\/)*\.gitbook\/assets\/([^>]+)>\)/g,
      `![$1](https://raw.githubusercontent.com/gguuttss/radix-docs/master/.gitbook/assets/$2)`)
    // Fix relative links to point to GitHub
    .replace(/\[([^\]]+)\]\((?!http)(?!#)([^)]+\.md)\)/g, (match, text, relPath) => {
      const dir = dirname(filePath);
      const absPath = resolve(DOCS_ROOT, dir, relPath).replace(DOCS_ROOT + '/', '');
      return `[${text}](${GITHUB_BASE}/${absPath})`;
    });

  // Remove frontmatter
  content = content.replace(/^---[\s\S]*?---\n*/, '');
  // Remove first H1 (will be the page title)
  content = content.replace(/^#\s+.+\n*/, '');
  // Remove description lines that gitbook uses
  content = content.replace(/^description:\s*.+\n*/m, '');

  return marked.parse(content, { gfm: true, breaks: false });
}

// Build breadcrumb from hierarchy
function buildSectionPath(pages, index) {
  const page = pages[index];
  const parts = [];
  let targetDepth = page.depth - 1;
  for (let i = index - 1; i >= 0 && targetDepth >= 0; i--) {
    if (pages[i].depth === targetDepth) {
      parts.unshift(pages[i].title);
      targetDepth--;
    }
  }
  return parts;
}

async function main() {
  const pages = parseSummary();
  console.log(`Found ${pages.length} pages in SUMMARY.md`);

  const { Pool } = pg;
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 1,
    ssl: { rejectUnauthorized: false },
  });

  const client = await pool.connect();

  // Check existing pages under any legacy-docs path
  const existing = await client.query(
    "SELECT tag_path, slug FROM pages WHERE tag_path LIKE 'developers/legacy-docs%'"
  );
  const existingKeys = new Set(existing.rows.map(r => `${r.tag_path}::${r.slug}`));
  console.log(`${existingKeys.size} pages already exist under legacy-docs`);

  let created = 0;
  let skipped = 0;
  const tagPathCounts = {};

  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];
    const filePath = resolve(DOCS_ROOT, page.path);

    if (!existsSync(filePath)) {
      console.log(`  SKIP (missing): ${page.path}`);
      skipped++;
      continue;
    }

    const tagPath = computeTagPath(page.path);
    const slug = buildSlug(page.path);
    const key = `${tagPath}::${slug}`;

    if (existingKeys.has(key)) {
      skipped++;
      continue;
    }

    const mdContent = readFileSync(filePath, 'utf-8');
    const html = mdToHtml(mdContent, page.path);

    const sectionPath = buildSectionPath(pages, i);
    const sectionLabel = sectionPath.length > 0 ? sectionPath.join(' > ') : '';

    const contentBlocks = [];

    const sourceLink = `${GITHUB_BASE}/${page.path}`;
    contentBlocks.push({
      id: uid(),
      type: 'content',
      text: `<p><em>${sectionLabel ? sectionLabel + ' > ' : ''}${page.title}</em> — <a href="${sourceLink}" target="_blank" rel="noopener">View on GitHub</a></p><hr>`,
    });

    if (html.trim()) {
      contentBlocks.push({
        id: uid(),
        type: 'content',
        text: html,
      });
    }

    const excerptMatch = mdContent.match(/(?:^|\n)([A-Z][^#\n][^\n]{20,})/);
    const excerpt = excerptMatch
      ? excerptMatch[1].slice(0, 200).replace(/[`*_\[\]]/g, '')
      : `Legacy documentation: ${page.title}`;

    const pageId = `cm${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
    const now = new Date().toISOString();
    const contentJson = JSON.stringify(contentBlocks);

    try {
      await client.query(
        `INSERT INTO pages (id, slug, title, content, excerpt, tag_path, metadata, version, author_id, created_at, updated_at)
         VALUES ($1, $2, $3, $4::jsonb, $5, $6, '{}'::jsonb, '1.0.0', $7, $8, $8)`,
        [pageId, slug, page.title, contentJson, excerpt, tagPath, AUTHOR_ID, now]
      );

      const revisionId = `cm${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
      await client.query(
        `INSERT INTO revisions (id, page_id, content, title, version, change_type, changes, author_id, message, created_at)
         VALUES ($1, $2, $3::jsonb, $4, '1.0.0', 'major', '[]'::jsonb, $5, 'Imported from radix-docs legacy repository', $6)`,
        [revisionId, pageId, contentJson, page.title, AUTHOR_ID, now]
      );

      tagPathCounts[tagPath] = (tagPathCounts[tagPath] || 0) + 1;
      created++;
      if (created % 10 === 0) console.log(`  Created ${created} pages...`);
    } catch (err) {
      console.error(`  ERROR on ${tagPath}/${slug}: ${err.message}`);
    }
  }

  console.log(`\nDone: ${created} created, ${skipped} skipped`);
  console.log('\nPages per tag path:');
  for (const [tp, count] of Object.entries(tagPathCounts).sort()) {
    console.log(`  ${tp}: ${count}`);
  }

  client.release();
  await pool.end();
  process.exit(0);
}

main().catch(err => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
