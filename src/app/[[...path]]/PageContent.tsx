// src/app/[[...path]]/PageContent.tsx

'use client';

import { useState, useEffect, useRef, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import dynamic from 'next/dynamic';
import { ArrowLeft, ArrowRight, Save, Plus, Upload, X, Image as ImageIcon, ArrowDownAZ, RefreshCw, Rss, SlidersHorizontal } from 'lucide-react';
import { BlockRenderer, findInfobox, infoboxHasContent, InfoboxSidebar, PageThumb } from '@/components/BlockRenderer';
import { UserAvatar } from '@/components/UserAvatar';
import { Breadcrumbs, PageActions } from '@/components/Breadcrumbs';
import { LinkPreview } from '@/components/LinkPreview';
import { AuthRequired } from '@/components/AuthRequired';
import { Button } from '@/components/ui';
import { useAuth, useStore } from '@/hooks';
import { categoryLabel, cn, generateBannerSvg, mustReload, pagePath, sendJson } from '@/lib/utils';
import { describe } from 'wiki-formant/metadata';
import { openingText } from 'wiki-formant/text';
import { slugifyHeading } from 'wiki-formant/headings';
import { SITE_NAME, SITE_URL } from '@/lib/site';
import { AGO, useNow } from '@/lib/now';
import { findTagByPath, getXrdRequired, XRD_NOT_A_FEE, type SortOrder } from '@/lib/tags';
import { categoryHref, type Control, type FacetControlGroup, type FacetFilters, type SharedFacet } from '@/lib/taxonomy';
import { createBlock } from '@/lib/block-utils';
import { formatDay, freshnessBanner, relativeTime } from 'wiki-formant/freshness';
import { Cite, FacetBar, FacetSummary, RelatedPages as SeeAlso } from 'wiki-formant/react-server';
import { useSaveShortcut, useUnsavedChanges } from 'wiki-formant/react';
import type { WikiPage } from '@/types';
import type { Block, InfoboxBlock } from '@/types/blocks';

const LazyPageEditor = dynamic(() => import('./PageEditor'), {
  ssr: false,
  loading: () => <div className="h-64 skeleton" />,
});

const HistoryView = dynamic(() => import('@/components/HistoryView'), {
  ssr: false,
  loading: () => <div className="h-64 skeleton" />,
});

export { HistoryView };

const Discussion = dynamic(() => import('@/components/Discussion').then(m => m.Discussion), { ssr: false });
const UserStats = dynamic(() => import('@/components/UserStats').then(m => m.UserStats));

const BlockEditor = dynamic(() => import('@/components/BlockEditor').then(m => m.BlockEditor), { ssr: false, loading: () => <div className="h-64 skeleton" /> });
const InfoboxEditor = dynamic(() => import('@/components/BlockEditor').then(m => m.InfoboxEditor), { ssr: false, loading: () => <div className="h-32 skeleton" /> });

/** An article's blocks, its infobox edited apart in the rail beside them; both editors run it. */
export function ArticleBlocksEditor({ content, onChange }: { content: Block[]; onChange: (content: Block[]) => void }) {
  const infobox = findInfobox(content) || createBlock('infobox') as InfoboxBlock;
  const mainBlocks = content.filter(b => b.type !== 'infobox');
  return (
    <div className="page-with-infobox">
      <div className="page-main-content">
        <BlockEditor content={mainBlocks} onChange={blocks => onChange([...blocks, infobox])} />
      </div>
      <aside className="infobox-editor">
        <InfoboxEditor block={infobox} onChange={block => onChange([...mainBlocks, block])} />
      </aside>
    </div>
  );
}

// ========== PAGE META (foot line) ==========
// The single home for page provenance — Wikipedia's "This page was last edited …" line.
// The revision count is text: the History link beside the breadcrumb is the way in.
function PageMeta({ page }: { page: WikiPage }) {
  const revisions = page.revisionCount ?? 0;
  const now = useNow();
  return (
    <div className="page-meta">
      {page.author && (
        <span className="row">
          <UserAvatar seed={page.author.id} avatarUrl={page.author.avatarUrl} size="sm" />
          <span className="truncate">{page.author.displayName || page.author.shortAddress}</span>
        </span>
      )}
      <span>Last updated {relativeTime(page.updatedAt, now, AGO)}</span>
      <span className="font-mono">v{page.version}</span>
      <span>{revisions} revision{revisions === 1 ? '' : 's'}</span>
      {page.lastVerifiedAt && <span>Verified {formatDay(page.lastVerifiedAt)}</span>}
      <Cite publisher={SITE_NAME} title={page.title} date={page.updatedAt} url={`${SITE_URL}${pagePath(page.tagPath, page.slug)}`} />
    </div>
  );
}

// ========== BANNER ==========
export function Banner({ src, title, tagPath, editable, onUpload, onRemove, children }: { src?: string | null; title?: string; tagPath?: string; editable?: boolean; onUpload?: (url: string) => void; onRemove?: () => void; children?: ReactNode }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const showToast = useStore(s => s.showToast);

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !onUpload) return;
    setIsUploading(true);
    // Imported on use: the module carries Tiptap, which a reader never loads.
    import('wiki-formant/editor')
      .then(({ uploadImageTo }) => uploadImageTo('/api/upload')(file))
      .then(onUpload, (err: Error) => showToast(err.message, 'info'))
      .finally(() => { setIsUploading(false); if (fileInputRef.current) fileInputRef.current.value = ''; });
  };

  const FileInput = <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleUpload} />;

  if (editable && !src) {
    return (
      <div className="banner-empty">
        {FileInput}
        <button onClick={() => fileInputRef.current?.click()} disabled={isUploading} className="banner-upload-btn">
          <div className="stack-sm items-center"><ImageIcon size={32} /><span>{isUploading ? 'Uploading...' : 'Add Banner Image'}</span></div>
        </button>
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
          <button onClick={() => fileInputRef.current?.click()} disabled={isUploading} className="icon-btn banner-action-btn" title="Change banner"><Upload size={16} /></button>
          {onRemove && src && <button onClick={onRemove} className="icon-btn banner-action-btn text-error hover:text-error" title="Remove banner"><X size={16} /></button>}
        </div>
      )}
    </div>
  );
}

