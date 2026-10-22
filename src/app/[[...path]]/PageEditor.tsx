// src/app/[[...path]]/PageEditor.tsx

'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Save, Trash2, Link2, X } from 'lucide-react';
import { Breadcrumbs, PageActions } from '@/components/Breadcrumbs';
import { EmptyState } from '@/components/EmptyState';
import { Button, Input } from '@/components/ui';
import { useAuth, useStore } from '@/hooks';
import { cn, pagePath, sendJson } from '@/lib/utils';
import { isReservedSlug } from '@/lib/path';
import { slugifyHeading } from 'wiki-formant/headings';
import { findInfobox } from '@/components/BlockRenderer';
import { isAuthorOnlyPath, isLockedPage, isSharedPath, canEditAuthorOnlyPage, getMetadataKeys, getXrdRequired, XRD_NOT_A_FEE, type MetadataKeyDefinition } from '@/lib/tags';
import { createBlock } from '@/lib/block-utils';
import { Banner, BlockEditor, InfoboxEditor } from './PageContent';
import type { WikiPage, PageMetadata } from '@/types';
import type { Block } from '@/types/blocks';
import { useSaveShortcut, useTypeahead, useUnsavedChanges, useClickOutside } from 'wiki-formant/react';
import { WikiLine } from 'wiki-formant/editor';

// ========== METADATA FIELDS ==========
// A text value is stored HTML: the infobox writes one carrying markup as prose,
// through the sanitiser's prose set, so a link, bold and italic all survive it.
const TEXT_MARKS = ['bold', 'italic', 'link'] as const;

function parseAssignee(raw: string): string {
  if (!raw) return '';
  try { return JSON.parse(raw).name || raw; } catch { return raw; }
}

type UserOption = { id: string; displayName: string | null; shortAddress: string };

