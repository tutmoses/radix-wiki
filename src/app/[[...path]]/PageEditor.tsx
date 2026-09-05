// src/app/[[...path]]/PageEditor.tsx

'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { ArrowLeft, Save, Trash2, Link2, X } from 'lucide-react';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { Button, Input, StatusCard } from '@/components/ui';
import { useAuth, useClickOutside, useStore } from '@/hooks';
import { pagePath, slugify } from '@/lib/utils';
import { findInfobox } from '@/components/BlockRenderer';
import { isAuthorOnlyPath, isLockedPage, isSharedPath, canEditAuthorOnlyPage, getMetadataKeys, getXrdRequired, XRD_NOT_A_FEE, type MetadataKeyDefinition } from '@/lib/tags';
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
  // Written after render, not during: a ref mutated mid-render can tear under
  // concurrent rendering. Callers only read it from events, which run later.
  useEffect(() => { onChangeRef.current = onChange; });

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

function parseAssignee(raw: string): string {
  if (!raw) return '';
  try { return JSON.parse(raw).name || raw; } catch { return raw; }
}

type UserOption = { id: string; displayName: string | null; shortAddress: string };

/**
 * The user typeahead. Both places that name a person — the `user` metadata field
 * and the allowed-editors list — are this control; they differ only in what the
 * input keeps after a pick, which is what `onPick` returns.
 */
