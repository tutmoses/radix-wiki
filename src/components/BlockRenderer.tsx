// src/components/BlockRenderer.tsx

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { AlertCircle, AlertTriangle, CheckCircle, Info, Clock, FileText } from 'lucide-react';
import { cn, formatRelativeTime } from '@/lib/utils';
import { findTagByPath } from '@/lib/tags';
import { Badge } from '@/components/ui';
import type { Block, BlockContent } from '@/lib/blocks';
import type { WikiPage } from '@/types';

// Parse inline markdown: **bold**, *italic*, `code`, [link](url)
function parseInlineMarkdown(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const combined = /(\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`|\[(.+?)\]\((.+?)\))/g;
  let lastIndex = 0, key = 0, match;

  while ((match = combined.exec(text)) !== null) {
    if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index));
    const full = match[0];
    if (full.startsWith('**')) parts.push(<strong key={key++}>{match[2]}</strong>);
    else if (full.startsWith('*')) parts.push(<em key={key++}>{match[3]}</em>);
    else if (full.startsWith('`')) parts.push(<code key={key++} className="px-1.5 py-0.5 bg-surface-2 rounded text-sm font-mono">{match[4]}</code>);
    else if (full.startsWith('[')) {
      const [linkText, href] = [match[5], match[6]];
      const cls = "text-accent hover:text-accent-hover underline underline-offset-2";
      parts.push(href.startsWith('http') 
        ? <a key={key++} href={href} target="_blank" rel="noopener noreferrer" className={cls}>{linkText}</a>
        : <Link key={key++} href={href} className={cls}>{linkText}</Link>);
    }
    lastIndex = match.index + full.length;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return parts.length > 0 ? parts : [text];
}

// Callout styles
const CALLOUT_STYLES = {
  info: { bg: 'bg-blue-500/10', border: 'border-blue-500/30', Icon: Info, color: 'text-blue-400' },
  warning: { bg: 'bg-yellow-500/10', border: 'border-yellow-500/30', Icon: AlertTriangle, color: 'text-yellow-400' },
  success: { bg: 'bg-green-500/10', border: 'border-green-500/30', Icon: CheckCircle, color: 'text-green-400' },
  error: { bg: 'bg-red-500/10', border: 'border-red-500/30', Icon: AlertCircle, color: 'text-red-400' },
};

// Recent pages dynamic component
function RecentPagesRenderer({ block }: { block: Extract<Block, { type: 'recentPages' }> }) {
  const [pages, setPages] = useState<WikiPage[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const params = new URLSearchParams({ pageSize: block.limit.toString(), published: 'true' });
        if (block.tagPath) params.set('tagPath', block.tagPath);
        const response = await fetch(`/api/wiki?${params}`);
        if (response.ok) setPages((await response.json()).items);
      } catch (error) {
        console.error('Failed to fetch recent pages:', error);
      } finally {
        setIsLoading(false);
      }
    })();
  }, [block.tagPath, block.limit]);

  if (isLoading) return (
    <div className="flex gap-6 animate-pulse">
      {[...Array(Math.min(block.limit, 3))].map((_, i) => <div key={i} className="flex-1 h-32 bg-surface-1 rounded-lg" />)}
    </div>
  );
  if (pages.length === 0) return <p className="text-text-muted text-sm">No pages found.</p>;

  return (
    <div className="flex gap-6 flex-wrap">
      {pages.map(page => {
        const leafTag = findTagByPath(page.tagPath.split('/'));
        return (
          <Link key={page.id} href={`/${page.tagPath}/${page.slug}`} className="flex-1 min-w-[280px] max-w-[calc(33.333%-1rem)] group">
            <div className="flex items-start gap-3 p-4 bg-surface-1 rounded-lg border border-border-muted hover:border-border transition-colors h-full">
              <FileText size={18} className="text-accent shrink-0 mt-0.5" />
              <div className="flex flex-col gap-1 min-w-0">
                <span className="font-medium group-hover:text-accent transition-colors truncate">{page.title}</span>
                {page.excerpt && <p className="text-sm text-text-muted line-clamp-2">{page.excerpt}</p>}
                <div className="flex items-center gap-2 mt-auto pt-2">
                  <span className="text-xs text-text-muted flex items-center gap-1"><Clock size={12} />{formatRelativeTime(page.updatedAt)}</span>
                  {leafTag && <Badge variant="secondary" className="text-xs">{leafTag.name}</Badge>}
                </div>
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

// Page list dynamic component
function PageListRenderer({ block }: { block: Extract<Block, { type: 'pageList' }> }) {
  const [pages, setPages] = useState<WikiPage[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (block.pageIds.length === 0) { setIsLoading(false); return; }
    (async () => {
      try {
        const results = await Promise.all(
          block.pageIds.map(async id => {
            const response = await fetch(`/api/wiki/by-id/${id}`);
            return response.ok ? response.json() : null;
          })
        );
        setPages(results.filter(Boolean));
      } catch (error) {
        console.error('Failed to fetch pages:', error);
      } finally {
        setIsLoading(false);
      }
    })();
  }, [block.pageIds]);

  if (isLoading) return <div className="flex gap-6"><div className="flex-1 h-20 bg-surface-1 rounded-lg animate-pulse" /></div>;
  if (pages.length === 0) return <p className="text-text-muted text-sm">No pages selected.</p>;

  return (
    <div className="flex gap-4 flex-wrap">
      {pages.map(page => (
        <Link key={page.id} href={`/${page.tagPath}/${page.slug}`} className="group flex items-center gap-2 p-3 rounded-md bg-surface-1 hover:bg-surface-2 transition-colors">
          <FileText size={16} className="text-accent" /><span className="group-hover:text-accent transition-colors">{page.title}</span>
        </Link>
      ))}
    </div>
  );
}

// Block renderer registry
function renderBlock(block: Block): React.ReactNode {
  switch (block.type) {
    case 'heading': {
      const Tag = `h${block.level}` as 'h1' | 'h2' | 'h3';
      const sizes = { 1: 'text-3xl', 2: 'text-2xl', 3: 'text-xl' };
      return <Tag className={cn(sizes[block.level], 'font-semibold')}>{block.text}</Tag>;
    }
    case 'paragraph':
      return <p className="leading-relaxed">{parseInlineMarkdown(block.text)}</p>;
    case 'image':
      if (!block.src) return null;
      return (
        <figure className="flex flex-col gap-2">
          <img src={block.src} alt={block.alt || ''} className="rounded-lg max-w-full" />
          {block.caption && <figcaption className="text-sm text-text-muted text-center">{block.caption}</figcaption>}
        </figure>
      );
    case 'callout': {
      const style = CALLOUT_STYLES[block.variant];
      return (
        <div className={cn('flex gap-3 p-4 rounded-lg border', style.bg, style.border)}>
          <style.Icon size={20} className={cn('shrink-0 mt-0.5', style.color)} />
          <div className="flex flex-col gap-1">
            {block.title && <strong className="text-sm">{block.title}</strong>}
            <p className="text-sm">{parseInlineMarkdown(block.text)}</p>
          </div>
        </div>
      );
    }
    case 'divider':
      return <hr className="border-border-muted" />;
    case 'code':
      return (
        <div className="relative">
          {block.language && <span className="absolute top-2 right-2 text-xs text-text-muted">{block.language}</span>}
          <pre className="bg-surface-1 border border-border-muted rounded-lg p-4 overflow-x-auto">
            <code className="text-sm font-mono">{block.code}</code>
          </pre>
        </div>
      );
    case 'quote':
      return (
        <blockquote className="border-l-4 border-accent pl-4 py-1">
          <p className="italic text-text-muted">{parseInlineMarkdown(block.text)}</p>
          {block.attribution && <cite className="text-sm text-text-muted mt-2 block">— {block.attribution}</cite>}
        </blockquote>
      );
    case 'list':
      if (block.style === 'checklist') {
        return (
          <ul className="flex flex-col gap-2">
            {block.items.map((item, i) => (
              <li key={i} className="flex items-start gap-2">
                <input type="checkbox" checked={item.checked} readOnly className="mt-1 rounded" />
                <span className={item.checked ? 'line-through text-text-muted' : ''}>{parseInlineMarkdown(item.text)}</span>
              </li>
            ))}
          </ul>
        );
      }
      const Tag = block.style === 'numbered' ? 'ol' : 'ul';
      return (
        <Tag className={cn('pl-6 flex flex-col gap-1', block.style === 'numbered' ? 'list-decimal' : 'list-disc')}>
          {block.items.map((item, i) => <li key={i}>{parseInlineMarkdown(item.text)}</li>)}
        </Tag>
      );
    case 'recentPages':
      return <RecentPagesRenderer block={block} />;
    case 'pageList':
      return <PageListRenderer block={block} />;
    case 'embed': {
      if (!block.url) return null;
      const aspectRatios = { '16:9': 'aspect-video', '4:3': 'aspect-[4/3]', '1:1': 'aspect-square' };
      let embedUrl = block.url;
      const youtubeMatch = block.url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&]+)/);
      if (youtubeMatch) embedUrl = `https://www.youtube.com/embed/${youtubeMatch[1]}`;
      return (
        <div className={cn('w-full rounded-lg overflow-hidden bg-surface-1', aspectRatios[block.aspectRatio || '16:9'])}>
          <iframe src={embedUrl} className="w-full h-full border-0" allowFullScreen />
        </div>
      );
    }
    default:
      return null;
  }
}

export function BlockRenderer({ content, className }: { content: BlockContent | unknown; className?: string }) {
  if (!content || !Array.isArray(content)) return null;
  return (
    <div className={cn('flex flex-col gap-6', className)}>
      {(content as BlockContent).map(block => <div key={block.id}>{renderBlock(block)}</div>)}
    </div>
  );
}

export default BlockRenderer;