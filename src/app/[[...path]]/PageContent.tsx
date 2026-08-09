// src/app/[[...path]]/PageContent.tsx

'use client';

import { useState, useEffect, useRef, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import dynamic from 'next/dynamic';
import { ArrowLeft, ArrowRight, Save, Plus, Upload, X, Image as ImageIcon, ArrowDownAZ, CalendarPlus, RefreshCw, SlidersHorizontal } from 'lucide-react';
import { BlockRenderer, findInfobox, infoboxHasContent, InfoboxSidebar } from '@/components/BlockRenderer';
import { UserAvatar } from '@/components/UserAvatar';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { LinkPreview } from '@/components/LinkPreview';
import { Badge, Button, Card, Input, StatusCard } from '@/components/ui';
import { useAuth, useStore } from '@/hooks';
import { cn, slugify, generateBannerSvg, formatRelativeTime, formatDate, getContentSnippet, userProfileSlug, shortenAddress } from '@/lib/utils';
import { findTagByPath, getXrdRequired, XRD_NOT_A_FEE, type SortOrder, type TagNode } from '@/lib/tags';
import { categoryHref, toggleFilter, type Facet, type FacetFilters, type FacetValue, type SharedFacet } from '@/lib/taxonomy';
import { createBlock } from '@/lib/block-utils';
import { freshnessBanner } from '@/lib/freshness';
import type { WikiPage } from '@/types';
import type { Block } from '@/types/blocks';

const LazyPageEditor = dynamic(() => import('./PageEditor'), {
  ssr: false,
  loading: () => <div className="h-64 skeleton rounded-lg" />,
});

const HistoryView = dynamic(() => import('@/components/HistoryView'), {
  ssr: false,
  loading: () => <div className="h-64 skeleton rounded-lg" />,
});

export type { HistoryData } from '@/components/HistoryView';
export { HistoryView };

const Discussion = dynamic(() => import('@/components/Discussion').then(m => m.Discussion), { ssr: false });
const UserStats = dynamic(() => import('@/components/UserStats').then(m => m.UserStats));

const BlockEditor = dynamic(() => import('@/components/BlockEditor').then(m => m.BlockEditor), { ssr: false, loading: () => <div className="h-64 skeleton rounded-lg" /> });
const InfoboxEditor = dynamic(() => import('@/components/BlockEditor').then(m => m.InfoboxEditor), { ssr: false, loading: () => <div className="h-32 skeleton rounded-lg" /> });

export { StatusCard } from '@/components/ui';

export function PageSkeleton() {
  return (
    <div className="stack">
      <div className="h-8 w-48 skeleton rounded" />
      <div className="h-48 skeleton rounded-lg" />
      <div className="h-6 w-3/4 skeleton rounded" />
      <div className="h-6 w-1/2 skeleton rounded" />
    </div>
  );
}

// ========== PAGE META (foot line) ==========
// The single home for page provenance — Wikipedia's "This page was last edited …" line.
function PageMeta({ page }: { page: WikiPage }) {
  const revisions = page._count?.revisions ?? 0;
  return (
    <div className="page-meta">
      {page.author && (
        <span className="row">
          <UserAvatar radixAddress={page.author.radixAddress} avatarUrl={page.author.avatarUrl} size="sm" />
          <span className="truncate">{page.author.displayName || shortenAddress(page.author.radixAddress)}</span>
        </span>
      )}
      <span>Last updated {formatRelativeTime(page.updatedAt)}</span>
      <span className="font-mono">v{page.version}</span>
      <Link href={`/${page.tagPath}/${page.slug}/history`} className="link">
        {revisions} revision{revisions === 1 ? '' : 's'}
      </Link>
      {page.lastVerifiedAt && <span>Verified {formatDate(page.lastVerifiedAt)}</span>}
    </div>
  );
}

// ========== BANNER ==========
export function Banner({ src, title, tagPath, editable, onUpload, onRemove, children }: { src?: string | null; title?: string; tagPath?: string; editable?: boolean; onUpload?: (url: string) => void; onRemove?: () => void; children?: ReactNode }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !onUpload) return;
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/upload', { method: 'POST', body: formData });
      if (res.ok) onUpload((await res.json()).url);
      else alert((await res.json()).error || 'Upload failed');
    } catch { alert('Upload failed'); }
    finally { setIsUploading(false); if (fileInputRef.current) fileInputRef.current.value = ''; }
  };

  const FileInput = <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleUpload} />;

  if (editable && !src) {
    return (
      <div className="banner-empty">
        {FileInput}
        <button onClick={() => fileInputRef.current?.click()} disabled={isUploading} className="banner-upload-btn">
          <div className="stack-sm items-center"><ImageIcon size={32} /><span>{isUploading ? 'Uploading...' : 'Add Banner Image'}</span></div>
        </button>
        {children && <div className="banner-overlay">{children}</div>}
      </div>
    );
  }

  const generativeSrc = !src && title ? generateBannerSvg(title, tagPath || '') : null;
  if (!src && !generativeSrc && !children) return null;

  return (
    <div className="banner-container">
      {src ? (
        <Image src={src} alt={title ? `${title} banner` : 'Page banner'} fill className="banner-image" sizes="100vw" priority />
      ) : generativeSrc ? (
        <Image src={generativeSrc} alt={title || 'Page banner'} fill className="banner-image" unoptimized />
      ) : (
        <div className="banner-placeholder" />
      )}
      {children && (
        <div className="banner-overlay">
          <div className="banner-overlay-left">{children}</div>
        </div>
      )}
      {editable && (
        <div className="banner-actions">
          {FileInput}
          <button onClick={() => fileInputRef.current?.click()} disabled={isUploading} className="banner-action-btn" title="Change banner"><Upload size={16} /></button>
          {onRemove && src && <button onClick={onRemove} className="banner-action-btn text-error hover:text-error" title="Remove banner"><X size={16} /></button>}
        </div>
      )}
    </div>
  );
}