// ========== SORT TOGGLE ==========
const SORT_OPTIONS: { value: SortOrder; label: string; icon: typeof ArrowDownAZ }[] = [
  { value: 'title', label: 'A–Z', icon: ArrowDownAZ },
  { value: 'recent', label: 'Recent', icon: RefreshCw },
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

// ========== SECTION INDEX ==========
interface PageRef { title: string; href: string }
export interface SubcategorySummary {
  name: string; href: string; description?: string;
  /** Pages anywhere in this subcategory's subtree. */
  total: number;
  /** What the card lists: its first few articles, then its sections. */
  links: PageRef[];
}

/**
 * A category's subcategories, each card listing what it holds. The card used to
 * be a name, a blurb and a page count, which made a container category a page of
 * cards leading to another page of cards — /developers put 33 tutorials two
 * clicks away and named none of them. Listing the titles turns the card into the
 * index it was standing in for.
 */
function SectionIndex({ subcategories }: { subcategories: SubcategorySummary[] }) {
  if (!subcategories.length) return null;
  return (
    <div className="section-index">
      {subcategories.map(child => (
        <div key={child.href} className="section-card">
          <h2 className="section-card-title"><Link href={child.href}>{child.name}</Link></h2>
          {child.description && <p className="section-card-desc">{child.description}</p>}
          {child.links.length > 0 && (
            <ul className="section-card-links">
              {child.links.map(l => (
                <li key={l.href}><Link href={l.href} className="link">{l.title}</Link></li>
              ))}
            </ul>
          )}
          <Link href={child.href} className="section-card-more">
            {child.total === 0 ? 'Browse section' : `All ${child.total} page${child.total === 1 ? '' : 's'}`} →
          </Link>
        </div>
      ))}
    </div>
  );
}

/**
 * Feeds a category actually publishes. Browser auto-discovery was the only way to
 * reach these, which is no way at all for a reader who wants the weekly by mail
 * or in a reader. Blog-only for now because it is the only tag path with a feed.
 */
const CATEGORY_FEEDS: Record<string, { href: string; label: string }[]> = {
  blog: [
    { href: '/week-in-review.xml', label: 'Week in Review' },
    { href: '/blog.xml', label: 'All posts' },
  ],
};

function SubscribeRow({ tagPath }: { tagPath: string }) {
  const feeds = CATEGORY_FEEDS[tagPath];
  if (!feeds) return null;
  return (
    <div className="subscribe-row">
      <span className="subscribe-label">Subscribe:</span>
      {feeds.map(feed => (
        <a key={feed.href} href={feed.href} className="subscribe-link">
          <Rss size={13} aria-hidden />{feed.label}
        </a>
      ))}
    </div>
  );
}

function CategoryHero({ description, mainArticle }: { description?: string; mainArticle: PageRef | null }) {
  if (!description && !mainArticle) return null;
  return (
    <div className="category-hero">
      {description && <p className="text-text-muted text-lg">{description}</p>}
      {mainArticle && (
        <p className="category-main-article">
          The main article for this category is <Link href={mainArticle.href} className="link">{mainArticle.title}</Link>.
        </p>
      )}
    </div>
  );
}

// ========== CATEGORY RESULTS BAR ==========
/**
 * One line above the grid: how much of the category you are looking at, and the
 * two controls that change it. The sentence and its Clear link are
 * `wiki-formant/react-server`'s, shared with the other wikis.
 */
function ResultsBar({ name, tagPath, total, shown, sort, filters, letter, clearHref, hasRail, filtersOpen, onToggleFilters }: {
  name: string; tagPath: string; total: number; shown: number; sort: SortOrder;
  filters: FacetFilters; letter?: string; clearHref?: string; hasRail: boolean; filtersOpen: boolean; onToggleFilters: () => void;
}) {
  const narrowed = Object.keys(filters).length + (letter ? 1 : 0);
  return (
    <div className="results-bar">
      <FacetSummary
        shown={shown} total={total} name={name} link={Link}
        clearHref={clearHref}
      />
      <div className="row">
        {hasRail && (
          <button type="button" className={cn('filter-toggle', narrowed > 0 && 'filter-toggle-active')} onClick={onToggleFilters} aria-expanded={filtersOpen}>
            <SlidersHorizontal size={14} />Filters{narrowed > 0 && ` · ${narrowed}`}
          </button>
        )}
        {total > 1 && <SortToggle sort={sort} tagPath={tagPath} filters={filters} letter={letter} />}
      </div>
    </div>
  );
}

/** What an edit URL opened without a session says. */
const EDIT_AUTH = { title: 'Connect your wallet to edit', reason: 'Editing needs a connected Radix wallet holding the $XRD minimum for this page.' };

// ========== SAVE PHASE ==========
/**
 * A save's phases, as both editors run them: one thing happens at a time. A
 * save refused because the page moved on stays refused: its baseVersion is
 * stale, and only a reload gives the editor the version to build on.
 */
export type SavePhase =
  /** `missing` names the required metadata fields the last save was refused for. */
  | { kind: 'editing'; error: string | null; missing?: string[] }
  | { kind: 'saving' }
  | { kind: 'conflict'; message: string };

export function ConflictNotice({ message }: { message: string }) {
  return (
    <div data-callout="warning">
      <p>{message} Your changes were not saved: copy anything you want to keep, then <button type="button" className="link" onClick={() => window.location.reload()}>reload the latest version</button>.</p>
    </div>
  );
}

// ========== HOMEPAGE VIEW ==========
export function HomepageView({ page, isEditing }: { page: WikiPage | null; isEditing: boolean }) {
  const router = useRouter();
  const { status, isAuthenticated } = useAuth();
  const connect = useStore(s => s.connect);
  const [content, setContent] = useState<Block[]>((page?.content as unknown as Block[]) || []);
  const [bannerImage, setBannerImage] = useState<string | null>(page?.bannerImage || null);
  const [save, setSave] = useState<SavePhase>({ kind: 'editing', error: null });

  useEffect(() => {
    if (page) { setContent((page.content as unknown as Block[]) || []); setBannerImage(page.bannerImage || null); }
  }, [page]);

  // Unsaved work is guarded as the article editor guards it, a refused save included.
  const dirty = JSON.stringify({ content, bannerImage }) !== JSON.stringify({ content: page?.content || [], bannerImage: page?.bannerImage || null });
  const confirmLeave = useUnsavedChanges(isEditing && dirty && save.kind !== 'saving');
  useSaveShortcut(() => { if (isEditing && save.kind === 'editing') handleSave(); });

  if (isEditing && status !== 'signed-in') return <AuthRequired status={status} {...EDIT_AUTH} backHref="/" />;

  async function handleSave() {
    setSave({ kind: 'saving' });
    try {
      // The version it opened, so a save made meanwhile (a routine's, say) is a
      // 409 to reload from rather than a revision silently written over.
      const res = await sendJson('/api/wiki', 'PUT', { title: page?.title, content, bannerImage, baseVersion: page?.version });
      // The view may keep this instance across the navigation, so it leaves in the editing phase.
      if (res.ok) { setSave({ kind: 'editing', error: null }); router.push('/'); return; }
      const body = await res.json().catch(() => null);
      setSave(mustReload(res.status, body)
        ? { kind: 'conflict', message: body?.error || 'The homepage changed since it was opened.' }
        : { kind: 'editing', error: body?.error || 'Failed to save.' });
    } catch { setSave({ kind: 'editing', error: 'Failed to save: the request did not reach the wiki.' }); }
  }
  const isSaving = save.kind === 'saving';
  const canSave = save.kind === 'editing';

  if (isEditing) {
    return (
      <div className="stack">
        <div className="spread">
          <Link href="/" onClick={e => { if (!confirmLeave()) e.preventDefault(); }} className="row link-muted"><ArrowLeft size={16} /><span>Back to Homepage</span></Link>
          <Button onClick={handleSave} disabled={!canSave} size="sm" title="Save (⌘S)"><Save size={16} />{isSaving ? 'Saving...' : 'Save Changes'}</Button>
        </div>
        <h1 id="edit-homepage">Edit Homepage</h1>
        {save.kind === 'editing' && save.error && <div data-callout="error"><p>{save.error}</p></div>}
        {save.kind === 'conflict' && <ConflictNotice message={save.message} />}
        <div data-callout="info"><p>Editing the homepage requires holding <strong>{getXrdRequired('edit', '').toLocaleString('en-US')} XRD</strong> in your connected wallet. {XRD_NOT_A_FEE}</p></div>
        <Banner src={bannerImage} editable onUpload={setBannerImage} onRemove={() => setBannerImage(null)} />
        <ArticleBlocksEditor content={content} onChange={setContent} />
        <div className="spread">
          <Link href="/" onClick={e => { if (!confirmLeave()) e.preventDefault(); }}><Button variant="ghost">Cancel</Button></Link>
          <Button onClick={handleSave} disabled={!canSave}><Save size={18} />{isSaving ? 'Saving...' : 'Save Changes'}</Button>
        </div>
      </div>
    );
  }

  const infobox = findInfobox(content);
  const mainBlocks = infobox ? content.filter(b => b.type !== 'infobox') : content;

  const mainContent = (
    <>
      <BlockRenderer content={mainBlocks} />
      <div className="row-lg justify-center flex-wrap">
        {!isAuthenticated && <Button size="lg" variant="primary" onClick={connect}>Connect Radix Wallet<ArrowRight size={18} /></Button>}
        <Link href="/contents"><Button variant="secondary" size="lg">Browse Content</Button></Link>
      </div>
    </>
  );

  return (
    <div className="stack">
      <Banner src={bannerImage} title="Homepage">
        <PageActions className="justify-end" historyHref="/history" editHref={isAuthenticated ? '/edit' : undefined} />
        <h1 className="sr-only">Radix ($XRD) – The Radix DLT Crypto Wiki</h1>
      </Banner>
      {infobox && infoboxHasContent(infobox) ? (
        <div className="page-with-infobox">
          <div className="page-main-content stack">{mainContent}</div>
          <InfoboxSidebar block={infobox} title={SITE_NAME} />
        </div>
      ) : (
        mainContent
      )}
    </div>
  );
}

// ========== CATEGORY LISTING ==========
/**
 * `noun` names what the category holds – a board of ideas creates an Idea, not a Page.
 * Straight to the editor: the slug comes from the title there, in the one field that
 * edits it. This used to ask for the slug first and then show that field again.
 */
export function NewPageControl({ tagPath, noun = 'Page' }: { tagPath: string; noun?: string }) {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return null;
  return <Link href={`/${tagPath}?new`} prefetch={false}><Button size="sm"><Plus size={16} />New {noun}</Button></Link>;
}

/** The pages in a category: count bar, grid, filter rail. Stands alone, or runs under the category's hub article. */
function CategoryListing({ name, tagPath, pages, sort, total, facetGroups, filters, letters, letter, clearHref, heading }: {
  /** The category's name, as the results bar says it. */
  name: string; tagPath: string[]; pages: WikiPage[]; sort: SortOrder; total: number;
  facetGroups: FacetControlGroup[]; filters: FacetFilters; letters: Control[]; letter?: string; clearHref?: string; heading?: ReactNode;
}) {
  const [showFilters, setShowFilters] = useState(false);
  const pathStr = tagPath.join('/');
  const hasRail = facetGroups.length > 0 || letters.length > 0;

  return (
    <div className="stack">
      {heading}
      {/* The results bar says what the listing holds but is not a heading, which
          left every card title an h3 under whatever h2 the prose above happened
          to end on — on /ecosystem, 140 projects nested under "How a status is
          decided". Named for screen readers and outline parsers only; the bar
          below already says it on screen. */}
      <h2 className="sr-only">{name}</h2>
      <ResultsBar
        name={name} tagPath={pathStr} total={total} shown={pages.length} sort={sort} filters={filters} letter={letter} clearHref={clearHref}
        hasRail={hasRail} filtersOpen={showFilters} onToggleFilters={() => setShowFilters(v => !v)}
      />
      <div className={cn(hasRail && 'category-with-rail')}>
        <div className="category-results">
          {/* Nothing to list is said once, by the results bar: "No pages match
              these filters" with its Clear link, or "This section has no pages yet". */}
          {pages.length > 0 && (
            <div className="category-grid">
              {pages.map(p => (
                <Link key={p.id} href={pagePath(p.tagPath, p.slug)}>
                  <div className="page-card">
                    <PageThumb page={p} />
                    <div className="page-card-body">
                      <div className="spread">
                        <h3 className="m-0!">{p.title}</h3>
                        {p.metadata?.status && <span>{p.metadata.status}</span>}
                      </div>
                      {(() => { const snippet = (p.metadata as Record<string, string> | null)?.excerpt || p.snippet || describe(openingText(p.content)); return snippet && <p className="text-text-muted text-small line-clamp-2">{snippet}</p>; })()}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
        {/* The same links an article's infobox already carries — `Status:`,
            `Category:` — for the whole set, in the same column of the page. As
            rows of pills above the grid they were ~50 tap targets before the
            first card; as a rail the grid starts at the top. Below `md` it is
            collapsed behind one button, so a phone gets the pages first. The
            index leads: two lines against the facets' twenty, and the one
            control a 142-page category is for. */}
        <FacetBar
          link={Link} facets={facetGroups} letters={letters}
          alphaLabel="Index" alphaFirst letterCounts="title" label="Filter this category"
          classNames={{
            root: cn('category-rail', showFilters && 'category-rail-open'),
            row: 'facet-group', label: 'facet-group-label', text: 'truncate', count: 'facet-option-count',
            control: 'facet-option', controlActive: 'facet-option facet-option-active',
            letterRow: 'alpha-index', letterControl: 'alpha-letter', letterControlActive: 'alpha-letter alpha-letter-active',
          }}
        />
      </div>
    </div>
  );
}

// ========== CATEGORY VIEW ==========
export function CategoryView({ tagPath, pages, sort, total, facetGroups, filters, letters, letter, clearHref, subcategories, mainArticle, hub, nowMs }: {
  tagPath: string[]; pages: WikiPage[]; sort: SortOrder; total: number;
  facetGroups: FacetControlGroup[]; filters: FacetFilters; letters: Control[]; letter?: string;
  /** Back to the whole category, when the view is narrowed. */
  clearHref?: string;
  subcategories: SubcategorySummary[]; mainArticle: PageRef | null; hub: WikiPage | null;
  /** Server clock, so a hub's freshness notice cannot differ between SSR and hydration. */
  nowMs: number;
}) {
  const pathStr = tagPath.join('/');
  const tag = findTagByPath(tagPath);
  const title = tag?.name || tagPath.at(-1) || '';
  const controlItems = <><SubscribeRow tagPath={pathStr} /><NewPageControl tagPath={pathStr} /></>;
  // The page title already names the category and the results bar names what the
  // listing holds, so neither draws a visible heading — the outline they need is
  // carried by the section cards' own h2 and the listing's sr-only one.
  // A hub's title sits in its banner, so its controls ride above whichever comes first.
  const hubControls = <div className="row-lg justify-end empty:hidden">{controlItems}</div>;
  // A category with no pages of its own and no subcategories still needs to
  // say so, and to offer the create control.
  const listing = (total > 0 || (!hub && subcategories.length === 0)) && (
    <CategoryListing
      name={categoryLabel(tag?.name ?? '') || tagPath.at(-1) || 'this section'} tagPath={tagPath} pages={pages} sort={sort} total={total}
      facetGroups={facetGroups} filters={filters} letters={letters} letter={letter} clearHref={clearHref}
      heading={hub && hubControls}
    />
  );
  const sections = subcategories.length > 0 && (
    <section className="stack-sm" aria-label="Sections">
      {hub && !listing && hubControls}
      <SectionIndex subcategories={subcategories} />
    </section>
  );

  // The hub article owns the page — banner, title, infobox — and the section
  // index and listing become its last sections, the way a Wikipedia article
  // carries its category.
  if (hub) {
    return (
      <PageViewContent
        page={hub}
        related={{ pages: [], sharedFacet: null }}
        series={null}
        nowMs={nowMs}
        sections={sections || undefined}
        listing={listing || undefined}
      />
    );
  }

  return (
    <div className="stack">
      <Breadcrumbs path={tagPath} />
      <div className="spread">
        <h1 id={slugifyHeading(title)}>{title}</h1>
        <div className="row-lg">{controlItems}</div>
      </div>
      <CategoryHero description={tag?.description} mainArticle={mainArticle} />
      {sections}
      {listing}
    </div>
  );
}

// ========== SEE ALSO ==========
type RelatedPage = Pick<WikiPage, 'id' | 'title' | 'slug' | 'tagPath'> & { snippet?: string };
/** `sharedFacet` names the axis the ranking found in common, so the heading can be the way into the whole set. */
export type RelatedPages = { pages: RelatedPage[]; sharedFacet: SharedFacet | null };

// ========== PAGE VIEW (Read-only) ==========
function PageViewContent({ page, related, series, sections, listing, nowMs }: { page: WikiPage; related: RelatedPages; series: PageRef | null; sections?: ReactNode; listing?: ReactNode; nowMs: number }) {
  const { isAuthenticated } = useAuth();
  // Contributor stats belong to the page's *subject* — the explicit
  // metadata.subjectUserId pointer set on profile pages (community bios,
  // project accounts) — never inferred from authorship, since curated bios
  // are usually written by someone else.
  const subjectUserId = page.metadata?.subjectUserId;
  const blocks = (page.content as unknown as Block[]) || [];
  const infobox = findInfobox(blocks);
  const showInfobox = infoboxHasContent(infobox, page.metadata, page.tagPath);
  // The synthetic freshness notice defers to an author-placed outdated banner.
  const hasOutdatedBanner = blocks.some(b => b.type === 'banner' && b.variant === 'outdated');
  const fresh = hasOutdatedBanner ? null : freshnessBanner(page, nowMs, { against: 'current sources and the live ledger' });
  const sectionName = categoryLabel(findTagByPath(page.tagPath.split('/'))?.name ?? '') || page.tagPath;
  const mainBlocks = [...(fresh ? [fresh] : []), ...blocks.filter(b => b.type !== 'infobox')];
  const viewPath = pagePath(page.tagPath, page.slug);

  // Everything after the prose. On a hub it moves below the listing, so the page
  // reads article → the pages in it → provenance and discussion.
  const tail = (
    <>
      {/* The heading *is* the link: it names what these pages have in common and
          opens the filtered category holding the rest. */}
      <SeeAlso
        link={Link}
        pages={related.pages.map(p => ({ href: pagePath(p.tagPath, p.slug), title: p.title, detail: p.snippet }))}
        heading={related.sharedFacet ? <>More {related.sharedFacet.value} in {sectionName}</> : <>More from {sectionName}</>}
        href={categoryHref(page.tagPath, related.sharedFacet ? { filters: { [related.sharedFacet.key]: related.sharedFacet.value } } : {})}
      />
      {subjectUserId && <UserStats userId={subjectUserId} />}
      <PageMeta page={page} />
      <Discussion pageId={page.id} />
    </>
  );

  // A category's section index sits where a table of contents sits: after the
  // lead, before the body. On a hub that had grown to nine blocks it was
  // otherwise the last thing on the page — the navigation for 33 tutorials
  // parked below the resource directory nobody scrolls to.
  const leadEnd = mainBlocks.findIndex(b => b.type === 'content') + 1;
  const main = (
    <div className="page-main-content stack">
      {sections ? (
        <>
          <BlockRenderer content={mainBlocks.slice(0, leadEnd)} />
          {sections}
          <BlockRenderer content={mainBlocks.slice(leadEnd)} />
        </>
      ) : <BlockRenderer content={mainBlocks} />}
      {!listing && tail}
    </div>
  );

  return (
    <article className="stack">
      <Banner src={page.bannerImage} title={page.title} tagPath={page.tagPath}>
        <Breadcrumbs
          path={[...page.tagPath.split('/'), page.slug].filter(Boolean)} leafTitle={page.title}
          actions={<PageActions historyHref={`${viewPath}/history`} editHref={isAuthenticated ? `${viewPath}/edit` : undefined} />}
        />
        <h1 id={slugifyHeading(page.title)} className="m-0!">{page.title}</h1>
      </Banner>
      {showInfobox ? (
        <div className="page-with-infobox">
          {main}
          <InfoboxSidebar block={infobox ?? { id: '__infobox__', type: 'infobox', blocks: [] }} title={page.title} metadata={page.metadata} tagPath={page.tagPath} series={series} />
        </div>
      ) : main}
      {/* Full width, not nested in the article column: a card grid and a facet
          rail don't fit beside an infobox. */}
      {listing && <>{listing}<div className="stack">{tail}</div></>}
      <LinkPreview />
    </article>
  );
}

// ========== PAGE VIEW WRAPPER ==========
export function PageView({ page, tagPath, slug, isEditMode, related = { pages: [], sharedFacet: null }, series = null, nowMs }: { page: WikiPage | null; tagPath: string; slug: string; isEditMode: boolean; related?: RelatedPages; series?: PageRef | null; nowMs: number }) {
  const { status } = useAuth();
  // The header sits outside this tree and cites the page it is on; it knows
  // only the URL, and a slug is not a title.
  useEffect(() => {
    useStore.setState({ pageTitle: page?.title ?? null });
    return () => useStore.setState({ pageTitle: null });
  }, [page?.title]);

  const viewPath = pagePath(tagPath, slug);

  if (isEditMode && status !== 'signed-in') return <AuthRequired status={status} {...EDIT_AUTH} backHref={viewPath} />;
  // Keyed, so another page, or a new version of this one, opens a fresh form.
  if (!page || isEditMode) return <LazyPageEditor key={page ? `${page.id}@${page.version}` : viewPath} page={page ?? undefined} tagPath={tagPath} slug={slug} />;
  return <PageViewContent page={page} related={related} series={series} nowMs={nowMs} />;
}
