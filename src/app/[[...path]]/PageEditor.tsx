// src/app/[[...path]]/PageEditor.tsx

'use client';

import { useState, useEffect, useRef, useCallback, type KeyboardEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Save, Trash2, Link2, X } from 'lucide-react';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { EmptyState } from '@/components/EmptyState';
import { Button, Input } from '@/components/ui';
import { useAuth, useHistoryLink } from '@/hooks';
import { CARRIED_TOAST } from '@/components/Toast';
import { cn, mustReload, pagePath, sendJson } from '@/lib/utils';
import { isReservedSlug } from '@/lib/path';
import { slugifyHeading } from 'wiki-formant/headings';
import { isAuthorOnlyPath, isLockedPage, isSharedPath, canEditAuthorOnlyPage, getMetadataKeys, getXrdRequired, XRD_NOT_A_FEE, type MetadataKeyDefinition } from '@/lib/tags';
import { createBlock } from '@/lib/block-utils';
import { ArticleBlocksEditor, Banner, ConflictNotice, type SavePhase } from './PageContent';
import type { WikiPage, PageMetadata } from '@/types';
import type { Block } from '@/types/blocks';
import { useSaveShortcut, useTypeahead, useUnsavedChanges, useClickOutside } from 'wiki-formant/react';
import { WikiLine } from 'wiki-formant/editor';
import { parseAssignee } from './assignee';

// ========== METADATA FIELDS ==========
// A text value is stored HTML: the infobox writes one carrying markup as prose,
// through the sanitiser's prose set, so a link, bold and italic all survive it.
const TEXT_MARKS = ['bold', 'italic', 'link'] as const;

type UserOption = { id: string; displayName: string | null; shortAddress: string };