const fetchUsers = (q: string, signal: AbortSignal): Promise<UserOption[]> =>
  fetch(`/api/users/search?q=${encodeURIComponent(q)}`, { signal }).then(r => r.json());

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
  const [open, setOpen] = useState(false);
  // Read through a ref so the fetcher stays stable: `useTypeahead` re-runs its
  // search whenever the fetcher changes identity.
  const excludeRef = useRef(exclude);
  useEffect(() => { excludeRef.current = exclude; }, [exclude]);
  const search = useCallback(
    (q: string, signal: AbortSignal) =>
      fetchUsers(q, signal).then(users => users.filter(u => !excludeRef.current?.some(e => e.id === u.id))),
    [],
  );
  const pick = (user: UserOption) => { setQuery(onPick(user)); setOpen(false); };
  const { query, setQuery, items, highlight, setHighlight, onKeyDown, combobox } = useTypeahead<UserOption>({
    fetch: search,
    onPick: user => pick(user),
    onEscape: () => setOpen(false),
    minLength: 2,
  });
  useEffect(() => { setQuery(initial); }, [initial, setQuery]);
  const ref = useClickOutside<HTMLDivElement>(useCallback(() => setOpen(false), []));
  const aria = combobox(undefined, open && items.length > 0);

  return (
    <div ref={ref} className="relative">
      <Input
        value={query}
        onChange={e => { setQuery(e.target.value); setOpen(true); if (!e.target.value) onClear?.(); }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        {...aria.inputProps}
      />
      {open && items.length > 0 && (
        <div className="user-picker-dropdown" {...aria.listProps}>
          {items.map((u, i) => (
            <button
              key={u.id}
              type="button"
              className={cn('user-picker-option', i === highlight && 'search-result-active')}
              onMouseEnter={() => setHighlight(i)}
              onClick={() => pick(u)}
              {...aria.optionProps(i)}
            >
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
              <WikiLine
                as="div"
                value={metadata[key] || ''}
                onChange={v => updateField(key, v)}
                placeholder={label}
                marks={TEXT_MARKS}
                className="rich-input"
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
// What the form opens on, and what it is compared against to know it is dirty.
function initialFields(page: WikiPage | undefined, slug: string) {
  return page
    ? {
        title: page.title,
        content: page.content as unknown as Block[],
        bannerImage: page.bannerImage || null,
        metadata: (page.metadata as PageMetadata) || {},
        editSlug: page.slug,
        editorIds: page.editorIds,
      }
    : { title: '', content: [createBlock('content')], bannerImage: null, metadata: {} as PageMetadata, editSlug: slug, editorIds: [] as string[] };
}

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
  // New Page opens with no slug, and the slug follows the title until it is edited.
  const [slugEdited, setSlugEdited] = useState(false);
  const [editorIds, setEditorIds] = useState<string[]>([]);
  const [editors, setEditors] = useState<UserOption[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [missingKeys, setMissingKeys] = useState<string[]>([]);
  const [revisionMessage, setRevisionMessage] = useState('');
  const [verified, setVerified] = useState(false);
  const [gate, setGate] = useState<{ allowed: boolean; balance?: number; required?: number; error?: string } | null>(null);
  const isAuthor = user && page?.authorId === user.id;
  const metadataKeys = getMetadataKeys(tagPath.split('/'));

  // State the $XRD gate before any writing happens, not as a 403 after save.
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/auth/gate?type=${isCreating ? 'create' : 'edit'}&tagPath=${encodeURIComponent(tagPath)}`)
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (!cancelled && d) setGate(d); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [isCreating, tagPath]);

  const initial = useMemo(() => initialFields(page, slug), [page, slug]);
  useEffect(() => {
    setTitle(initial.title);
    setContent(initial.content);
    setBannerImage(initial.bannerImage);
    setMetadata(initial.metadata);
    setEditSlug(initial.editSlug);
    setEditorIds(initial.editorIds);
    if (initial.editorIds.length > 0) {
      fetch(`/api/users/search?ids=${initial.editorIds.join(',')}`)
        .then(r => r.json()).then(setEditors).catch(() => {});
    } else {
      setEditors([]);
    }
  }, [initial]);

  const shownSlug = isCreating && !slug && !slugEdited ? slugifyHeading(title) : editSlug;

  const initialJson = useMemo(() => JSON.stringify(initial), [initial]);
  const dirty = JSON.stringify({ title, content, bannerImage, metadata, editSlug, editorIds }) !== initialJson;
  // A save leaves by a full page load, which would trip the guard it just passed.
  const confirmLeave = useUnsavedChanges(dirty && !isSaving);

  const save = async () => {
    if (!title.trim()) { setSaveError('Title is required.'); return; }
    // The empty slug is the category's own hub article, so a new page never takes it.
    const newSlug = slugifyHeading(shownSlug);
    if (isCreating && !newSlug && !slug) { setSaveError('Add a slug: the title has no letters or digits to make one from.'); return; }
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
      // A new page always POSTs: the route gives a slug that is already taken a
      // suffix, where a PUT would have overwritten the page holding it. An edit
      // names the version it opened, so a save made meanwhile is a 409 to reload
      // from rather than an edit silently written over.
      const res = page
        ? await sendJson(`/api/wiki${pagePath(tagPath, slug)}`, 'PUT', { title, content, bannerImage, metadata, newSlug, editorIds, verified, baseVersion: page.version, revisionMessage: revisionMessage.trim() || undefined })
        : await sendJson('/api/wiki', 'POST', { title, content, bannerImage, metadata, tagPath, slug: newSlug || slug || undefined });
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

  const canSave = (isCreating ? !!title.trim() : true) && (gate ? gate.allowed : true);
  useSaveShortcut(() => { if (canSave && !isSaving) save(); });

  const back = <Link href={viewPath}><Button variant="secondary"><ArrowLeft size={18} />Back</Button></Link>;
  if (page && user && isAuthorOnlyPath(page.tagPath) && !canEditAuthorOnlyPage(page, user.id)) {
    return <EmptyState as="h1" title="Not your page" description="In this category you can edit only the pages you wrote." action={back} />;
  }

  if (page && isLockedPage(page.tagPath, page.slug)) {
    return <EmptyState as="h1" title="Page locked" description="This page is locked and cannot be edited." action={back} />;
  }

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
    <article className="stack page-editor">
      <Breadcrumbs
        path={[...tagPath.split('/'), slug].filter(Boolean)} suffix={isCreating ? 'Create' : 'Edit'}
        actions={!isCreating && <PageActions historyHref={`${viewPath}/history`} />}
      />
      {/* A child of the article, not the header, so it stays stuck for the whole edit. */}
      <div className="editor-bar">
        <Link href={backHref} onClick={e => { if (!confirmLeave()) e.preventDefault(); }} className="row link-muted"><ArrowLeft size={16} /><span>{isCreating ? 'Back to Category' : 'Back to Page'}</span></Link>
        <Button onClick={save} disabled={isSaving || !canSave} size="sm" title="Save (⌘S)"><Save size={16} />{saveLabel}</Button>
      </div>
      <header className="stack pb-6 border-b border-border">
        {gate && !gate.allowed ? (
          <div data-callout="warning"><p>{gate.error}</p></div>
        ) : gate === null ? (
          <div data-callout="info"><p>{isCreating ? 'Creating a page in' : 'Editing the page at'} <code>{isCreating ? `/${tagPath}` : viewPath}</code> requires holding <strong>{getXrdRequired(isCreating ? 'create' : 'edit', tagPath).toLocaleString('en-US')} XRD</strong> in your connected wallet. {XRD_NOT_A_FEE}</p></div>
        ) : null}
        {saveError && <div data-callout="error"><p>{saveError}</p></div>}
        <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="Page Title" className="input-ghost text-h1 font-bold" autoFocus={isCreating} />
        <div className="slug-editor">
          <Link2 size={14} />
          {isHub ? <span>/{tagPath}</span> : <>
            <span>/{tagPath}/</span>
            <input type="text" value={shownSlug} onChange={e => { setSlugEdited(true); setEditSlug(e.target.value.toLowerCase().replace(/[^\w\s-]/g, '').replace(/[\s_]+/g, '-')); }} onBlur={() => setEditSlug(slugifyHeading(shownSlug))} placeholder="page-slug" />
          </>}
        </div>
        {/* A reserved slug gets a suffix on create and is refused on rename; say so before the save. */}
        {!isHub && isReservedSlug(tagPath, slugifyHeading(shownSlug)) && (
          <p className="text-small text-text-muted">
            That address belongs to a view or a subcategory of this section, so {isCreating ? 'the page gets a suffix after it' : 'the page cannot move there'}.
          </p>
        )}
        {!isCreating && (
          <>
            <Input value={revisionMessage} onChange={e => setRevisionMessage(e.target.value)} placeholder="Edit summary — what changed and why (optional)" maxLength={200} />
            <label className="row"><input type="checkbox" checked={verified} onChange={e => setVerified(e.target.checked)} />I checked this page's facts against its sources</label>
          </>
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
