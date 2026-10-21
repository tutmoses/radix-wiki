// src/components/BlockEditor.tsx - Full editor with Tiptap (code-split)

'use client';

import { useMemo, type ReactNode } from 'react';
import { EditorContent, UrlPromptField, WikiToolbar, toolbarActions, uploadImageTo, useUrlPrompt, useWikiEditor, type ToolbarKey } from 'wiki-formant/editor';
import {
  BannerFields, BlockEditor as FormantBlockEditor, Choice, CodeTabsFields, ColumnsFields, Field, InfoboxFields, LimitField, LinkGridFields,
  ListFields, ReferencesFields, StatsFields, type BlockEditorKit, type BlockMeta, type BlockSchema, type ChoiceProps, type FieldProps, type MenuProps, type PageOption,
} from 'wiki-formant/block-editor';
import { CHART_RANGES } from 'wiki-formant/chart';
import { Plus, Trash2, Copy, ChevronUp, ChevronDown, Upload, Minus, Code, Quote, Bold, Italic, Link2, Unlink, Heading2, Heading3, Heading4, List, TableIcon, Globe, LayoutList, Info } from 'lucide-react';
import { categoryLabel, cn, tipAddress } from '@/lib/utils';
import { TAG_TREE, tagPaths } from '@/lib/tags';
import { useFetch } from '@/hooks';
import { BLOCK_META, INSERTABLE_BLOCKS, ATOMIC_BLOCK_TYPES, createBlock, duplicateBlock } from '@/lib/block-utils';
import { resolveMapUrl } from 'wiki-formant/maps';
import { ACTIVITY_METRICS } from '@/lib/radix/metrics';
import { Button, Dropdown, TipJarQr } from '@/components/ui';
import { Iframe, YouTube, TwitterEmbed, MapEmbed, TabGroup, TabItem, CodeBlock, HeadingIds } from '@/lib/tiptap/extensions';
import type { AtomicBlock, Block, BlockType, InfoboxBlock, AssetPriceBlock, NetworkChartBlock, RssFeedBlock, TipJarBlock, ListBlock } from '@/types/blocks';

// The upload endpoint is this app's, so the hook takes the uploader rather than
// owning one. Module-level because the hook's upload callback depends on it.
const uploadImage = uploadImageTo('/api/upload');

// The editor's state, its toolbar's layout and the address field are
// `wiki-formant/editor`, shared with caper and acuiq2; the icons, the classes and
// this wiki's own nodes are what is left here.
const FORMAT_ACTIONS = toolbarActions(['bold', 'italic', 'code', 'link', 'h2', 'h3', 'h4', 'bulletList', 'blockquote', 'codeBlock', 'divider']);
const INSERT_ACTIONS = toolbarActions(['table', 'tabs']);
const TOOLBAR_ICONS: Partial<Record<ToolbarKey, ReactNode>> & { unlink: ReactNode; upload: ReactNode; embed: ReactNode } = {
  bold: <Bold size={14} />, italic: <Italic size={14} />, code: <Code size={14} />, link: <Link2 size={14} />,
  h2: <Heading2 size={14} />, h3: <Heading3 size={14} />, h4: <Heading4 size={14} />, bulletList: <List size={14} />,
  blockquote: <Quote size={14} />, codeBlock: <Code size={14} />, divider: <Minus size={14} />, table: <TableIcon size={14} />,
  tabs: <LayoutList size={14} />, unlink: <Unlink size={14} />, upload: <Upload size={14} />, embed: <Globe size={14} />,
};
const TOOLBAR_CLASSES = { toolbar: 'toolbar', button: 'toolbar-btn', pressed: 'toolbar-btn-on', divider: 'toolbar-divider', tableButton: 'toolbar-btn text-xs', danger: 'hover:text-error' };
const PROMPT_CLASSES = { row: 'row', input: 'input', apply: 'btn btn-primary', cancel: 'btn' };

