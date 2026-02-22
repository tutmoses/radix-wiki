// src/lib/highlight.ts - Server-side syntax highlighting via rehype-pretty-code

import { unified } from 'unified';
import rehypeParse from 'rehype-parse';
import rehypeStringify from 'rehype-stringify';
import rehypePrettyCode from 'rehype-pretty-code';
import type { Block, AtomicBlock, CodeTabsBlock } from '@/types/blocks';

const processor = unified()
  .use(rehypeParse, { fragment: true })
  .use(rehypePrettyCode, {
    theme: 'github-dark',
    keepBackground: true,
    defaultLang: 'rust',
  })
  .use(rehypeStringify);

async function highlightHtml(html: string): Promise<string> {
  if (!html || (!html.includes('<pre') && !html.includes('<code'))) return html;
  const result = await processor.process(html);
  return String(result);
}

async function highlightAtomicBlock(block: AtomicBlock): Promise<AtomicBlock> {
  if (block.type === 'content' && block.text?.includes('<pre')) {
    return { ...block, text: await highlightHtml(block.text) };
  }
  if (block.type === 'codeTabs') {
    const tabs = await Promise.all(
      block.tabs.map(async tab => {
        const html = `<pre><code class="language-${tab.language}">${escapeHtml(tab.code)}</code></pre>`;
        return { ...tab, code: await highlightHtml(html) };
      })
    );
    return { ...block, tabs } as CodeTabsBlock;
  }
  return block;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export async function highlightBlocks(blocks: Block[]): Promise<Block[]> {
  return Promise.all(blocks.map(async (block): Promise<Block> => {
    if (block.type === 'columns') {
      const columns = await Promise.all(
        block.columns.map(async col => ({
          ...col,
          blocks: await Promise.all(col.blocks.map(highlightAtomicBlock)),
        }))
      );
      return { ...block, columns };
    }
    if (block.type === 'infobox') {
      const inner = await Promise.all(block.blocks.map(highlightAtomicBlock));
      return { ...block, blocks: inner };
    }
    return highlightAtomicBlock(block as AtomicBlock) as Promise<Block>;
  }));
}
