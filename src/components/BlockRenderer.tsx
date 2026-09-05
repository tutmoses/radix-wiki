// src/components/BlockRenderer.tsx - Lightweight view-only block renderer

'use client';

import { useState, useEffect, useRef, memo, useMemo, Fragment } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Clock, FileText, Copy, Check, AlertTriangle, Megaphone, CalendarClock, type LucideIcon } from 'lucide-react';
import { cn, formatRelativeTime, generateBannerSvg, getContentSnippet, pagePath } from '@/lib/utils';
import { findTagByPath } from '@/lib/tags';
import { safeLinkHref } from 'wiki-formant/validation';
// The rendered-article passes are `wiki-formant/dom`, shared with caper. The
// copy-button injector there was byte-identical to the one this file held, down
// to the SVG path data, and the Twitter origin was written out here as well as
// twice more in the editor's node views.
import { activateTabGroups, addCopyButtons, hydrateTweetEmbeds, onTweetResize, sizeTweetEmbeds } from 'wiki-formant/dom';
import { processHtml } from '@/lib/html';
import { useAccountQr, useFetch } from '@/hooks';
import { Badge } from '@/components/ui';
import type { WikiPage, PageMetadata } from '@/types';
import type { Block, RecentPagesBlock, PageListBlock, AssetPriceBlock, RssFeedBlock, ColumnsBlock, InfoboxBlock, AtomicBlock, ContentBlock, CodeTabsBlock, LinkGridBlock, TipJarBlock, ReferencesBlock, BannerBlock, BannerVariant, StatsBlock, TestimonialBlock } from '@/types/blocks';
import { getMetadataKeys } from '@/lib/tags';
import { metadataRows } from '@/lib/taxonomy';
import { TokenChart } from '@/components/charts/TokenChart';
import { formatPriceSubscript } from '@/components/charts/format';
import { useCopy } from 'wiki-formant/react';

