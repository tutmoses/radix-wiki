// src/hooks/useWikiForm.ts

'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import type { BlockContent } from '@/lib/blocks';

interface WikiFormData {
  title: string;
  content: BlockContent;
  tagPath: string;
  isPublished: boolean;
}

interface UseWikiFormOptions {
  initialData?: Partial<WikiFormData>;
  tagPath?: string;
  slug?: string;
}

export function useWikiForm({ initialData, tagPath: existingTagPath, slug: existingSlug }: UseWikiFormOptions = {}) {
  const router = useRouter();

  const [title, setTitle] = useState(initialData?.title || '');
  const [content, setContent] = useState<BlockContent>(initialData?.content || []);
  const [tagPath, setTagPath] = useState(initialData?.tagPath || existingTagPath || '');
  const [isPublished, setIsPublished] = useState(initialData?.isPublished ?? true);
  const [isSaving, setIsSaving] = useState(false);

  // Determine mode based on whether we're editing an existing page
  // If slug exists, we need to check if the page exists to know if we're editing or creating
  const isEditMode = !!existingSlug;

  const validate = useCallback((): string | null => {
    if (!title.trim()) return 'Title is required';
    if (!existingTagPath && !tagPath) return 'Please select a category';
    return null;
  }, [title, tagPath, existingTagPath]);

  const save = useCallback(async (): Promise<boolean> => {
    const error = validate();
    if (error) { alert(error); return false; }

    setIsSaving(true);
    try {
      const currentTagPath = existingTagPath || tagPath;
      
      // Check if page exists (for edit vs create)
      let pageExists = false;
      if (existingSlug) {
        const checkResponse = await fetch(`/api/wiki/${currentTagPath}/${existingSlug}`);
        pageExists = checkResponse.ok;
      }

      const endpoint = pageExists 
        ? `/api/wiki/${currentTagPath}/${existingSlug}` 
        : '/api/wiki';
      const method = pageExists ? 'PUT' : 'POST';

      const body = pageExists
        ? { title, content, isPublished }
        : { title, content, isPublished, tagPath: currentTagPath, slug: existingSlug };

      const response = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        const data = await response.json();
        router.push(`/${data.tagPath}/${data.slug}`);
        return true;
      } else {
        const data = await response.json();
        alert(data.error || `Failed to ${pageExists ? 'save' : 'create'} page`);
        return false;
      }
    } catch {
      alert('Failed to save page');
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [title, content, isPublished, tagPath, existingTagPath, existingSlug, router, validate]);

  const reset = useCallback((data?: Partial<WikiFormData>) => {
    setTitle(data?.title || '');
    setContent(data?.content || []);
    setTagPath(data?.tagPath || existingTagPath || '');
    setIsPublished(data?.isPublished ?? true);
  }, [existingTagPath]);

  return {
    title,
    content,
    tagPath,
    isPublished,
    isSaving,
    isEditMode,
    setTitle,
    setContent,
    setTagPath,
    setIsPublished,
    save,
    reset,
    validate,
  };
}