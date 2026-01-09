// src/components/BlockEditor.tsx

'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { 
  Plus, GripVertical, Trash2, Copy, ChevronUp, ChevronDown,
  Type, AlignLeft, Image, AlertCircle, Minus, Code, Quote, 
  List, Clock, FileText, Link as LinkIcon
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button, Input } from '@/components/ui';
import { 
  type Block, type BlockContent, type BlockType,
  createBlock, duplicateBlock, BLOCK_LABELS, INSERTABLE_BLOCKS 
} from '@/lib/blocks';

const BLOCK_ICONS: Record<BlockType, React.ReactNode> = {
  heading: <Type size={18} />,
  paragraph: <AlignLeft size={18} />,
  image: <Image size={18} />,
  callout: <AlertCircle size={18} />,
  divider: <Minus size={18} />,
  code: <Code size={18} />,
  quote: <Quote size={18} />,
  list: <List size={18} />,
  recentPages: <Clock size={18} />,
  pageList: <FileText size={18} />,
  embed: <LinkIcon size={18} />,
};

interface BlockEditorProps {
  content: BlockContent;
  onChange: (content: BlockContent) => void;
}

interface BlockWrapperProps {
  block: Block;
  index: number;
  total: number;
  isSelected: boolean;
  onSelect: () => void;
  onUpdate: (block: Block) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}

// Individual block editors
function HeadingEditor({ block, onUpdate }: { block: Extract<Block, { type: 'heading' }>; onUpdate: (b: Block) => void }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        {([1, 2, 3] as const).map((level) => (
          <button
            key={level}
            onClick={() => onUpdate({ ...block, level })}
            className={cn(
              'px-3 py-1 text-sm rounded-md border',
              block.level === level ? 'bg-accent text-text-inverted border-accent' : 'border-border hover:bg-surface-2'
            )}
          >
            H{level}
          </button>
        ))}
      </div>
      <input
        type="text"
        value={block.text}
        onChange={(e) => onUpdate({ ...block, text: e.target.value })}
        placeholder="Heading text..."
        className={cn(
          'w-full bg-transparent border-0 outline-none font-semibold',
          block.level === 1 && 'text-3xl',
          block.level === 2 && 'text-2xl',
          block.level === 3 && 'text-xl'
        )}
      />
    </div>
  );
}

function ParagraphEditor({ block, onUpdate }: { block: Extract<Block, { type: 'paragraph' }>; onUpdate: (b: Block) => void }) {
  return (
    <div className="flex flex-col gap-1">
      <textarea
        value={block.text}
        onChange={(e) => onUpdate({ ...block, text: e.target.value })}
        placeholder="Write paragraph... (supports **bold**, *italic*, `code`, [links](url))"
        className="w-full bg-transparent border-0 outline-none resize-none min-h-[60px] leading-relaxed"
        rows={3}
      />
      <p className="text-xs text-text-muted">Supports: **bold**, *italic*, `code`, [link text](url)</p>
    </div>
  );
}

function ImageEditor({ block, onUpdate }: { block: Extract<Block, { type: 'image' }>; onUpdate: (b: Block) => void }) {
  return (
    <div className="flex flex-col gap-3">
      <Input
        label="Image URL"
        type="url"
        value={block.src}
        onChange={(e) => onUpdate({ ...block, src: e.target.value })}
        placeholder="https://..."
      />
      <Input
        label="Alt text"
        value={block.alt || ''}
        onChange={(e) => onUpdate({ ...block, alt: e.target.value })}
        placeholder="Describe the image..."
      />
      <Input
        label="Caption (optional)"
        value={block.caption || ''}
        onChange={(e) => onUpdate({ ...block, caption: e.target.value })}
        placeholder="Image caption..."
      />
      {block.src && (
        <img src={block.src} alt={block.alt || ''} className="rounded-lg max-h-48 object-contain" />
      )}
    </div>
  );
}

function CalloutEditor({ block, onUpdate }: { block: Extract<Block, { type: 'callout' }>; onUpdate: (b: Block) => void }) {
  const variants = ['info', 'warning', 'success', 'error'] as const;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        {variants.map((variant) => (
          <button
            key={variant}
            onClick={() => onUpdate({ ...block, variant })}
            className={cn(
              'px-3 py-1 text-sm rounded-md border capitalize',
              block.variant === variant ? 'bg-accent text-text-inverted border-accent' : 'border-border hover:bg-surface-2'
            )}
          >
            {variant}
          </button>
        ))}
      </div>
      <Input
        label="Title (optional)"
        value={block.title || ''}
        onChange={(e) => onUpdate({ ...block, title: e.target.value })}
        placeholder="Callout title..."
      />
      <textarea
        value={block.text}
        onChange={(e) => onUpdate({ ...block, text: e.target.value })}
        placeholder="Callout content..."
        className="w-full p-3 bg-surface-1 border border-border rounded-md outline-none resize-none min-h-[60px]"
        rows={2}
      />
    </div>
  );
}

