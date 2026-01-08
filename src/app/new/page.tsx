// src/app/new/page.tsx

'use client';

import Link from 'next/link';
import { ArrowLeft, Save, FileText } from 'lucide-react';
import { WikiLayout } from '@/components/layout/WikiLayout';
import { WikiEditor } from '@/components/editor/WikiEditor';
import { TagSelector, TagPathDisplay } from '@/components/TagSelector';
import { Button, Card, CardContent } from '@/components/ui';
import { useIsAuthenticated } from '@/hooks/useStore';
import { useWikiForm } from '@/hooks/useWikiForm';

function AuthRequiredCard() {
  return (
    <Card className="max-w-md mx-auto text-center">
      <CardContent className="flex flex-col items-center gap-4 py-12">
        <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-surface-2 text-text-muted">
          <FileText size={32} />
        </div>
        <h1 className="text-2xl font-semibold">Authentication Required</h1>
        <p className="text-text-muted">Please connect your Radix wallet to create wiki pages.</p>
        <Link href="/"><Button variant="secondary"><ArrowLeft size={18} />Back to Home</Button></Link>
      </CardContent>
    </Card>
  );
}

export default function NewWikiPage() {
  const isAuthenticated = useIsAuthenticated();
  const form = useWikiForm();

  if (!isAuthenticated) {
    return <WikiLayout maxWidth="md" showSidebar={false}><AuthRequiredCard /></WikiLayout>;
  }

  const canSave = form.title.trim() && form.tagPath;

  return (
    <WikiLayout maxWidth="4xl">
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <Link href="/" className="flex items-center gap-1 text-text-muted hover:text-text transition-colors">
            <ArrowLeft size={16} /><span className="text-sm">Back to Home</span>
          </Link>
          <Button onClick={form.save} disabled={form.isSaving || !canSave} size="sm">
            <Save size={16} />{form.isSaving ? 'Creating...' : 'Create Page'}
          </Button>
        </div>

        <input
          type="text"
          value={form.title}
          onChange={(e) => form.setTitle(e.target.value)}
          placeholder="Page Title"
          className="text-3xl font-bold bg-transparent border-0 outline-none w-full placeholder:text-text-muted"
          autoFocus
        />

        <Card>
          <CardContent className="p-0">
            <WikiEditor
              content={form.content}
              onChange={form.setContent}
              placeholder="Start writing your wiki page..."
            />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex flex-col gap-4">
            <h3 className="text-xl font-semibold">Page Settings</h3>
            
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium">Category *</label>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm text-text-muted">Selected:</span>
                <TagPathDisplay path={form.tagPath} />
              </div>
              <TagSelector value={form.tagPath} onChange={form.setTagPath} />
              <p className="text-xs text-text-muted">
                Select a category to determine the page URL: radix.wiki/{form.tagPath || '...'}/{form.title ? form.title.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '') : 'page-slug'}
              </p>
            </div>

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
          <Link href="/"><Button variant="ghost">Cancel</Button></Link>
          <Button onClick={form.save} disabled={form.isSaving || !canSave}>
            <Save size={18} />{form.isSaving ? 'Creating...' : 'Create Page'}
          </Button>
        </div>
      </div>
    </WikiLayout>
  );
}