function RichTextEditor({ value, onChange, placeholder = 'Write content...' }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  // This wiki's own nodes, built from its class names and icons. Memoised
  // because a fresh array would tear the editor down and lose the selection.
  const nodes = useMemo(() => [YouTube, Iframe, TwitterEmbed, MapEmbed, TabGroup, TabItem, CodeBlock, HeadingIds], []);
  const { editor, fileInputRef, isUploading, handleFileChange, triggerUpload, isActive } = useWikiEditor({
    value,
    onChange,
    placeholder,
    nodes,
    proseClass: 'prose prose-invert',
    uploadImage,
  });
  // The link field opens on the link the cursor is in, and emptying it unlinks.
  const prompt = useUrlPrompt(editor, { resolveMapUrl });

  return (
    <div className="stack-sm">
      <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/gif,image/webp,image/avif" className="hidden" onChange={handleFileChange} />
      {editor && (
        <WikiToolbar editor={editor} isActive={isActive} prompt={prompt} actions={FORMAT_ACTIONS} trailing={INSERT_ACTIONS}
          onUpload={triggerUpload} embed icons={TOOLBAR_ICONS} classNames={TOOLBAR_CLASSES} />
      )}
      <UrlPromptField prompt={prompt} placeholders={{ embed: 'YouTube, Twitter/X, Maps, or iframe URL' }} classNames={PROMPT_CLASSES} />
      <div className={cn('tiptap-editor tiptap-field', isUploading && 'tiptap-field-disabled')}>
        <EditorContent editor={editor} />
        {isUploading && <div className="text-center text-text-muted text-small py-2">Uploading image...</div>}
      </div>
    </div>
  );
}

// ========== THIS WIKI'S BLOCKS ==========
// The list, the cards, the menus and the core blocks' fields are
// `wiki-formant/block-editor`; these are the types only this wiki has.

type EditProps<T extends Block> = { block: T; onUpdate: (b: T) => void };

// Every category a list may name, as its trail: "Contents › Tech › Releases".
const SECTIONS = tagPaths().filter(t => t.path).map(t => ({
  value: t.path,
  label: TAG_TREE.crumbs(t.path).map(c => categoryLabel(c.label)).join(' › '),
}));

function ListEdit({ block, onUpdate }: EditProps<ListBlock>) {
  // The pages to pick from, fetched only once the list picks by hand.
  const { data: pages } = useFetch<PageOption[]>(block.source === 'chosen' ? '/api/wiki?refs' : null);
  return <ListFields block={block} onUpdate={onUpdate} pages={pages ?? undefined} sections={SECTIONS} />;
}

const rangeOptions = (ranges: readonly string[]) => ranges.map(r => ({ value: r, label: r === 'all' ? 'All' : r.toUpperCase() }));

function AssetPriceEdit({ block, onUpdate }: EditProps<AssetPriceBlock>) {
  return (
    <div className="stack-sm">
      <Field label="Resource address" hint="Any Radix resource address; its price is fetched live">
        <input type="text" value={block.resourceAddress || ''} onChange={e => onUpdate({ ...block, resourceAddress: e.target.value })} placeholder="resource_rdx1..." className="input font-mono" />
      </Field>
      <label className="row"><input type="checkbox" checked={block.showChange ?? true} onChange={e => onUpdate({ ...block, showChange: e.target.checked })} />Show 24h change</label>
      <label className="row"><input type="checkbox" checked={block.showChart ?? false} onChange={e => onUpdate({ ...block, showChart: e.target.checked })} />Show price chart</label>
      {block.showChart && (
        <Choice label="Default timeframe" value={block.chartTimeframe || '30d'} options={rangeOptions(CHART_RANGES)} onChange={tf => onUpdate({ ...block, chartTimeframe: tf as AssetPriceBlock['chartTimeframe'] })} />
      )}
    </div>
  );
}