// ========== SORT TOGGLE ==========
const SORT_OPTIONS: { value: SortOrder; label: string; icon: typeof ArrowDownAZ }[] = [
  { value: 'title', label: 'A–Z', icon: ArrowDownAZ },
  { value: 'newest', label: 'Newest', icon: CalendarPlus },
  { value: 'recent', label: 'Updated', icon: RefreshCw },
];

export function SortToggle({ sort, tagPath, filters = {}, letter }: { sort: SortOrder; tagPath: string; filters?: FacetFilters; letter?: string }) {
  const router = useRouter();
  return (
    <div className="toggle-group-sm">
      {SORT_OPTIONS.map(o => (
        <button key={o.value} className={cn('toggle-option-sm', sort === o.value && 'bg-accent text-text-inverted')}
          onClick={() => router.push(categoryHref(tagPath, { sort: o.value, filters, letter }))} title={o.label}><o.icon size={14} /></button>
      ))}
    </div>
  );
}

// ========== CATEGORY HERO ==========
export interface SubcategorySummary { name: string; href: string; description?: string; pages: number; subs: number }
export interface PageRef { title: string; href: string }

function subcategoryMeta({ pages, subs }: SubcategorySummary): string {
  return [pages && `${pages} page${pages === 1 ? '' : 's'}`, subs && `${subs} subcategor${subs === 1 ? 'y' : 'ies'}`]
    .filter(Boolean).join(' · ');
}

