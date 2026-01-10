// src/app/[[...path]]/page.tsx

'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Edit, Clock, User, ArrowLeft, ArrowRight, Trash2, Save, Eye, FileText, Plus } from 'lucide-react';
import { WikiLayout } from '@/components/WikiLayout';
import { BlockEditor } from '@/components/BlockEditor';
import { BlockRenderer } from '@/components/BlockRenderer';
import { Button, Card, Badge, LoadingScreen, Input } from '@/components/ui';
import { useAuth, useIsAuthenticated } from '@/hooks/useStore';
import { formatRelativeTime, formatDate, slugify } from '@/lib/utils';
import { isValidTagPath, findTagByPath } from '@/lib/tags';
import type { WikiPage } from '@/types';
import type { BlockContent } from '@/lib/blocks';

interface WikiPageWithRevisions extends WikiPage {
  revisions?: { id: string }[];
}

const DEFAULT_HOMEPAGE_CONTENT: BlockContent = [
  { id: 'hero-heading', type: 'heading', level: 1, text: 'Welcome to RADIX Wiki' },
  { id: 'hero-paragraph', type: 'paragraph', text: 'A decentralized wiki platform powered by **Radix DLT**. Create, collaborate, and share knowledge with Web3 authentication.' },
  { id: 'features-heading', type: 'heading', level: 2, text: 'Features' },
  { id: 'features-list', type: 'list', style: 'bullet', items: [
    { text: '**Decentralized Auth** — Login securely with your Radix Wallet using ROLA verification' },
    { text: '**Collaborative** — Create and edit wiki pages with full revision history' },
    { text: '**Fast & Modern** — Built with Next.js and Tailwind CSS' },
  ]},
  { id: 'recent-heading', type: 'heading', level: 2, text: 'Recent Pages' },
  { id: 'recent-pages', type: 'recentPages', limit: 6 },
  { id: 'cta-callout', type: 'callout', variant: 'info', title: 'Get Started', text: 'Connect your Radix wallet to start creating and editing pages.' },
];

// Shared Components
function Breadcrumbs({ path, suffix }: { path: string[]; suffix?: string }) {
  return (
    <nav className="flex items-center gap-2 text-sm text-text-muted flex-wrap">
      <Link href="/" className="hover:text-text transition-colors">Home</Link>
      {path.map((segment, i) => {
        const href = '/' + path.slice(0, i + 1).join('/');
        const tag = findTagByPath(path.slice(0, i + 1));
        const isLast = i === path.length - 1 && !suffix;
        return (
          <span key={href} className="flex items-center gap-2">
            <span>/</span>
            {isLast ? <span className="text-text">{tag?.name || segment}</span> 
              : <Link href={href} className="hover:text-text transition-colors">{tag?.name || segment}</Link>}
          </span>
        );
      })}
      {suffix && <><span>/</span><span className="text-text">{suffix}</span></>}
    </nav>
  );
}

