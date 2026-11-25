// src/lib/tiptap/extensions.tsx — this wiki's binding of the shared editor nodes.
//
// The nodes themselves are `wiki-formant/tiptap`, shared with caper, on its
// default class names (this wiki's look over them is globals.css). What stays
// here is the part that is this wiki's: the icon set. The embeds carry none,
// so they are `embedNodes()` in the editor, straight from the package.

'use client';

import { ChevronDown, Check, Code, Plus, X } from 'lucide-react';
import { createCodeBlock, createHeadingIds, createTabs } from 'wiki-formant/tiptap';
import { slugifyHeading } from 'wiki-formant/headings';

export const CodeBlock = createCodeBlock({
  icons: {
    lang: <Code size={12} />,
    chevron: open => <ChevronDown size={12} className={open ? 'transition-transform rotate-180' : 'transition-transform'} />,
    selected: <Check size={12} />,
  },
});

export const { TabGroup, TabItem } = createTabs({
  icons: { add: <Plus size={14} />, remove: <X size={12} /> },
});

/**
 * Gives each heading in the editor the id its published copy will carry, so
 * the rail's "On this page" entries, which `PageEditor` reads from the draft,
 * scroll to it and light it while the page is being edited.
 * `slugifyHeading` is the rule `processHtml` passes to `injectHeadingIds`.
 */
export const HeadingIds = createHeadingIds({ slug: slugifyHeading });
