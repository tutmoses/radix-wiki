// src/app/[[...path]]/page.tsx

'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Edit, Clock, User, ArrowLeft, ArrowRight, Trash2, Save, Eye, FileText, Plus } from 'lucide-react';
import { WikiLayout } from '@/components/WikiLayout';
import { BlockEditor } from '@/components/BlockEditor';
import { BlockRenderer } from '@/components/BlockRenderer';
import { TagSelector, TagPathDisplay } from '@/components/TagSelector';
import { Button, Card, CardContent, Badge, LoadingScreen, Input } from '@/components/ui';
import { useAuth, useIsAuthenticated } from '@/hooks/useStore';
import { useWikiForm } from '@/hooks/useWikiForm';
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

// ============================================================================
// Shared Components
// ============================================================================

function BreadcrumbNav({ path, isEdit, isCreate }: { path: string[]; isEdit?: boolean; isCreate?: boolean }) {
  const crumbs = path.map((segment, index) => {
    const href = '/' + path.slice(0, index + 1).join('/');
    const tag = findTagByPath(path.slice(0, index + 1));
    return { href, label: tag?.name || segment };
  });

  return (
    <nav className="flex items-center gap-2 text-sm text-text-muted flex-wrap">
      <Link href="/" className="hover:text-text transition-colors">Home</Link>
      {crumbs.map((crumb, i) => (
        <span key={crumb.href} className="flex items-center gap-2">
          <span>/</span>
          {i === crumbs.length - 1 && !isEdit && !isCreate ? (
            <span className="text-text">{crumb.label}</span>
          ) : (
            <Link href={crumb.href} className="hover:text-text transition-colors">{crumb.label}</Link>
          )}
        </span>
      ))}
      {isEdit && <><span>/</span><span className="text-text">Edit</span></>}
      {isCreate && <><span>/</span><span className="text-text">Create</span></>}
    </nav>
  );
}

function AuthRequiredCard({ message, backHref = '/' }: { message: string; backHref?: string }) {
  return (
    <WikiLayout maxWidth="md" showSidebar={false}>
      <Card className="text-center">
        <CardContent className="flex flex-col items-center gap-4 py-12">
          <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-surface-2 text-text-muted">
            <FileText size={32} />
          </div>
          <h1 className="text-2xl font-semibold">Authentication Required</h1>
          <p className="text-text-muted">{message}</p>
          <Link href={backHref}><Button variant="secondary"><ArrowLeft size={18} />Back</Button></Link>
        </CardContent>
      </Card>
    </WikiLayout>
  );
}

function NotFoundCard({ title = 'Page not found', message = "The page you're looking for doesn't exist." }: { title?: string; message?: string }) {
  return (
    <WikiLayout maxWidth="md" showSidebar={false}>
      <Card className="text-center">
        <CardContent className="flex flex-col items-center gap-4 py-12">
          <h1 className="text-2xl font-semibold">{title}</h1>
          <p className="text-text-muted">{message}</p>
          <Link href="/"><Button><ArrowLeft size={18} />Back to Home</Button></Link>
        </CardContent>
      </Card>
    </WikiLayout>
  );
}

// ============================================================================
// Homepage Views
// ============================================================================

