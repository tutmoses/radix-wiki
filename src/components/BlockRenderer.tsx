// src/components/BlockRenderer.tsx - Lightweight view-only block renderer

'use client';

import { useState, useEffect, useRef, memo, useMemo, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Clock, FileText, User } from 'lucide-react';
import { cn, formatRelativeTime, formatDate, slugify, generateBannerSvg } from '@/lib/utils';
import { findTagByPath } from '@/lib/tags';
import { usePages, useFetch } from '@/hooks';
import { Badge } from '@/components/ui';
import { UserAvatar } from '@/components/UserAvatar';
import type { WikiPage, PageMetadata } from '@/types';
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
    .replace(/<a\s+href="(https?:\/\/[^"]+)"([^>]*)>/gi, (match, href, rest) => rest.includes('target=') ? match : `<a href="${href}"${rest} target="_blank" rel="noopener noreferrer">`);
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
            <Image src={generateBannerSvg(page.title, page.tagPath)} alt="" fill className="object-cover" unoptimized />
          )}
        </div>
        <div className="page-card-body">
          <span className="page-card-title">{page.title}</span>
          {page.excerpt && <p className="page-card-excerpt">{page.excerpt}</p>}
          <div className="page-card-meta">
            <small className="row text-text-muted"><Clock size={12} />{formatRelativeTime(page.updatedAt)}</small>
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
  const display = pages.length ? pages : block.resolvedPages || [];
  if (isLoading && !display.length) return <div className="recent-pages-grid">{Array.from({ length: Math.min(block.limit, 3) }, (_, i) => <div key={i} className="h-32 skeleton" />)}</div>;
  if (!display.length) return <p className="text-text-muted">No pages found.</p>;
  return <div className="recent-pages-grid">{display.map((p: any) => <PageCard key={p.id} page={p} />)}</div>;
}

function PageListFetcher({ block }: { block: PageListBlock }) {
  const { pages, isLoading } = usePages({ type: 'byIds', pageIds: block.pageIds });
  if (isLoading) return <div className="row-md"><div className="flex-1 h-20 skeleton" /></div>;
  if (!pages.length) return <p className="text-text-muted">No pages selected.</p>;
  return <div className="row-md wrap">{pages.map(p => <PageCard key={p.id} page={p} compact />)}</div>;
}

function PageListBlockView({ block }: { block: PageListBlock }) {
  if (!block.resolvedPages) return <PageListFetcher block={block} />;
  const pages = block.resolvedPages;
  if (!pages.length) return <p className="text-text-muted">No pages selected.</p>;
  return <div className="row-md wrap">{pages.map((p: any) => <PageCard key={p.id} page={p} compact />)}</div>;
}

type PriceData = { price: number; change24h?: number; symbol?: string; name?: string };

function transformPrice(json: any): PriceData {
  const priceNow = parseFloat(json.price?.usd?.now) || 0;
  const price24h = parseFloat(json.price?.usd?.['24h']) || 0;
  return { price: priceNow, change24h: price24h > 0 ? ((priceNow - price24h) / price24h) * 100 : undefined, symbol: json.symbol, name: json.name };
}

function useResourcePrice(resourceAddress?: string) {
  return useFetch<PriceData>(
    resourceAddress ? `https://api.ociswap.com/tokens/${resourceAddress}` : null,
    { transform: transformPrice, interval: 60000 },
  );
}

// ========== TOKEN CHART ==========

const TIMEFRAME_CONFIG: Record<string, { resolution: string; seconds: number; countback: number }> = {
  '24h': { resolution: '60', seconds: 86400, countback: 24 },
  '7d': { resolution: '240', seconds: 604800, countback: 42 },
  '30d': { resolution: '1D', seconds: 2592000, countback: 30 },
};
const TIMEFRAMES = ['24h', '7d', '30d'] as const;
const TIMEFRAME_LABELS: Record<string, string> = { '24h': '24H', '7d': '7D', '30d': '30D' };

type ChartPoint = { time: number; value: number };

