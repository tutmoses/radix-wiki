// src/components/BlockRenderer.tsx - Lightweight view-only block renderer

'use client';

import { useState, useEffect, useRef, memo, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Clock, FileText } from 'lucide-react';
import { cn, formatRelativeTime, slugify } from '@/lib/utils';
import { getShiki, highlightCodeBlocks } from '@/lib/shiki';
import { findTagByPath } from '@/lib/tags';
import { usePages } from '@/hooks';
import { Badge } from '@/components/ui';
import type { WikiPage } from '@/types';
import type { Block, RecentPagesBlock, PageListBlock, AssetPriceBlock, ColumnsBlock } from '@/types/blocks';

export type { Block, BlockType, ContentBlock, RecentPagesBlock, PageListBlock, AssetPriceBlock, ColumnsBlock, Column, LeafBlock } from '@/types/blocks';

// ========== LAZY SHIKI HOOK ==========
function useLazyShiki(containerRef: React.RefObject<HTMLElement | null>, hasCodeBlocks: boolean) {
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !hasCodeBlocks) return;

    let observer: IntersectionObserver | null = null;
    let cancelled = false;

    observer = new IntersectionObserver((entries) => {
      if (entries.some(e => e.isIntersecting) && !cancelled) {
        observer?.disconnect();
        getShiki().then(highlighter => {
          if (!cancelled) highlightCodeBlocks(container, highlighter);
        });
      }
    }, { rootMargin: '200px' });

    const codeBlocks = container.querySelectorAll('pre:not([data-highlighted])');
    codeBlocks.forEach(el => observer?.observe(el));

    return () => { cancelled = true; observer?.disconnect(); };
  }, [hasCodeBlocks]);
}

// ========== UTILITIES ==========
function processHtml(html: string): string {
  if (!html.trim()) return html;
  const stripTags = (s: string) => s.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').trim();
  return html
    .replace(/<(h[1-4])([^>]*)>([\s\S]*?)<\/\1>/gi, (match, tag, attrs, content) => {
      if (attrs.includes(' id=')) return match;
      const text = stripTags(content);
      const id = slugify(text);
      return id ? `<${tag}${attrs} id="${id}">${content}</${tag}>` : match;
    })
    .replace(/<a\s+href="(https?:\/\/[^"]+)"([^>]*)>/gi, (match, href, rest) => {
      if (rest.includes('target=')) return match;
      return `<a href="${href}"${rest} target="_blank" rel="noopener noreferrer" class="link">`;
    })
    .replace(/<a\s+href="([^"]+)"([^>]*)>/gi, (match, href, rest) => {
      if (rest.includes('class=')) return match;
      return `<a href="${href}"${rest} class="link">`;
    });
}

function hasCodeBlocksInContent(content: Block[]): boolean {
  const check = (blocks: Block[]): boolean => {
    for (const block of blocks) {
      if (block.type === 'content' && block.text?.includes('<pre')) return true;
      if (block.type === 'columns') {
        for (const col of block.columns) if (check(col.blocks)) return true;
      }
    }
    return false;
  };
  return check(content);
}

// ========== PAGE CARD ==========
function PageCard({ page, compact }: { page: WikiPage; compact?: boolean }) {
  const leafTag = findTagByPath(page.tagPath.split('/'));
  const href = `/${page.tagPath}/${page.slug}`;
  
  if (compact) {
    return (
      <Link href={href} className="group row p-3 surface hover:bg-surface-2 transition-colors">
        {page.bannerImage ? (
          <Image src={page.bannerImage} alt="" width={32} height={32} className="rounded object-cover shrink-0" />
        ) : (
          <FileText size={16} className="text-accent shrink-0" />
        )}
        <span className="group-hover:text-accent transition-colors truncate">{page.title}</span>
      </Link>
    );
  }
  
  return (
    <Link href={href} className="group">
      <div className="surface-interactive h-full overflow-hidden">
        {page.bannerImage ? (
          <div className="aspect-4/1 overflow-hidden relative">
            <Image src={page.bannerImage} alt="" fill className="object-cover group-hover:scale-105 transition-transform duration-300" sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw" />
          </div>
        ) : (
          <div className="aspect-4/1 bg-surface-2 center"><FileText size={24} className="text-muted" /></div>
        )}
        <div className="stack-sm p-4">
          <span className="font-medium group-hover:text-accent transition-colors truncate">{page.title}</span>
          {page.excerpt && <p className="text-muted line-clamp-2 text-small">{page.excerpt}</p>}
          <div className="row flex-wrap mt-auto pt-1">
            <small className="row text-muted"><Clock size={12} />{formatRelativeTime(page.updatedAt)}</small>
            {leafTag && <Badge variant="secondary" className="truncate max-w-full">{leafTag.name}</Badge>}
          </div>
        </div>
      </div>
    </Link>
  );
}