function StatusCard({ title, message, backHref = '/', icon }: { title: string; message: string; backHref?: string; icon?: React.ReactNode }) {
  return (
    <WikiLayout maxWidth="md" showSidebar={false}>
      <Card className="text-center">
        <div className="flex flex-col items-center gap-4 py-12">
          {icon && <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-surface-2 text-text-muted">{icon}</div>}
          <h1 className="text-2xl font-semibold">{title}</h1>
          <p className="text-text-muted">{message}</p>
          <Link href={backHref}><Button variant="secondary"><ArrowLeft size={18} />Back</Button></Link>
        </div>
      </Card>
    </WikiLayout>
  );
}

// Homepage View
function HomepageView({ isEditing }: { isEditing: boolean }) {
  const router = useRouter();
  const isAuthenticated = useIsAuthenticated();
  const [content, setContent] = useState<BlockContent>(DEFAULT_HOMEPAGE_CONTENT);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetch('/api/wiki').then(r => r.ok ? r.json() : null)
      .then(page => setContent(page?.content || DEFAULT_HOMEPAGE_CONTENT))
      .finally(() => setIsLoading(false));
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const r = await fetch('/api/wiki', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: 'Homepage', content }) });
      if (r.ok) router.push('/');
      else alert((await r.json()).error || 'Failed to save');
    } catch { alert('Failed to save'); }
    finally { setIsSaving(false); }
  };

  if (isEditing && !isAuthenticated) return <StatusCard title="Authentication Required" message="Please connect your Radix wallet to edit the homepage." icon={<FileText size={32} />} />;
  if (isLoading) return <WikiLayout><LoadingScreen message="Loading..." /></WikiLayout>;

  if (isEditing) {
    return (
      <WikiLayout maxWidth="4xl">
        <div className="flex flex-col gap-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <Link href="/" className="flex items-center gap-1 text-text-muted hover:text-text transition-colors"><ArrowLeft size={16} /><span className="text-sm">Back to Homepage</span></Link>
            <div className="flex items-center gap-2">
              <Link href="/"><Button variant="secondary" size="sm"><Eye size={16} />Preview</Button></Link>
              <Button onClick={handleSave} disabled={isSaving} size="sm"><Save size={16} />{isSaving ? 'Saving...' : 'Save Changes'}</Button>
            </div>
          </div>
          <h1 className="text-3xl font-bold">Edit Homepage</h1>
          <BlockEditor content={content} onChange={setContent} />
          <div className="flex items-center justify-between">
            <Link href="/"><Button variant="ghost">Cancel</Button></Link>
            <Button onClick={handleSave} disabled={isSaving}><Save size={18} />{isSaving ? 'Saving...' : 'Save Changes'}</Button>
          </div>
        </div>
      </WikiLayout>
    );
  }

  return (
    <WikiLayout>
      <div className="flex flex-col gap-8">
        {isAuthenticated && <div className="flex justify-end"><Link href="/edit"><Button variant="secondary" size="sm"><Edit size={16} />Edit Homepage</Button></Link></div>}
        <BlockRenderer content={content} className="max-w-4xl mx-auto" />
        <div className="flex items-center gap-4 justify-center flex-wrap max-w-4xl mx-auto">
          {!isAuthenticated && <Button size="lg" variant="primary" onClick={() => document.querySelector<HTMLButtonElement>('#radix-connect-btn button')?.click()}>Connect Radix Wallet<ArrowRight size={18} /></Button>}
          <Link href="/contents"><Button variant="secondary" size="lg">Browse Content</Button></Link>
        </div>
        <footer className="border-t border-border-muted py-8 mt-8">
          <div className="flex items-center justify-between flex-wrap gap-4 text-text-muted text-sm">
            <p>© 2024 RADIX Wiki. Powered by Radix DLT.</p>
            <div className="flex items-center gap-4">
              <a href="https://radixdlt.com" target="_blank" rel="noopener noreferrer" className="hover:text-accent transition-colors">Radix DLT</a>
              <a href="https://github.com" target="_blank" rel="noopener noreferrer" className="hover:text-accent transition-colors">GitHub</a>
            </div>
          </div>
        </footer>
      </div>
    </WikiLayout>
  );
}

