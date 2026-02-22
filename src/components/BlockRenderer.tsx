// src/components/BlockRenderer.tsx - Lightweight view-only block renderer

'use client';

import { useState, useEffect, useRef, memo, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Clock, FileText } from 'lucide-react';
import { cn, formatRelativeTime, slugify, generateBannerSvg } from '@/lib/utils';
import { findTagByPath } from '@/lib/tags';
import { usePages } from '@/hooks';
import { Badge } from '@/components/ui';
import type { WikiPage, PageMetadata } from '@/types';
import renderMathInElement from 'katex/contrib/auto-render';
import type { Block, RecentPagesBlock, PageListBlock, AssetPriceBlock, RssFeedBlock, ColumnsBlock, InfoboxBlock, AtomicBlock, ContentBlock, CodeTabsBlock } from '@/types/blocks';
import { getMetadataKeys, type MetadataKeyDefinition } from '@/lib/tags';

// ========== COPY BUTTON ==========
const COPY_SVG = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
const CHECK_SVG = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';

function addCopyButton(pre: Element) {
  const btn = document.createElement('button');
  btn.className = 'code-copy-btn';
  btn.setAttribute('aria-label', 'Copy code');
  btn.innerHTML = COPY_SVG;
  btn.onclick = () => {
    const code = pre.querySelector('code')?.textContent || pre.textContent || '';
    navigator.clipboard.writeText(code).then(() => {
      btn.innerHTML = CHECK_SVG;
      setTimeout(() => { btn.innerHTML = COPY_SVG; }, 2000);
    });
  };
  (pre as HTMLElement).style.position = 'relative';
  pre.appendChild(btn);
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
    .replace(/<a\s+href="(https?:\/\/[^"]+)"([^>]*)>/gi, (match, href, rest) => rest.includes('target=') ? match : `<a href="${href}"${rest} target="_blank" rel="noopener noreferrer" class="link">`)
    .replace(/<a\s+href="([^"]+)"([^>]*)>/gi, (match, href, rest) => rest.includes('class=') ? match : `<a href="${href}"${rest} class="link">`);
}

// ========== PAGE CARD ==========
const PageCard = memo(function PageCard({ page, compact }: { page: WikiPage; compact?: boolean }) {
  const leafTag = findTagByPath(page.tagPath.split('/'));
  const href = `/${page.tagPath}/${page.slug}`;

  if (compact) {
    return (
      <Link href={href} className="page-card-compact">
        {page.bannerImage ? <Image src={page.bannerImage} alt="" width={32} height={32} className="rounded object-cover shrink-0" /> : <FileText size={16} className="text-accent shrink-0" />}
        <span className="group-hover:text-accent transition-colors truncate">{page.title}</span>
      </Link>
    );
  }

  return (
    <Link href={href} className="group">
      <div className="page-card">
        <div className="page-card-thumb">
          {page.bannerImage ? (
            <Image src={page.bannerImage} alt="" fill className="object-cover group-hover:scale-105 transition-transform duration-300" sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw" />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={generateBannerSvg(page.title, page.tagPath)} alt="" className="w-full h-full object-cover" />
          )}
        </div>
        <div className="page-card-body">
          <span className="page-card-title">{page.title}</span>
          {page.excerpt && <p className="page-card-excerpt">{page.excerpt}</p>}
          <div className="page-card-meta">
            <small className="row text-muted"><Clock size={12} />{formatRelativeTime(page.updatedAt)}</small>
            {leafTag && <Badge variant="secondary" className="truncate max-w-full">{leafTag.name}</Badge>}
          </div>
        </div>
      </div>
    </Link>
  );
});

// ========== BLOCK VIEW COMPONENTS ==========
function RecentPagesBlockView({ block }: { block: RecentPagesBlock }) {
  const { pages, isLoading } = usePages({ type: 'recent', tagPath: block.tagPath, limit: block.limit });
  if (isLoading) return <div className="recent-pages-grid">{Array.from({ length: Math.min(block.limit, 3) }, (_, i) => <div key={i} className="h-32 skeleton" />)}</div>;
  if (!pages.length) return <p className="text-muted">No pages found.</p>;
  return <div className="recent-pages-grid">{pages.map(p => <PageCard key={p.id} page={p} />)}</div>;
}