// ========== BLOCK VIEW COMPONENTS ==========
function RecentPagesBlockView({ block }: { block: RecentPagesBlock }) {
  const { pages, isLoading } = usePages({ type: 'recent', tagPath: block.tagPath, limit: block.limit });
  if (isLoading) return <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">{Array.from({ length: Math.min(block.limit, 3) }, (_, i) => <div key={i} className="h-32 skeleton" />)}</div>;
  if (!pages.length) return <p className="text-muted">No pages found.</p>;
  return <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">{pages.map(p => <PageCard key={p.id} page={p} />)}</div>;
}

function PageListBlockView({ block }: { block: PageListBlock }) {
  const { pages, isLoading } = usePages({ type: 'byIds', pageIds: block.pageIds });
  if (isLoading) return <div className="row-md"><div className="flex-1 h-20 skeleton" /></div>;
  if (!pages.length) return <p className="text-muted">No pages selected.</p>;
  return <div className="row-md wrap">{pages.map(p => <PageCard key={p.id} page={p} compact />)}</div>;
}

function AssetPriceBlockView({ block }: { block: AssetPriceBlock }) {
  const { data, isLoading, error } = useResourcePrice(block.resourceAddress);
  if (!block.resourceAddress) return <p className="text-muted">No resource address configured</p>;
  if (isLoading) return <div className="surface p-4 animate-pulse"><div className="h-8 w-32 bg-surface-2 rounded" /></div>;
  if (error || !data || typeof data.price !== 'number') return <p className="text-error text-small">{error || 'Price unavailable'}</p>;
  const displayName = data.symbol || data.name || block.resourceAddress.slice(0, 20) + '...';
  const isPositive = (data.change24h ?? 0) >= 0;
  const priceStr = data.price < 0.01 ? data.price.toFixed(6) : data.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 });
  return (
    <div className="surface p-4 flex items-center gap-4">
      <div className="stack-xs">
        <span className="text-small text-muted">${displayName}</span>
        <span className="text-h3 font-semibold">${priceStr}</span>
      </div>
      {block.showChange && typeof data.change24h === 'number' && (
        <span className={cn('font-medium', isPositive ? 'text-success' : 'text-error')}>{isPositive ? '↑' : '↓'} {Math.abs(data.change24h).toFixed(2)}%</span>
      )}
    </div>
  );
}

function useResourcePrice(resourceAddress?: string) {
  const [data, setData] = useState<{ price: number; change24h?: number; symbol?: string; name?: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!resourceAddress) { setError('No resource address'); setIsLoading(false); return; }
    const fetchPrice = async () => {
      try {
        const res = await fetch(`https://api.ociswap.com/tokens/${resourceAddress}`);
        if (!res.ok) throw new Error('Token not found');
        const json = await res.json();
        const priceNow = parseFloat(json.price?.usd?.now) || 0;
        const price24h = parseFloat(json.price?.usd?.['24h']) || 0;
        setData({ price: priceNow, change24h: price24h > 0 ? ((priceNow - price24h) / price24h) * 100 : undefined, symbol: json.symbol, name: json.name });
        setError(priceNow === 0 ? 'Price unavailable' : null);
      } catch { setError('Price unavailable'); }
      finally { setIsLoading(false); }
    };
    setIsLoading(true);
    fetchPrice();
    const interval = setInterval(fetchPrice, 60000);
    return () => clearInterval(interval);
  }, [resourceAddress]);

  return { data, isLoading, error };
}

