// src/app/[[...path]]/PageEditor.tsx

'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { ArrowLeft, Save, Trash2, Link2 } from 'lucide-react';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { Button, Input, StatusCard } from '@/components/ui';
import { useAuth, useStore } from '@/hooks';
import { slugify } from '@/lib/utils';
import { findInfobox } from '@/components/BlockRenderer';
import { isAuthorOnlyPath, getMetadataKeys, getXrdRequired, type MetadataKeyDefinition } from '@/lib/tags';
import { createBlock } from '@/lib/block-utils';
import { Banner } from './PageContent';
import type { WikiPage, PageMetadata } from '@/types';
import type { Block } from '@/types/blocks';

const BlockEditor = dynamic(() => import('@/components/BlockEditor').then(m => m.BlockEditor), {
  ssr: false,
  loading: () => <div className="h-64 skeleton rounded-lg" />,
});

const InfoboxEditor = dynamic(() => import('@/components/BlockEditor').then(m => m.InfoboxEditor), {
  ssr: false,
  loading: () => <div className="h-32 skeleton rounded-lg" />,
});

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

function UserPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [query, setQuery] = useState(value || '');
  const [results, setResults] = useState<{ id: string; displayName: string | null; radixAddress: string }[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (query.length < 2) { setResults([]); return; }
    const controller = new AbortController();
    fetch(`/api/users/search?q=${encodeURIComponent(query)}`, { signal: controller.signal })
      .then(r => r.json()).then(setResults).catch(() => {});
    return () => controller.abort();
  }, [query]);

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <Input
        value={query}
        onChange={e => { setQuery(e.target.value); setOpen(true); if (!e.target.value) onChange(''); }}
        onFocus={() => setOpen(true)}
        placeholder="Search users..."
      />
      {open && results.length > 0 && (
        <div className="user-picker-dropdown">
          {results.map(u => (
            <button key={u.id} className="user-picker-option" onClick={() => { const name = u.displayName || u.radixAddress.slice(0, 12) + '...'; setQuery(name); onChange(name); setOpen(false); }}>
              <span className="font-medium">{u.displayName || 'Anonymous'}</span>
              <span className="text-text-muted text-xs">{u.radixAddress.slice(0, 12)}...</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function MetadataFields({ metadataKeys, metadata, onChange }: { metadataKeys: MetadataKeyDefinition[]; metadata: PageMetadata; onChange: (metadata: PageMetadata) => void }) {
  if (metadataKeys.length === 0) return null;

  const updateField = (key: string, value: string) => {
    onChange({ ...metadata, [key]: value });
  };

  return (
    <div className="metadata-panel">
      <h4 className="text-small font-medium text-text-muted m-0!">Page Metadata</h4>
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
            ) : type === 'user' ? (
              <UserPicker
                value={metadata[key] || ''}
                onChange={v => updateField(key, v)}
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
export default function PageEditor({ page, tagPath, slug }: { page?: WikiPage; tagPath: string; slug: string }) {
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
      if (res.ok) {
        if (data.isFirstContribution) useStore.getState().showToast('Your first contribution! Welcome to the wiki.');
        window.location.href = `/${data.tagPath}/${data.slug}`;
      } else { alert(data.error || 'Failed to save'); setIsSaving(false); }
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
        <div data-callout="info"><p>{isCreating ? `Creating new page at` : `Editing page at`} <code>/{tagPath}/{slug}</code> — requires <strong>{getXrdRequired(isCreating ? 'create' : 'edit', tagPath).toLocaleString()} XRD</strong></p></div>
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