function NetworkChartEdit({ block, onUpdate }: EditProps<NetworkChartBlock>) {
  return (
    <div className="stack-sm">
      <Field label="Metric">
        <select value={block.metric} onChange={e => onUpdate({ ...block, metric: e.target.value as NetworkChartBlock['metric'] })} className="input">
          {ACTIVITY_METRICS.map(m => <option key={m.key} value={m.key}>{m.label}</option>)}
        </select>
      </Field>
      <Choice label="Default range" value={block.range || '1y'} options={rangeOptions(['30d', '90d', '1y', 'all'])} onChange={range => onUpdate({ ...block, range: range as NetworkChartBlock['range'] })} />
      <small className="text-text-muted">The same daily series as /charts, updated once a day</small>
    </div>
  );
}

function RssFeedEdit({ block, onUpdate }: EditProps<RssFeedBlock>) {
  return (
    <div className="stack-sm">
      <Field label="Feed URL">
        <input type="text" className="input" value={block.url} onChange={e => onUpdate({ ...block, url: e.target.value })} placeholder="https://example.com/feeds.json" />
      </Field>
      <LimitField label="Items per page" value={block.limit || 20} onChange={limit => onUpdate({ ...block, limit })} />
    </div>
  );
}

function TipJarEdit({ block, onUpdate }: EditProps<TipJarBlock>) {
  const { address, isValid } = tipAddress(block.address);
  return (
    <div className="stack-sm">
      <Field label="Heading">
        <input type="text" className="input" value={block.label || ''} onChange={e => onUpdate({ ...block, label: e.target.value })} placeholder="Tip the author ☕️" />
      </Field>
      <Field label="Radix account address">
        <input type="text" value={block.address || ''} onChange={e => onUpdate({ ...block, address: e.target.value })} placeholder="account_rdx12..." className="input font-mono" />
      </Field>
      <small className={!address || isValid ? 'text-text-muted' : 'text-error'}>
        {!address ? 'Paste your Radix account address — a scannable QR generates automatically.' : isValid ? 'Valid Radix account address.' : 'Not a valid Radix account address (must start with account_rdx or account_tdx_2_).'}
      </small>
      <Field label="Message">
        <input type="text" className="input" value={block.message || ''} onChange={e => onUpdate({ ...block, message: e.target.value })} placeholder="Support independent writing on Radix." />
      </Field>
      {isValid && <TipJarQr address={address} className="tip-jar-qr-preview" />}
    </div>
  );
}

function renderBody(block: Block, onUpdate: (b: Block) => void): ReactNode {
  switch (block.type) {
    case 'content': return <RichTextEditor value={block.text} onChange={text => onUpdate({ ...block, text })} />;
    case 'list': return <ListEdit block={block} onUpdate={onUpdate} />;
    case 'assetPrice': return <AssetPriceEdit block={block} onUpdate={onUpdate} />;
    case 'networkChart': return <NetworkChartEdit block={block} onUpdate={onUpdate} />;
    case 'rssFeed': return <RssFeedEdit block={block} onUpdate={onUpdate} />;
    case 'tipJar': return <TipJarEdit block={block} onUpdate={onUpdate} />;
    case 'codeTabs': return <CodeTabsFields block={block} onUpdate={onUpdate} />;
    case 'stats': return <StatsFields block={block} onUpdate={onUpdate} />;
    case 'linkGrid': return <LinkGridFields block={block} onUpdate={onUpdate} />;
    case 'references': return <ReferencesFields block={block} onUpdate={onUpdate} />;
    case 'banner': return <BannerFields block={block} onUpdate={onUpdate} />;
    case 'columns': return <ColumnsFields block={block} onUpdate={onUpdate} />;
    case 'infobox': return <InfoboxFields block={block} onUpdate={onUpdate} />;
    // A testimonial has no fields here, and is kept as it is.
    case 'testimonial': return null;
  }
}

// ========== THE KIT ==========

function LabelledField({ label, hint, children }: FieldProps) {
  return (
    <label className="stack-xs">
      <span className="font-medium text-small">{label}</span>
      {children}
      {hint && <small className="text-text-muted">{hint}</small>}
    </label>
  );
}

