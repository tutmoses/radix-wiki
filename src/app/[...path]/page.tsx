// src/app/[...path]/page.tsx

'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Edit, Clock, User, ArrowLeft, Trash2, Save, Eye, FileText } from 'lucide-react';
import { WikiLayout } from '@/components/layout/WikiLayout';
import { WikiEditor } from '@/components/editor/WikiEditor';
import { ContentRenderer } from '@/components/editor/ContentRenderer';
import { Button, Card, CardContent, Badge, LoadingScreen } from '@/components/ui';
import { useAuth, useIsAuthenticated } from '@/hooks/useStore';
import { useWikiForm } from '@/hooks/useWikiForm';
import { formatRelativeTime, formatDate } from '@/lib/utils';
import { isValidTagPath, findTagByPath } from '@/lib/tags';
import type { WikiPage } from '@/types';
import type { JSONContent } from '@tiptap/react';

interface WikiPageWithRevisions extends WikiPage {
  revisions?: { id: string }[];
}

function BreadcrumbNav({ path, isEdit }: { path: string[]; isEdit?: boolean }) {
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
          {i === crumbs.length - 1 && !isEdit ? (
            <span className="text-text">{crumb.label}</span>
          ) : (
            <Link href={crumb.href} className="hover:text-text transition-colors">{crumb.label}</Link>
          )}
        </span>
      ))}
      {isEdit && <><span>/</span><span className="text-text">Edit</span></>}
    </nav>
  );
}

function CategoryListingPage({ tagPath }: { tagPath: string[] }) {
  const [pages, setPages] = useState<WikiPage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
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

  const childTags = tag?.children || [];

  return (
    <WikiLayout maxWidth="4xl">
      <div className="flex flex-col gap-6">
        <BreadcrumbNav path={tagPath} />
        <h1 className="text-3xl font-bold">{tag?.name || tagPath[tagPath.length - 1]}</h1>

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
            <CardContent><p className="text-text-muted">No pages in this category yet.</p></CardContent>
          </Card>
        )}
      </div>
    </WikiLayout>
  );
}

function EditPageView({ page, tagPath, slug }: { page: WikiPageWithRevisions; tagPath: string; slug: string }) {
  const { user } = useAuth();
  const form = useWikiForm({ tagPath, slug });
  const viewPath = `/${tagPath}/${slug}`;

  useEffect(() => {
    form.reset({ title: page.title, content: page.content as JSONContent | undefined, isPublished: page.isPublished });
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
            <Button onClick={form.save} disabled={form.isSaving} size="sm">
              <Save size={16} />{form.isSaving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </div>

        <input
          type="text"
          value={form.title}
          onChange={(e) => form.setTitle(e.target.value)}
          placeholder="Page Title"
          className="text-3xl font-bold bg-transparent border-0 outline-none w-full placeholder:text-text-muted"
        />

        <Card>
          <CardContent className="p-0">
            <WikiEditor content={form.content} onChange={form.setContent} placeholder="Start writing..." />
          </CardContent>
        </Card>

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
          <Button onClick={form.save} disabled={form.isSaving}>
            <Save size={18} />{form.isSaving ? 'Saving...' : 'Save Changes'}
          </Button>
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

        <div className="prose prose-lg max-w-none">
          <ContentRenderer content={page.content} />
        </div>

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

function AuthRequiredCard({ path, action }: { path: string[]; action: string }) {
  return (
    <WikiLayout maxWidth="md" showSidebar={false}>
      <Card className="text-center">
        <CardContent className="flex flex-col items-center gap-4 py-12">
          <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-surface-2 text-text-muted">
            <FileText size={32} />
          </div>
          <h1 className="text-2xl font-semibold">Authentication Required</h1>
          <p className="text-text-muted">Please connect your Radix wallet to {action} pages.</p>
          <Link href={'/' + path.join('/')}>
            <Button variant="secondary"><ArrowLeft size={18} />Back</Button>
          </Link>
        </CardContent>
      </Card>
    </WikiLayout>
  );
}

export default function DynamicPage() {
  const params = useParams();
  const router = useRouter();
  const rawPath = (params.path as string[]) || [];
  
  const isEditMode = rawPath[rawPath.length - 1] === 'edit';
  const pathSegments = isEditMode ? rawPath.slice(0, -1) : rawPath;

  const [page, setPage] = useState<WikiPageWithRevisions | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCategory, setIsCategory] = useState(false);

  const isAuthenticated = useIsAuthenticated();

  useEffect(() => {
    if (pathSegments.length === 0) {
      router.push('/');
      return;
    }

    if (isValidTagPath(pathSegments) && !isEditMode) {
      setIsCategory(true);
      setIsLoading(false);
      return;
    }

    const tagPath = pathSegments.slice(0, -1);
    const pageSlug = pathSegments[pathSegments.length - 1];

    if (!isValidTagPath(tagPath)) {
      setError('Invalid path');
      setIsLoading(false);
      return;
    }

    (async () => {
      try {
        const response = await fetch(`/api/wiki/${tagPath.join('/')}/${pageSlug}`);
        if (response.ok) {
          setPage(await response.json());
        } else if (response.status === 404) {
          setError('Page not found');
        } else {
          setError('Failed to load page');
        }
      } catch {
        setError('Failed to load page');
      } finally {
        setIsLoading(false);
      }
    })();
  }, [pathSegments.join('/'), isEditMode, router]);

  if (isEditMode && !isAuthenticated) {
    return <AuthRequiredCard path={pathSegments} action="edit" />;
  }

  if (isCategory) {
    return <CategoryListingPage tagPath={pathSegments} />;
  }

  if (isLoading) return <WikiLayout><LoadingScreen message="Loading page..." /></WikiLayout>;

  if (error || !page) {
    return (
      <WikiLayout maxWidth="md" showSidebar={false}>
        <Card className="text-center">
          <CardContent className="flex flex-col items-center gap-4 py-12">
            <h1 className="text-2xl font-semibold">{error || 'Page not found'}</h1>
            <p className="text-text-muted">The page you&apos;re looking for doesn&apos;t exist.</p>
            <Link href="/"><Button><ArrowLeft size={18} />Back to Home</Button></Link>
          </CardContent>
        </Card>
      </WikiLayout>
    );
  }

  const tagPath = pathSegments.slice(0, -1).join('/');
  const slug = pathSegments[pathSegments.length - 1];

  if (isEditMode) {
    return <EditPageView page={page} tagPath={tagPath} slug={slug} />;
  }

  return <ViewPageView page={page} />;
}