function ColumnsBlockView({ block }: { block: ColumnsBlock }) {
  const gapClass = { sm: 'gap-2', md: 'gap-4', lg: 'gap-6' }[block.gap || 'md'];
  const alignClass = { start: 'items-start', center: 'items-center', end: 'items-end', stretch: 'items-stretch' }[block.align || 'start'];
  return (
    <div className={cn('flex flex-col md:flex-row', gapClass, alignClass)}>
      {block.columns.map(col => (
        <div key={col.id} className="flex-1 stack">
          {col.blocks.map(bl => <div key={bl.id}>{renderBlockView(bl)}</div>)}
        </div>
      ))}
    </div>
  );
}

const ContentBlockView = memo(function ContentBlockView({ html }: { html: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const processedHtml = useMemo(() => processHtml(html), [html]);
  
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.querySelectorAll('[data-twitter-embed]:not([data-init])').forEach(container => {
      container.setAttribute('data-init', '');
      const tweetId = container.getAttribute('data-tweet-id');
      if (!tweetId) return;
      const iframe = container.querySelector('iframe');
      if (iframe) {
        iframe.src = `https://platform.twitter.com/embed/Tweet.html?id=${tweetId}&dnt=true`;
        iframe.style.width = '100%';
        iframe.style.height = '250px';
        iframe.style.border = 'none';
        iframe.setAttribute('scrolling', 'no');
      }
    });
    
    const handleMessage = (e: MessageEvent) => {
      if (e.origin === 'https://platform.twitter.com' && e.data?.['twttr.embed']?.method === 'twttr.private.resize') {
        const params = e.data['twttr.embed'].params;
        if (params?.[0]?.height) {
          el.querySelectorAll('[data-twitter-embed] iframe').forEach(iframe => {
            (iframe as HTMLIFrameElement).style.height = `${params[0].height}px`;
          });
        }
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [html]);
  
  return processedHtml.trim() ? <div ref={ref} className="prose-content" suppressHydrationWarning dangerouslySetInnerHTML={{ __html: processedHtml }} /> : null;
});

function renderBlockView(block: Block): React.ReactNode {
  switch (block.type) {
    case 'content': return <ContentBlockView html={block.text} />;
    case 'recentPages': return <RecentPagesBlockView block={block} />;
    case 'pageList': return <PageListBlockView block={block} />;
    case 'assetPrice': return <AssetPriceBlockView block={block} />;
    case 'columns': return <ColumnsBlockView block={block} />;
  }
}

// ========== MAIN COMPONENT ==========
export function BlockRenderer({ content, className }: { content: Block[] | unknown; className?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const blocks = (content && Array.isArray(content)) ? content as Block[] : [];
  const hasCode = hasCodeBlocksInContent(blocks);

  // Handle tabs - only runs once per tab group
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    container.querySelectorAll('[data-tabs]:not([data-tabs-init])').forEach(tabGroup => {
      const items = tabGroup.querySelectorAll('[data-tab-item]');
      if (!items.length) return;
      tabGroup.setAttribute('data-tabs-init', '');
      const tabList = document.createElement('div');
      tabList.className = 'tabs-list';
      const tabPanels = document.createElement('div');
      tabPanels.className = 'tabs-panels';
      items.forEach((item, i) => {
        const btn = document.createElement('button');
        btn.className = `tab-button${i === 0 ? ' active' : ''}`;
        btn.textContent = item.getAttribute('data-tab-title') || `Tab ${i + 1}`;
        btn.type = 'button';
        btn.onclick = () => {
          tabList.querySelectorAll('.tab-button').forEach(b => b.classList.remove('active'));
          tabPanels.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
          btn.classList.add('active');
          tabPanels.children[i]?.classList.add('active');
        };
        tabList.appendChild(btn);
        const panel = document.createElement('div');
        panel.className = `tab-panel${i === 0 ? ' active' : ''}`;
        panel.innerHTML = item.innerHTML;
        tabPanels.appendChild(panel);
      });
      tabGroup.innerHTML = '';
      tabGroup.appendChild(tabList);
      tabGroup.appendChild(tabPanels);
    });
  }, []);

  useLazyShiki(containerRef, hasCode);

  if (!blocks.length) return null;
  return (
    <div ref={containerRef} className={cn('stack', className)}>
      {blocks.map(block => <div key={block.id}>{renderBlockView(block)}</div>)}
    </div>
  );
}

export default BlockRenderer;