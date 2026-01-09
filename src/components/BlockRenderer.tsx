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

// Parse basic markdown in text: **bold**, *italic*, `code`, [link](url)
function parseInlineMarkdown(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;

  const patterns = [
    { regex: /\*\*(.+?)\*\*/g, render: (m: string) => <strong key={key++}>{m}</strong> },
    { regex: /\*(.+?)\*/g, render: (m: string) => <em key={key++}>{m}</em> },
    { regex: /`(.+?)`/g, render: (m: string) => <code key={key++} className="px-1.5 py-0.5 bg-surface-2 rounded text-sm font-mono">{m}</code> },
    { regex: /\[(.+?)\]\((.+?)\)/g, render: (text: string, href: string) => {
      const isExternal = href.startsWith('http');
      if (isExternal) {
        return <a key={key++} href={href} target="_blank" rel="noopener noreferrer" className="text-accent hover:text-accent-hover underline underline-offset-2">{text}</a>;
      }
      return <Link key={key++} href={href} className="text-accent hover:text-accent-hover underline underline-offset-2">{text}</Link>;
    }},
  ];

  // Simple approach: process patterns sequentially
  // For production, consider a proper markdown parser
  const combined = /(\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`|\[(.+?)\]\((.+?)\))/g;
  let lastIndex = 0;
  let match;

  while ((match = combined.exec(text)) !== null) {
    // Add text before match
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    const full = match[0];
    if (full.startsWith('**')) {
      parts.push(<strong key={key++}>{match[2]}</strong>);
    } else if (full.startsWith('*')) {
      parts.push(<em key={key++}>{match[3]}</em>);
    } else if (full.startsWith('`')) {
      parts.push(<code key={key++} className="px-1.5 py-0.5 bg-surface-2 rounded text-sm font-mono">{match[4]}</code>);
    } else if (full.startsWith('[')) {
      const linkText = match[5];
      const href = match[6];
      const isExternal = href.startsWith('http');
      if (isExternal) {
        parts.push(<a key={key++} href={href} target="_blank" rel="noopener noreferrer" className="text-accent hover:text-accent-hover underline underline-offset-2">{linkText}</a>);
      } else {
        parts.push(<Link key={key++} href={href} className="text-accent hover:text-accent-hover underline underline-offset-2">{linkText}</Link>);
      }
    }

    lastIndex = match.index + full.length;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length > 0 ? parts : [text];
}

function HeadingRenderer({ block }: { block: Extract<Block, { type: 'heading' }> }) {
  const Tag = `h${block.level}` as 'h1' | 'h2' | 'h3';
  const sizes = { 1: 'text-3xl', 2: 'text-2xl', 3: 'text-xl' };
  return <Tag className={cn(sizes[block.level], 'font-semibold')}>{block.text}</Tag>;
}

function ParagraphRenderer({ block }: { block: Extract<Block, { type: 'paragraph' }> }) {
  return <p className="leading-relaxed">{parseInlineMarkdown(block.text)}</p>;
}

function ImageRenderer({ block }: { block: Extract<Block, { type: 'image' }> }) {
  if (!block.src) return null;
  return (
    <figure className="flex flex-col gap-2">
      <img src={block.src} alt={block.alt || ''} className="rounded-lg max-w-full" />
      {block.caption && <figcaption className="text-sm text-text-muted text-center">{block.caption}</figcaption>}
    </figure>
  );
}

function CalloutRenderer({ block }: { block: Extract<Block, { type: 'callout' }> }) {
  const styles = {
    info: { bg: 'bg-blue-500/10', border: 'border-blue-500/30', icon: Info, iconColor: 'text-blue-400' },
    warning: { bg: 'bg-yellow-500/10', border: 'border-yellow-500/30', icon: AlertTriangle, iconColor: 'text-yellow-400' },
    success: { bg: 'bg-green-500/10', border: 'border-green-500/30', icon: CheckCircle, iconColor: 'text-green-400' },
    error: { bg: 'bg-red-500/10', border: 'border-red-500/30', icon: AlertCircle, iconColor: 'text-red-400' },
  };
  const style = styles[block.variant];
  const Icon = style.icon;

  return (
    <div className={cn('flex gap-3 p-4 rounded-lg border', style.bg, style.border)}>
      <Icon size={20} className={cn('shrink-0 mt-0.5', style.iconColor)} />
      <div className="flex flex-col gap-1">
        {block.title && <strong className="text-sm">{block.title}</strong>}
        <p className="text-sm">{parseInlineMarkdown(block.text)}</p>
      </div>
    </div>
  );
}

function DividerRenderer() {
  return <hr className="border-border-muted" />;
}

function CodeRenderer({ block }: { block: Extract<Block, { type: 'code' }> }) {
  return (
    <div className="relative">
      {block.language && (
        <span className="absolute top-2 right-2 text-xs text-text-muted">{block.language}</span>
      )}
      <pre className="bg-surface-1 border border-border-muted rounded-lg p-4 overflow-x-auto">
        <code className="text-sm font-mono">{block.code}</code>
      </pre>
    </div>
  );
}

