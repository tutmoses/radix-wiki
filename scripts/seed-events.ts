// scripts/seed-events.ts — Seed wiki pages from Notion-exported .md files
// Usage: npx tsx scripts/seed-events.ts

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { put } from '@vercel/blob';
import { marked } from 'marked';
import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import crypto from 'crypto';

// --- Config ---
const EVENTS_DIR = '/Users/libertant/Desktop/Events';
const TAG_PATH = 'contents/history';
const AUTHOR_ID = 'cmk5t48vx0000005zc5se4dqz'; // Hydrate
const SKIP_EXISTING = true;

// --- DB ---
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// --- Helpers ---
function slugify(text: string): string {
  return text.toLowerCase().trim().replace(/[^\w\s-]/g, '').replace(/[\s_-]+/g, '-').replace(/^-+|-+$/g, '');
}

function uid(): string {
  return crypto.randomUUID();
}

/** Convert .heic to .jpeg using macOS sips, returns new path */
function convertHeic(filePath: string): string {
  const out = filePath.replace(/\.heic$/i, '.jpeg');
  if (fs.existsSync(out)) return out;
  try {
    execSync(`sips -s format jpeg "${filePath}" --out "${out}"`, { stdio: 'pipe' });
  } catch {
    console.warn(`  [warn] Failed to convert HEIC: ${path.basename(filePath)}`);
    return '';
  }
  return out;
}

/** Upload a local file to Vercel Blob, returns URL or empty string */
async function uploadImage(filePath: string): Promise<string> {
  if (!fs.existsSync(filePath)) return '';

  const ext = path.extname(filePath).toLowerCase();
  let actualPath = filePath;

  // Convert HEIC
  if (ext === '.heic') {
    actualPath = convertHeic(filePath);
    if (!actualPath) return '';
  }

  // Skip unsupported formats
  const supported = ['.jpeg', '.jpg', '.png', '.gif', '.webp', '.avif'];
  if (!supported.includes(path.extname(actualPath).toLowerCase())) return '';

  // Check size (4MB limit)
  const stat = fs.statSync(actualPath);
  if (stat.size > 4 * 1024 * 1024) {
    console.warn(`  [warn] Skipping large file: ${path.basename(actualPath)} (${(stat.size / 1024 / 1024).toFixed(1)}MB)`);
    return '';
  }

  const filename = `${crypto.randomUUID()}${path.extname(actualPath)}`;
  const buffer = fs.readFileSync(actualPath);
  const blob = await put(filename, buffer, { access: 'public', addRandomSuffix: false });
  return blob.url;
}

// --- Metadata Parsing ---
interface EventMeta {
  attendees?: string;
  date?: string;
  location?: string;
  type?: string;
  website?: string;
}

