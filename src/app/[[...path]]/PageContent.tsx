// src/app/[[...path]]/PageContent.tsx

'use client';

import { useState, useEffect, useRef, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import dynamic from 'next/dynamic';
import { ArrowLeft, ArrowRight, Trash2, Save, FileText, Plus, RotateCcw, User, Upload, X, Image as ImageIcon } from 'lucide-react';
import { BlockRenderer, createDefaultPageContentSync as createDefaultPageContent } from '@/components/Blocks';
import { Discussion } from '@/components/Discussion';
import { Footer } from '@/components/Footer';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { UserStats } from '@/components/UserStats';
import { Button, Card, Badge, Input } from '@/components/ui';
import { useAuth } from '@/hooks';
import { formatDate, slugify } from '@/lib/utils';
import { findTagByPath, isAuthorOnlyPath } from '@/lib/tags';
import type { WikiPage } from '@/types';
import type { Block } from '@/components/BlockRenderer';

// Lazy load BlockEditor - only when editing
const BlockEditor = dynamic(() => import('@/components/BlockEditor').then(m => m.BlockEditor), {
  ssr: false,
  loading: () => <div className="h-64 skeleton rounded-lg" />,
});

export interface WikiPageWithRevisions extends WikiPage {
  revisions?: { id: string }[];
}

// ========== STATUS CARDS ==========
const STATUS = {
  authRequired: { title: 'Authentication Required', message: 'Please connect your Radix wallet.' },
  notFound: { title: 'Page not found', message: "The page you're looking for doesn't exist." },
  notAuthorized: { title: 'Not Authorized', message: 'You can only edit your own pages in this category.' },
  invalidPath: { title: 'Invalid path', message: 'The path you entered is not valid.' },
  error: { title: 'Error', message: 'Failed to load page' },
} as const;

export function StatusCard({ status, backHref }: { status: keyof typeof STATUS; backHref: string }) {
  const { title, message } = STATUS[status];
  return (
    <div className="center">
      <Card className="text-center max-w-md">
        <div className="stack items-center py-12">
          <div className="center w-16 h-16 rounded-2xl bg-surface-2 text-muted"><FileText size={32} /></div>
          <h1>{title}</h1>
          <p className="text-muted">{message}</p>
          <Link href={backHref}><Button variant="secondary"><ArrowLeft size={18} />Back</Button></Link>
        </div>
      </Card>
    </div>
  );
}

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

// ========== BANNER ==========
function Banner({ src, editable, onUpload, onRemove, children }: { 
  src?: string | null; editable?: boolean; onUpload?: (url: string) => void; onRemove?: () => void; children?: ReactNode;
}) {
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
      <div className="banner-container border-2 border-dashed border-border-muted rounded-lg bg-surface-1/50">
        {FileInput}
        <button onClick={() => fileInputRef.current?.click()} disabled={isUploading} className="w-full h-full center text-muted hover:text-text hover:bg-surface-2/50 transition-colors">
          <div className="stack-sm items-center"><ImageIcon size={32} /><span>{isUploading ? 'Uploading...' : 'Add Banner Image'}</span></div>
        </button>
        {children && <div className="banner-overlay">{children}</div>}
      </div>
    );
  }

  if (!src && !children) return null;

  return (
    <div className="banner-container relative rounded-lg overflow-hidden">
      {src ? (
        <Image src={src} alt="Page banner" fill className="banner-image object-cover" sizes="100vw" priority />
      ) : (
        <div className="banner-placeholder" />
      )}
      {children && <div className="banner-overlay">{children}</div>}
      {editable && (
        <div className="absolute top-2 right-2 row z-10">
          {FileInput}
          <button onClick={() => fileInputRef.current?.click()} disabled={isUploading} className="icon-btn bg-surface-0/80 backdrop-blur-sm" title="Change banner"><Upload size={16} /></button>
          {onRemove && src && <button onClick={onRemove} className="icon-btn bg-surface-0/80 backdrop-blur-sm text-error hover:text-error" title="Remove banner"><X size={16} /></button>}
        </div>
      )}
    </div>
  );
}