function ToggleChoice({ label, value, options, onChange }: ChoiceProps) {
  // A row of buttons holds a few values; a list's categories take a select.
  if (options.length > 6) {
    return (
      <LabelledField label={label}>
        <select className="input" value={value} onChange={e => onChange(e.target.value)}>
          {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </LabelledField>
    );
  }
  return (
    <div className="stack-xs">
      <span className="font-medium text-small">{label}</span>
      <div className="toggle-group flex-wrap" role="group" aria-label={label}>
        {options.map(o => (
          <button key={o.value} type="button" aria-pressed={value === o.value} onClick={() => onChange(o.value)} className={cn('toggle-option', value === o.value && 'toggle-option-active')}>{o.label}</button>
        ))}
      </div>
    </div>
  );
}

function DropdownMenu({ open, onOpenChange, trigger, below, children }: MenuProps) {
  return (
    <div className={below ? 'relative' : 'relative center'}>
      {trigger}
      {open && (
        <Dropdown onClose={() => onOpenChange(false)} className={cn('w-64 p-2', !below && 'left-1/2 -translate-x-1/2')}>
          <div className="stack-sm">{children}</div>
        </Dropdown>
      )}
    </div>
  );
}

const KIT: BlockEditorKit = {
  classNames: {
    list: 'stack', nestedList: 'stack-sm', empty: 'empty-state text-text-muted',
    card: 'block-wrapper group', cardHead: 'spread mb-3', cardLabel: 'block-label', cardActions: 'block-actions', action: 'icon-btn block-action',
    addBlock: 'insert-btn', menuItem: 'dropdown-item rounded-md', menuText: 'stack-xs', menuHint: 'text-small text-text-muted',
    stack: 'stack-sm', row: 'row', nest: 'edit-wrapper', columns: 'block-columns',
    input: 'input', lang: 'w-36', code: 'code-tab-input', figure: 'w-32', number: 'w-20', muted: 'text-text-muted text-small',
  },
  icons: { add: <Plus size={14} />, up: <ChevronUp size={14} />, down: <ChevronDown size={14} />, duplicate: <Copy size={14} />, remove: <Trash2 size={14} /> },
  Field: LabelledField,
  Choice: ToggleChoice,
  Menu: DropdownMenu,
  Add: ({ onPress, children }) => <Button size="sm" className="self-start" onClick={onPress}>{children}</Button>,
};

const META = Object.fromEntries(
  Object.entries(BLOCK_META).map(([type, { label, hint, icon: Icon }]) => [type, { label, hint, icon: <Icon size={16} className="shrink-0" /> }]),
) as Record<BlockType, BlockMeta>;

const SCHEMA: BlockSchema<Block> = {
  meta: type => META[type],
  create: createBlock,
  duplicate: duplicateBlock,
  renderBody,
  types: INSERTABLE_BLOCKS,
  nestedTypes: ATOMIC_BLOCK_TYPES,
};
// The infobox is edited in its own rail, and holds atomic blocks only.
const INFOBOX_SCHEMA: BlockSchema<Block> = { ...SCHEMA, types: ATOMIC_BLOCK_TYPES };

// ========== PUBLIC API ==========
export function BlockEditor({ content, onChange }: { content: Block[]; onChange: (content: Block[]) => void }) {
  return <FormantBlockEditor blocks={content} onChange={onChange} schema={SCHEMA} kit={KIT} />;
}

export function InfoboxEditor({ block, onChange }: { block: InfoboxBlock; onChange?: (block: InfoboxBlock) => void }) {
  return (
    <div className="edit-wrapper">
      <div className="edit-wrapper-label"><Info size={18} /><span className="font-medium">Sidebar Content</span></div>
      <FormantBlockEditor blocks={block.blocks ?? []} onChange={blocks => onChange?.({ ...block, blocks: blocks as AtomicBlock[] })} schema={INFOBOX_SCHEMA} kit={KIT} />
    </div>
  );
}