function PageListBlockView({ block }: { block: PageListBlock }) {
  const { pages, isLoading } = usePages({ type: 'byIds', pageIds: block.pageIds });
  if (isLoading) return <div className="row-md"><div className="flex-1 h-20 skeleton" /></div>;
  if (!pages.length) return <p className="text-muted">No pages selected.</p>;
  return <div className="row-md wrap">{pages.map(p => <PageCard key={p.id} page={p} compact />)}</div>;
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

function AssetPriceBlockView({ block }: { block: AssetPriceBlock }) {
  const { data, isLoading, error } = useResourcePrice(block.resourceAddress);
  if (!block.resourceAddress) return <p className="text-muted">No resource address configured</p>;
  if (isLoading) return <div className="surface p-4 animate-pulse"><div className="h-8 w-32 bg-surface-2 rounded" /></div>;
  if (error || !data || typeof data.price !== 'number') return <p className="text-error text-small">{error || 'Price unavailable'}</p>;
  const displayName = data.symbol || data.name || block.resourceAddress.slice(0, 20) + '...';
  const isPositive = (data.change24h ?? 0) >= 0;
  const priceStr = data.price < 0.01 ? data.price.toFixed(6) : data.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 });
  return (
    <div className="asset-price">
      <div className="stack-xs">
        <span className="text-small text-muted">${displayName}</span>
        <span className="text-h3 font-semibold">${priceStr}</span>
      </div>
      {block.showChange && typeof data.change24h === 'number' && <span className={cn('font-medium', isPositive ? 'text-success' : 'text-error')}>{isPositive ? '↑' : '↓'} {Math.abs(data.change24h).toFixed(2)}%</span>}
    </div>
  );
}

interface RssFeedItem { title: string; link: string; image?: string; source: string; date?: string; description?: string; }