function useChartData(resourceAddress?: string, timeframe: string = '7d') {
  const [data, setData] = useState<ChartPoint[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!resourceAddress) return;
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    const cfg = TIMEFRAME_CONFIG[timeframe] || TIMEFRAME_CONFIG['7d'];
    const now = Math.floor(Date.now() / 1000);
    const from = now - cfg.seconds;
    const url = `https://api.ociswap.com/udf/history?symbol=${resourceAddress}&resolution=${cfg.resolution}&from=${from}&to=${now}&countback=${cfg.countback}&currencyCode=USD`;

    fetch(url)
      .then(r => { if (!r.ok) throw new Error(r.statusText); return r.json(); })
      .then(json => {
        if (cancelled) return;
        if (json.s !== 'ok' || !Array.isArray(json.t)) { setError('No chart data'); return; }
        const points: ChartPoint[] = json.t.map((t: number, i: number) => ({ time: t, value: parseFloat(json.c[i]) || 0 }));
        setData(points);
      })
      .catch(e => { if (!cancelled) setError(e.message); })
      .finally(() => { if (!cancelled) setIsLoading(false); });

    return () => { cancelled = true; };
  }, [resourceAddress, timeframe]);

  return { data, isLoading, error };
}

function TokenChart({ resourceAddress, defaultTimeframe = '7d' }: { resourceAddress: string; defaultTimeframe?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<any>(null);
  const seriesRef = useRef<any>(null);
  const [timeframe, setTimeframe] = useState(defaultTimeframe);
  const [chartReady, setChartReady] = useState(false);
  const { data, isLoading, error } = useChartData(resourceAddress, timeframe);

  useEffect(() => {
    if (!containerRef.current) return;
    let disposed = false;

    import('lightweight-charts').then(({ createChart, AreaSeries, ColorType, LineType, CrosshairMode }) => {
      if (disposed || !containerRef.current) return;

      const chart = createChart(containerRef.current, {
        layout: { background: { type: ColorType.Solid, color: 'transparent' }, textColor: '#8b8fa3', fontFamily: 'inherit', fontSize: 11 },
        grid: { vertLines: { color: 'rgba(139, 143, 163, 0.1)' }, horzLines: { color: 'rgba(139, 143, 163, 0.1)' } },
        crosshair: { mode: CrosshairMode.Magnet, vertLine: { color: 'rgba(255, 157, 160, 0.4)', width: 1, style: 3 }, horzLine: { color: 'rgba(255, 157, 160, 0.4)', width: 1, style: 3 } },
        rightPriceScale: { visible: false },
        timeScale: { borderVisible: false, timeVisible: true, secondsVisible: false },
        handleScroll: false,
        handleScale: false,
        width: containerRef.current.clientWidth,
        height: 260,
      });

      const series = chart.addSeries(AreaSeries, {
        lineColor: '#ff9da0',
        topColor: 'rgba(255, 157, 160, 0.4)',
        bottomColor: 'rgba(255, 157, 160, 0.02)',
        lineWidth: 2,
        lineType: LineType.Curved,
        crosshairMarkerBackgroundColor: '#ff9da0',
        crosshairMarkerBorderColor: '#ff9da0',
        priceFormat: { type: 'price', minMove: 0.000001, precision: 6 },
      });

      chartRef.current = chart;
      seriesRef.current = series;
      setChartReady(true);

      const ro = new ResizeObserver(entries => {
        const w = entries[0]?.contentRect?.width;
        if (w && chart) chart.applyOptions({ width: w });
      });
      ro.observe(containerRef.current);

      return () => { ro.disconnect(); };
    });

    return () => { disposed = true; chartRef.current?.remove(); chartRef.current = null; seriesRef.current = null; setChartReady(false); };
  }, []);

  useEffect(() => {
    if (!chartReady || !seriesRef.current || !data?.length) return;
    seriesRef.current.setData(data);
    chartRef.current?.timeScale().fitContent();
  }, [data, chartReady]);

  return (
    <div className="asset-chart">
      <div className="asset-chart-controls">
        {TIMEFRAMES.map(tf => (
          <button key={tf} onClick={() => setTimeframe(tf)} className={cn('toggle-option', timeframe === tf && 'toggle-option-active')}>
            {TIMEFRAME_LABELS[tf]}
          </button>
        ))}
      </div>
      <div ref={containerRef} className="asset-chart-container">
        {isLoading && !chartReady && <div className="h-[260px] skeleton rounded" />}
        {error && <p className="text-error text-small p-4">{error}</p>}
      </div>
    </div>
  );
}

function AssetPriceBlockView({ block }: { block: AssetPriceBlock }) {
  const { data, isLoading, error } = useResourcePrice(block.resourceAddress);
  if (!block.resourceAddress) return <p className="text-text-muted">No resource address configured</p>;
  if (isLoading) return <div className="surface p-4 animate-pulse"><div className="h-8 w-32 bg-surface-2 rounded" /></div>;
  if (error || !data || typeof data.price !== 'number') return <p className="text-error text-small">{error || 'Price unavailable'}</p>;
  const displayName = data.symbol || data.name || block.resourceAddress.slice(0, 20) + '...';
  const isPositive = (data.change24h ?? 0) >= 0;
  const priceStr = data.price < 0.01 ? data.price.toFixed(6) : data.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 });
  return (
    <div className="stack-sm">
      <div className="asset-price">
        <div className="stack-xs">
          <span className="text-small text-text-muted">${displayName}</span>
          <span className="text-h3 font-semibold">${priceStr}</span>
        </div>
        {block.showChange && typeof data.change24h === 'number' && <span className={cn('font-medium', isPositive ? 'text-success' : 'text-error')}>{isPositive ? '↑' : '↓'} {Math.abs(data.change24h).toFixed(2)}%</span>}
      </div>
      {block.showChart && <TokenChart resourceAddress={block.resourceAddress!} defaultTimeframe={block.chartTimeframe || '7d'} />}
    </div>
  );
}