function parseMetadata(lines: string[]): { meta: EventMeta; bodyLines: string[] } {
  const meta: EventMeta = {};
  const bodyLines: string[] = [];
  let pastMeta = false;
  let seenMeta = false;

  for (const line of lines) {
    if (pastMeta) {
      bodyLines.push(line);
      continue;
    }

    // Skip empty lines before/between metadata
    if (!line.trim() && !seenMeta) continue;
    if (!line.trim() && seenMeta) continue; // skip blank line right after last metadata

    const m = line.match(/^(\w[\w\s]*?)::\s*(.+)$/);
    if (m) {
      seenMeta = true;
      const key = m[1].trim().toLowerCase();
      const val = m[2].trim();
      switch (key) {
        case 'attendees': meta.attendees = val; break;
        case 'event date': meta.date = val.split('→')[0].trim().replace(/\//g, '-').replace(/\s.*$/, ''); break;
        case 'location': meta.location = val; break;
        case 'type': meta.type = val; break;
        case 'website': meta.website = val.startsWith('http') ? val : `https://${val}`; break;
      }
    } else {
      pastMeta = true;
      bodyLines.push(line);
    }
  }

  return { meta, bodyLines };
}

// --- Content Conversion ---
/** Strip Notion-specific markers, clean up markdown */
function cleanMarkdown(md: string): string {
  // Remove Notion aside blocks - extract inner content
  md = md.replace(/<aside>\s*[🗣💡👥ℹ️🏆🛤️]*\s*/g, '');
  md = md.replace(/<\/aside>/g, '');

  // Remove Notion page links (keep display text)
  md = md.replace(/\[([^\]]+)\]\(https:\/\/www\.notion\.so\/[^\)]+\)/g, '$1');

  // Clean up emoji headers
  md = md.replace(/^(#{1,6})\s*[🗯️🏆🛤️ℹ️💡🗣👥]*\s*/gm, '$1 ');

  return md.trim();
}

/** Parse image references from markdown, resolve to local paths */
function extractImages(md: string): { imgRef: string; localPath: string }[] {
  const images: { imgRef: string; localPath: string }[] = [];
  const imgRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
  let match;
  while ((match = imgRegex.exec(md)) !== null) {
    const ref = match[2];
    // Skip URLs
    if (ref.startsWith('http')) continue;
    // Skip PDF files
    if (ref.endsWith('.pdf')) continue;
    // Decode URI components in path and resolve relative to Events dir
    const decoded = decodeURIComponent(ref);
    const localPath = path.resolve(EVENTS_DIR, decoded);
    images.push({ imgRef: match[0], localPath });
  }
  return images;
}

/** Convert cleaned markdown body to HTML content blocks */
async function buildContentBlocks(
  bodyMd: string,
): Promise<{ blocks: any[]; bannerImage: string }> {
  let bannerImage = '';
  const blocks: any[] = [];

  // Extract and upload images first
  const images = extractImages(bodyMd);
  const imageUrls = new Map<string, string>();

  for (const img of images) {
    const url = await uploadImage(img.localPath);
    if (url) {
      imageUrls.set(img.imgRef, url);
    }
  }

  // Replace image references with uploaded URLs or remove failed ones
  let processed = bodyMd;
  for (const img of images) {
    const url = imageUrls.get(img.imgRef);
    if (url) {
      // Set first image as banner
      if (!bannerImage) bannerImage = url;
      processed = processed.replace(img.imgRef, `![](${url})`);
    } else {
      processed = processed.replace(img.imgRef, '');
    }
  }

  // Remove video/mov references (not supported)
  processed = processed.replace(/\[.*?\.mov\]\([^)]+\)/gi, '');
  processed = processed.replace(/!\[.*?\.mov\]\([^)]+\)/gi, '');

  // Split by H2 sections for better block structure
  const sections = processed.split(/(?=^## )/m).filter(s => s.trim());

  for (const section of sections) {
    const html = await marked.parse(section.trim());
    if (html.trim()) {
      blocks.push({ id: uid(), type: 'content', text: html });
    }
  }

  // If no blocks were created, make one from the whole body
  if (blocks.length === 0 && processed.trim()) {
    const html = await marked.parse(processed.trim());
    blocks.push({ id: uid(), type: 'content', text: html });
  }

  return { blocks, bannerImage };
}

// --- Main ---
async function main() {
  console.log('Scanning events directory...');

  const files = fs.readdirSync(EVENTS_DIR).filter(f => f.endsWith('.md'));
  console.log(`Found ${files.length} .md files\n`);

  let created = 0;
  let skipped = 0;
  let errors = 0;

  for (const file of files) {
    const filePath = path.join(EVENTS_DIR, file);
    const raw = fs.readFileSync(filePath, 'utf-8');
    const lines = raw.split('\n');

    // Extract title from first H1
    const titleLine = lines.find(l => l.startsWith('# '));
    if (!titleLine) {
      console.log(`[skip] No title found in ${file}`);
      skipped++;
      continue;
    }
    const title = titleLine.replace(/^#\s+/, '').trim();
    const slug = slugify(title);

    // Skip "History of Radix" - already exists
    if (SKIP_EXISTING) {
      const existing = await prisma.page.findFirst({ where: { tagPath: TAG_PATH, slug } });
      if (existing) {
        console.log(`[skip] "${title}" already exists`);
        skipped++;
        continue;
      }
    }

    console.log(`[create] "${title}"`);

    try {
      // Parse metadata and body
      const bodyStart = lines.indexOf(titleLine);
      const afterTitle = lines.slice(bodyStart + 1);
      const { meta, bodyLines } = parseMetadata(afterTitle.filter(l => !l.startsWith('# ')));

      // Clean and convert body
      const cleanedBody = cleanMarkdown(bodyLines.join('\n'));
      const { blocks, bannerImage } = await buildContentBlocks(cleanedBody);

      if (blocks.length === 0) {
        console.log(`  [warn] No content blocks generated, creating minimal page`);
        blocks.push({ id: uid(), type: 'content', text: `<p>${title}</p>` });
      }

      // Build metadata
      const metadata: Record<string, string> = {};
      if (meta.attendees) metadata.attendees = meta.attendees;
      if (meta.date) metadata.date = meta.date;
      if (meta.location) metadata.location = meta.location;
      if (meta.type) metadata.type = meta.type;
      if (meta.website) metadata.website = meta.website;

      // Create page
      const page = await prisma.page.create({
        data: {
          slug,
          title,
          content: blocks,
          excerpt: cleanedBody.slice(0, 200).replace(/<[^>]+>/g, '').replace(/[#*_\[\]()]/g, '').trim(),
          bannerImage: bannerImage || undefined,
          tagPath: TAG_PATH,
          metadata,
          version: '1.0.0',
          authorId: AUTHOR_ID,
        },
      });

      // Create initial revision
      await prisma.revision.create({
        data: {
          pageId: page.id,
          title,
          content: blocks,
          version: '1.0.0',
          changeType: 'major',
          changes: [],
          authorId: AUTHOR_ID,
          message: 'Initial version (seeded from Notion export)',
        },
      });

      console.log(`  -> /${TAG_PATH}/${slug}`);
      created++;
    } catch (err: any) {
      console.error(`  [error] ${err.message}`);
      errors++;
    }
  }

  console.log(`\nDone: ${created} created, ${skipped} skipped, ${errors} errors`);
  await pool.end();
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
