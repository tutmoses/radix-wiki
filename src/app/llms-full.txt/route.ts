import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma/client';
import type { Block, AtomicBlock } from '@/types/blocks';

export const dynamic = 'force-dynamic';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://radix.wiki';

function stripHtml(html: string): string {
  return html
    .replace(/<a[^>]+href="([^"]*)"[^>]*>(.*?)<\/a>/gi, ' $2 ($1) ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(?:p|h[1-6]|li|tr|th|td|div)>/gi, '\n')
    .replace(/<(?:li)>/gi, '- ')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function cleanExcerpt(s: string): string {
  return s
    .replace(/\(https?:\/\/[^)]*\)/g, '')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/\(\s*\)/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .slice(0, 160);
}

function extractText(blocks: Block[]): string {
  return blocks.map(block => {
    switch (block.type) {
      case 'content':
        return stripHtml(block.text);
      case 'infobox':
        return block.blocks.map(b => extractAtomicText(b)).filter(Boolean).join('\n');
      case 'columns':
        return block.columns.map(col => col.blocks.map(b => extractAtomicText(b)).filter(Boolean).join('\n')).join('\n');
      case 'codeTabs':
        return block.tabs.map(t => `[${t.label}]\n${t.code}`).join('\n');
      default:
        return '';
    }
  }).filter(Boolean).join('\n\n');
}

function extractAtomicText(block: AtomicBlock): string {
  switch (block.type) {
    case 'content': return stripHtml(block.text);
    case 'codeTabs': return block.tabs.map(t => `[${t.label}]\n${t.code}`).join('\n');
    default: return '';
  }
}

export async function GET() {
  const pages = await prisma.page.findMany({
    select: { title: true, tagPath: true, slug: true, excerpt: true, content: true, updatedAt: true },
    orderBy: { updatedAt: 'desc' },
  });

  const sections = pages
    .filter(p => p.tagPath && p.slug)
    .map(p => {
      const url = `${BASE_URL}/${p.tagPath}/${p.slug}`;
      const body = extractText((p.content as unknown as Block[]) || []);
      return `## ${p.title}\n\nURL: ${url}\nUpdated: ${p.updatedAt.toISOString().split('T')[0]}\n${p.excerpt ? `Summary: ${cleanExcerpt(p.excerpt)}\n` : ''}\n${body}`;
    });

  const text = [
    `# RADIX Wiki — Full Content Export`,
    ``,
    `> This is the full-text version of llms.txt for ${BASE_URL}`,
    `> ${pages.length} pages, last generated ${new Date().toISOString().split('T')[0]}`,
    ``,
    ...sections,
  ].join('\n\n');

  return new NextResponse(text, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
}
