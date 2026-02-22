// src/app/[[...path]]/PageContent.tsx

'use client';

import { useState, useEffect, useRef, useCallback, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import dynamic from 'next/dynamic';
import { ArrowLeft, ArrowRight, Trash2, Save, FileText, Plus, Upload, X, Image as ImageIcon, Link2, MessageSquare } from 'lucide-react';
import { BlockRenderer, findInfobox, InfoboxSidebar } from '@/components/BlockRenderer';
import { Footer } from '@/components/Footer';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { Button, Card, Input, StatusCard } from '@/components/ui';
import { useAuth, useStore } from '@/hooks';
import { slugify, formatRelativeTime, generateBannerSvg } from '@/lib/utils';
import { findTagByPath, isAuthorOnlyPath, getMetadataKeys, getXrdRequired, type MetadataKeyDefinition, type SortOrder, type TagNode } from '@/lib/tags';
import { createBlock } from '@/lib/block-utils';
import type { WikiPage, AdjacentPages, PageMetadata, ForumThread } from '@/types';
import type { Block } from '@/types/blocks';

const BlockEditor = dynamic(() => import('@/components/BlockEditor').then(m => m.BlockEditor), {
  ssr: false,
  loading: () => <div className="h-64 skeleton rounded-lg" />,
});

const InfoboxEditor = dynamic(() => import('@/components/BlockEditor').then(m => m.InfoboxEditor), {
  ssr: false,
  loading: () => <div className="h-32 skeleton rounded-lg" />,
});

const HistoryView = dynamic(() => import('@/components/HistoryView'), {
  ssr: false,
  loading: () => <div className="h-64 skeleton rounded-lg" />,
});

export type { HistoryData } from '@/components/HistoryView';
export { HistoryView };

const Discussion = dynamic(() => import('@/components/Discussion').then(m => m.Discussion), { ssr: false });
const UserStats = dynamic(() => import('@/components/UserStats').then(m => m.UserStats));

function useSyncPageInfo(page: WikiPage | null) {
  const setPageInfo = useStore(s => s.setPageInfo);
  useEffect(() => {
    if (page) {
      setPageInfo({
        updatedAt: page.updatedAt,
        createdAt: page.createdAt,
        author: page.author,
        revisionCount: page._count?.revisions ?? 0,
      });
    } else {
      setPageInfo(null);
    }
    return () => setPageInfo(null);
  }, [page, setPageInfo]);
}

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
function Banner({ src, title, tagPath, editable, onUpload, onRemove, children }: { src?: string | null; title?: string; tagPath?: string; editable?: boolean; onUpload?: (url: string) => void; onRemove?: () => void; children?: ReactNode }) {
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
        <Image src={src} alt="Page banner" fill className="banner-image" sizes="100vw" priority />
      ) : generativeSrc ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={generativeSrc} alt="" className="banner-image absolute inset-0" />
      ) : (
        <div className="banner-placeholder" />
      )}
      {children && <div className="banner-overlay">{children}</div>}
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

