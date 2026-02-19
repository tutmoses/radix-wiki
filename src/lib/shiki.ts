// src/lib/shiki.ts - Shared syntax highlighting

type Highlighter = Awaited<ReturnType<typeof import('shiki').createHighlighter>>;

export const SHIKI_LANGS = ['javascript', 'typescript', 'css', 'json', 'bash', 'python', 'rust', 'sql', 'html', 'xml', 'jsx', 'tsx', 'markdown', 'yaml', 'toml'] as const;
const VALID_LANGS = new Set<string>(SHIKI_LANGS);
export const DEFAULT_LANG = 'rust';

let shikiInstance: Highlighter | null = null;
let shikiPromise: Promise<Highlighter> | null = null;

export function getShiki(): Promise<Highlighter> {
  if (shikiInstance) return Promise.resolve(shikiInstance);
  if (!shikiPromise) {
    shikiPromise = import('shiki').then(async ({ createHighlighter }) => {
      shikiInstance = await createHighlighter({ themes: ['github-dark'], langs: [...SHIKI_LANGS] });
      return shikiInstance;
    });
  }
  return shikiPromise;
}

function addCopyButton(pre: Element) {
  const btn = document.createElement('button');
  btn.className = 'code-copy-btn';
  btn.setAttribute('aria-label', 'Copy code');
  btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
  btn.onclick = () => {
    const code = pre.querySelector('code')?.textContent || pre.textContent || '';
    navigator.clipboard.writeText(code).then(() => {
      btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
      setTimeout(() => {
        btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
      }, 2000);
    });
  };
  const wrapper = pre.parentElement;
  if (wrapper?.classList.contains('code-block-wrapper')) {
    wrapper.appendChild(btn);
  } else {
    (pre as HTMLElement).style.position = 'relative';
    pre.appendChild(btn);
  }
}

export function highlightCodeBlocks(container: HTMLElement, highlighter: Highlighter) {
  container.querySelectorAll('pre:not([data-highlighted]) code, pre:not([data-highlighted]):not(:has(code))').forEach(el => {
    const pre = el.tagName === 'PRE' ? el : el.parentElement;
    if (!pre || pre.hasAttribute('data-highlighted')) return;
    const code = el.textContent || '';
    if (!code.trim()) return;
    const langMatch = el.className?.match(/language-(\w+)/);
    const lang = VALID_LANGS.has(langMatch?.[1] || '') ? langMatch![1] : DEFAULT_LANG;
    const html = highlighter.codeToHtml(code, { lang, theme: 'github-dark' });
    const temp = document.createElement('div');
    temp.innerHTML = html;
    const newPre = temp.firstElementChild;
    if (newPre) {
      newPre.setAttribute('data-highlighted', 'true');
      pre.replaceWith(newPre);
      addCopyButton(newPre);
    }
  });
  // Add copy buttons to pre blocks that already had highlighting or don't need it
  container.querySelectorAll('pre[data-highlighted]:not(:has(.code-copy-btn))').forEach(pre => addCopyButton(pre));
}