// src/app/[[...path]]/PageContent.tsx

'use client';

import { useState, useEffect, useRef, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import dynamic from 'next/dynamic';
import { ArrowLeft, ArrowRight, Save, Plus, Upload, X, Image as ImageIcon, ArrowDownAZ, CalendarPlus, RefreshCw, Clock, FileText } from 'lucide-react';
import { BlockRenderer, findInfobox, InfoboxSidebar, type InfoboxPageInfo } from '@/components/BlockRenderer';
import { UserAvatar } from '@/components/UserAvatar';
import { Footer } from '@/components/Footer';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { Badge, Button, Card, Input, StatusCard } from '@/components/ui';
import { useAuth, useStore } from '@/hooks';
import { cn, slugify, generateBannerSvg, formatRelativeTime, formatDate, getContentSnippet } from '@/lib/utils';
import { findTagByPath, getXrdRequired, type SortOrder, type TagNode } from '@/lib/tags';
import { createBlock } from '@/lib/block-utils';
import type { WikiPage, AdjacentPages } from '@/types';
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

function PageNav({ adjacent }: { adjacent: AdjacentPages }) {
  const { prev, next } = adjacent;
  if (!prev && !next) return null;
  return (
    <nav className="page-nav">
      {prev ? (
        <Link href={`/${prev.tagPath}/${prev.slug}`} className="page-nav-link">
          <span className="page-nav-label"><ArrowLeft size={14} />Previous</span>
          <span className="page-nav-title">{prev.title}</span>
        </Link>
      ) : <div />}
      {next && (
        <Link href={`/${next.tagPath}/${next.slug}`} className="page-nav-link text-right">
          <span className="page-nav-label justify-end">Next<ArrowRight size={14} /></span>
          <span className="page-nav-title">{next.title}</span>
        </Link>
      )}
    </nav>
  );
}

// ========== BANNER ==========
export function Banner({ src, title, tagPath, editable, onUpload, onRemove, pageInfo, children }: { src?: string | null; title?: string; tagPath?: string; editable?: boolean; onUpload?: (url: string) => void; onRemove?: () => void; pageInfo?: InfoboxPageInfo | null; children?: ReactNode }) {
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

  const pageInfoEl = pageInfo ? (
    <div className="banner-page-info">
      {pageInfo.author && (
        <div className="banner-info-row">
          <UserAvatar radixAddress={pageInfo.author.radixAddress} avatarUrl={pageInfo.author.avatarUrl} size="sm" />
          <span className="truncate">{pageInfo.author.displayName || pageInfo.author.radixAddress.slice(0, 16)}...</span>
        </div>
      )}
      <div className="banner-info-row">
        <Clock size={14} className="shrink-0 opacity-60" />
        <span>Updated {formatRelativeTime(pageInfo.updatedAt)}</span>
      </div>
      <div className="banner-info-row">
        <Clock size={14} className="shrink-0 opacity-60" />
        <span>Created {formatDate(pageInfo.createdAt)}</span>
      </div>
      {(pageInfo.revisionCount ?? 0) > 0 && (
        <div className="banner-info-row">
          <FileText size={14} className="shrink-0 opacity-60" />
          <span>{pageInfo.revisionCount} revisions</span>
        </div>
      )}
    </div>
  ) : null;

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
      {(children || pageInfoEl) && (
        <div className="banner-overlay">
          <div className="banner-overlay-inner">
            <div className="banner-overlay-left">{children}</div>
            {pageInfoEl}
          </div>
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

export function SortToggle({ sort, tagPath }: { sort: SortOrder; tagPath: string }) {
  const router = useRouter();
  return (
    <div className="toggle-group-sm">
      {SORT_OPTIONS.map(o => (
        <button key={o.value} className={cn('toggle-option-sm', sort === o.value && 'bg-accent text-text-inverted')}
          onClick={() => router.push(`/${tagPath}?sort=${o.value}`)} title={o.label}><o.icon size={14} /></button>
      ))}
    </div>
  );
}

// ========== CATEGORY HERO ==========
function CategoryHero({ tag, tagPath }: { tag: TagNode; tagPath: string }) {
  const children = tag.children?.filter(c => !c.hidden);
  if (!tag.description && !children?.length) return null;
  return (
    <div className="category-hero">
      {tag.description && <p className="text-text-muted text-lg">{tag.description}</p>}
      {children && children.length > 0 && (
        <div className="category-hero-grid">
          {children.map(child => (
            <Link key={child.slug} href={`/${tagPath}/${child.slug}`} className="category-hero-card">
              <span className="font-medium">{child.name}</span>
              {child.description && <span className="text-text-muted text-small">{child.description}</span>}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

// ========== CATEGORY SUMMARY ==========
function CategorySummary({ tag, tagPath, pages }: { tag: TagNode | null; tagPath: string[]; pages: WikiPage[] }) {
  const categoryName = tag?.name?.replace(/^\p{Emoji_Presentation}\s*/u, '') || tagPath[tagPath.length - 1] || 'this section';
  const latest = pages.length > 0 ? pages.reduce((acc, p) => (new Date(p.updatedAt) > new Date(acc.updatedAt) ? p : acc), pages[0]!) : null;
  const parent = tagPath.length > 1 ? findTagByPath(tagPath.slice(0, -1)) : null;
  const siblings = parent?.children?.filter(c => !c.hidden && c.slug !== tagPath[tagPath.length - 1]) ?? [];
  const parentPath = tagPath.slice(0, -1).join('/');

  if (pages.length === 0 && siblings.length === 0) return null;

  return (
    <div className="category-summary stack-sm">
      {pages.length > 0 && latest && (
        <p className="text-text-muted text-small">
          {categoryName} contains <strong>{pages.length}</strong> page{pages.length === 1 ? '' : 's'}, last updated {formatRelativeTime(latest.updatedAt)}.
        </p>
      )}
      {siblings.length > 0 && parent && (
        <div className="stack-xs">
          <span className="sidebar-label">Related sections in {parent.name.replace(/^\p{Emoji_Presentation}\s*/u, '')}</span>
          <ul className="related-sections">
            {siblings.map(s => (
              <li key={s.slug}>
                <Link href={`/${parentPath}/${s.slug}`} className="related-section-link">
                  <span className="font-medium">{s.name}</span>
                  {s.description && <span className="text-text-muted text-small"> — {s.description}</span>}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
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
        <div data-callout="info"><p>Editing the homepage requires <strong>{getXrdRequired('edit', '').toLocaleString()} XRD</strong></p></div>
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
      <Footer />
    </>
  );

  const pageInfo = page ? { author: page.author, updatedAt: page.updatedAt, createdAt: page.createdAt, revisionCount: page._count?.revisions ?? 0 } : null;

  return (
    <div className="stack">
      <Banner src={bannerImage} title="Homepage" pageInfo={pageInfo}>
        <h1 className="sr-only">RADIX Wiki</h1>
      </Banner>
      {infobox ? (
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
export function CategoryView({ tagPath, pages, sort }: { tagPath: string[]; pages: WikiPage[]; sort: SortOrder }) {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const pathStr = tagPath.join('/');
  const [newSlug, setNewSlug] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const tag = findTagByPath(tagPath);
  const canCreatePages = isAuthenticated;

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
      {tag && <CategoryHero tag={tag} tagPath={pathStr} />}
      <CategorySummary tag={tag} tagPath={tagPath} pages={pages} />
      <div className="center">
        <SortToggle sort={sort} tagPath={pathStr} />
      </div>
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
                    {p.metadata?.status && <span title={p.metadata.status === '🟢' ? 'Active' : p.metadata.status === '🟠' ? 'In Development' : 'Inactive'}>{p.metadata.status}</span>}
                  </div>
                  {(() => { const snippet = getContentSnippet(p.content); return snippet && <p className="text-text-muted text-small line-clamp-2">{snippet}</p>; })()}
                </div>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <Card className="empty-state">
          <p className="text-text-muted">No pages in this category yet.</p>
          {canCreatePages && <small className="mt-2 block">Click "New Page" above to create one.</small>}
        </Card>
      )}
    </div>
  );
}

// ========== SEE ALSO ==========
export type RelatedPage = Pick<WikiPage, 'id' | 'title' | 'slug' | 'tagPath'> & { snippet?: string };

function SeeAlso({ pages, tagPath }: { pages: RelatedPage[]; tagPath: string }) {
  if (!pages.length) return null;
  const sectionTag = findTagByPath(tagPath.split('/'));
  const sectionName = sectionTag?.name?.replace(/^\p{Emoji_Presentation}\s*/u, '') || tagPath;
  return (
    <aside className="see-also" aria-labelledby="see-also-heading">
      <h2 id="see-also-heading" className="text-h4">See also</h2>
      <p className="text-text-muted text-small">More from {sectionName}.</p>
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
function PageViewContent({ page, adjacent, related }: { page: WikiPage; adjacent: AdjacentPages; related: RelatedPage[] }) {
  const { isAuthenticated } = useAuth();
  const isCommunityPage = page.tagPath.startsWith('community');
  const blocks = (page.content as unknown as Block[]) || [];
  const infobox = findInfobox(blocks) || { id: '__infobox__', type: 'infobox' as const, blocks: [] };
  const mainBlocks = blocks.filter(b => b.type !== 'infobox');

  const pageInfo = { author: page.author, updatedAt: page.updatedAt, createdAt: page.createdAt, revisionCount: page._count?.revisions ?? 0 };

  return (
    <article className="stack">
      <Banner src={page.bannerImage} title={page.title} tagPath={page.tagPath} pageInfo={pageInfo}>
        <Breadcrumbs path={[...page.tagPath.split('/'), page.slug]} />
        <h1 id={slugify(page.title)} className="m-0!">{page.title}</h1>
      </Banner>
      <div className="page-with-infobox">
        <div className="page-main-content stack">
          <BlockRenderer content={mainBlocks} />
          <SeeAlso pages={related} tagPath={page.tagPath} />
          {isCommunityPage && <UserStats authorId={page.authorId} />}
          <Discussion pageId={page.id} tagPath={page.tagPath} />
          <PageNav adjacent={adjacent} />
          {isAuthenticated && (
            <Link href={`/${page.tagPath}/${page.slug}/edit`} className="edit-cta">Something missing? Edit this page →</Link>
          )}
        </div>
        <InfoboxSidebar block={infobox} metadata={page.metadata} tagPath={page.tagPath} />
      </div>
    </article>
  );
}

// ========== PAGE VIEW WRAPPER ==========
export function PageView({ page, tagPath, slug, isEditMode, adjacent, related = [] }: { page: WikiPage | null; tagPath: string; slug: string; isEditMode: boolean; adjacent: AdjacentPages; related?: RelatedPage[] }) {
  const { isAuthenticated } = useAuth();

  const viewPath = `/${tagPath}/${slug}`;

  if (isEditMode && !isAuthenticated) return <StatusCard status="authRequired" backHref={viewPath} />;
  if (!page && !isAuthenticated) return <StatusCard status="notFound" backHref="/" />;
  if (!page && isAuthenticated) return <LazyPageEditor tagPath={tagPath} slug={slug} />;
  if (!page) return <StatusCard status="notFound" backHref="/" />;
  return isEditMode ? <LazyPageEditor page={page} tagPath={tagPath} slug={slug} /> : <PageViewContent page={page} adjacent={adjacent} related={related} />;
}