function CodeEditor({ block, onUpdate }: { block: Extract<Block, { type: 'code' }>; onUpdate: (b: Block) => void }) {
  const languages = ['typescript', 'javascript', 'python', 'rust', 'sql', 'bash', 'json', 'css', 'html'];
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {languages.map((lang) => (
          <button
            key={lang}
            onClick={() => onUpdate({ ...block, language: lang })}
            className={cn(
              'px-2 py-1 text-xs rounded border',
              block.language === lang ? 'bg-accent text-text-inverted border-accent' : 'border-border hover:bg-surface-2'
            )}
          >
            {lang}
          </button>
        ))}
      </div>
      <textarea
        value={block.code}
        onChange={(e) => onUpdate({ ...block, code: e.target.value })}
        placeholder="// Enter code..."
        className="w-full p-3 bg-surface-1 border border-border rounded-md outline-none resize-none min-h-[120px] font-mono text-sm"
        rows={6}
        spellCheck={false}
      />
    </div>
  );
}

function QuoteEditor({ block, onUpdate }: { block: Extract<Block, { type: 'quote' }>; onUpdate: (b: Block) => void }) {
  return (
    <div className="flex flex-col gap-3 border-l-4 border-accent pl-4">
      <textarea
        value={block.text}
        onChange={(e) => onUpdate({ ...block, text: e.target.value })}
        placeholder="Quote text..."
        className="w-full bg-transparent border-0 outline-none resize-none min-h-[60px] italic"
        rows={2}
      />
      <Input
        label="Attribution (optional)"
        value={block.attribution || ''}
        onChange={(e) => onUpdate({ ...block, attribution: e.target.value })}
        placeholder="— Author name"
      />
    </div>
  );
}

