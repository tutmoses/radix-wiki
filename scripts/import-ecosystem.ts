// scripts/import-ecosystem.ts
// Usage: npx tsx scripts/import-ecosystem.ts <folder-path> <author-user-id>

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import { marked } from 'marked';
import { readdir, readFile } from 'fs/promises';
import { join } from 'path';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

// Map source emoji categories → tag schema categories
const CATEGORY_MAP: Record<string, string> = {
  '🏦 Finance': 'Finance',
  '🔬 Lab / Agency': 'Studio',
  '🕸️ Infrastructure': 'Infrastructure',
  '🪙 Token': 'Token',
  '🖼️ NFT': 'NFT Platform',
  '👾 Gaming': 'Gaming',
  '⚛️ DAO Platform': 'DAO Platform',
  '📚 Research / Education': 'Education',
  '🚀 Launchpad': 'Launchpad',
  '🔮 Oracle': 'Oracle',
  '🧪 DeSci': 'DeSci',
  '⚖️ Stablecoin': 'Stablecoin',
  '🛜 LoFi': 'LoFi',
  '🎤 Podcast': 'Media',
  '🟢 Open Source': 'Open Source',
};

// Map source status → tag schema status
const STATUS_MAP: Record<string, string> = {
  '🟢': '🟢',
  '🟡': '🟠',
  '💀': '🔴',
};

interface ParsedPage {
  title: string;
  metadata: Record<string, string>;
  body: string;
}

function parseFrontmatter(raw: string): ParsedPage {
  const lines = raw.split('\n');
  const title = (lines[0] || '').replace(/^#\s+/, '').trim();

  const meta: Record<string, string> = {};
  let bodyStart = 1;

  // Skip blank line after title
  if (lines[1]?.trim() === '') bodyStart = 2;

  // Parse emoji-prefixed metadata lines
  for (let i = bodyStart; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) { bodyStart = i + 1; continue; }

    const catMatch = line.match(/^🗂️\s*Category::\s*(.+)/);
    const foundedMatch = line.match(/^🎂\s*Founded::\s*(.+)/);
    const websiteMatch = line.match(/^🌎\s*Website::\s*(.+)/);
    const githubMatch = line.match(/^👾\s*Github::\s*(.+)/);
    const xMatch = line.match(/^🆇\s*X::\s*(.+)/);
    const telegramMatch = line.match(/^🗣️\s*Telegram::\s*(.+)/);
    const teamMatch = line.match(/^👥\s*Team::\s*(.+)/);
    const assetsMatch = line.match(/^💰\s*Assets::\s*(.+)/);
    const validatorMatch = line.match(/^✅\s*Validator::\s*(.+)/);
    const statusMatch = line.match(/^Status:\s*(.+)/);

    if (catMatch) {
      // Take first category from comma-separated list, map it
      const first = catMatch[1].split(',')[0].trim();
      meta.category = CATEGORY_MAP[first] || 'Token';
      bodyStart = i + 1;
    } else if (foundedMatch) {
      meta.founded = foundedMatch[1].trim();
      bodyStart = i + 1;
    } else if (websiteMatch) {
      meta.website = websiteMatch[1].trim();
      bodyStart = i + 1;
    } else if (xMatch) {
      const socials = [meta.socials, `x: ${xMatch[1].trim()}`].filter(Boolean).join(', ');
      meta.socials = socials;
      bodyStart = i + 1;
    } else if (telegramMatch) {
      const socials = [meta.socials, `tg: ${telegramMatch[1].trim()}`].filter(Boolean).join(', ');
      meta.socials = socials;
      bodyStart = i + 1;
    } else if (githubMatch) {
      const socials = [meta.socials, `gh: ${githubMatch[1].trim()}`].filter(Boolean).join(', ');
      meta.socials = socials;
      bodyStart = i + 1;
    } else if (teamMatch) {
      meta.team = teamMatch[1].trim();
      bodyStart = i + 1;
    } else if (assetsMatch) {
      meta.assets = assetsMatch[1].trim();
      bodyStart = i + 1;
    } else if (validatorMatch) {
      // Append validator to assets
      meta.assets = [meta.assets, validatorMatch[1].trim()].filter(Boolean).join(' | ');
      bodyStart = i + 1;
    } else if (statusMatch) {
      meta.status = STATUS_MAP[statusMatch[1].trim()] || '🟠';
      bodyStart = i + 1;
    } else {
      // Not a metadata line — body starts here
      break;
    }
  }

  // Default required fields
  if (!meta.status) meta.status = '🟠';
  if (!meta.category) meta.category = 'Token';

  const body = lines.slice(bodyStart).join('\n').trim();
  return { title, metadata: meta, body };
}