function CategoryHero({ description, mainArticle, subcategories }: { description?: string; mainArticle: PageRef | null; subcategories: SubcategorySummary[] }) {
  if (!description && !mainArticle && !subcategories.length) return null;
  return (
    <div className="category-hero">
      {description && <p className="text-text-muted text-lg">{description}</p>}
      {mainArticle && (
        <p className="category-main-article">
          The main article for this category is <Link href={mainArticle.href} className="link">{mainArticle.title}</Link>.
        </p>
      )}
      {subcategories.length > 0 && (
        <div className="category-hero-grid">
          {subcategories.map(child => (
            <Link key={child.href} href={child.href} className="category-hero-card">
              <span className="font-medium">{child.name}</span>
              {child.description && <span className="text-text-muted text-small">{child.description}</span>}
              <span className="subcategory-meta">{subcategoryMeta(child)}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

// ========== CATEGORY RAIL (facets + A–Z index) ==========
/**
 * The same links an article's infobox already carries — `Status:`, `Category:` —
 * shown for the whole set, in the same column of the page. As three wrapped rows
 * of pills above the grid they were ~50 tap targets and a screen of chrome before
 * the first card; as a rail they read as a vertical list of choices with counts
 * and the grid starts at the top. Below `md` the rail is collapsed behind one
 * button, so a phone gets the pages first.
 */
function CategoryRail({ tagPath, sort, facets, filters, letters, letter, open }: {
  tagPath: string; sort: SortOrder; facets: Facet[]; filters: FacetFilters; letters: FacetValue[]; letter?: string; open: boolean;
}) {
  return (
    <nav className={cn('category-rail', open && 'category-rail-open')} aria-label="Filter this category">
      {/* The index leads: it is two lines against the facets' twenty, and a rail
          tall enough to scroll would otherwise bury the one control that is the
          whole point of a 142-page category. */}
      {letters.length > 0 && (
        <div className="facet-group">
          <span className="facet-group-label">Index</span>
          <div className="alpha-index">
            <Link href={categoryHref(tagPath, { sort, filters })} className={cn('alpha-letter', !letter && 'alpha-letter-active')}>All</Link>
            {letters.map(({ value, count }) => (
              <Link
                key={value}
                href={categoryHref(tagPath, { sort, filters, letter: letter === value ? undefined : value })}
                className={cn('alpha-letter', letter === value && 'alpha-letter-active')}
                title={`${count} page${count === 1 ? '' : 's'}`}
              >
                {value}
              </Link>
            ))}
          </div>
        </div>
      )}
      {facets.map(facet => (
        <div key={facet.key} className="facet-group">
          <span className="facet-group-label">{facet.label}</span>
          {facet.values.map(({ value, count }) => {
            const active = filters[facet.key] === value;
            return (
              <Link
                key={value}
                href={categoryHref(tagPath, { sort, filters: toggleFilter(filters, facet.key, value), letter })}
                className={cn('facet-option', active && 'facet-option-active')}
                aria-current={active ? 'true' : undefined}
                title={value}
              >
                <span className="truncate">{value}</span>
                <span className="facet-option-count">{count}</span>
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

// ========== CATEGORY RESULTS BAR ==========
/** One line above the grid: how much of the category you are looking at, and the two controls that change it. */
function ResultsBar({ tag, tagPath, total, shown, sort, filters, letter, hasRail, filtersOpen, onToggleFilters }: {
  tag: TagNode | null; tagPath: string; total: number; shown: number; sort: SortOrder;
  filters: FacetFilters; letter?: string; hasRail: boolean; filtersOpen: boolean; onToggleFilters: () => void;
}) {
  const categoryName = tag?.name?.replace(/^\p{Emoji_Presentation}\s*/u, '') || tagPath.split('/').at(-1) || 'this section';
  const narrowed = Object.keys(filters).length + (letter ? 1 : 0);
  return (
    <div className="results-bar">
      <p className="results-count">
        {shown === total
          ? <>The following <strong>{total}</strong> page{total === 1 ? ' is' : 's are'} in {categoryName}.</>
          : <>Showing <strong>{shown}</strong> of {total} pages in {categoryName}.</>}
        {narrowed > 0 && <> <Link href={categoryHref(tagPath, { sort })} className="link">Clear</Link></>}
      </p>
      <div className="row">
        {hasRail && (
          <button type="button" className={cn('filter-toggle', narrowed > 0 && 'filter-toggle-active')} onClick={onToggleFilters} aria-expanded={filtersOpen}>
            <SlidersHorizontal size={14} />Filters{narrowed > 0 && ` · ${narrowed}`}
          </button>
        )}
        <SortToggle sort={sort} tagPath={tagPath} filters={filters} letter={letter} />
      </div>
    </div>
  );
}

// ========== HOMEPAGE VIEW ==========
export function HomepageView({ page, isEditing }: { page: WikiPage | null; isEditing: boolean }) {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const connect = useStore(s => s.connect);
  const [content, setContent] = useState<Block[]>((page?.content as unknown as Block[]) || []);
  const [bannerImage, setBannerImage] = useState<string | null>(page?.bannerImage || null);
  const [isSaving, setIsSaving] = useState(false);


  useEffect(() => {
    if (page) { setContent((page.content as unknown as Block[]) || []); setBannerImage(page.bannerImage || null); }
  }, [page]);

  if (isEditing && !isAuthenticated) return <StatusCard status="authRequired" backHref="/" />;

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const res = await fetch('/api/wiki', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: 'Homepage', content, bannerImage }) });
      if (res.ok) router.push('/');
      else alert((await res.json()).error || 'Failed to save');
    } catch { alert('Failed to save'); }
    finally { setIsSaving(false); }
  };

  if (isEditing) {
    const infobox = findInfobox(content) || createBlock('infobox') as import('@/types/blocks').InfoboxBlock;
    const mainBlocks = content.filter(b => b.type !== 'infobox');
    const updateMainBlocks = (blocks: Block[]) => setContent([...blocks, infobox]);
    const updateInfobox = (block: Block) => setContent([...content.filter(b => b.type !== 'infobox'), block]);

    return (
      <div className="stack">
        <div className="spread">
          <Link href="/" className="row link-muted"><ArrowLeft size={16} /><span>Back to Homepage</span></Link>
          <Button onClick={handleSave} disabled={isSaving} size="sm"><Save size={16} />{isSaving ? 'Saving...' : 'Save Changes'}</Button>
        </div>
        <h1>Edit Homepage</h1>
        <div data-callout="info"><p>Editing the homepage requires holding <strong>{getXrdRequired('edit', '').toLocaleString()} XRD</strong> in your connected wallet. {XRD_NOT_A_FEE}</p></div>
        <Banner src={bannerImage} editable onUpload={setBannerImage} onRemove={() => setBannerImage(null)} />
        <div className="page-with-infobox">
          <div className="page-main-content">
            <BlockEditor content={mainBlocks} onChange={updateMainBlocks} />
          </div>
          <aside className="infobox-editor">
            <InfoboxEditor block={infobox} onChange={updateInfobox} />
          </aside>
        </div>
        <div className="spread">
          <Link href="/"><Button variant="ghost">Cancel</Button></Link>
          <Button onClick={handleSave} disabled={isSaving}><Save size={18} />{isSaving ? 'Saving...' : 'Save Changes'}</Button>
        </div>
      </div>
    );
  }

  const infobox = findInfobox(content);
  const mainBlocks = infobox ? content.filter(b => b.type !== 'infobox') : content;

  const mainContent = (
    <>
      <BlockRenderer content={mainBlocks} />
      <div className="row-md justify-center wrap">
        {!isAuthenticated && <Button size="lg" variant="primary" onClick={connect}>Connect Radix Wallet<ArrowRight size={18} /></Button>}
        <Link href="/contents"><Button variant="secondary" size="lg">Browse Content</Button></Link>
      </div>
    </>
  );

  return (
    <div className="stack">
      <Banner src={bannerImage} title="Homepage">
        <h1 className="sr-only">Radix (XRD) – The Radix DLT Crypto Wiki</h1>
      </Banner>
      {infobox && infoboxHasContent(infobox) ? (
        <div className="page-with-infobox">
          <div className="page-main-content stack">{mainContent}</div>
          <InfoboxSidebar block={infobox} />
        </div>
      ) : (
        mainContent
      )}
    </div>
  );
}

// ========== CATEGORY VIEW ==========
export function CategoryView({ tagPath, pages, sort, total, facets, filters, letters, letter, subcategories, mainArticle }: {
  tagPath: string[]; pages: WikiPage[]; sort: SortOrder; total: number;
  facets: Facet[]; filters: FacetFilters; letters: FacetValue[]; letter?: string;
  subcategories: SubcategorySummary[]; mainArticle: PageRef | null;
}) {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const pathStr = tagPath.join('/');
  const [newSlug, setNewSlug] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const tag = findTagByPath(tagPath);
  const canCreatePages = isAuthenticated;
  const isContainer = total === 0 && subcategories.length > 0;
  const hasRail = facets.length > 0 || letters.length > 0;

  return (
    <div className="stack">
      <Breadcrumbs path={tagPath} />
      <div className="spread">
        <h1>{tag?.name || tagPath[tagPath.length - 1]}</h1>
        {canCreatePages && (
          <div className="row">
            {showCreate ? (
              <>
                <Input value={newSlug} onChange={e => setNewSlug(e.target.value)} placeholder="page-slug" className="w-48" onKeyDown={e => e.key === 'Enter' && newSlug.trim() && router.push(`/${pathStr}/${slugify(newSlug)}`)} autoFocus />
                <Button size="sm" onClick={() => { const s = slugify(newSlug); if (s) router.push(`/${pathStr}/${s}`); }} disabled={!newSlug.trim()}>Go</Button>
                <Button size="sm" variant="ghost" onClick={() => setShowCreate(false)}>Cancel</Button>
              </>
            ) : <Button size="sm" onClick={() => setShowCreate(true)}><Plus size={16} />New Page</Button>}
          </div>
        )}
      </div>
      <CategoryHero description={tag?.description} mainArticle={mainArticle} subcategories={subcategories} />
      {/* A container category (Tech, Contents) holds only subcategories — sorting and an
          "empty" notice are both noise there; the subcategory cards are the whole page. */}
      {isContainer ? null : <>
      <ResultsBar
        tag={tag} tagPath={pathStr} total={total} shown={pages.length} sort={sort} filters={filters} letter={letter}
        hasRail={hasRail} filtersOpen={showFilters} onToggleFilters={() => setShowFilters(v => !v)}
      />
      <div className={cn(hasRail && 'category-with-rail')}>
        <div className="category-results">
          {pages.length > 0 ? (
            <div className="category-grid">
              {pages.map(p => (
                <Link key={p.id} href={`/${p.tagPath}/${p.slug}`}>
                  <Card interactive className="h-full overflow-hidden p-0!">
                    <div className="page-card-thumb">
                      {p.bannerImage ? (
                        <Image src={p.bannerImage} alt={p.title} fill className="object-cover group-hover:scale-105 transition-transform duration-300" sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw" />
                      ) : (
                        <Image src={generateBannerSvg(p.title, p.tagPath)} alt={p.title} fill className="object-cover" unoptimized />
                      )}
                    </div>
                    <div className="page-card-body">
                      <div className="spread">
                        <h3 className="m-0!">{p.title}</h3>
                        {p.metadata?.status && <span>{p.metadata.status}</span>}
                      </div>
                      {(() => { const snippet = getContentSnippet(p.content); return snippet && <p className="text-text-muted text-small line-clamp-2">{snippet}</p>; })()}
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          ) : (
            <Card className="empty-state">
              {total > 0 ? (
                <>
                  <p className="text-text-muted">No pages match these filters.</p>
                  <Link href={categoryHref(pathStr, { sort })} className="link mt-2 inline-block">Clear filters</Link>
                </>
              ) : (
                <>
                  <p className="text-text-muted">No pages in this category yet.</p>
                  {canCreatePages && <small className="mt-2 block">Click "New Page" above to create one.</small>}
                </>
              )}
            </Card>
          )}
        </div>
        {hasRail && (
          <CategoryRail tagPath={pathStr} sort={sort} facets={facets} filters={filters} letters={letters} letter={letter} open={showFilters} />
        )}
      </div>
      </>}
    </div>
  );
}

// ========== SEE ALSO ==========
export type RelatedPage = Pick<WikiPage, 'id' | 'title' | 'slug' | 'tagPath'> & { snippet?: string };
/** `sharedFacet` names the axis the ranking found in common, so the heading can be the way into the whole set. */
export type RelatedPages = { pages: RelatedPage[]; sharedFacet: SharedFacet | null };

/**
 * The heading *is* the link: it names what these five have in common and opens
 * the filtered category holding the rest. The sentence that used to sit under it
 * only restated the infobox row that now carries the same link.
 */
function SeeAlso({ pages, tagPath, sharedFacet }: { pages: RelatedPage[]; tagPath: string; sharedFacet?: SharedFacet | null }) {
  if (!pages.length) return null;
  const sectionTag = findTagByPath(tagPath.split('/'));
  const sectionName = sectionTag?.name?.replace(/^\p{Emoji_Presentation}\s*/u, '') || tagPath;
  return (
    <aside className="see-also" aria-labelledby="see-also-heading">
      <h2 id="see-also-heading" className="text-h4">
        <Link href={categoryHref(tagPath, sharedFacet ? { filters: { [sharedFacet.key]: sharedFacet.value } } : {})} className="link">
          {sharedFacet ? <>More {sharedFacet.value} in {sectionName}</> : <>More from {sectionName}</>}
        </Link>
      </h2>
      <ul className="see-also-grid">
        {pages.map(p => (
          <li key={p.id}>
            <Link href={`/${p.tagPath}/${p.slug}`} className="see-also-card">
              <span className="font-medium">{p.title}</span>
              {p.snippet && <span className="text-text-muted text-small line-clamp-2">{p.snippet}</span>}
            </Link>
          </li>
        ))}
      </ul>
    </aside>
  );
}

// ========== PAGE VIEW (Read-only) ==========
function PageViewContent({ page, related, series }: { page: WikiPage; related: RelatedPages; series: PageRef | null }) {
  const { isAuthenticated } = useAuth();
  // Contributor stats belong only on a member's own profile — not on curated
  // articles that happen to live under /community (e.g. Dan Hughes).
  const isOwnProfile = page.tagPath === 'community' && !!page.author &&
    page.slug === userProfileSlug(page.author.displayName, page.author.radixAddress);
  const blocks = (page.content as unknown as Block[]) || [];
  const infobox = findInfobox(blocks);
  const showInfobox = infoboxHasContent(infobox, page.metadata, page.tagPath);
  // The synthetic freshness notice defers to an author-placed outdated banner.
  const hasOutdatedBanner = blocks.some(b => b.type === 'banner' && b.variant === 'outdated');
  const fresh = hasOutdatedBanner ? null : freshnessBanner(page);
  const mainBlocks = [...(fresh ? [fresh] : []), ...blocks.filter(b => b.type !== 'infobox')];

  const main = (
    <div className="page-main-content stack">
      <BlockRenderer content={mainBlocks} />
      <SeeAlso pages={related.pages} tagPath={page.tagPath} sharedFacet={related.sharedFacet} />
      {isOwnProfile && <UserStats authorId={page.authorId} />}
      <PageMeta page={page} />
      <Discussion pageId={page.id} tagPath={page.tagPath} />
      {isAuthenticated && (
        <Link href={`/${page.tagPath}/${page.slug}/edit`} className="edit-cta">Something missing? Edit this page →</Link>
      )}
    </div>
  );

  return (
    <article className="stack">
      <Banner src={page.bannerImage} title={page.title} tagPath={page.tagPath}>
        <Breadcrumbs path={[...page.tagPath.split('/'), page.slug]} />
        <h1 id={slugify(page.title)} className="m-0!">{page.title}</h1>
      </Banner>
      {showInfobox ? (
        <div className="page-with-infobox">
          {main}
          <InfoboxSidebar block={infobox ?? { id: '__infobox__', type: 'infobox', blocks: [] }} metadata={page.metadata} tagPath={page.tagPath} series={series} />
        </div>
      ) : main}
      <LinkPreview />
    </article>
  );
}

// ========== PAGE VIEW WRAPPER ==========
export function PageView({ page, tagPath, slug, isEditMode, related = { pages: [], sharedFacet: null }, series = null }: { page: WikiPage | null; tagPath: string; slug: string; isEditMode: boolean; related?: RelatedPages; series?: PageRef | null }) {
  const { isAuthenticated } = useAuth();

  const viewPath = `/${tagPath}/${slug}`;

  if (isEditMode && !isAuthenticated) return <StatusCard status="authRequired" backHref={viewPath} />;
  if (!page) return <LazyPageEditor tagPath={tagPath} slug={slug} />;
  return isEditMode ? <LazyPageEditor page={page} tagPath={tagPath} slug={slug} /> : <PageViewContent page={page} related={related} series={series} />;
}
