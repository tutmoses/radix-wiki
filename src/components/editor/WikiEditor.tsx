// src/components/editor/WikiEditor.tsx

'use client';

import { useEditor, EditorContent, type JSONContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import Highlight from '@tiptap/extension-highlight';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import Typography from '@tiptap/extension-typography';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import { common, createLowlight } from 'lowlight';
import { useCallback, useEffect } from 'react';
import { EditorToolbar } from './EditorToolbar';

const lowlight = createLowlight(common);

interface WikiEditorProps {
  content?: JSONContent;
  onChange?: (content: JSONContent) => void;
  onSave?: (content: JSONContent) => void;
  placeholder?: string;
  editable?: boolean;
  autoFocus?: boolean;
}

export function WikiEditor({ content, onChange, onSave, placeholder = 'Start writing your wiki page...', editable = true, autoFocus = false }: WikiEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ codeBlock: false }),
      Placeholder.configure({ placeholder }),
      Link.configure({ openOnClick: false, HTMLAttributes: { class: 'text-accent underline underline-offset-2' } }),
      Image.configure({ HTMLAttributes: { class: 'rounded-md max-w-full' } }),
      Highlight.configure({ multicolor: true }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Table.configure({ resizable: true }),
      TableRow,
      TableCell,
      TableHeader,
      Typography,
      CodeBlockLowlight.configure({ lowlight }),
    ],
    content,
    editable,
    autofocus: autoFocus,
    editorProps: { attributes: { class: 'tiptap-editor prose prose-slate max-w-none focus:outline-none' } },
    onUpdate: ({ editor }) => onChange?.(editor.getJSON()),
    immediatelyRender: false,
  });

  useEffect(() => {
    if (editor && content && JSON.stringify(editor.getJSON()) !== JSON.stringify(content)) {
      editor.commands.setContent(content);
    }
  }, [editor, content]);

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if ((event.metaKey || event.ctrlKey) && event.key === 's') {
      event.preventDefault();
      if (editor && onSave) onSave(editor.getJSON());
    }
  }, [editor, onSave]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  if (!editor) {
    return (
      <div className="bg-surface-1 p-4 min-h-[400px] animate-pulse">
        <div className="h-4 bg-surface-2 rounded w-3/4 mb-4" />
        <div className="h-4 bg-surface-2 rounded w-1/2 mb-4" />
        <div className="h-4 bg-surface-2 rounded w-5/6" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {editable && <EditorToolbar editor={editor} onSave={onSave} />}
      <div className="bg-surface-0 border border-border rounded-md p-6 min-h-[400px] shadow-sm">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}

export default WikiEditor;