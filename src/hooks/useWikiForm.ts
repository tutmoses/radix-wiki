// src/hooks/useWikiForm.ts

'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import type { JSONContent } from '@tiptap/react';

interface WikiFormData {
  title: string;
  content: JSONContent | undefined;
  tagPath: string;
  isPublished: boolean;
}

interface UseWikiFormOptions {
  initialData?: Partial<WikiFormData>;
  tagPath?: string;
  slug?: string;
}

export function useWikiForm({ initialData, tagPath: existingTagPath, slug }: UseWikiFormOptions = {}) {
  const router = useRouter();
  const isEditMode = !!slug;

  const [title, setTitle] = useState(initialData?.title || '');
  const [content, setContent] = useState<JSONContent | undefined>(initialData?.content);
  const [tagPath, setTagPath] = useState(initialData?.tagPath || existingTagPath || '');
  const [isPublished, setIsPublished] = useState(initialData?.isPublished ?? true);
  const [isSaving, setIsSaving] = useState(false);

  const validate = useCallback((): string | null => {
    if (!title.trim()) return 'Title is required';
    if (!tagPath && !isEditMode) return 'Please select a category';
    return null;
  }, [title, tagPath, isEditMode]);

  const save = useCallback(async (): Promise<boolean> => {
    const error = validate();
    if (error) { alert(error); return false; }

    setIsSaving(true);
    try {
      const currentTagPath = existingTagPath || tagPath;
      const endpoint = isEditMode 
        ? `/api/wiki/${currentTagPath}/${slug}` 
        : '/api/wiki';
      const method = isEditMode ? 'PUT' : 'POST';

      const response = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, content, isPublished, tagPath: currentTagPath }),
      });

      if (response.ok) {
        const data = await response.json();
        router.push(`/${data.tagPath}/${data.slug}`);
        return true;
      } else {
        const data = await response.json();
        alert(data.error || `Failed to ${isEditMode ? 'save' : 'create'} page`);
        return false;
      }
    } catch {
      alert(`Failed to ${isEditMode ? 'save' : 'create'} page`);
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [title, content, isPublished, tagPath, existingTagPath, slug, isEditMode, router, validate]);

  const reset = useCallback((data?: Partial<WikiFormData>) => {
    setTitle(data?.title || '');
    setContent(data?.content);
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