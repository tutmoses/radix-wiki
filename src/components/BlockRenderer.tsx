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
    else if (full.startsWith('`')) parts.push(<code key={key++}>{match[4]}</code>);
    else if (full.startsWith('[')) {
      const [linkText, href] = [match[5], match[6]];
      parts.push(href.startsWith('http') 
        ? <a key={key++} href={href} target="_blank" rel="noopener noreferrer" className="link">{linkText}</a>
        : <Link key={key++} href={href} className="link">{linkText}</Link>);
    }
    lastIndex = match.index + full.length;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return parts.length > 0 ? parts : [text];
}

// Callout config
const CALLOUT_CONFIG = {
  info: { className: 'callout-info', Icon: Info, iconClass: 'status-info' },
  warning: { className: 'callout-warning', Icon: AlertTriangle, iconClass: 'status-warning' },
  success: { className: 'callout-success', Icon: CheckCircle, iconClass: 'status-success' },
  error: { className: 'callout-error', Icon: AlertCircle, iconClass: 'status-error' },
};

// Recent pages widget
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
    <div className="row-4 wrap">
      {[...Array(Math.min(block.limit, 3))].map((_, i) => <div key={i} className="flex-1 h-32 skeleton" />)}
    </div>
  );
  if (pages.length === 0) return <p className="text-muted">No pages found.</p>;

  return (
    <div className="row-4 wrap">
      {pages.map(page => {
        const leafTag = findTagByPath(page.tagPath.split('/'));
        return (
          <Link key={page.id} href={`/${page.tagPath}/${page.slug}`} className="flex-1 min-w-[280px] max-w-[calc(33.333%-1rem)] group">
            <div className="row items-start gap-3 p-4 surface-interactive h-full">
              <FileText size={18} className="text-accent shrink-0 mt-0.5" />
              <div className="stack-2 min-w-0">
                <span className="font-medium group-hover:text-accent transition-colors truncate">{page.title}</span>
                {page.excerpt && <p className="text-muted line-clamp-2">{page.excerpt}</p>}
                <div className="row mt-auto pt-2">
                  <small className="row"><Clock size={12} />{formatRelativeTime(page.updatedAt)}</small>
                  {leafTag && <Badge variant="secondary">{leafTag.name}</Badge>}
                </div>
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

// Page list widget
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

  if (isLoading) return <div className="row-4"><div className="flex-1 h-20 skeleton" /></div>;
  if (pages.length === 0) return <p className="text-muted">No pages selected.</p>;

  return (
    <div className="row-4 wrap">
      {pages.map(page => (
        <Link key={page.id} href={`/${page.tagPath}/${page.slug}`} className="group row p-3 surface hover:bg-surface-2 transition-colors">
          <FileText size={16} className="text-accent" />
          <span className="group-hover:text-accent transition-colors">{page.title}</span>
        </Link>
      ))}
    </div>
  );
}

// Block renderer
function renderBlock(block: Block): React.ReactNode {
  switch (block.type) {
    case 'heading': {
      const Tag = `h${block.level}` as 'h1' | 'h2' | 'h3';
      return <Tag>{block.text}</Tag>;
    }
    case 'paragraph':
      return <p>{parseInlineMarkdown(block.text)}</p>;
    case 'image':
      if (!block.src) return null;
      return (
        <figure className="stack-2">
          <img src={block.src} alt={block.alt || ''} className="rounded-lg max-w-full" />
          {block.caption && <figcaption className="text-muted text-center">{block.caption}</figcaption>}
        </figure>
      );
    case 'callout': {
      const config = CALLOUT_CONFIG[block.variant];
      return (
        <div className={cn('callout', config.className)}>
          <config.Icon size={20} className={cn('shrink-0 mt-0.5', config.iconClass)} />
          <div className="stack-2">
            {block.title && <strong>{block.title}</strong>}
            <p>{parseInlineMarkdown(block.text)}</p>
          </div>
        </div>
      );
    }
    case 'divider':
      return <hr />;
    case 'code':
      return (
        <div className="relative">
          {block.language && <small className="absolute top-2 right-2">{block.language}</small>}
          <pre><code>{block.code}</code></pre>
        </div>
      );
    case 'quote':
      return (
        <blockquote>
          <p>{parseInlineMarkdown(block.text)}</p>
          {block.attribution && <cite className="block mt-2">— {block.attribution}</cite>}
        </blockquote>
      );
    case 'list':
      if (block.style === 'checklist') {
        return (
          <ul className="stack-2">
            {block.items.map((item, i) => (
              <li key={i} className="row items-start">
                <input type="checkbox" checked={item.checked} readOnly className="mt-1 rounded" />
                <span className={item.checked ? 'line-through text-muted' : ''}>{parseInlineMarkdown(item.text)}</span>
              </li>
            ))}
          </ul>
        );
      }
      const Tag = block.style === 'numbered' ? 'ol' : 'ul';
      return (
        <Tag className={cn('pl-6 stack-2', block.style === 'numbered' ? 'list-decimal' : 'list-disc')}>
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
        <div className={cn('w-full rounded-lg overflow-hidden surface', aspectRatios[block.aspectRatio || '16:9'])}>
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
    <div className={cn('stack-6', className)}>
      {(content as BlockContent).map(block => <div key={block.id}>{renderBlock(block)}</div>)}
    </div>
  );
}

export default BlockRenderer;