// ========== HOMEPAGE VIEW ==========
export function HomepageView({ page, isEditing }: { page: WikiPage | null; isEditing: boolean }) {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const connect = useStore(s => s.connect);
  const [content, setContent] = useState<Block[]>((page?.content as unknown as Block[]) || []);
  const [bannerImage, setBannerImage] = useState<string | null>(page?.bannerImage || null);
  const [isSaving, setIsSaving] = useState(false);
  useSyncPageInfo(page);

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
        <div className="callout"><p>Editing the homepage requires <strong>{getXrdRequired('edit', '').toLocaleString()} XRD</strong></p></div>
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

  return (
    <div className="stack">
      <Banner src={bannerImage} title="Homepage" />
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

// ========== SORT TOGGLE ==========
const SORT_OPTIONS: { value: SortOrder; label: string }[] = [
  { value: 'title', label: 'A–Z' },
  { value: 'newest', label: 'Newest' },
  { value: 'recent', label: 'Updated' },
];

function SortToggle({ sort, tagPath }: { sort: SortOrder; tagPath: string }) {
  const router = useRouter();
  return (
    <div className="toggle-group-sm">
      {SORT_OPTIONS.map(o => (
        <button key={o.value} className={sort === o.value ? 'toggle-option-sm-active' : 'toggle-option-sm'}
          onClick={() => router.push(`/${tagPath}?sort=${o.value}`)}>{o.label}</button>
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
                    <Image src={p.bannerImage} alt="" fill className="object-cover group-hover:scale-105 transition-transform duration-300" sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw" />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={generateBannerSvg(p.title, p.tagPath)} alt="" className="w-full h-full object-cover" />
                  )}
                </div>
                <div className="page-card-body">
                  <h3 className="m-0!">{p.title}</h3>
                  {p.excerpt && <p className="text-muted text-small line-clamp-2">{p.excerpt}</p>}
                </div>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <Card className="empty-state">
          <p className="text-muted">No pages in this category yet.</p>
          {canCreatePages && <small className="mt-2 block">Click "New Page" above to create one.</small>}
        </Card>
      )}
    </div>
  );
}

// ========== FORUM VIEW ==========
export function ForumView({ tagPath, threads, sort }: { tagPath: string[]; threads: ForumThread[]; sort: SortOrder }) {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const pathStr = tagPath.join('/');
  const [newSlug, setNewSlug] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const tag = findTagByPath(tagPath);

  return (
    <div className="stack">
      <Breadcrumbs path={tagPath} />
      <div className="spread">
        <h1>{tag?.name || tagPath[tagPath.length - 1]}</h1>
        {isAuthenticated && (
          <div className="row">
            {showCreate ? (
              <>
                <Input value={newSlug} onChange={e => setNewSlug(e.target.value)} placeholder="thread-slug" className="w-48" onKeyDown={e => e.key === 'Enter' && newSlug.trim() && router.push(`/${pathStr}/${slugify(newSlug)}`)} autoFocus />
                <Button size="sm" onClick={() => { const s = slugify(newSlug); if (s) router.push(`/${pathStr}/${s}`); }} disabled={!newSlug.trim()}>Go</Button>
                <Button size="sm" variant="ghost" onClick={() => setShowCreate(false)}>Cancel</Button>
              </>
            ) : <Button size="sm" onClick={() => setShowCreate(true)}><Plus size={16} />New Thread</Button>}
          </div>
        )}
      </div>
      <div className="center">
        <SortToggle sort={sort} tagPath={pathStr} />
      </div>
      {threads.length > 0 ? (
        <div className="forum-list">
          {threads.map(t => (
            <Link key={t.id} href={`/${t.tagPath}/${t.slug}`} className="forum-row">
              <div className="forum-row-main">
                <span className="forum-row-title">{t.title}</span>
                <span className="forum-row-author">{t.author?.displayName || t.author?.radixAddress?.slice(0, 12) + '...'}</span>
              </div>
              <div className="forum-row-meta">
                <span className="forum-row-replies"><MessageSquare size={14} />{t.replyCount}</span>
                <span className="forum-row-activity">{formatRelativeTime(t.lastActivity)}</span>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <Card className="empty-state">
          <p className="text-muted">No threads yet.</p>
          {isAuthenticated && <small className="mt-2 block">Click &quot;New Thread&quot; to start a discussion.</small>}
        </Card>
      )}
    </div>
  );
}

// ========== METADATA FIELDS ==========
function RichInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (ref.current && ref.current.innerHTML !== value) ref.current.innerHTML = value || '';
  }, [value]);

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const html = e.clipboardData.getData('text/html');
    if (!html) return;
    e.preventDefault();
    const doc = new DOMParser().parseFromString(html, 'text/html');
    doc.body.querySelectorAll('*').forEach(el => {
      if (el.tagName === 'A') { Array.from(el.attributes).forEach(a => { if (a.name !== 'href') el.removeAttribute(a.name); }); return; }
      const parent = el.parentNode!;
      while (el.firstChild) parent.insertBefore(el.firstChild, el);
      parent.removeChild(el);
    });
    const sel = window.getSelection();
    if (!sel?.rangeCount) return;
    const range = sel.getRangeAt(0);
    range.deleteContents();
    const frag = range.createContextualFragment(doc.body.innerHTML);
    range.insertNode(frag);
    range.collapse(false);
    onChangeRef.current(ref.current?.innerHTML || '');
  }, []);

  return (
    <div
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      onInput={() => onChangeRef.current(ref.current?.innerHTML || '')}
      onPaste={handlePaste}
      data-placeholder={placeholder}
      className="rich-input"
    />
  );
}