function UserSearch({ initial = '', placeholder, exclude, onPick, onClear }: {
  initial?: string;
  placeholder: string;
  /** Already chosen, so they are not offered a second time. */
  exclude?: UserOption[];
  /** Returns the text the input keeps: the picked name, or '' to reset for the next pick. */
  onPick: (user: UserOption) => string;
  /** The input was emptied by hand. */
  onClear?: () => void;
}) {
  const [query, setQuery] = useState(initial);
  const [results, setResults] = useState<UserOption[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useClickOutside<HTMLDivElement>(useCallback(() => setOpen(false), []));

  useEffect(() => {
    if (query.length < 2) return;
    const controller = new AbortController();
    fetch(`/api/users/search?q=${encodeURIComponent(query)}`, { signal: controller.signal })
      .then(r => r.json()).then(setResults).catch(() => {});
    return () => controller.abort();
  }, [query]);

  // Derived rather than cleared from the effect: a short query has no results by
  // definition, so there is nothing to synchronise.
  const visibleResults = query.length < 2 ? [] : results.filter(u => !exclude?.some(e => e.id === u.id));

  return (
    <div ref={ref} className="relative">
      <Input
        value={query}
        onChange={e => { setQuery(e.target.value); setOpen(true); if (!e.target.value) onClear?.(); }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
      />
      {open && visibleResults.length > 0 && (
        <div className="user-picker-dropdown">
          {visibleResults.map(u => (
            <button key={u.id} className="user-picker-option" onClick={() => { setQuery(onPick(u)); setOpen(false); }}>
              <span className="font-medium">{u.displayName || 'Anonymous'}</span>
              <span className="text-text-muted text-xs">{u.shortAddress}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function MetadataFields({ metadataKeys, metadata, onChange, invalidKeys = [] }: { metadataKeys: MetadataKeyDefinition[]; metadata: PageMetadata; onChange: (metadata: PageMetadata) => void; invalidKeys?: string[] }) {
  // Required or already-populated fields stay visible; the rest sit behind one disclosure.
  const [showAll, setShowAll] = useState(false);
  if (metadataKeys.length === 0) return null;

  const updateField = (key: string, value: string) => {
    onChange({ ...metadata, [key]: value });
  };

  const primary = metadataKeys.filter(k => k.required || metadata[k.key]?.trim());
  const hiddenCount = metadataKeys.length - primary.length;
  const visible = showAll ? metadataKeys : primary;

  return (
    <div className="metadata-panel">
      <div className="spread">
        <h4 className="text-small font-medium text-text-muted m-0!">Page Metadata</h4>
        {!showAll && hiddenCount > 0 && (
          <button type="button" className="link text-small" onClick={() => setShowAll(true)}>More fields ({hiddenCount})</button>
        )}
      </div>
      <div className="metadata-grid">
        {visible.map(({ key, label, type, required, options }) => (
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
            ) : type === 'resource_address' ? (
              <Input
                value={metadata[key] || ''}
                onChange={e => updateField(key, e.target.value)}
                placeholder="resource_rdx1..."
                className="font-mono"
              />
            ) : type === 'user' ? (
              <UserSearch
                initial={parseAssignee(metadata[key] || '')}
                placeholder="Search users..."
                onPick={u => { const name = u.displayName || u.shortAddress; updateField(key, JSON.stringify({ id: u.id, name, address: u.shortAddress })); return name; }}
                onClear={() => updateField(key, '')}
              />
            ) : (
              <Input
                value={metadata[key] || ''}
                onChange={e => updateField(key, e.target.value)}
                placeholder={label}
              />
            )}
            {invalidKeys.includes(key) && !metadata[key]?.trim() && <span className="text-error text-xs">Required</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

// ========== EDITOR WHITELIST ==========
function EditorWhitelist({ editors, onAdd, onRemove }: {
  editors: UserOption[];
  onAdd: (user: UserOption) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <div className="metadata-panel">
      <h4 className="text-small font-medium text-text-muted m-0!">Allowed Editors</h4>
      {editors.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {editors.map(u => (
            <span key={u.id} className="badge row gap-1">
              {u.displayName || u.shortAddress}
              <button onClick={() => onRemove(u.id)} className="icon-btn" style={{ padding: 0, width: 16, height: 16 }}><X size={12} /></button>
            </span>
          ))}
        </div>
      )}
      <UserSearch placeholder="Search users to add..." exclude={editors} onPick={u => { onAdd(u); return ''; }} />
    </div>
  );
}

// ========== PAGE EDITOR ==========
export default function PageEditor({ page, tagPath, slug }: { page?: WikiPage; tagPath: string; slug: string }) {
  const router = useRouter();
  const { user } = useAuth();
  const isCreating = !page;
  const viewPath = pagePath(tagPath, slug);
  // A category's hub article lives at the empty slug and is reached by its
  // category's own URL, so there is no slug to edit and no rename to offer.
  const isHub = !isCreating && !slug;
  const [title, setTitle] = useState('');
  const [content, setContent] = useState<Block[]>([]);
  const [bannerImage, setBannerImage] = useState<string | null>(null);
  const [metadata, setMetadata] = useState<PageMetadata>({});
  const [editSlug, setEditSlug] = useState(slug);
  const [editorIds, setEditorIds] = useState<string[]>([]);
  const [editors, setEditors] = useState<UserOption[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [missingKeys, setMissingKeys] = useState<string[]>([]);
  const [revisionMessage, setRevisionMessage] = useState('');
  const [gate, setGate] = useState<{ allowed: boolean; balance?: number; required?: number; error?: string } | null>(null);
  const isAuthor = user && page?.authorId === user.id;
  const metadataKeys = getMetadataKeys(tagPath.split('/'));

  // State the XRD gate before any writing happens, not as a 403 after save.
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/auth/gate?type=${isCreating ? 'create' : 'edit'}&tagPath=${encodeURIComponent(tagPath)}`)
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (!cancelled && d) setGate(d); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [isCreating, tagPath]);

  useEffect(() => {
    if (page) {
      setTitle(page.title);
      setContent(page.content as unknown as Block[]);
      setBannerImage(page.bannerImage || null);
      setMetadata((page.metadata as PageMetadata) || {});
      setEditSlug(page.slug);
      const ids = (page as WikiPage & { editorIds?: string[] }).editorIds ?? [];
      setEditorIds(ids);
      if (ids.length > 0) {
        fetch(`/api/users/search?ids=${ids.join(',')}`)
          .then(r => r.json()).then(setEditors).catch(() => {});
      } else {
        setEditors([]);
      }
    } else {
      setTitle('');
      setContent([createBlock('content')]);
      setBannerImage(null);
      setMetadata({});
      setEditorIds([]);
      setEditors([]);
    }
  }, [page, tagPath, slug]);

  const save = async () => {
    if (!title.trim()) { setSaveError('Title is required.'); return; }
    const missing = metadataKeys.filter(k => k.required && !metadata[k.key]?.trim());
    if (missing.length > 0) {
      setMissingKeys(missing.map(k => k.key));
      setSaveError(`Missing required metadata: ${missing.map(k => k.label).join(', ')}.`);
      return;
    }
    setMissingKeys([]);
    setSaveError(null);
    setIsSaving(true);
    try {
      const apiPath = `/api/wiki${pagePath(tagPath, slug)}`;
      const exists = page || (await fetch(apiPath).then(r => r.ok));
      const method = exists ? 'PUT' : 'POST';
      const endpoint = exists ? apiPath : '/api/wiki';
      const newSlug = slugify(editSlug);
      const body = exists
        ? { title, content, bannerImage, metadata, newSlug, editorIds, revisionMessage: revisionMessage.trim() || undefined }
        : { title, content, bannerImage, metadata, tagPath, slug: newSlug || slug };
      const res = await fetch(endpoint, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json();
      if (res.ok) {
        if (data.isFirstContribution) useStore.getState().showToast('Your first contribution! Welcome to the wiki.');
        window.location.href = pagePath(data.tagPath, data.slug);
      } else { setSaveError(data.error || 'Failed to save.'); setIsSaving(false); }
    } catch { setSaveError('Failed to save.'); setIsSaving(false); }
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

  if (page && user && isAuthorOnlyPath(page.tagPath) && !canEditAuthorOnlyPage(page, user.id)) {
    return <StatusCard status="notAuthorized" backHref={viewPath} />;
  }

  if (page && isLockedPage(page.tagPath, page.slug)) {
    return <StatusCard status="locked" backHref={viewPath} />;
  }

  const canSave = (isCreating ? !!title.trim() : true) && (gate ? gate.allowed : true);
  // On a shared board the card is the board's, not its filer's: whoever passes
  // the edit gate can delete it too.
  const canDelete = !isCreating && (isAuthor || (isSharedPath(tagPath) && gate?.allowed === true));
  const backHref = isCreating ? `/${tagPath}` : viewPath;
  const saveLabel = isCreating ? (isSaving ? 'Creating...' : 'Create Page') : (isSaving ? 'Saving...' : 'Save Changes');

  const infobox = findInfobox(content) || createBlock('infobox') as import('@/types/blocks').InfoboxBlock;
  const mainBlocks = content.filter(b => b.type !== 'infobox');
  const updateMainBlocks = (blocks: Block[]) => setContent([...blocks, infobox]);
  const updateInfobox = (block: Block) => setContent([...content.filter(b => b.type !== 'infobox'), block]);

  return (
    <article className="stack">
      <Breadcrumbs path={[...tagPath.split('/'), slug].filter(Boolean)} suffix={isCreating ? 'Create' : 'Edit'} />
      <header className="stack pb-6 border-b border-border">
        <div className="spread">
          <Link href={backHref} className="row link-muted"><ArrowLeft size={16} /><span>{isCreating ? 'Back to Category' : 'Back to Page'}</span></Link>
          <Button onClick={save} disabled={isSaving || !canSave} size="sm"><Save size={16} />{saveLabel}</Button>
        </div>
        {gate && !gate.allowed ? (
          <div data-callout="warning"><p>{gate.error}</p></div>
        ) : gate === null ? (
          <div data-callout="info"><p>{isCreating ? 'Creating a new page at' : 'Editing the page at'} <code>{viewPath}</code> requires holding <strong>{getXrdRequired(isCreating ? 'create' : 'edit', tagPath).toLocaleString()} XRD</strong> in your connected wallet. {XRD_NOT_A_FEE}</p></div>
        ) : null}
        {saveError && <div data-callout="error"><p>{saveError}</p></div>}
        <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="Page Title" className="input-ghost text-h1 font-bold" autoFocus={isCreating} />
        <div className="slug-editor">
          <Link2 size={14} />
          {isHub ? <span>/{tagPath}</span> : <>
            <span>/{tagPath}/</span>
            <input type="text" value={editSlug} onChange={e => setEditSlug(e.target.value.toLowerCase().replace(/[^\w\s-]/g, '').replace(/[\s_]+/g, '-'))} onBlur={() => setEditSlug(slugify(editSlug))} placeholder="page-slug" />
          </>}
        </div>
        {!isCreating && (
          <Input value={revisionMessage} onChange={e => setRevisionMessage(e.target.value)} placeholder="Edit summary — what changed and why (optional)" maxLength={200} />
        )}
      </header>
      <Banner src={bannerImage} editable onUpload={setBannerImage} onRemove={() => setBannerImage(null)} />
      <MetadataFields metadataKeys={metadataKeys} metadata={metadata} onChange={setMetadata} invalidKeys={missingKeys} />
      {isAuthor && isAuthorOnlyPath(tagPath) && !isCreating && (
        <EditorWhitelist
          editors={editors}
          onAdd={u => { setEditorIds([...editorIds, u.id]); setEditors([...editors, u]); }}
          onRemove={id => { setEditorIds(editorIds.filter(i => i !== id)); setEditors(editors.filter(e => e.id !== id)); }}
        />
      )}
      <div className="page-with-infobox">
        <div className="page-main-content">
          <BlockEditor content={mainBlocks} onChange={updateMainBlocks} />
        </div>
        <aside className="infobox-editor">
          <InfoboxEditor block={infobox} onChange={updateInfobox} />
        </aside>
      </div>
      {canDelete && (
        <div className="section-divider">
          <Button variant="ghost" size="sm" onClick={handleDelete} disabled={isDeleting} className="text-error hover:bg-error/10">
            <Trash2 size={16} />{isDeleting ? 'Deleting...' : 'Delete Page'}
          </Button>
        </div>
      )}
    </article>
  );
}