// ========== HOMEPAGE VIEW ==========
export function HomepageView({ page, isEditing }: { page: WikiPageWithRevisions | null; isEditing: boolean }) {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const [content, setContent] = useState<Block[]>((page?.content as unknown as Block[]) || []);
  const [bannerImage, setBannerImage] = useState<string | null>(page?.bannerImage || null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (page) {
      setContent((page.content as unknown as Block[]) || []);
      setBannerImage(page.bannerImage || null);
    }
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
    return (
      <div className="stack">
        <div className="spread">
          <Link href="/" className="row link-muted"><ArrowLeft size={16} /><span>Back to Homepage</span></Link>
          <Button onClick={handleSave} disabled={isSaving} size="sm"><Save size={16} />{isSaving ? 'Saving...' : 'Save Changes'}</Button>
        </div>
        <h1>Edit Homepage</h1>
        <Banner src={bannerImage} editable onUpload={setBannerImage} onRemove={() => setBannerImage(null)} />
        <BlockEditor content={content} onChange={setContent} />
        <div className="spread">
          <Link href="/"><Button variant="ghost">Cancel</Button></Link>
          <Button onClick={handleSave} disabled={isSaving}><Save size={18} />{isSaving ? 'Saving...' : 'Save Changes'}</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="stack">
      <Banner src={bannerImage} />
      <BlockRenderer content={content} />
      <div className="row-md justify-center wrap">
        {!isAuthenticated && <Button size="lg" variant="primary" onClick={() => document.querySelector<HTMLButtonElement>('#radix-connect-btn button')?.click()}>Connect Radix Wallet<ArrowRight size={18} /></Button>}
        <Link href="/contents"><Button variant="secondary" size="lg">Browse Content</Button></Link>
      </div>
      <Footer />
    </div>
  );
}

// ========== CATEGORY VIEW ==========
export function CategoryView({ tagPath, pages }: { tagPath: string[]; pages: WikiPage[] }) {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const pathStr = tagPath.join('/');
  const [newSlug, setNewSlug] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const tag = findTagByPath(tagPath);
  const canCreatePages = isAuthenticated && pathStr !== 'community';

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
      {tag?.children?.length ? <div className="row wrap">{tag.children.map(c => <Link key={c.slug} href={`/${pathStr}/${c.slug}`}><Badge variant="secondary" className="cursor-pointer hover:brightness-110">{c.name}</Badge></Link>)}</div> : null}
      {pages.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {pages.map(p => (
            <Link key={p.id} href={`/${p.tagPath}/${p.slug}`}>
              <Card interactive className="h-full overflow-hidden p-0!">
                {p.bannerImage ? (
                  <div className="aspect-4/1 overflow-hidden relative">
                    <Image src={p.bannerImage} alt="" fill className="object-cover group-hover:scale-105 transition-transform duration-300" sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw" />
                  </div>
                ) : (
                  <div className="aspect-4/1 bg-surface-2 center"><FileText size={24} className="text-muted" /></div>
                )}
                <div className="stack-sm p-4">
                  <h3 className="m-0!">{p.title}</h3>
                  {p.excerpt && <p className="text-muted text-small line-clamp-2">{p.excerpt}</p>}
                </div>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <Card className="text-center py-12">
          <p className="text-muted">No pages in this category yet.</p>
          {canCreatePages && <small className="mt-2 block">Click "New Page" above to create one.</small>}
        </Card>
      )}
    </div>
  );
}

// ========== PAGE EDITOR ==========
function PageEditor({ page, tagPath, slug }: { page?: WikiPageWithRevisions; tagPath: string; slug: string }) {
  const { user } = useAuth();
  const isCreating = !page;
  const viewPath = `/${tagPath}/${slug}`;
  const [title, setTitle] = useState('');
  const [content, setContent] = useState<Block[]>([]);
  const [bannerImage, setBannerImage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (page) { setTitle(page.title); setContent(page.content as unknown as Block[]); setBannerImage(page.bannerImage || null); }
    else { setTitle(''); setContent(createDefaultPageContent()); setBannerImage(null); }
  }, [page?.id, tagPath, slug]);

  const save = async () => {
    if (!title.trim()) { alert('Title is required'); return; }
    setIsSaving(true);
    try {
      const exists = page || (await fetch(`/api/wiki/${tagPath}/${slug}`).then(r => r.ok));
      const method = exists ? 'PUT' : 'POST';
      const endpoint = exists ? `/api/wiki/${tagPath}/${slug}` : '/api/wiki';
      const body = exists ? { title, content, bannerImage } : { title, content, bannerImage, tagPath, slug };
      const res = await fetch(endpoint, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json();
      if (res.ok) window.location.href = `/${data.tagPath}/${data.slug}`;
      else { alert(data.error || 'Failed to save'); setIsSaving(false); }
    } catch { alert('Failed to save'); setIsSaving(false); }
  };

  if (page && user && isAuthorOnlyPath(page.tagPath) && page.authorId !== user.id) {
    return <StatusCard status="notAuthorized" backHref={viewPath} />;
  }

  const canSave = isCreating ? title.trim() : true;
  const backHref = isCreating ? `/${tagPath}` : viewPath;
  const saveLabel = isCreating ? (isSaving ? 'Creating...' : 'Create Page') : (isSaving ? 'Saving...' : 'Save Changes');

  return (
    <article className="stack">
      <Breadcrumbs path={[...tagPath.split('/'), slug]} suffix={isCreating ? 'Create' : 'Edit'} />
      <header className="stack pb-6 border-b border-border">
        <div className="spread">
          <Link href={backHref} className="row link-muted"><ArrowLeft size={16} /><span>{isCreating ? 'Back to Category' : 'Back to Page'}</span></Link>
          <Button onClick={save} disabled={isSaving || !canSave} size="sm"><Save size={16} />{saveLabel}</Button>
        </div>
        {isCreating && <div className="callout"><p>Creating new page at <code>/{tagPath}/{slug}</code></p></div>}
        <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="Page Title" className="input-ghost text-h1 font-bold" autoFocus={isCreating} />
      </header>
      <Banner src={bannerImage} editable onUpload={setBannerImage} onRemove={() => setBannerImage(null)} />
      <BlockEditor content={content} onChange={setContent} />
    </article>
  );
}

// ========== PAGE VIEW (Read-only) ==========
function PageViewContent({ page }: { page: WikiPageWithRevisions }) {
  const router = useRouter();
  const { user } = useAuth();
  const [isDeleting, setIsDeleting] = useState(false);
  const isAuthor = user && page.authorId === user.id;
  const isCommunityPage = page.tagPath.startsWith('community');

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this page?')) return;
    setIsDeleting(true);
    try {
      const r = await fetch(`/api/wiki/${page.tagPath}/${page.slug}`, { method: 'DELETE' });
      if (r.ok) router.push(`/${page.tagPath}`);
      else alert('Failed to delete');
    } catch { alert('Failed to delete'); }
    finally { setIsDeleting(false); }
  };

  return (
    <article className="stack">
      <Banner src={page.bannerImage}>
        <Breadcrumbs path={[...page.tagPath.split('/'), page.slug]} />
        <h1 className="m-0!">{page.title}</h1>
      </Banner>
      <BlockRenderer content={page.content} />
      {isCommunityPage && <UserStats authorId={page.authorId} />}
      <Discussion pageId={page.id} />
      {isAuthor && (
        <div className="pt-6 border-t border-border">
          <Button variant="ghost" size="sm" onClick={handleDelete} disabled={isDeleting} className="text-error hover:bg-error/10">
            <Trash2 size={16} />{isDeleting ? 'Deleting...' : 'DELETE PAGE'}
          </Button>
        </div>
      )}
    </article>
  );
}

// ========== PAGE VIEW WRAPPER ==========
export function PageView({ page, tagPath, slug, isEditMode }: { page: WikiPageWithRevisions | null; tagPath: string; slug: string; isEditMode: boolean }) {
  const { isAuthenticated } = useAuth();
  const viewPath = `/${tagPath}/${slug}`;

  if (isEditMode && !isAuthenticated) return <StatusCard status="authRequired" backHref={viewPath} />;
  if (!page && !isAuthenticated) return <StatusCard status="notFound" backHref="/" />;
  if (!page && isAuthenticated) return <PageEditor tagPath={tagPath} slug={slug} />;
  if (!page) return <StatusCard status="notFound" backHref="/" />;
  return isEditMode ? <PageEditor page={page} tagPath={tagPath} slug={slug} /> : <PageViewContent page={page} />;
}

// ========== HISTORY VIEW ==========
type HistoryData = { page: { id: string; title: string }; revisions: { id: string; title: string; message?: string | null; createdAt: Date; author?: { id: string; displayName?: string | null; radixAddress: string } }[] } | null;

export function HistoryView({ data, tagPath, slug, isHomepage }: { data: HistoryData; tagPath: string; slug: string; isHomepage?: boolean }) {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const [restoringId, setRestoringId] = useState<string | null>(null);
  
  const apiBase = isHomepage ? '/api/wiki' : `/api/wiki/${tagPath}/${slug}`;
  const viewPath = isHomepage ? '/' : `/${tagPath}/${slug}`;

  if (!data) {
    return (
      <div className="stack">
        {!isHomepage && <Breadcrumbs path={[...tagPath.split('/'), slug]} suffix="History" />}
        <Card className="text-center py-12"><p className="text-error">Page not found</p></Card>
      </div>
    );
  }

  const handleRestore = async (revisionId: string) => {
    if (!confirm('Restore this revision? This will replace the current content.')) return;
    setRestoringId(revisionId);
    try {
      const r = await fetch(`${apiBase}/history`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ revisionId }) });
      if (r.ok) router.push(viewPath);
      else alert((await r.json()).error || 'Failed to restore');
    } catch { alert('Failed to restore'); }
    finally { setRestoringId(null); }
  };

  return (
    <div className="stack">
      {!isHomepage && <Breadcrumbs path={[...tagPath.split('/'), slug]} suffix="History" />}
      <div className="spread">
        <h1>{isHomepage ? 'Homepage History' : `History: ${data.page.title}`}</h1>
        <Link href={viewPath}><Button variant="secondary" size="sm"><ArrowLeft size={16} />{isHomepage ? 'Back to Homepage' : 'Back to Page'}</Button></Link>
      </div>
      {data.revisions.length > 0 ? (
        <div className="stack">
          {data.revisions.map((rev, i) => (
            <Card key={rev.id} className={i === 0 ? 'border-accent' : ''}>
              <div className="stack-sm">
                <div className="spread">
                  <div className="row"><span className="font-medium">{rev.title}</span>{i === 0 && <Badge variant="default">Current</Badge>}</div>
                  <div className="row">
                    <span className="text-muted text-small">{formatDate(rev.createdAt, { hour: '2-digit', minute: '2-digit' })}</span>
                    {i > 0 && isAuthenticated && <Button variant="ghost" size="sm" onClick={() => handleRestore(rev.id)} disabled={restoringId === rev.id}><RotateCcw size={14} />{restoringId === rev.id ? 'Restoring...' : 'Restore'}</Button>}
                  </div>
                </div>
                {rev.message && <p className="text-muted">{rev.message}</p>}
                <div className="row text-small text-muted"><User size={14} /><span>{rev.author?.displayName || rev.author?.radixAddress.slice(0, 16) + '...'}</span></div>
              </div>
            </Card>
          ))}
        </div>
      ) : <Card className="text-center py-12"><p className="text-muted">No revision history available.</p></Card>}
    </div>
  );
}