interface RssFeedItem { title: string; link: string; image?: string; source: string; date?: string; description?: string; }

function RssFeedBlockView({ block }: { block: RssFeedBlock }) {
  const { data, isLoading } = useFetch<RssFeedItem[]>(block.url, { transform: d => d.items || [] });
  const items = data || [];

  if (isLoading) return <div className="rss-feed-scroll"><div className="stack-sm">{Array.from({ length: 3 }, (_, i) => <div key={i} className="h-[280px] skeleton rounded-md" />)}</div></div>;
  if (!items.length) return <p className="text-text-muted">No feed items found.</p>;

  return (
    <div className="rss-feed-scroll">
      <div className="stack-sm">
        {items.slice(0, block.limit || 15).map((item, i) => (
          <div key={i} className="rss-card">
            {item.image && (
              <div className="rss-card-image">
                <Image src={item.image} alt="" fill className="object-cover" unoptimized />
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

interface InfoboxPageInfo {
  author?: { displayName?: string | null; radixAddress: string; avatarUrl?: string | null } | null;
  updatedAt: string | Date;
  createdAt: string | Date;
  revisionCount?: number;
}

export function InfoboxSidebar({ block, metadata, tagPath, pageInfo }: { block: InfoboxBlock; metadata?: PageMetadata | null; tagPath?: string; pageInfo?: InfoboxPageInfo | null }) {
  const metaBlock = metadata && tagPath ? buildMetadataBlock(metadata, tagPath) : null;
  return (
    <aside className="infobox stack">
      {pageInfo && (
        <div className="infobox-page-info">
          {pageInfo.author && (
            <div className="row">
              <UserAvatar radixAddress={pageInfo.author.radixAddress} avatarUrl={pageInfo.author.avatarUrl} size="sm" />
              <span className="text-text-muted">Author:</span>
              <span className="truncate">{pageInfo.author.displayName || pageInfo.author.radixAddress.slice(0, 16)}...</span>
            </div>
          )}
          <div className="row">
            <Clock size={14} className="text-text-muted shrink-0" />
            <span className="text-text-muted">Updated:</span>
            <span>{formatRelativeTime(pageInfo.updatedAt)}</span>
          </div>
          <div className="row">
            <Clock size={14} className="text-text-muted shrink-0" />
            <span className="text-text-muted">Created:</span>
            <span>{formatDate(pageInfo.createdAt)}</span>
          </div>
          {(pageInfo.revisionCount ?? 0) > 0 && (
            <div className="row">
              <FileText size={14} className="text-text-muted shrink-0" />
              <span className="text-text-muted">Revisions:</span>
              <span>{pageInfo.revisionCount}</span>
            </div>
          )}
        </div>
      )}
      {metaBlock && <div>{renderBlockView(metaBlock)}</div>}
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

    if (/\$\$|\\\(|\\\[/.test(html)) {
      // @ts-expect-error -- CSS module import has no types
      import('katex/dist/katex.min.css').then(() => import('katex/contrib/auto-render')).then(({ default: render }) => {
        render(el, {
          delimiters: [
            { left: '$$', right: '$$', display: true },
            { left: '$', right: '$', display: false },
            { left: '\\(', right: '\\)', display: false },
            { left: '\\[', right: '\\]', display: true },
          ],
          throwOnError: false,
        });
      });
    }

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