// Category View
function CategoryView({ tagPath }: { tagPath: string[] }) {
  const router = useRouter();
  const isAuthenticated = useIsAuthenticated();
  const [pages, setPages] = useState<WikiPage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newSlug, setNewSlug] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const tag = findTagByPath(tagPath);
  const pathStr = tagPath.join('/');

  useEffect(() => {
    fetch(`/api/wiki?tagPath=${encodeURIComponent(pathStr)}&published=true`)
      .then(r => r.ok ? r.json() : { items: [] })
      .then(d => setPages(d.items))
      .finally(() => setIsLoading(false));
  }, [pathStr]);

  const handleCreate = () => { const s = slugify(newSlug); if (s) router.push(`/${pathStr}/${s}`); };

  return (
    <WikiLayout maxWidth="4xl">
      <div className="flex flex-col gap-6">
        <Breadcrumbs path={tagPath} />
        <div className="flex items-center justify-between flex-wrap gap-4">
          <h1 className="text-3xl font-bold">{tag?.name || tagPath[tagPath.length - 1]}</h1>
          {isAuthenticated && (
            <div className="flex items-center gap-2">
              {showCreate ? (
                <>
                  <Input value={newSlug} onChange={e => setNewSlug(e.target.value)} placeholder="page-slug" className="w-48" onKeyDown={e => e.key === 'Enter' && handleCreate()} autoFocus />
                  <Button size="sm" onClick={handleCreate} disabled={!newSlug.trim()}>Go</Button>
                  <Button size="sm" variant="ghost" onClick={() => setShowCreate(false)}>Cancel</Button>
                </>
              ) : <Button size="sm" onClick={() => setShowCreate(true)}><Plus size={16} />New Page</Button>}
            </div>
          )}
        </div>
        {tag?.children?.length ? (
          <div className="flex flex-wrap gap-2">
            {tag.children.map(c => <Link key={c.slug} href={`/${pathStr}/${c.slug}`}><Badge variant="secondary" className="cursor-pointer hover:bg-surface-3">{c.name}</Badge></Link>)}
          </div>
        ) : null}
        {isLoading ? <LoadingScreen message="Loading pages..." /> : pages.length > 0 ? (
          <div className="grid gap-4">
            {pages.map(p => (
              <Link key={p.id} href={`/${p.tagPath}/${p.slug}`}>
                <Card interactive>
                  <div className="flex flex-col gap-2">
                    <h3 className="text-xl font-semibold">{p.title}</h3>
                    {p.excerpt && <p className="text-text-muted">{p.excerpt}</p>}
                    <span className="text-sm text-text-muted">{formatRelativeTime(p.updatedAt)}</span>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        ) : (
          <Card className="text-center py-12">
            <p className="text-text-muted">No pages in this category yet.</p>
            {isAuthenticated && <p className="text-sm text-text-muted mt-2">Click "New Page" above to create one.</p>}
          </Card>
        )}
      </div>
    </WikiLayout>
  );
}

// Page Editor (with inlined form logic)
function PageEditor({ page, tagPath, slug }: { page?: WikiPageWithRevisions; tagPath: string; slug: string }) {
  const router = useRouter();
  const { user } = useAuth();
  const isCreating = !page;
  const viewPath = `/${tagPath}/${slug}`;

  const [title, setTitle] = useState('');
  const [content, setContent] = useState<BlockContent>([]);
  const [isPublished, setIsPublished] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (page) { setTitle(page.title); setContent(page.content as BlockContent); setIsPublished(page.isPublished); }
    else { setTitle(''); setContent([]); setIsPublished(true); }
  }, [page?.id, tagPath, slug]);

  const save = async () => {
    if (!title.trim()) { alert('Title is required'); return; }
    setIsSaving(true);
    try {
      const exists = page || (await fetch(`/api/wiki/${tagPath}/${slug}`).then(r => r.ok));
      const endpoint = exists ? `/api/wiki/${tagPath}/${slug}` : '/api/wiki';
      const method = exists ? 'PUT' : 'POST';
      const body = exists ? { title, content, isPublished } : { title, content, isPublished, tagPath, slug };
      const r = await fetch(endpoint, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (r.ok) { const d = await r.json(); router.push(`/${d.tagPath}/${d.slug}`); }
      else alert((await r.json()).error || 'Failed to save');
    } catch { alert('Failed to save'); }
    finally { setIsSaving(false); }
  };

  if (page && user && page.authorId !== user.id) {
    return <StatusCard title="Not Authorized" message="You can only edit your own pages." backHref={viewPath} />;
  }

  const canSave = isCreating ? title.trim() : true;
  const backHref = isCreating ? `/${tagPath}` : viewPath;
  const saveLabel = isCreating ? (isSaving ? 'Creating...' : 'Create Page') : (isSaving ? 'Saving...' : 'Save Changes');

  return (
    <WikiLayout maxWidth="4xl">
      <div className="flex flex-col gap-6">
        <Breadcrumbs path={[...tagPath.split('/'), slug]} suffix={isCreating ? 'Create' : 'Edit'} />
        <div className="flex items-center justify-between flex-wrap gap-4">
          <Link href={backHref} className="flex items-center gap-1 text-text-muted hover:text-text transition-colors">
            <ArrowLeft size={16} /><span className="text-sm">{isCreating ? 'Back to Category' : 'Back to Page'}</span>
          </Link>
          <div className="flex items-center gap-2">
            {!isCreating && <Link href={viewPath}><Button variant="secondary" size="sm"><Eye size={16} />Preview</Button></Link>}
            <Button onClick={save} disabled={isSaving || !canSave} size="sm"><Save size={16} />{saveLabel}</Button>
          </div>
        </div>
        {isCreating && (
          <div className="bg-accent-muted border border-accent/30 rounded-lg p-4">
            <p className="text-sm">Creating new page at <code className="px-1.5 py-0.5 bg-surface-2 rounded text-xs">/{tagPath}/{slug}</code></p>
          </div>
        )}
        <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="Page Title"
          className="text-3xl font-bold bg-transparent border-0 outline-none w-full placeholder:text-text-muted" autoFocus={isCreating} />
        <BlockEditor content={content} onChange={setContent} />
        <Card>
          <div className="flex flex-col gap-4">
            <h3 className="text-xl font-semibold">Page Settings</h3>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={isPublished} onChange={e => setIsPublished(e.target.checked)} className="w-4 h-4 rounded border-border" />
              {isCreating ? 'Publish immediately' : 'Published'}
            </label>
          </div>
        </Card>
        <div className="flex items-center justify-between">
          <Link href={backHref}><Button variant="ghost">Cancel</Button></Link>
          <Button onClick={save} disabled={isSaving || !canSave}><Save size={18} />{saveLabel}</Button>
        </div>
      </div>
    </WikiLayout>
  );
}

// Page View
function PageView({ page }: { page: WikiPageWithRevisions }) {
  const router = useRouter();
  const { user } = useAuth();
  const [isDeleting, setIsDeleting] = useState(false);
  const isAuthor = user && page.authorId === user.id;
  const tagPathArray = page.tagPath.split('/');

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
    <WikiLayout maxWidth="4xl">
      <article className="flex flex-col gap-6">
        <Breadcrumbs path={[...tagPathArray, page.slug]} />
        <header className="flex flex-col gap-4 pb-6 border-b border-border">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <h1 className="text-3xl font-bold">{page.title}</h1>
            {isAuthor && (
              <div className="flex items-center gap-2">
                <Link href={`/${page.tagPath}/${page.slug}/edit`}><Button variant="secondary" size="sm"><Edit size={16} />Edit</Button></Link>
                <Button variant="ghost" size="sm" onClick={handleDelete} disabled={isDeleting} className="text-red-500 hover:bg-red-500/10">
                  <Trash2 size={16} />{isDeleting ? 'Deleting...' : 'Delete'}
                </Button>
              </div>
            )}
          </div>
          <div className="flex items-center gap-4 flex-wrap text-text-muted text-sm">
            {page.author && <span className="flex items-center gap-1"><User size={14} />{page.author.displayName || page.author.radixAddress.slice(0, 16)}...</span>}
            <span className="flex items-center gap-1"><Clock size={14} />Updated {formatRelativeTime(page.updatedAt)}</span>
          </div>
          <div className="flex items-center gap-2">
            {tagPathArray.map((s, i) => <Badge key={s} variant="secondary">{findTagByPath(tagPathArray.slice(0, i + 1))?.name || s}</Badge>)}
          </div>
        </header>
        <BlockRenderer content={page.content} />
        <footer className="pt-6 border-t border-border text-text-muted text-sm flex items-center gap-4 flex-wrap">
          <span>Created {formatDate(page.createdAt)}</span>
          {page.revisions?.length ? <span>{page.revisions.length} revision{page.revisions.length !== 1 ? 's' : ''}</span> : null}
        </footer>
      </article>
    </WikiLayout>
  );
}