function RssFeedBlockView({ block }: { block: RssFeedBlock }) {
  const [items, setItems] = useState<RssFeedItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch(block.url)
      .then(r => r.json())
      .then(data => setItems(data.items || []))
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, [block.url]);

  if (isLoading) return <div className="rss-feed-scroll"><div className="stack-sm">{Array.from({ length: 3 }, (_, i) => <div key={i} className="h-[280px] skeleton rounded-md" />)}</div></div>;
  if (!items.length) return <p className="text-text-muted">No feed items found.</p>;

  return (
    <div className="rss-feed-scroll">
      <div className="stack-sm">
        {items.slice(0, block.limit || 15).map((item, i) => (
          <div key={i} className="rss-card">
            {item.image && (
              <div className="rss-card-image">
                <img src={item.image} alt="" className="absolute inset-0 w-full h-full object-cover" />
              </div>
            )}
            <div className="rss-card-body">
              <div className="rss-card-title"><a href={item.link} target="_blank" rel="noopener noreferrer">{item.title}</a></div>
              <div className="rss-card-meta">
                <span className="rss-card-source">{item.source}</span>
                {item.date && <>{' · '}{new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</>}
              </div>
              {item.description && <div className="rss-card-desc">{item.description}...</div>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CodeTabsBlockView({ block }: { block: CodeTabsBlock }) {
  const [activeTab, setActiveTab] = useState(0);

  return (
    <div className="code-tabs">
      <div className="code-tabs-list">
        {block.tabs.map((tab, i) => (
          <button key={i} className={cn('code-tabs-btn', i === activeTab && 'code-tabs-btn-active')} onClick={() => setActiveTab(i)}>{tab.label}</button>
        ))}
      </div>
      {block.tabs.map((tab, i) => (
        <div key={i} className={i === activeTab ? 'block' : 'hidden'} dangerouslySetInnerHTML={{ __html: tab.code }} />
      ))}
    </div>
  );
}

function ColumnsBlockView({ block }: { block: ColumnsBlock }) {
  const gapClass = { sm: 'gap-2', md: 'gap-4', lg: 'gap-6' }[block.gap || 'md'];
  const alignClass = { start: 'items-start', center: 'items-center', end: 'items-end', stretch: 'items-stretch' }[block.align || 'start'];
  return (
    <div className={cn('columns-layout', gapClass, alignClass)}>
      {block.columns.map(col => (
        <div key={col.id} className="column-view">
          {(col.blocks || []).map(bl => <div key={bl.id}>{renderBlockView(bl)}</div>)}
        </div>
      ))}
    </div>
  );
}

function linkify(v: string): string {
  const href = /^https?:\/\//.test(v) ? v : `https://${v}`;
  return `<a href="${href}" target="_blank" rel="noopener noreferrer" class="link break-all">${v.replace(/^https?:\/\/(www\.)?/, '')}</a>`;
}

function formatMetadataValue(value: string, type: string): string {
  if (type === 'date') {
    const d = new Date(value);
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }
  const isUrl = (v: string) => type === 'url' || /^https?:\/\//.test(v) || /^[^\s]+\.[a-z]{2,}(\/\S*)?$/i.test(v);
  if (/<br\s*\/?>/.test(value)) {
    return value.split(/<br\s*\/?>/).map(part => {
      const trimmed = part.trim();
      return trimmed ? (isUrl(trimmed) ? linkify(trimmed) : trimmed) : '';
    }).join('<br>');
  }
  if (isUrl(value)) return linkify(value);
  return value;
}

function buildMetadataBlock(metadata: PageMetadata, tagPath: string): ContentBlock | null {
  const keys = getMetadataKeys(tagPath.split('/'));
  if (!keys.length || !metadata) return null;
  const entries = keys.filter(k => metadata[k.key]?.trim());
  if (!entries.length) return null;
  const rows = entries.map(({ key, label, type }) =>
    `<tr><th>${label}</th><td>${formatMetadataValue(metadata[key], type)}</td></tr>`
  ).join('');
  return { id: '__metadata__', type: 'content', text: `<table>${rows}</table>` };
}

export function InfoboxSidebar({ block, metadata, tagPath }: { block: InfoboxBlock; metadata?: PageMetadata | null; tagPath?: string }) {
  const metaBlock = metadata && tagPath ? buildMetadataBlock(metadata, tagPath) : null;
  return (
    <aside className="infobox stack">
      {metaBlock && <div className="infobox-metadata">{renderBlockView(metaBlock)}</div>}
      {(block.blocks || []).map(b => <div key={b.id}>{renderBlockView(b)}</div>)}
    </aside>
  );
}

function InfoboxBlockView({ block }: { block: InfoboxBlock }) {
  return (
    <>
      {(block.blocks || []).map(b => <div key={b.id}>{renderBlockView(b)}</div>)}
    </>
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
      const iframe = container.querySelector('iframe') as HTMLIFrameElement | null;
      if (iframe) { iframe.src = `https://platform.twitter.com/embed/Tweet.html?id=${tweetId}&dnt=true`; iframe.setAttribute('scrolling', 'no'); }
    });
    const handleMessage = (e: MessageEvent) => {
      if (e.origin !== 'https://platform.twitter.com') return;
      const data = e.data?.['twttr.embed'];
      if (data?.method === 'twttr.private.resize' && data.params?.[0]?.height) {
        el.querySelectorAll('[data-twitter-embed] iframe').forEach(iframe => { (iframe as HTMLIFrameElement).style.height = `${data.params[0].height}px`; });
      }
    };
    window.addEventListener('message', handleMessage);

    renderMathInElement(el, {
      delimiters: [
        { left: '$$', right: '$$', display: true },
        { left: '$', right: '$', display: false },
        { left: '\\(', right: '\\)', display: false },
        { left: '\\[', right: '\\]', display: true },
      ],
      throwOnError: false,
    });

    return () => window.removeEventListener('message', handleMessage);
  }, [html]);

  return processedHtml.trim() ? <div ref={ref} className="prose-content" suppressHydrationWarning dangerouslySetInnerHTML={{ __html: processedHtml }} /> : null;
});

function renderBlockView(block: Block | AtomicBlock): React.ReactNode {
  switch (block.type) {
    case 'content': return <ContentBlockView html={block.text} />;
    case 'recentPages': return <RecentPagesBlockView block={block} />;
    case 'pageList': return <PageListBlockView block={block} />;
    case 'assetPrice': return <AssetPriceBlockView block={block} />;
    case 'rssFeed': return <RssFeedBlockView block={block} />;
    case 'codeTabs': return <CodeTabsBlockView block={block} />;
    case 'columns': return <ColumnsBlockView block={block} />;
    case 'infobox': return <InfoboxBlockView block={block} />;
  }
}

// ========== UTILITIES ==========
export function findInfobox(blocks: Block[]): InfoboxBlock | null {
  for (const block of blocks) {
    if (block.type === 'infobox') return block;
  }
  return null;
}


// ========== MAIN COMPONENT ==========
export function BlockRenderer({ content, className }: { content: Block[] | unknown; className?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const blocks = (content && Array.isArray(content)) ? content as Block[] : [];

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
    // Add copy buttons to highlighted code blocks
    container.querySelectorAll('pre:not(:has(.code-copy-btn))').forEach(addCopyButton);
  }, []);

  if (!blocks.length) return null;

  return (
    <div ref={containerRef} className={cn('stack', className)}>
      {blocks.map(block => <div key={block.id}>{renderBlockView(block)}</div>)}
    </div>
  );
}

export default BlockRenderer;