// ========== PAGE CARD ==========
const PageCard = memo(function PageCard({ page, compact }: { page: WikiPage; compact?: boolean }) {
  const leafTag = findTagByPath(page.tagPath.split('/'));
  const href = pagePath(page.tagPath, page.slug);

  if (compact) {
    return (
      <Link href={href} className="page-card-compact">
        {page.bannerImage ? <Image src={page.bannerImage} alt={page.title} width={32} height={32} className="rounded object-cover shrink-0" /> : <FileText size={16} className="text-accent shrink-0" />}
        <span className="group-hover:text-accent transition-colors truncate">{page.title}</span>
      </Link>
    );
  }

  return (
    <Link href={href} className="group">
      <div className="page-card">
        <div className="page-card-thumb">
          {page.bannerImage ? (
            <Image src={page.bannerImage} alt={page.title} fill className="object-cover group-hover:scale-105 transition-transform duration-300" sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw" />
          ) : (
            <Image src={generateBannerSvg(page.title, page.tagPath)} alt={page.title} fill className="object-cover" unoptimized />
          )}
        </div>
        <div className="page-card-body">
          <span className="page-card-title">{page.title}</span>
          {(() => { const snippet = page.snippet ?? getContentSnippet(page.content); return snippet && <p className="page-card-snippet">{snippet}</p>; })()}
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
  const params = new URLSearchParams({ pageSize: String(block.limit) });
  if (block.tagPath) params.set('tagPath', block.tagPath);
  params.set('sort', 'updatedAt');
  const { data, isLoading } = useFetch<WikiPage[]>(`/api/wiki?${params}`, { transform: d => d.items || [] });
  const display = data?.length ? data : block.resolvedPages || [];
  if (isLoading && !display.length) return <div className="recent-pages-grid">{Array.from({ length: Math.min(block.limit, 3) }, (_, i) => <div key={i} className="h-32 skeleton" />)}</div>;
  if (!display.length) return <p className="text-text-muted">No pages found.</p>;
  return <div className="recent-pages-grid">{display.map(p => <PageCard key={p.id} page={p} />)}</div>;
}

function PageListBlockView({ block }: { block: PageListBlock }) {
  // A server-resolved list never fetches, and `useFetch(null)` reports isLoading
  // false — so the skeleton below cannot flash over a list that already exists.
  const { data, isLoading } = useFetch<WikiPage[]>(
    block.resolvedPages || !block.pageIds.length ? null : `/api/wiki?ids=${block.pageIds.join(',')}`,
  );
  const pages = block.resolvedPages || data || [];
  if (isLoading) return <div className="row-md"><div className="flex-1 h-20 skeleton" /></div>;
  if (!pages.length) return <p className="text-text-muted">No pages selected.</p>;
  return <div className="row-md flex-wrap">{pages.map(p => <PageCard key={p.id} page={p} compact />)}</div>;
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

function AssetPriceBlockView({ block }: { block: AssetPriceBlock }) {
  const { data, isLoading, error } = useResourcePrice(block.resourceAddress);
  if (!block.resourceAddress) return <p className="text-text-muted">No resource address configured</p>;
  if (isLoading) return <div className="surface p-4 animate-pulse"><div className="h-8 w-32 bg-surface-2 rounded" /></div>;
  if (error || !data || typeof data.price !== 'number') return <p className="text-error text-small">{error || 'Price unavailable'}</p>;
  const displayName = data.symbol || data.name || block.resourceAddress.slice(0, 20) + '...';
  const isPositive = (data.change24h ?? 0) >= 0;
  const priceStr = formatPriceSubscript(data.price);
  return (
    <div className="stack-sm">
      <div className="asset-price">
        <div className="stack-xs">
          <span className="text-small text-text-muted">${displayName}</span>
          <span className="text-h3 font-semibold">${priceStr}</span>
        </div>
        {block.showChange && typeof data.change24h === 'number' && <span className={cn('font-medium', isPositive ? 'text-success' : 'text-error')}>{isPositive ? '↑' : '↓'} {Math.abs(data.change24h).toFixed(2)}%</span>}
      </div>
      {block.showChart && <TokenChart resourceAddress={block.resourceAddress!} defaultTimeframe={block.chartTimeframe || '30d'} />}
      <Link href={`/charts/tokens/${block.resourceAddress}`} className="charts-section-link">View full chart →</Link>
    </div>
  );
}

interface RssFeedItem { title: string; link: string; image?: string; source: string; date?: string; description?: string; }

function RssFeedBlockView({ block }: { block: RssFeedBlock }) {
  // Prefer items pre-resolved server-side (rendered as static HTML, no client hydration
  // needed); fall back to a client fetch for editor/preview where they aren't resolved.
  const preResolved = block.resolvedItems as RssFeedItem[] | undefined;
  const { data, isLoading } = useFetch<RssFeedItem[]>(preResolved ? null : block.url, { transform: d => d.items || [] });
  const items = preResolved || data || [];

  if (!preResolved && isLoading) return <div className="rss-feed"><div className="rss-feed-scroll"><div className="stack-sm">{Array.from({ length: 3 }, (_, i) => <div key={i} className="h-[280px] skeleton rounded-md" />)}</div></div></div>;
  if (!items.length) return <p className="text-text-muted">No feed items found.</p>;

  // Wrapper is the fill target: beside a taller sibling column it stretches, and the
  // absolutely-positioned scroller inside keeps the feed's own length out of the layout.
  return (
    <div className="rss-feed">
      <div className="rss-feed-scroll">
        <div className="stack-sm">
          {items.slice(0, block.limit || 15).map((item, i) => (
            <div key={i} className="rss-card">
              {item.image && (
                <div className="rss-card-image">
                  <Image src={item.image} alt={item.title} fill className="object-cover" unoptimized />
                </div>
              )}
              <div className="rss-card-body">
                <div className="rss-card-title"><a href={item.link} target="_blank" rel="noopener">{item.title}</a></div>
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
          {(col.blocks || []).map(bl => <Fragment key={bl.id}>{renderBlockView(bl)}</Fragment>)}
        </div>
      ))}
    </div>
  );
}

function linkify(v: string): string {
  const href = /^https?:\/\//.test(v) ? v : `https://${v}`;
  return `<a href="${href}" target="_blank" rel="noopener" class="link break-all">${v.replace(/^https?:\/\/(www\.)?/, '')}</a>`;
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

// Which keys appear, in what order, and which of them link is `metadataRows` —
// the shared derivation, so this table and caper's cannot drift apart again. A
// row carries an `href` exactly when its key is a facet the category view
// already filters and counts, which is what makes the row the way into that set
// (Wikipedia's linked infobox fields) off the one URL contract every facet chip
// is built from. `resource_address` keys are dropped here rather than there:
// they are not a table row on this wiki at all, they are the AssetPrice widgets
// above the table.
function buildMetadataBlock(metadata: PageMetadata, tagPath: string): ContentBlock | null {
  if (!metadata) return null;
  const rows = metadataRows(tagPath, { metadata })
    .filter(row => row.type !== 'resource_address')
    .map(row => {
      const cell = row.href
        ? `<a href="${row.href}" class="link">${row.value}</a>`
        : formatMetadataValue(row.value, row.type);
      return `<tr><th>${row.label}</th><td>${cell}</td></tr>`;
    }).join('');
  return rows ? { id: '__metadata__', type: 'content', text: `<table>${rows}</table>` } : null;
}

function getResourceAddressEntries(metadata: PageMetadata, tagPath: string): { key: string; label: string; value: string }[] {
  const keys = getMetadataKeys(tagPath.split('/'));
  return keys.filter(k => k.type === 'resource_address' && metadata[k.key]?.trim()).map(k => ({ key: k.key, label: k.label, value: metadata[k.key]! }));
}

/** Whether the infobox aside would render anything — used to skip the empty bordered card. */
export function infoboxHasContent(block: InfoboxBlock | null, metadata?: PageMetadata | null, tagPath?: string): boolean {
  if (block?.blocks?.length) return true;
  if (!metadata || !tagPath) return false;
  return getResourceAddressEntries(metadata, tagPath).length > 0 || buildMetadataBlock(metadata, tagPath) !== null;
}

export function InfoboxSidebar({ block, metadata, tagPath, series }: { block: InfoboxBlock; metadata?: PageMetadata | null; tagPath?: string; series?: { title: string; href: string } | null }) {
  const metaBlock = metadata && tagPath ? buildMetadataBlock(metadata, tagPath) : null;
  const assetEntries = metadata && tagPath ? getResourceAddressEntries(metadata, tagPath) : [];
  return (
    <aside className="infobox stack">
      {/* Wikipedia's {{Category main article}}, pointed from the article: the tag
          path names the topic's main article, so every page in it opens onto the
          one that defines it. Breadcrumbs already say where the page sits. */}
      {series && (
        <div className="infobox-series">
          <span>Part of a series on</span>
          <Link href={series.href} className="link">{series.title}</Link>
        </div>
      )}
      {assetEntries.map(entry => (
        <div key={entry.key}>
          <AssetPriceBlockView block={{ id: `__asset_${entry.key}__`, type: 'assetPrice', resourceAddress: entry.value, showChange: true, showChart: true, chartTimeframe: '30d' }} />
        </div>
      ))}
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
    hydrateTweetEmbeds(el);
    const offResize = onTweetResize(height => sizeTweetEmbeds(el, height));

    if (/\$\$|\\\(|\\\[/.test(html)) {
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

    return offResize;
  }, [html]);

  return processedHtml.trim() ? <div ref={ref} className="prose-content" suppressHydrationWarning dangerouslySetInnerHTML={{ __html: processedHtml }} /> : null;
});

function LinkGridBlockView({ block }: { block: LinkGridBlock }) {
  return (
    <div className="link-grid">
      {block.intro && <p>{block.intro}</p>}
      {(block.groups || []).map(group => (
        <section key={group.id} className="link-grid-group">
          <h3>{group.heading}</h3>
          {group.description && <div className="link-grid-group-description" dangerouslySetInnerHTML={{ __html: group.description }} />}
          <div className="link-grid-pills">
            {(group.links || []).map((link, i) => {
              const href = safeLinkHref(link.href);
              if (!href) return null;
              return /^https?:\/\//.test(href)
                ? <a key={i} href={href} target="_blank" rel="noopener">{link.label}</a>
                : <Link key={i} href={href}>{link.label}</Link>;
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

function TipJarBlockView({ block }: { block: TipJarBlock }) {
  // `useCopy` from `wiki-formant/react`. The version here had no rejection
  // handler, so a denied clipboard left the button saying "Copied".
  const { copied, copy } = useCopy();
  const { address, isValid, qr } = useAccountQr(block.address);

  return (
    <div className="tip-jar">
      {block.label && <div className="tip-jar-label">{block.label}</div>}
      {block.message && <p className="tip-jar-message">{block.message}</p>}
      {qr ? (
        <div className="tip-jar-qr" dangerouslySetInnerHTML={{ __html: qr }} />
      ) : (
        <div className="tip-jar-placeholder">{address && !isValid ? 'Not a valid Radix account address.' : 'No tip address set.'}</div>
      )}
      {isValid && (
        <button type="button" className="tip-jar-address" onClick={() => copy(address)} title="Copy address">
          <span className="tip-jar-address-text">{address}</span>
          {copied ? <Check size={14} /> : <Copy size={14} />}
        </button>
      )}
    </div>
  );
}

// ========== EDITORIAL NOTICES ==========
const BANNER_META: Record<BannerVariant, { label: string; message: string; icon: LucideIcon }> = {
  stub: { label: 'Stub', message: 'This article is a stub. You can help RADIX Wiki by expanding it.', icon: FileText },
  unsourced: { label: 'Needs citations', message: 'This article needs additional citations for verification. Please help improve it by adding references to reliable sources.', icon: AlertTriangle },
  outdated: { label: 'May be outdated', message: 'Some information here may be out of date. Please help update it to reflect the current state of the Radix ecosystem.', icon: CalendarClock },
  promotional: { label: 'Written like an advertisement', message: 'This article may read like an advertisement. Please help rewrite it from a neutral point of view.', icon: Megaphone },
  cleanup: { label: 'Needs cleanup', message: 'This article may require cleanup to meet RADIX Wiki quality standards.', icon: AlertTriangle },
  coi: { label: 'Conflict of interest', message: 'A major contributor to this article may have a close connection with its subject. It may need additional review for a neutral point of view.', icon: AlertTriangle },
};

function BannerBlockView({ block }: { block: BannerBlock }) {
  const meta = BANNER_META[block.variant] ?? BANNER_META.cleanup;
  const Icon = meta.icon;
  return (
    <div className={cn('editorial-banner', `editorial-banner-${block.variant}`)} role="note">
      <Icon size={18} className="editorial-banner-icon" />
      <p className="editorial-banner-body"><strong>{meta.label}.</strong> {block.text?.trim() || meta.message}</p>
    </div>
  );
}

function ReferencesBlockView({ block }: { block: ReferencesBlock }) {
  const items = block.items || [];
  if (!items.length) return null;
  return (
    <section className="references-block" aria-labelledby="references-heading">
      <h2 id="references-heading">{block.title || 'References'}</h2>
      <ol className="references-list">
        {items.map((item, i) => (
          <li key={item.id} id={`ref-${i + 1}`} className="reference-item">
            <a href={`#cite-${i + 1}`} className="ref-backlink" aria-label="Back to citation">↑</a>{' '}
            <span dangerouslySetInnerHTML={{ __html: processHtml(item.text) }} />
            {safeLinkHref(item.url) && <> <a href={safeLinkHref(item.url)!} target="_blank" rel="noopener" className="reference-link" aria-label="Open source">↗</a></>}
          </li>
        ))}
      </ol>
    </section>
  );
}

/** A row of measured figures. The Week in Review carries one every issue, so the
 *  numbers are a block the editor can hold rather than a hand-built table. */
function StatsBlockView({ block }: { block: StatsBlock }) {
  const items = block.items || [];
  if (!items.length) return null;
  return (
    <div className={cn('stat-grid', `stat-grid-${block.columns || 4}`)}>
      {items.map(item => (
        <div key={item.id} className="stat-card">
          <span className="stat-value">{item.value}{item.suffix && <span className="stat-suffix">{item.suffix}</span>}</span>
          <span className="stat-label">{item.label}</span>
        </div>
      ))}
    </div>
  );
}

/** One quotation, attributed. Quoting a person is the cheapest way a recap can
 *  carry a voice that is not its own, and it was being typed as plain prose. */
function TestimonialBlockView({ block }: { block: TestimonialBlock }) {
  if (!block.quote?.trim()) return null;
  return (
    <figure className="pull-quote">
      <blockquote className="pull-quote-body">{block.quote}</blockquote>
      <figcaption className="pull-quote-attr">
        {block.author}{block.role && <span className="pull-quote-role">{block.role}</span>}
      </figcaption>
    </figure>
  );
}

function renderBlockView(block: Block | AtomicBlock): React.ReactNode {
  switch (block.type) {
    case 'stats': return <StatsBlockView block={block} />;
    case 'testimonial': return <TestimonialBlockView block={block} />;
    case 'content': return <ContentBlockView html={block.text} />;
    case 'recentPages': return <RecentPagesBlockView block={block} />;
    case 'pageList': return <PageListBlockView block={block} />;
    case 'assetPrice': return <AssetPriceBlockView block={block} />;
    case 'rssFeed': return <RssFeedBlockView block={block} />;
    case 'codeTabs': return <CodeTabsBlockView block={block} />;
    case 'columns': return <ColumnsBlockView block={block} />;
    case 'infobox': return <InfoboxBlockView block={block} />;
    case 'linkGrid': return <LinkGridBlockView block={block} />;
    case 'tipJar': return <TipJarBlockView block={block} />;
    case 'references': return <ReferencesBlockView block={block} />;
    case 'banner': return <BannerBlockView block={block} />;
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
    activateTabGroups(container);
    addCopyButtons(container);
  }, []);

  if (!blocks.length) return null;

  return (
    <div ref={containerRef} className={cn('stack', className)}>
      {blocks.map(block => <div key={block.id}>{renderBlockView(block)}</div>)}
    </div>
  );
}