function slugify(text: string): string {
  return text.toLowerCase().trim().replace(/[^\w\s-]/g, '').replace(/[\s_-]+/g, '-').replace(/^-+|-+$/g, '');
}

// Strip local image references (e.g. ![alt](localfile.webp)) since we can't upload them
function stripLocalImages(md: string): string {
  return md.replace(/!\[([^\]]*)\]\((?!https?:\/\/)([^)]+)\)/g, '');
}

async function main() {
  const folder = process.argv[2];
  const authorId = process.argv[3];

  if (!folder || !authorId) {
    console.error('Usage: npx tsx scripts/import-ecosystem.ts <folder-path> <author-user-id>');
    process.exit(1);
  }

  // Verify author exists
  const author = await prisma.user.findUnique({ where: { id: authorId } });
  if (!author) {
    console.error(`User ${authorId} not found. Available users:`);
    const users = await prisma.user.findMany({ select: { id: true, displayName: true, radixAddress: true } });
    users.forEach(u => console.error(`  ${u.id} — ${u.displayName || u.radixAddress}`));
    process.exit(1);
  }

  const files = (await readdir(folder)).filter(f => f.endsWith('.md'));
  const skipped: string[] = [];
  let created = 0;

  for (const file of files) {
    const raw = await readFile(join(folder, file), 'utf-8');
    const { title, metadata, body } = parseFrontmatter(raw);

    // Skip index/non-page files
    if (!body || title === 'Ecosystem') {
      skipped.push(file);
      continue;
    }

    const slug = slugify(title);
    const cleanMd = stripLocalImages(body);
    const html = await marked.parse(cleanMd);

    const content = [{
      id: `block-${slug}-1`,
      type: 'content' as const,
      text: html,
    }];

    // Extract first paragraph as excerpt
    const excerptMatch = cleanMd.match(/^(.+?)(?:\n\n|\n#)/s);
    const excerpt = excerptMatch
      ? excerptMatch[1].replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/\*\*/g, '').slice(0, 300)
      : undefined;

    // Check for existing page
    const existing = await prisma.page.findFirst({ where: { tagPath: 'ecosystem', slug } });
    if (existing) {
      skipped.push(`${file} (slug "${slug}" exists)`);
      continue;
    }

    await prisma.page.create({
      data: {
        slug,
        title,
        content: content as any,
        excerpt,
        tagPath: 'ecosystem',
        metadata: metadata as any,
        version: '1.0.0',
        authorId,
      },
    });

    await prisma.revision.create({
      data: {
        pageId: (await prisma.page.findFirst({ where: { tagPath: 'ecosystem', slug } }))!.id,
        title,
        content: content as any,
        version: '1.0.0',
        changeType: 'major',
        changes: [],
        authorId,
        message: 'Imported from Notion export',
      },
    });

    created++;
    process.stdout.write(`\r${created}/${files.length - skipped.length} imported`);
  }

  console.log(`\n\nDone: ${created} pages created, ${skipped.length} skipped`);
  if (skipped.length) console.log('Skipped:', skipped.join('\n  '));

  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