// Main Router
export default function DynamicPage() {
  const params = useParams();
  const rawPath = (params.path as string[]) || [];
  const isAuthenticated = useIsAuthenticated();
  const [page, setPage] = useState<WikiPageWithRevisions | null>(null);
  const [status, setStatus] = useState<'loading' | 'found' | 'notfound' | 'error'>('loading');

  // Homepage routes
  if (rawPath.length === 0) return <HomepageView isEditing={false} />;
  if (rawPath.length === 1 && rawPath[0] === 'edit') return <HomepageView isEditing={true} />;

  const isEditMode = rawPath[rawPath.length - 1] === 'edit';
  const pathSegments = isEditMode ? rawPath.slice(0, -1) : rawPath;

  // Category route
  if (isValidTagPath(pathSegments)) return <CategoryView tagPath={pathSegments} />;

  // Page routes
  const tagPathSegments = pathSegments.slice(0, -1);
  const slug = pathSegments[pathSegments.length - 1];
  const tagPath = tagPathSegments.join('/');

  if (!isValidTagPath(tagPathSegments)) {
    return <StatusCard title="Invalid path" message="The path you entered is not valid." />;
  }

  useEffect(() => {
    setStatus('loading');
    fetch(`/api/wiki/${tagPath}/${slug}`)
      .then(r => r.ok ? r.json().then(d => { setPage(d); setStatus('found'); }) : setStatus(r.status === 404 ? 'notfound' : 'error'))
      .catch(() => setStatus('error'));
  }, [tagPath, slug]);

  if (isEditMode && !isAuthenticated) {
    return <StatusCard title="Authentication Required" message="Please connect your Radix wallet to edit pages." backHref={`/${tagPath}/${slug}`} icon={<FileText size={32} />} />;
  }
  if (status === 'loading') return <WikiLayout><LoadingScreen message="Loading page..." /></WikiLayout>;
  if (status === 'error') return <StatusCard title="Error" message="Failed to load page" />;
  if (status === 'notfound') return isAuthenticated ? <PageEditor tagPath={tagPath} slug={slug} /> : <StatusCard title="Page not found" message="The page you're looking for doesn't exist." />;
  if (!page) return <StatusCard title="Page not found" message="The page you're looking for doesn't exist." />;
  return isEditMode ? <PageEditor page={page} tagPath={tagPath} slug={slug} /> : <PageView page={page} />;
}