// A refusal (a 429, say) rejects rather than answering no one, so the typeahead
// does not cache it as the query's result.
const fetchUsers = async (q: string, signal: AbortSignal): Promise<UserOption[]> => {
  const res = await fetch(`/api/users/search?q=${encodeURIComponent(q)}`, { signal });
  if (!res.ok) throw new Error(res.statusText || `Failed (${res.status})`);
  return res.json();
};

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
  // The hook keeps its rows while the list is shut, and searches the picked name
  // again; keys reach it only while the list shows, so Enter never picks a row
  // nobody can see. An arrow in a shut box opens it.
  const onKeys = (e: KeyboardEvent<HTMLInputElement>) => {
    if (open) onKeyDown(e);
    else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); setOpen(true); }
  };

  return (
    <div ref={ref} className="relative">
      <Input
        value={query}
        onChange={e => { setQuery(e.target.value); setOpen(true); if (!e.target.value) onClear?.(); }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeys}
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
                className="input rich-input"
              />
            ) : type === 'user' ? (
              <UserSearch
                initial={parseAssignee(metadata[key])?.name ?? metadata[key] ?? ''}
                placeholder="Search users..."
                onPick={u => { const name = u.displayName || u.shortAddress; updateField(key, JSON.stringify({ id: u.id, name, address: u.shortAddress })); return name; }}
                onClear={() => updateField(key, '')}
              />
            ) : (
              <Input
                type={type === 'url' || type === 'date' ? type : undefined}
                value={metadata[key] || ''}
                onChange={e => updateField(key, e.target.value)}
                placeholder={type === 'resource_address' ? 'resource_rdx1...' : type === 'date' ? undefined : label}
                className={type === 'resource_address' ? 'font-mono' : undefined}
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
/** The co-editors the page names, read by id: still loading, unreadable, or their names. */
type Editors =
  | { status: 'loading' }
  | { status: 'failed' }
  | { status: 'loaded'; users: UserOption[] };

function EditorWhitelist({ editors: list, onAdd, onRemove }: {
  editors: Editors;
  onAdd: (user: UserOption) => void;
  onRemove: (id: string) => void;
}) {
  if (list.status !== 'loaded') {
    return (
      <div className="metadata-panel">
        <h4 className="text-small font-medium text-text-muted m-0!">Allowed Editors</h4>
        {list.status === 'loading'
          ? <div className="h-8 skeleton" />
          : <p className="text-small text-text-muted">The allowed editors could not be loaded, so they are kept as they are. Reload to change them.</p>}
      </div>
    );
  }
  const editors = list.users;
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
// A save's phases, and a delete, so a save and a delete never overlap.
type Phase = SavePhase | { kind: 'deleting' };

/**
 * The $XRD gate, asked before any writing happens rather than met as a 403
 * after the save. `unknown` is a check that did not answer (an unreadable
 * balance, a dropped request): the requirement is stated and the save is still
 * allowed, since the route enforces it anyway. Only a shortfall's 403 refuses.
 */
type Gate =
  | { kind: 'checking' }
  | { kind: 'unknown' }
  | { kind: 'allowed' }
  | { kind: 'refused'; reason: string };

/**
 * The slug field: following the title, as New Page opens when it has no slug,
 * or what was typed (or the slug the page already has). Typing is what stops
 * it following.
 */
type SlugField = { kind: 'title' } | { kind: 'typed'; value: string };

type Fields = { title: string; content: Block[]; bannerImage: string | null; metadata: PageMetadata; slug: SlugField; editorIds: string[] };

// What the form opens on, and what it is compared against to know it is dirty.
function initialFields(page: WikiPage | undefined, slug: string): Fields {
  return page
    ? {
        title: page.title,
        content: page.content as unknown as Block[],
        bannerImage: page.bannerImage || null,
        metadata: (page.metadata as PageMetadata) || {},
        slug: { kind: 'typed', value: page.slug },
        editorIds: page.editorIds,
      }
    : { title: '', content: [createBlock('content')], bannerImage: null, metadata: {}, slug: slug ? { kind: 'typed', value: slug } : { kind: 'title' }, editorIds: [] };
}

/** Keyed by its page where it is rendered, so it opens on `page` once and never resyncs. */
export default function PageEditor({ page, tagPath, slug }: { page?: WikiPage; tagPath: string; slug: string }) {
  const router = useRouter();
  const { user } = useAuth();
  const isCreating = !page;
  const viewPath = pagePath(tagPath, slug);
  useHistoryLink(isCreating ? null : `${viewPath}/history`);
  // A category's hub article lives at the empty slug and is reached by its
  // category's own URL, so there is no slug to edit and no rename to offer.
  const isHub = !isCreating && !slug;
  const [initial] = useState(() => initialFields(page, slug));
  const [fields, setFields] = useState(initial);
  const { title, content, bannerImage, metadata, slug: slugField, editorIds } = fields;
  const patch = (p: Partial<Fields>) => setFields(f => ({ ...f, ...p }));
  const [editors, setEditors] = useState<Editors>(initial.editorIds.length ? { status: 'loading' } : { status: 'loaded', users: [] });
  const [phase, setPhase] = useState<Phase>({ kind: 'editing', error: null });
  const [revisionMessage, setRevisionMessage] = useState('');
  const [verified, setVerified] = useState(false);
  const [gate, setGate] = useState<Gate>({ kind: 'checking' });
  const isAuthor = user && page?.authorId === user.id;
  const metadataKeys = getMetadataKeys(tagPath.split('/'));

  useEffect(() => {
    let cancelled = false;
    setGate({ kind: 'checking' });
    fetch(`/api/auth/gate?type=${isCreating ? 'create' : 'edit'}&tagPath=${encodeURIComponent(tagPath)}`)
      .then(async (r): Promise<Gate> => r.ok ? { kind: 'allowed' }
        : r.status === 403 ? { kind: 'refused', reason: (await r.json().catch(() => ({}))).error || 'Your wallet does not hold enough $XRD to save here.' }
        : { kind: 'unknown' })
      .catch((): Gate => ({ kind: 'unknown' }))
      .then(next => { if (!cancelled) setGate(next); });
    return () => { cancelled = true; };
  }, [isCreating, tagPath]);

  useEffect(() => {
    if (initial.editorIds.length === 0) return;
    let cancelled = false;
    fetch(`/api/users/search?ids=${initial.editorIds.join(',')}`)
      .then(r => (r.ok ? r.json() : Promise.reject(new Error(r.statusText))))
      .then((users: UserOption[]): Editors => ({ status: 'loaded', users }), (): Editors => ({ status: 'failed' }))
      .then(next => { if (!cancelled) setEditors(next); });
    return () => { cancelled = true; };
  }, [initial]);

  const shownSlug = slugField.kind === 'title' ? slugifyHeading(title) : slugField.value;

  const dirty = fields !== initial && JSON.stringify(fields) !== JSON.stringify(initial);
  // A save leaves by a full page load, which would trip the guard it just passed.
  const confirmLeave = useUnsavedChanges(dirty && phase.kind !== 'saving');

  const save = async () => {
    if (!title.trim()) { setPhase({ kind: 'editing', error: 'Title is required.' }); return; }
    // The empty slug is the category's own hub article, so a new page never takes it.
    const newSlug = slugifyHeading(shownSlug);
    if (isCreating && !newSlug && !slug) { setPhase({ kind: 'editing', error: 'Add a slug: the title has no letters or digits to make one from.' }); return; }
    const missing = metadataKeys.filter(k => k.required && !metadata[k.key]?.trim());
    if (missing.length > 0) {
      setPhase({ kind: 'editing', error: `Missing required metadata: ${missing.map(k => k.label).join(', ')}.`, missing: missing.map(k => k.key) });
      return;
    }
    setPhase({ kind: 'saving' });
    try {
      // A new page always POSTs: the route gives a slug that is already taken a
      // suffix, where a PUT would have overwritten the page holding it. An edit
      // names the version it opened, so a save made meanwhile is a 409 to reload
      // from rather than an edit silently written over.
      const res = page
        ? await sendJson(`/api/wiki${pagePath(tagPath, slug)}`, 'PUT', { title, content, bannerImage, metadata, newSlug, editorIds, verified, baseVersion: page.version, revisionMessage: revisionMessage.trim() || undefined })
        : await sendJson('/api/wiki', 'POST', { title, content, bannerImage, metadata, tagPath, slug: newSlug || slug || undefined });
      const data = await res.json();
      // Saving stays the phase until the load replaces the editor. A taken slug
      // is an edit the reader can make and save again; only a reload fixes the rest.
      if (res.ok) {
        if (data.isFirstContribution) sessionStorage.setItem(CARRIED_TOAST, 'Your first contribution! Welcome to the wiki.');
        window.location.href = pagePath(data.tagPath, data.slug);
      } else if (mustReload(res.status, data)) setPhase({ kind: 'conflict', message: data.error || 'This page changed since it was opened.' });
      else setPhase({ kind: 'editing', error: data.error || 'Failed to save.' });
    } catch { setPhase({ kind: 'editing', error: 'Failed to save.' }); }
  };

  const handleDelete = async () => {
    if (!page || !confirm('Are you sure you want to delete this page?')) return;
    setPhase({ kind: 'deleting' });
    try {
      const r = await fetch(`/api/wiki/${page.tagPath}/${page.slug}`, { method: 'DELETE' });
      // Deleting stays the phase until the navigation replaces the editor.
      if (r.ok) { router.push(`/${page.tagPath}`); return; }
    } catch { /* reported below */ }
    setPhase({ kind: 'editing', error: 'The page could not be deleted. Try again.' });
  };

  const canSave = (isCreating ? !!title.trim() : true) && gate.kind !== 'refused';
  useSaveShortcut(() => { if (canSave && phase.kind === 'editing') save(); });

  const back = <Link href={viewPath}><Button variant="secondary"><ArrowLeft size={18} />Back</Button></Link>;
  if (page && user && isAuthorOnlyPath(page.tagPath) && !canEditAuthorOnlyPage(page, user.id)) {
    return <EmptyState as="h1" title="Not your page" description="In this category you can edit only the pages you wrote." action={back} />;
  }

  if (page && isLockedPage(page.tagPath, page.slug)) {
    return <EmptyState as="h1" title="Page locked" description="This page is locked and cannot be edited." action={back} />;
  }

  // On a shared board the card is the board's, not its filer's: whoever passes
  // the edit gate can delete it too.
  const canDelete = !isCreating && (isAuthor || (isSharedPath(tagPath) && gate.kind === 'allowed'));
  const backHref = isCreating ? `/${tagPath}` : viewPath;
  const isSaving = phase.kind === 'saving';
  const saveLabel = isCreating ? (isSaving ? 'Creating...' : 'Create Page') : (isSaving ? 'Saving...' : 'Save Changes');

  return (
    <article className="stack page-editor">
      <Breadcrumbs
        path={[...tagPath.split('/'), slug].filter(Boolean)} suffix={isCreating ? 'Create' : 'Edit'}
      />
      {/* A child of the article, not the header, so it stays stuck for the whole edit. */}
      <div className="editor-bar">
        <Link href={backHref} onClick={e => { if (!confirmLeave()) e.preventDefault(); }} className="row link-muted"><ArrowLeft size={16} /><span>{isCreating ? 'Back to Category' : 'Back to Page'}</span></Link>
        <Button onClick={save} disabled={phase.kind !== 'editing' || !canSave} size="sm" title="Save (⌘S)"><Save size={16} />{saveLabel}</Button>
      </div>
      <header className="stack pb-6 border-b border-border">
        {gate.kind === 'refused' ? (
          <div data-callout="warning"><p>{gate.reason}</p></div>
        ) : gate.kind !== 'allowed' ? (
          <div data-callout="info"><p>{isCreating ? 'Creating a page in' : 'Editing the page at'} <code>{isCreating ? `/${tagPath}` : viewPath}</code> requires holding <strong>{getXrdRequired(isCreating ? 'create' : 'edit', tagPath).toLocaleString('en-US')} XRD</strong> in your connected wallet. {XRD_NOT_A_FEE}</p></div>
        ) : null}
        {phase.kind === 'editing' && phase.error && <div data-callout="error"><p>{phase.error}</p></div>}
        {phase.kind === 'conflict' && <ConflictNotice message={phase.message} />}
        <input type="text" value={title} onChange={e => patch({ title: e.target.value })} placeholder="Page Title" className="input-ghost text-h1 font-bold" autoFocus={isCreating} />
        <div className="slug-editor">
          <Link2 size={14} />
          {isHub ? <span>/{tagPath}</span> : <>
            <span>/{tagPath}/</span>
            <input type="text" value={shownSlug} onChange={e => patch({ slug: { kind: 'typed', value: e.target.value.toLowerCase().replace(/[^\w\s-]/g, '').replace(/[\s_]+/g, '-') } })} onBlur={() => setFields(f => (f.slug.kind === 'typed' ? { ...f, slug: { kind: 'typed', value: slugifyHeading(f.slug.value) } } : f))} placeholder="page-slug" />
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
      <Banner src={bannerImage} editable onUpload={url => patch({ bannerImage: url })} onRemove={() => patch({ bannerImage: null })} />
      <MetadataFields metadataKeys={metadataKeys} metadata={metadata} onChange={m => patch({ metadata: m })} invalidKeys={phase.kind === 'editing' ? phase.missing : undefined} />
      {isAuthor && isAuthorOnlyPath(tagPath) && !isCreating && (
        <EditorWhitelist
          editors={editors}
          onAdd={u => { patch({ editorIds: [...editorIds, u.id] }); setEditors(e => e.status === 'loaded' ? { status: 'loaded', users: [...e.users, u] } : e); }}
          onRemove={id => { patch({ editorIds: editorIds.filter(i => i !== id) }); setEditors(e => e.status === 'loaded' ? { status: 'loaded', users: e.users.filter(u => u.id !== id) } : e); }}
        />
      )}
      <ArticleBlocksEditor content={content} onChange={c => patch({ content: c })} />
      {canDelete && (
        <div className="section-divider">
          <Button variant="ghost" size="sm" onClick={handleDelete} disabled={isSaving || phase.kind === 'deleting'} className="text-error hover:bg-error/10">
            <Trash2 size={16} />{phase.kind === 'deleting' ? 'Deleting...' : 'Delete Page'}
          </Button>
        </div>
      )}
    </article>
  );
}