function HomePageView() {
  const [homepageData, setHomepageData] = useState<{ id?: string; content: BlockContent } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const isAuthenticated = useIsAuthenticated();

  useEffect(() => {
    (async () => {
      try {
        const response = await fetch('/api/wiki/system/home');
        if (response.ok) {
          const page = await response.json();
          setHomepageData({ id: page.id, content: page.content });
        } else {
          setHomepageData({ content: DEFAULT_HOMEPAGE_CONTENT });
        }
      } catch {
        setHomepageData({ content: DEFAULT_HOMEPAGE_CONTENT });
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  if (isLoading) return <WikiLayout><LoadingScreen message="Loading..." /></WikiLayout>;

  const content = homepageData?.content || DEFAULT_HOMEPAGE_CONTENT;

  return (
    <WikiLayout>
      <div className="flex flex-col gap-8">
        {isAuthenticated && (
          <div className="flex justify-end">
            <Link href="/home/edit"><Button variant="secondary" size="sm"><Edit size={16} />Edit Homepage</Button></Link>
          </div>
        )}
        <BlockRenderer content={content} className="max-w-4xl mx-auto" />
        <div className="flex items-center gap-4 justify-center flex-wrap max-w-4xl mx-auto">
          {!isAuthenticated && (
            <Button size="lg" variant="primary" onClick={() => {
              document.querySelector<HTMLButtonElement>('#radix-connect-btn button')?.click();
            }}>
              Connect Radix Wallet<ArrowRight size={18} />
            </Button>
          )}
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

function EditHomePageView() {
  const router = useRouter();
  const isAuthenticated = useIsAuthenticated();
  const [content, setContent] = useState<BlockContent>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [pageExists, setPageExists] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const response = await fetch('/api/wiki/system/home');
        if (response.ok) {
          const page = await response.json();
          setContent(page.content);
          setPageExists(true);
        } else {
          setContent(DEFAULT_HOMEPAGE_CONTENT);
        }
      } catch {
        setContent(DEFAULT_HOMEPAGE_CONTENT);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const method = pageExists ? 'PUT' : 'POST';
      const endpoint = pageExists ? '/api/wiki/system/home' : '/api/wiki';
      const body = pageExists
        ? { content }
        : { title: 'Homepage', content, tagPath: 'system', slug: 'home', isPublished: true };

      const response = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (response.ok) router.push('/');
      else alert((await response.json()).error || 'Failed to save homepage');
    } catch {
      alert('Failed to save homepage');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isAuthenticated) return <AuthRequiredCard message="Please connect your Radix wallet to edit the homepage." />;
  if (isLoading) return <WikiLayout><LoadingScreen message="Loading homepage..." /></WikiLayout>;

  return (
    <WikiLayout maxWidth="4xl">
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <Link href="/" className="flex items-center gap-1 text-text-muted hover:text-text transition-colors">
            <ArrowLeft size={16} /><span className="text-sm">Back to Homepage</span>
          </Link>
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

// ============================================================================
// Category View
// ============================================================================

function CategoryListingView({ tagPath }: { tagPath: string[] }) {
  const router = useRouter();
  const isAuthenticated = useIsAuthenticated();
  const [pages, setPages] = useState<WikiPage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newSlug, setNewSlug] = useState('');
  const [showCreateInput, setShowCreateInput] = useState(false);
  const tag = findTagByPath(tagPath);
  const pathString = tagPath.join('/');

  useEffect(() => {
    (async () => {
      try {
        const response = await fetch(`/api/wiki?tagPath=${encodeURIComponent(pathString)}&published=true`);
        if (response.ok) setPages((await response.json()).items);
      } catch (error) {
        console.error('Failed to fetch pages:', error);
      } finally {
        setIsLoading(false);
      }
    })();
  }, [pathString]);

  const handleCreatePage = () => {
    const slug = slugify(newSlug);
    if (slug) router.push(`/${pathString}/${slug}`);
  };

  const childTags = tag?.children || [];

  return (
    <WikiLayout maxWidth="4xl">
      <div className="flex flex-col gap-6">
        <BreadcrumbNav path={tagPath} />
        <div className="flex items-center justify-between flex-wrap gap-4">
          <h1 className="text-3xl font-bold">{tag?.name || tagPath[tagPath.length - 1]}</h1>
          {isAuthenticated && (
            <div className="flex items-center gap-2">
              {showCreateInput ? (
                <>
                  <Input
                    value={newSlug}
                    onChange={(e) => setNewSlug(e.target.value)}
                    placeholder="page-slug"
                    className="w-48"
                    onKeyDown={(e) => e.key === 'Enter' && handleCreatePage()}
                    autoFocus
                  />
                  <Button size="sm" onClick={handleCreatePage} disabled={!newSlug.trim()}>Go</Button>
                  <Button size="sm" variant="ghost" onClick={() => setShowCreateInput(false)}>Cancel</Button>
                </>
              ) : (
                <Button size="sm" onClick={() => setShowCreateInput(true)}><Plus size={16} />New Page</Button>
              )}
            </div>
          )}
        </div>

        {childTags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {childTags.map(child => (
              <Link key={child.slug} href={`/${pathString}/${child.slug}`}>
                <Badge variant="secondary" className="cursor-pointer hover:bg-surface-3">{child.name}</Badge>
              </Link>
            ))}
          </div>
        )}

        {isLoading ? (
          <LoadingScreen message="Loading pages..." />
        ) : pages.length > 0 ? (
          <div className="grid gap-4">
            {pages.map(page => (
              <Link key={page.id} href={`/${page.tagPath}/${page.slug}`}>
                <Card interactive>
                  <CardContent className="flex flex-col gap-2">
                    <h3 className="text-xl font-semibold">{page.title}</h3>
                    {page.excerpt && <p className="text-text-muted">{page.excerpt}</p>}
                    <div className="flex items-center gap-4 text-sm text-text-muted">
                      <span>{formatRelativeTime(page.updatedAt)}</span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        ) : (
          <Card className="text-center py-12">
            <CardContent>
              <p className="text-text-muted">No pages in this category yet.</p>
              {isAuthenticated && (
                <p className="text-sm text-text-muted mt-2">Click "New Page" above to create one.</p>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </WikiLayout>
  );
}

// ============================================================================
// Page Views
// ============================================================================

function CreatePageView({ tagPath, slug }: { tagPath: string; slug: string }) {
  const form = useWikiForm({ tagPath, slug });
  const pathSegments = [...tagPath.split('/'), slug];

  useEffect(() => {
    form.reset({ title: '', content: [], tagPath, isPublished: true });
  }, [tagPath, slug]);

  const canSave = form.title.trim();

  return (
    <WikiLayout maxWidth="4xl">
      <div className="flex flex-col gap-6">
        <BreadcrumbNav path={pathSegments} isCreate />
        <div className="flex items-center justify-between flex-wrap gap-4">
          <Link href={`/${tagPath}`} className="flex items-center gap-1 text-text-muted hover:text-text transition-colors">
            <ArrowLeft size={16} /><span className="text-sm">Back to Category</span>
          </Link>
          <Button onClick={form.save} disabled={form.isSaving || !canSave} size="sm">
            <Save size={16} />{form.isSaving ? 'Creating...' : 'Create Page'}
          </Button>
        </div>

        <div className="bg-accent-muted border border-accent/30 rounded-lg p-4">
          <p className="text-sm">
            Creating new page at <code className="px-1.5 py-0.5 bg-surface-2 rounded text-xs">/{tagPath}/{slug}</code>
          </p>
        </div>

        <input
          type="text"
          value={form.title}
          onChange={(e) => form.setTitle(e.target.value)}
          placeholder="Page Title"
          className="text-3xl font-bold bg-transparent border-0 outline-none w-full placeholder:text-text-muted"
          autoFocus
        />

        <BlockEditor content={form.content} onChange={form.setContent} />

        <Card>
          <CardContent className="flex flex-col gap-4">
            <h3 className="text-xl font-semibold">Page Settings</h3>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="published"
                checked={form.isPublished}
                onChange={(e) => form.setIsPublished(e.target.checked)}
                className="w-4 h-4 rounded border-border"
              />
              <label htmlFor="published" className="text-sm">Publish this page immediately</label>
            </div>
          </CardContent>
        </Card>

        <div className="flex items-center justify-between">
          <Link href={`/${tagPath}`}><Button variant="ghost">Cancel</Button></Link>
          <Button onClick={form.save} disabled={form.isSaving || !canSave}>
            <Save size={18} />{form.isSaving ? 'Creating...' : 'Create Page'}
          </Button>
        </div>
      </div>
    </WikiLayout>
  );
}

function EditPageView({ page, tagPath, slug }: { page: WikiPageWithRevisions; tagPath: string; slug: string }) {
  const { user } = useAuth();
  const form = useWikiForm({ tagPath, slug });
  const viewPath = `/${tagPath}/${slug}`;

  useEffect(() => {
    form.reset({ title: page.title, content: page.content as BlockContent, isPublished: page.isPublished });
  }, [page.id]);

  if (user && page.authorId !== user.id) {
    return (
      <WikiLayout maxWidth="md" showSidebar={false}>
        <Card className="text-center">
          <CardContent className="flex flex-col items-center gap-4 py-12">
            <h1 className="text-2xl font-semibold">Not Authorized</h1>
            <p className="text-text-muted">You can only edit your own pages.</p>
            <Link href={viewPath}><Button><ArrowLeft size={18} />Back to Page</Button></Link>
          </CardContent>
        </Card>
      </WikiLayout>
    );
  }

  return (
    <WikiLayout maxWidth="4xl">
      <div className="flex flex-col gap-6">
        <BreadcrumbNav path={[...tagPath.split('/'), slug]} isEdit />
        <div className="flex items-center justify-between flex-wrap gap-4">
          <Link href={viewPath} className="flex items-center gap-1 text-text-muted hover:text-text transition-colors">
            <ArrowLeft size={16} /><span className="text-sm">Back to Page</span>
          </Link>
          <div className="flex items-center gap-2">
            <Link href={viewPath}><Button variant="secondary" size="sm"><Eye size={16} />Preview</Button></Link>
            <Button onClick={form.save} disabled={form.isSaving} size="sm"><Save size={16} />{form.isSaving ? 'Saving...' : 'Save Changes'}</Button>
          </div>
        </div>

        <input
          type="text"
          value={form.title}
          onChange={(e) => form.setTitle(e.target.value)}
          placeholder="Page Title"
          className="text-3xl font-bold bg-transparent border-0 outline-none w-full placeholder:text-text-muted"
        />

        <BlockEditor content={form.content} onChange={form.setContent} />

        <Card>
          <CardContent className="flex flex-col gap-4">
            <h3 className="text-xl font-semibold">Page Settings</h3>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="published"
                checked={form.isPublished}
                onChange={(e) => form.setIsPublished(e.target.checked)}
                className="w-4 h-4 rounded border-border"
              />
              <label htmlFor="published" className="text-sm">Publish this page</label>
            </div>
          </CardContent>
        </Card>

        <div className="flex items-center justify-between">
          <Link href={viewPath}><Button variant="ghost">Cancel</Button></Link>
          <Button onClick={form.save} disabled={form.isSaving}><Save size={18} />{form.isSaving ? 'Saving...' : 'Save Changes'}</Button>
        </div>
      </div>
    </WikiLayout>
  );
}

function ViewPageView({ page }: { page: WikiPageWithRevisions }) {
  const router = useRouter();
  const { user } = useAuth();
  const [isDeleting, setIsDeleting] = useState(false);
  const isAuthor = user && page.authorId === user.id;

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this page?')) return;
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/wiki/${page.tagPath}/${page.slug}`, { method: 'DELETE' });
      if (response.ok) router.push(`/${page.tagPath}`);
      else alert('Failed to delete page');
    } catch {
      alert('Failed to delete page');
    } finally {
      setIsDeleting(false);
    }
  };

  const tagPathArray = page.tagPath.split('/');
  const fullPath = [...tagPathArray, page.slug];

  return (
    <WikiLayout maxWidth="4xl">
      <article className="flex flex-col gap-6">
        <BreadcrumbNav path={fullPath} />

        <header className="flex flex-col gap-4 pb-6 border-b border-border">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <h1 className="text-3xl font-bold">{page.title}</h1>
            {isAuthor && (
              <div className="flex items-center gap-2">
                <Link href={`/${page.tagPath}/${page.slug}/edit`}>
                  <Button variant="secondary" size="sm"><Edit size={16} />Edit</Button>
                </Link>
                <Button variant="ghost" size="sm" onClick={handleDelete} disabled={isDeleting} className="text-red-500 hover:bg-red-500/10">
                  <Trash2 size={16} />{isDeleting ? 'Deleting...' : 'Delete'}
                </Button>
              </div>
            )}
          </div>

          <div className="flex items-center gap-4 flex-wrap text-text-muted text-sm">
            {page.author && (
              <div className="flex items-center gap-1">
                <User size={14} />
                <span>{page.author.displayName || page.author.radixAddress.slice(0, 16)}...</span>
              </div>
            )}
            <div className="flex items-center gap-1">
              <Clock size={14} />
              <span>Updated {formatRelativeTime(page.updatedAt)}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {tagPathArray.map((segment, i) => {
              const tag = findTagByPath(tagPathArray.slice(0, i + 1));
              return <Badge key={segment} variant="secondary">{tag?.name || segment}</Badge>;
            })}
          </div>
        </header>

        <BlockRenderer content={page.content} />

        <footer className="pt-6 border-t border-border">
          <div className="flex items-center gap-4 flex-wrap text-text-muted text-sm">
            <span>Created {formatDate(page.createdAt)}</span>
            {page.revisions && page.revisions.length > 0 && (
              <span>{page.revisions.length} revision{page.revisions.length !== 1 ? 's' : ''}</span>
            )}
          </div>
        </footer>
      </article>
    </WikiLayout>
  );
}

// ============================================================================
// Main Router Component
// ============================================================================

export default function DynamicPage() {
  const params = useParams();
  const router = useRouter();
  const rawPath = (params.path as string[]) || [];
  const isAuthenticated = useIsAuthenticated();

  const [page, setPage] = useState<WikiPageWithRevisions | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [pageNotFound, setPageNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Route: /
  if (rawPath.length === 0) {
    return <HomePageView />;
  }

  // Route: /home/edit
  if (rawPath.length === 2 && rawPath[0] === 'home' && rawPath[1] === 'edit') {
    return <EditHomePageView />;
  }

  // Determine if edit mode
  const isEditMode = rawPath[rawPath.length - 1] === 'edit';
  const pathSegments = isEditMode ? rawPath.slice(0, -1) : rawPath;

  // Route: /{validTagPath} - Category listing
  if (isValidTagPath(pathSegments)) {
    return <CategoryListingView tagPath={pathSegments} />;
  }

  // Route: /{tagPath}/{slug} or /{tagPath}/{slug}/edit
  const tagPathSegments = pathSegments.slice(0, -1);
  const slug = pathSegments[pathSegments.length - 1];
  const tagPath = tagPathSegments.join('/');

  // Invalid tag path
  if (!isValidTagPath(tagPathSegments)) {
    return <NotFoundCard title="Invalid path" message="The path you entered is not valid." />;
  }

  // Fetch page data
  useEffect(() => {
    (async () => {
      setIsLoading(true);
      setPageNotFound(false);
      setError(null);

      try {
        const response = await fetch(`/api/wiki/${tagPath}/${slug}`);
        if (response.ok) {
          setPage(await response.json());
        } else if (response.status === 404) {
          setPageNotFound(true);
        } else {
          setError('Failed to load page');
        }
      } catch {
        setError('Failed to load page');
      } finally {
        setIsLoading(false);
      }
    })();
  }, [tagPath, slug]);

  // Auth check for edit mode
  if (isEditMode && !isAuthenticated) {
    return <AuthRequiredCard message="Please connect your Radix wallet to edit pages." backHref={`/${tagPath}/${slug}`} />;
  }

  // Loading state
  if (isLoading) {
    return <WikiLayout><LoadingScreen message="Loading page..." /></WikiLayout>;
  }

  // Error state
  if (error) {
    return <NotFoundCard title="Error" message={error} />;
  }

  // Page not found - show create form for authenticated users
  if (pageNotFound) {
    if (isAuthenticated) {
      return <CreatePageView tagPath={tagPath} slug={slug} />;
    }
    return <NotFoundCard />;
  }

  // Page exists
  if (!page) {
    return <NotFoundCard />;
  }

  // Edit mode
  if (isEditMode) {
    return <EditPageView page={page} tagPath={tagPath} slug={slug} />;
  }

  // View mode
  return <ViewPageView page={page} />;
}