function MetadataFields({ metadataKeys, metadata, onChange }: { metadataKeys: MetadataKeyDefinition[]; metadata: PageMetadata; onChange: (metadata: PageMetadata) => void }) {
  if (metadataKeys.length === 0) return null;

  const updateField = (key: string, value: string) => {
    onChange({ ...metadata, [key]: value });
  };

  return (
    <div className="metadata-panel">
      <h4 className="text-small font-medium text-muted m-0!">Page Metadata</h4>
      <div className="metadata-grid">
        {metadataKeys.map(({ key, label, type, required, options }) => (
          <div key={key} className="stack-xs">
            <label className="text-small font-medium">
              {label}{required && <span className="text-error ml-1">*</span>}
            </label>
            {type === 'select' && options ? (
              <select
                value={metadata[key] || ''}
                onChange={e => updateField(key, e.target.value)}
                className="input"
              >
                <option value="">Select...</option>
                {options.map(opt => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            ) : type === 'text' ? (
              <RichInput
                value={metadata[key] || ''}
                onChange={v => updateField(key, v)}
                placeholder={label}
              />
            ) : type === 'url' ? (
              <Input
                type="url"
                value={metadata[key] || ''}
                onChange={e => updateField(key, e.target.value)}
                placeholder={label}
              />
            ) : type === 'date' ? (
              <Input
                type="date"
                value={metadata[key] || ''}
                onChange={e => updateField(key, e.target.value)}
              />
            ) : (
              <Input
                value={metadata[key] || ''}
                onChange={e => updateField(key, e.target.value)}
                placeholder={label}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ========== PAGE EDITOR ==========
function PageEditor({ page, tagPath, slug }: { page?: WikiPage; tagPath: string; slug: string }) {
  const router = useRouter();
  const { user } = useAuth();
  const isCreating = !page;
  const viewPath = `/${tagPath}/${slug}`;
  const [title, setTitle] = useState('');
  const [content, setContent] = useState<Block[]>([]);
  const [bannerImage, setBannerImage] = useState<string | null>(null);
  const [metadata, setMetadata] = useState<PageMetadata>({});
  const [editSlug, setEditSlug] = useState(slug);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const isAuthor = user && page?.authorId === user.id;
  const metadataKeys = getMetadataKeys(tagPath.split('/'));

  useEffect(() => {
    if (page) {
      setTitle(page.title);
      setContent(page.content as unknown as Block[]);
      setBannerImage(page.bannerImage || null);
      setMetadata((page.metadata as PageMetadata) || {});
      setEditSlug(page.slug);
    } else {
      setTitle('');
      setContent([createBlock('content')]);
      setBannerImage(null);
      setMetadata({});
    }
  }, [page, tagPath, slug]);

  const save = async () => {
    if (!title.trim()) { alert('Title is required'); return; }
    const requiredKeys = metadataKeys.filter(k => k.required);
    const missingKeys = requiredKeys.filter(k => !metadata[k.key]?.trim());
    if (missingKeys.length > 0) {
      alert(`Missing required metadata: ${missingKeys.map(k => k.label).join(', ')}`);
      return;
    }
    setIsSaving(true);
    try {
      const exists = page || (await fetch(`/api/wiki/${tagPath}/${slug}`).then(r => r.ok));
      const method = exists ? 'PUT' : 'POST';
      const endpoint = exists ? `/api/wiki/${tagPath}/${slug}` : '/api/wiki';
      const newSlug = slugify(editSlug);
      const body = exists ? { title, content, bannerImage, metadata, newSlug } : { title, content, bannerImage, metadata, tagPath, slug: newSlug || slug };
      const res = await fetch(endpoint, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json();
      if (res.ok) window.location.href = `/${data.tagPath}/${data.slug}`;
      else { alert(data.error || 'Failed to save'); setIsSaving(false); }
    } catch { alert('Failed to save'); setIsSaving(false); }
  };

  const handleDelete = async () => {
    if (!page || !confirm('Are you sure you want to delete this page?')) return;
    setIsDeleting(true);
    try {
      const r = await fetch(`/api/wiki/${page.tagPath}/${page.slug}`, { method: 'DELETE' });
      if (r.ok) router.push(`/${page.tagPath}`);
      else alert('Failed to delete');
    } catch { alert('Failed to delete'); }
    finally { setIsDeleting(false); }
  };

  if (page && user && isAuthorOnlyPath(page.tagPath) && page.authorId !== user.id) {
    return <StatusCard status="notAuthorized" backHref={viewPath} />;
  }

  const canSave = isCreating ? title.trim() : true;
  const backHref = isCreating ? `/${tagPath}` : viewPath;
  const saveLabel = isCreating ? (isSaving ? 'Creating...' : 'Create Page') : (isSaving ? 'Saving...' : 'Save Changes');

  const infobox = findInfobox(content) || createBlock('infobox') as import('@/types/blocks').InfoboxBlock;
  const mainBlocks = content.filter(b => b.type !== 'infobox');
  const updateMainBlocks = (blocks: Block[]) => setContent([...blocks, infobox]);
  const updateInfobox = (block: Block) => setContent([...content.filter(b => b.type !== 'infobox'), block]);

  return (
    <article className="stack">
      <Breadcrumbs path={[...tagPath.split('/'), slug]} suffix={isCreating ? 'Create' : 'Edit'} />
      <header className="stack pb-6 border-b border-border">
        <div className="spread">
          <Link href={backHref} className="row link-muted"><ArrowLeft size={16} /><span>{isCreating ? 'Back to Category' : 'Back to Page'}</span></Link>
          <Button onClick={save} disabled={isSaving || !canSave} size="sm"><Save size={16} />{saveLabel}</Button>
        </div>
        <div className="callout"><p>{isCreating ? `Creating new page at` : `Editing page at`} <code>/{tagPath}/{slug}</code> — requires <strong>{getXrdRequired(isCreating ? 'create' : 'edit', tagPath).toLocaleString()} XRD</strong></p></div>
        <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="Page Title" className="input-ghost text-h1 font-bold" autoFocus={isCreating} />
        <div className="slug-editor">
          <Link2 size={14} />
          <span>/{tagPath}/</span>
          <input type="text" value={editSlug} onChange={e => setEditSlug(e.target.value.toLowerCase().replace(/[^\w\s-]/g, '').replace(/[\s_]+/g, '-'))} onBlur={() => setEditSlug(slugify(editSlug))} placeholder="page-slug" />
        </div>
      </header>
      <Banner src={bannerImage} editable onUpload={setBannerImage} onRemove={() => setBannerImage(null)} />
      <MetadataFields metadataKeys={metadataKeys} metadata={metadata} onChange={setMetadata} />
      <div className="page-with-infobox">
        <div className="page-main-content">
          <BlockEditor content={mainBlocks} onChange={updateMainBlocks} />
        </div>
        <aside className="infobox-editor">
          <InfoboxEditor block={infobox} onChange={updateInfobox} />
        </aside>
      </div>
      {isAuthor && !isCreating && (
        <div className="section-divider">
          <Button variant="ghost" size="sm" onClick={handleDelete} disabled={isDeleting} className="text-error hover:bg-error/10">
            <Trash2 size={16} />{isDeleting ? 'Deleting...' : 'Delete Page'}
          </Button>
        </div>
      )}
    </article>
  );
}

// ========== PAGE VIEW (Read-only) ==========
function PageViewContent({ page, adjacent }: { page: WikiPage; adjacent: AdjacentPages }) {
  const isCommunityPage = page.tagPath.startsWith('community');
  const blocks = (page.content as unknown as Block[]) || [];
  const infobox = findInfobox(blocks) || { id: '__infobox__', type: 'infobox' as const, blocks: [] };
  const mainBlocks = blocks.filter(b => b.type !== 'infobox');

  return (
    <article className="stack">
      <Banner src={page.bannerImage} title={page.title} tagPath={page.tagPath}>
        <Breadcrumbs path={[...page.tagPath.split('/'), page.slug]} />
        <h1 id={slugify(page.title)} className="m-0!">{page.title}</h1>
      </Banner>
      <div className="page-with-infobox">
        <div className="page-main-content stack">
          <BlockRenderer content={mainBlocks} />
          {isCommunityPage && <UserStats authorId={page.authorId} />}
          <Discussion pageId={page.id} tagPath={page.tagPath} />
          <PageNav adjacent={adjacent} />
        </div>
        <InfoboxSidebar block={infobox} metadata={page.metadata} tagPath={page.tagPath} />
      </div>
    </article>
  );
}

// ========== PAGE VIEW WRAPPER ==========
export function PageView({ page, tagPath, slug, isEditMode, adjacent }: { page: WikiPage | null; tagPath: string; slug: string; isEditMode: boolean; adjacent: AdjacentPages }) {
  const { isAuthenticated } = useAuth();
  useSyncPageInfo(page);
  const viewPath = `/${tagPath}/${slug}`;

  if (isEditMode && !isAuthenticated) return <StatusCard status="authRequired" backHref={viewPath} />;
  if (!page && !isAuthenticated) return <StatusCard status="notFound" backHref="/" />;
  if (!page && isAuthenticated) return <PageEditor tagPath={tagPath} slug={slug} />;
  if (!page) return <StatusCard status="notFound" backHref="/" />;
  return isEditMode ? <PageEditor page={page} tagPath={tagPath} slug={slug} /> : <PageViewContent page={page} adjacent={adjacent} />;
}