function QuoteRenderer({ block }: { block: Extract<Block, { type: 'quote' }> }) {
  return (
    <blockquote className="border-l-4 border-accent pl-4 py-1">
      <p className="italic text-text-muted">{parseInlineMarkdown(block.text)}</p>
      {block.attribution && <cite className="text-sm text-text-muted mt-2 block">— {block.attribution}</cite>}
    </blockquote>
  );
}

function ListRenderer({ block }: { block: Extract<Block, { type: 'list' }> }) {
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
      {block.items.map((item, i) => (
        <li key={i}>{parseInlineMarkdown(item.text)}</li>
      ))}
    </Tag>
  );
}

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

  if (isLoading) {
    return (
      <div className="grid gap-3 animate-pulse">
        {[...Array(Math.min(block.limit, 3))].map((_, i) => (
          <div key={i} className="h-20 bg-surface-1 rounded-lg" />
        ))}
      </div>
    );
  }

  if (pages.length === 0) {
    return <p className="text-text-muted text-sm">No pages found.</p>;
  }

  return (
    <div className="grid gap-3">
      {pages.map((page) => {
        const tagSegments = page.tagPath.split('/');
        const leafTag = findTagByPath(tagSegments);
        return (
          <Link key={page.id} href={`/${page.tagPath}/${page.slug}`} className="group">
            <div className="flex items-start gap-3 p-3 bg-surface-1 rounded-lg border border-border-muted hover:border-border transition-colors">
              <FileText size={18} className="text-accent shrink-0 mt-0.5" />
              <div className="flex flex-col gap-1 min-w-0">
                <span className="font-medium group-hover:text-accent transition-colors truncate">{page.title}</span>
                {page.excerpt && <p className="text-sm text-text-muted line-clamp-1">{page.excerpt}</p>}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-text-muted flex items-center gap-1">
                    <Clock size={12} />
                    {formatRelativeTime(page.updatedAt)}
                  </span>
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

function PageListRenderer({ block }: { block: Extract<Block, { type: 'pageList' }> }) {
  const [pages, setPages] = useState<WikiPage[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (block.pageIds.length === 0) {
      setIsLoading(false);
      return;
    }

    (async () => {
      try {
        // Fetch each page - in production, create a batch endpoint
        const results = await Promise.all(
          block.pageIds.map(async (id) => {
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

  if (isLoading) {
    return <div className="h-20 bg-surface-1 rounded-lg animate-pulse" />;
  }

  if (pages.length === 0) {
    return <p className="text-text-muted text-sm">No pages selected.</p>;
  }

  return (
    <div className="grid gap-2">
      {pages.map((page) => (
        <Link key={page.id} href={`/${page.tagPath}/${page.slug}`} className="group flex items-center gap-2 p-2 rounded-md hover:bg-surface-1 transition-colors">
          <FileText size={16} className="text-accent" />
          <span className="group-hover:text-accent transition-colors">{page.title}</span>
        </Link>
      ))}
    </div>
  );
}

function EmbedRenderer({ block }: { block: Extract<Block, { type: 'embed' }> }) {
  if (!block.url) return null;

  const aspectRatios = { '16:9': 'aspect-video', '4:3': 'aspect-[4/3]', '1:1': 'aspect-square' };
  const aspectClass = aspectRatios[block.aspectRatio || '16:9'];

  // Handle YouTube URLs
  let embedUrl = block.url;
  const youtubeMatch = block.url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&]+)/);
  if (youtubeMatch) {
    embedUrl = `https://www.youtube.com/embed/${youtubeMatch[1]}`;
  }

  return (
    <div className={cn('w-full rounded-lg overflow-hidden bg-surface-1', aspectClass)}>
      <iframe src={embedUrl} className="w-full h-full border-0" allowFullScreen />
    </div>
  );
}

function SingleBlockRenderer({ block }: { block: Block }) {
  switch (block.type) {
    case 'heading': return <HeadingRenderer block={block} />;
    case 'paragraph': return <ParagraphRenderer block={block} />;
    case 'image': return <ImageRenderer block={block} />;
    case 'callout': return <CalloutRenderer block={block} />;
    case 'divider': return <DividerRenderer />;
    case 'code': return <CodeRenderer block={block} />;
    case 'quote': return <QuoteRenderer block={block} />;
    case 'list': return <ListRenderer block={block} />;
    case 'recentPages': return <RecentPagesRenderer block={block} />;
    case 'pageList': return <PageListRenderer block={block} />;
    case 'embed': return <EmbedRenderer block={block} />;
    default: return null;
  }
}

interface BlockRendererProps {
  content: BlockContent | unknown;
  className?: string;
}

export function BlockRenderer({ content, className }: BlockRendererProps) {
  if (!content || !Array.isArray(content)) {
    return null;
  }

  const blocks = content as BlockContent;

  return (
    <div className={cn('flex flex-col gap-4', className)}>
      {blocks.map((block) => (
        <SingleBlockRenderer key={block.id} block={block} />
      ))}
    </div>
  );
}

export default BlockRenderer;