function ListEditor({ block, onUpdate }: { block: Extract<Block, { type: 'list' }>; onUpdate: (b: Block) => void }) {
  const styles = ['bullet', 'numbered', 'checklist'] as const;
  
  const updateItem = (index: number, text: string) => {
    const items = [...block.items];
    items[index] = { ...items[index], text };
    onUpdate({ ...block, items });
  };

  const toggleChecked = (index: number) => {
    const items = [...block.items];
    items[index] = { ...items[index], checked: !items[index].checked };
    onUpdate({ ...block, items });
  };

  const addItem = () => {
    onUpdate({ ...block, items: [...block.items, { text: '' }] });
  };

  const removeItem = (index: number) => {
    if (block.items.length <= 1) return;
    const items = block.items.filter((_, i) => i !== index);
    onUpdate({ ...block, items });
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        {styles.map((style) => (
          <button
            key={style}
            onClick={() => onUpdate({ ...block, style })}
            className={cn(
              'px-3 py-1 text-sm rounded-md border capitalize',
              block.style === style ? 'bg-accent text-text-inverted border-accent' : 'border-border hover:bg-surface-2'
            )}
          >
            {style}
          </button>
        ))}
      </div>
      <div className="flex flex-col gap-2">
        {block.items.map((item, index) => (
          <div key={index} className="flex items-center gap-2">
            {block.style === 'checklist' && (
              <input
                type="checkbox"
                checked={item.checked || false}
                onChange={() => toggleChecked(index)}
                className="rounded"
              />
            )}
            {block.style === 'bullet' && <span className="text-text-muted">•</span>}
            {block.style === 'numbered' && <span className="text-text-muted">{index + 1}.</span>}
            <input
              type="text"
              value={item.text}
              onChange={(e) => updateItem(index, e.target.value)}
              placeholder="List item..."
              className="flex-1 bg-transparent border-0 outline-none"
            />
            <button
              onClick={() => removeItem(index)}
              className="p-1 text-text-muted hover:text-red-400"
              disabled={block.items.length <= 1}
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>
      <button onClick={addItem} className="text-sm text-accent hover:text-accent-hover">
        + Add item
      </button>
    </div>
  );
}

function RecentPagesEditor({ block, onUpdate }: { block: Extract<Block, { type: 'recentPages' }>; onUpdate: (b: Block) => void }) {
  return (
    <div className="flex flex-col gap-3 p-4 bg-surface-1 rounded-lg border border-dashed border-border">
      <div className="flex items-center gap-2 text-text-muted">
        <Clock size={18} />
        <span className="font-medium">Recent Pages Widget</span>
      </div>
      <Input
        label="Filter by category (optional)"
        value={block.tagPath || ''}
        onChange={(e) => onUpdate({ ...block, tagPath: e.target.value || undefined })}
        placeholder="e.g., contents/tech"
        hint="Leave empty to show all recent pages"
      />
      <div className="flex items-center gap-2">
        <label className="text-sm">Show</label>
        <input
          type="number"
          min={1}
          max={20}
          value={block.limit}
          onChange={(e) => onUpdate({ ...block, limit: parseInt(e.target.value) || 5 })}
          className="w-16 px-2 py-1 bg-surface-0 border border-border rounded-md text-center"
        />
        <span className="text-sm">pages</span>
      </div>
    </div>
  );
}

function PageListEditor({ block, onUpdate }: { block: Extract<Block, { type: 'pageList' }>; onUpdate: (b: Block) => void }) {
  const [newPageId, setNewPageId] = useState('');

  const addPage = () => {
    if (!newPageId.trim()) return;
    onUpdate({ ...block, pageIds: [...block.pageIds, newPageId.trim()] });
    setNewPageId('');
  };

  const removePage = (index: number) => {
    onUpdate({ ...block, pageIds: block.pageIds.filter((_, i) => i !== index) });
  };

  return (
    <div className="flex flex-col gap-3 p-4 bg-surface-1 rounded-lg border border-dashed border-border">
      <div className="flex items-center gap-2 text-text-muted">
        <FileText size={18} />
        <span className="font-medium">Curated Page List</span>
      </div>
      {block.pageIds.length > 0 && (
        <div className="flex flex-col gap-1">
          {block.pageIds.map((id, index) => (
            <div key={index} className="flex items-center gap-2 text-sm">
              <span className="flex-1 font-mono text-xs truncate">{id}</span>
              <button onClick={() => removePage(index)} className="text-text-muted hover:text-red-400">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <input
          type="text"
          value={newPageId}
          onChange={(e) => setNewPageId(e.target.value)}
          placeholder="Page ID..."
          className="flex-1 px-2 py-1 bg-surface-0 border border-border rounded-md text-sm"
        />
        <Button size="sm" onClick={addPage} disabled={!newPageId.trim()}>Add</Button>
      </div>
      <p className="text-xs text-text-muted">Add page IDs to create a curated list</p>
    </div>
  );
}

function EmbedEditor({ block, onUpdate }: { block: Extract<Block, { type: 'embed' }>; onUpdate: (b: Block) => void }) {
  const ratios = ['16:9', '4:3', '1:1'] as const;
  return (
    <div className="flex flex-col gap-3">
      <Input
        label="Embed URL"
        type="url"
        value={block.url}
        onChange={(e) => onUpdate({ ...block, url: e.target.value })}
        placeholder="https://youtube.com/watch?v=..."
        hint="Supports YouTube and other embed URLs"
      />
      <div className="flex items-center gap-2">
        <span className="text-sm">Aspect ratio:</span>
        {ratios.map((ratio) => (
          <button
            key={ratio}
            onClick={() => onUpdate({ ...block, aspectRatio: ratio })}
            className={cn(
              'px-2 py-1 text-xs rounded border',
              block.aspectRatio === ratio ? 'bg-accent text-text-inverted border-accent' : 'border-border hover:bg-surface-2'
            )}
          >
            {ratio}
          </button>
        ))}
      </div>
    </div>
  );
}

function DividerEditor() {
  return (
    <div className="py-2">
      <hr className="border-border-muted" />
      <p className="text-xs text-text-muted text-center mt-2">Horizontal divider</p>
    </div>
  );
}

function SingleBlockEditor({ block, onUpdate }: { block: Block; onUpdate: (b: Block) => void }) {
  switch (block.type) {
    case 'heading': return <HeadingEditor block={block} onUpdate={onUpdate} />;
    case 'paragraph': return <ParagraphEditor block={block} onUpdate={onUpdate} />;
    case 'image': return <ImageEditor block={block} onUpdate={onUpdate} />;
    case 'callout': return <CalloutEditor block={block} onUpdate={onUpdate} />;
    case 'divider': return <DividerEditor />;
    case 'code': return <CodeEditor block={block} onUpdate={onUpdate} />;
    case 'quote': return <QuoteEditor block={block} onUpdate={onUpdate} />;
    case 'list': return <ListEditor block={block} onUpdate={onUpdate} />;
    case 'recentPages': return <RecentPagesEditor block={block} onUpdate={onUpdate} />;
    case 'pageList': return <PageListEditor block={block} onUpdate={onUpdate} />;
    case 'embed': return <EmbedEditor block={block} onUpdate={onUpdate} />;
    default: return <p className="text-text-muted">Unknown block type</p>;
  }
}

function BlockWrapper({
  block,
  index,
  total,
  isSelected,
  onSelect,
  onUpdate,
  onDelete,
  onDuplicate,
  onMoveUp,
  onMoveDown,
}: BlockWrapperProps) {
  return (
    <div
      onClick={onSelect}
      className={cn(
        'group relative flex gap-2 p-4 rounded-lg border transition-colors',
        isSelected ? 'border-accent bg-accent/5' : 'border-border-muted hover:border-border'
      )}
    >
      {/* Drag handle & actions */}
      <div className="flex flex-col items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button className="p-1 text-text-muted hover:text-text cursor-grab">
          <GripVertical size={16} />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onMoveUp(); }}
          disabled={index === 0}
          className="p-1 text-text-muted hover:text-text disabled:opacity-30"
        >
          <ChevronUp size={14} />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onMoveDown(); }}
          disabled={index === total - 1}
          className="p-1 text-text-muted hover:text-text disabled:opacity-30"
        >
          <ChevronDown size={14} />
        </button>
      </div>

      {/* Block content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-2 text-text-muted">
          {BLOCK_ICONS[block.type]}
          <span className="text-xs font-medium uppercase">{BLOCK_LABELS[block.type]}</span>
        </div>
        <SingleBlockEditor block={block} onUpdate={onUpdate} />
      </div>

      {/* Block actions */}
      <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={(e) => { e.stopPropagation(); onDuplicate(); }}
          className="p-1 text-text-muted hover:text-text"
          title="Duplicate"
        >
          <Copy size={14} />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="p-1 text-text-muted hover:text-red-400"
          title="Delete"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}

function InsertBlockMenu({ onInsert, onClose }: { onInsert: (type: BlockType) => void; onClose: () => void }) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  return (
    <div ref={menuRef} className="absolute left-1/2 -translate-x-1/2 mt-2 w-64 bg-surface-0 border border-border rounded-lg shadow-lg z-10 p-2">
      <div className="grid gap-1">
        {INSERTABLE_BLOCKS.map((type) => (
          <button
            key={type}
            onClick={() => { onInsert(type); onClose(); }}
            className="flex items-center gap-2 w-full px-3 py-2 text-left text-sm rounded-md hover:bg-surface-2 transition-colors"
          >
            {BLOCK_ICONS[type]}
            <span>{BLOCK_LABELS[type]}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function InsertBlockButton({ onInsert }: { onInsert: (type: BlockType) => void }) {
  const [showMenu, setShowMenu] = useState(false);

  return (
    <div className="relative flex justify-center">
      <button
        onClick={() => setShowMenu(!showMenu)}
        className="flex items-center gap-1 px-3 py-1.5 text-sm text-text-muted hover:text-text border border-dashed border-border-muted hover:border-border rounded-md transition-colors"
      >
        <Plus size={16} />
        <span>Add block</span>
      </button>
      {showMenu && <InsertBlockMenu onInsert={onInsert} onClose={() => setShowMenu(false)} />}
    </div>
  );
}

export function BlockEditor({ content, onChange }: BlockEditorProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const updateBlock = useCallback((index: number, block: Block) => {
    const newContent = [...content];
    newContent[index] = block;
    onChange(newContent);
  }, [content, onChange]);

  const deleteBlock = useCallback((index: number) => {
    onChange(content.filter((_, i) => i !== index));
    setSelectedIndex(null);
  }, [content, onChange]);

  const duplicateBlockAt = useCallback((index: number) => {
    const newContent = [...content];
    newContent.splice(index + 1, 0, duplicateBlock(content[index]));
    onChange(newContent);
    setSelectedIndex(index + 1);
  }, [content, onChange]);

  const moveBlock = useCallback((from: number, to: number) => {
    if (to < 0 || to >= content.length) return;
    const newContent = [...content];
    const [moved] = newContent.splice(from, 1);
    newContent.splice(to, 0, moved);
    onChange(newContent);
    setSelectedIndex(to);
  }, [content, onChange]);

  const insertBlock = useCallback((type: BlockType, atIndex?: number) => {
    const newBlock = createBlock(type);
    const newContent = [...content];
    const index = atIndex ?? content.length;
    newContent.splice(index, 0, newBlock);
    onChange(newContent);
    setSelectedIndex(index);
  }, [content, onChange]);

  return (
    <div className="flex flex-col gap-3">
      {content.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-12 text-center">
          <p className="text-text-muted">No content yet. Add your first block!</p>
          <InsertBlockButton onInsert={(type) => insertBlock(type)} />
        </div>
      ) : (
        <>
          {content.map((block, index) => (
            <div key={block.id}>
              <BlockWrapper
                block={block}
                index={index}
                total={content.length}
                isSelected={selectedIndex === index}
                onSelect={() => setSelectedIndex(index)}
                onUpdate={(b) => updateBlock(index, b)}
                onDelete={() => deleteBlock(index)}
                onDuplicate={() => duplicateBlockAt(index)}
                onMoveUp={() => moveBlock(index, index - 1)}
                onMoveDown={() => moveBlock(index, index + 1)}
              />
            </div>
          ))}
          <InsertBlockButton onInsert={(type) => insertBlock(type)} />
        </>
      )}
    </div>
  );
}

export default BlockEditor;