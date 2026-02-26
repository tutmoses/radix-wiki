// src/lib/moltbook.ts — Moltbook API client + engagement helpers

import Anthropic from '@anthropic-ai/sdk';

const API_BASE = 'https://www.moltbook.com/api/v1';

function headers() {
  const key = process.env.MOLTBOOK_API_KEY;
  if (!key) throw new Error('MOLTBOOK_API_KEY not set');
  return { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
}

async function request<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { ...opts, headers: { ...headers(), ...opts?.headers } });
  if (!res.ok) throw new Error(`Moltbook ${path}: ${res.status} ${await res.text()}`);
  return res.json();
}

// --- Types ---

export interface MoltbookPost {
  id: string;
  title: string;
  content: string;
  submolt_name: string;
  upvotes: number;
  created_at: string;
  author: { username: string };
}

// --- Challenge solver (LLM-powered) ---

async function solveChallenge(text: string): Promise<string | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  try {
    const anthropic = new Anthropic();
    const msg = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 20,
      system: 'Solve the math problem. Respond with ONLY the number to 2 decimal places (e.g. "16.00"). Nothing else.',
      messages: [{ role: 'user', content: text }],
    });
    const answer = msg.content[0]?.type === 'text' ? msg.content[0].text.trim() : null;
    if (!answer || !/^\d+(\.\d+)?$/.test(answer)) return null;
    return answer.includes('.') ? answer : `${answer}.00`;
  } catch {
    return null;
  }
}

// --- Engagement helpers ---

// Broader keywords that match high-traffic submolt discussions
export const ENGAGEMENT_KEYWORDS = [
  'defi', 'smart contract', 'blockchain scalability',
  'layer 1', 'consensus mechanism', 'cross-chain',
  'token standard', 'reentrancy', 'on-chain',
  'agent finance', 'MCP blockchain',
] as const;

export const TOPIC_MAP: Record<string, string[]> = {
  'defi':                     ['ecosystem', 'contents/tech/core-concepts'],
  'smart contract':           ['developers/scrypto', 'contents/tech/core-concepts'],
  'blockchain scalability':   ['contents/tech/research', 'contents/tech/core-protocols'],
  'layer 1':                  ['contents/tech/core-protocols', 'contents/tech/research'],
  'consensus mechanism':      ['contents/tech/core-protocols', 'contents/tech/research'],
  'cross-chain':              ['contents/tech/core-protocols', 'ecosystem'],
  'token standard':           ['contents/tech/core-concepts', 'developers/scrypto'],
  'reentrancy':               ['developers/scrypto', 'contents/tech/core-concepts'],
  'on-chain':                 ['contents/tech/core-concepts', 'ecosystem'],
  'agent finance':            ['ecosystem', 'contents/tech/core-concepts'],
  'MCP blockchain':           ['developers', 'contents/tech/core-concepts'],
};

export const REPLY_TEMPLATES = {
  scalability: (_title: string, _excerpt: string, url: string) =>
    `Interesting point on scalability. The approach I've been tracking is Cerberus — atomic cross-shard commits without bridging. Wrote up how it works: ${url}`,
  defi: (_title: string, _excerpt: string, url: string) =>
    `This resonates. One angle worth considering: what if tokens were native resources instead of contract state? Eliminates approval exploits entirely. More here: ${url}`,
  security: (_title: string, _excerpt: string, url: string) =>
    `Good analysis. There's a language-level approach to this — making reentrancy structurally impossible rather than relying on developer discipline. Detailed breakdown: ${url}`,
  dev: (_title: string, _excerpt: string, url: string) =>
    `Solid build. If you're evaluating smart contract languages, Scrypto takes a different approach — assets as native primitives, Rust-based. Overview: ${url}`,
  generic: (_title: string, _excerpt: string, url: string) =>
    `Related topic I've been researching — wrote it up here: ${url}`,
} as const;

export type ReplyTemplate = keyof typeof REPLY_TEMPLATES;

export function pickReplyTemplate(keyword: string): ReplyTemplate {
  if (/scalab|layer.?1|cerberus|shard|consensus/.test(keyword)) return 'scalability';
  if (/defi|yield|swap|liquidity|amm|lend|borrow/.test(keyword)) return 'defi';
  if (/security|audit|exploit|hack|vuln|reentran/.test(keyword)) return 'security';
  if (/scrypto|develop|build|smart.?contract|rust|deploy/.test(keyword)) return 'dev';
  return 'generic';
}

export function scorePage(
  post: MoltbookPost,
  page: { title: string; excerpt: string | null; tagPath: string; slug: string },
): number {
  const postText = `${post.title} ${post.content}`.toLowerCase();
  const pageTokens = `${page.title} ${page.excerpt || ''}`.toLowerCase().split(/\W+/).filter(t => t.length > 3);
  return pageTokens.reduce((score, token) => score + (postText.includes(token) ? 1 : 0), 0);
}

export const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

// --- LLM generation (shared) ---

export function formatPageContext(page: { title: string; excerpt: string | null; tagPath?: string }, url: string): string {
  return `Wiki page: "${page.title}"\nExcerpt: ${page.excerpt || 'No excerpt.'}${page.tagPath ? `\nTag path: ${page.tagPath}` : ''}\nURL: ${url}`;
}

export async function generateWithLLM(system: string, userContent: string, maxTokens: number, url: string): Promise<string | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  try {
    const anthropic = new Anthropic();
    const msg = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content: userContent }],
    });
    const text = msg.content[0]?.type === 'text' ? msg.content[0].text.trim() : '';
    if (!text) return null;
    return text.includes(url) ? text : `${text} ${url}`;
  } catch {
    return null;
  }
}

// --- LLM reply generation ---

const REPLY_SYSTEM_PROMPT = `You are @radixwiki, an AI agent on Moltbook (a Reddit-style AI agent forum). You maintain a wiki about Radix DLT.

Write a SHORT reply to the post below. You are one agent talking to another.

Critical rules:
1. FIRST engage with what the post actually says — agree, disagree, add nuance, or answer the question
2. THEN, only if genuinely relevant, mention a Radix angle with the wiki link
3. If Radix isn't clearly relevant, just engage with the post and drop the link at the end as a "related read"
4. Under 200 characters. Be concise — one thought, not an essay
5. Never open with "Great question!", "Good analysis", "Interesting point", "This resonates" or any filler praise
6. No hashtags, no emojis
7. Sound like an agent sharing knowledge, not a marketer pitching a product
8. Ask a follow-up question when natural — this drives thread engagement

Good: "The approval vector is underrated. Scrypto sidesteps it entirely — tokens are native resources, not contract state. No approve() to exploit. ${'{url}'}"
Bad: "On Radix, tokens are native resources, not contract state — meaning no approval exploits or reentrancy by design. Relevant: Page Title. Excerpt text. ${'{url}'}"`;

export async function generateReply(
  post: MoltbookPost,
  page: { title: string; excerpt: string | null },
  url: string,
): Promise<string> {
  const userContent = `Post by @${post.author?.username || 'unknown'} in m/${post.submolt_name || 'general'}:\n${post.title ? `Title: ${post.title}\n` : ''}${post.content}\n\nRelevant wiki page to link: "${page.title}" — ${page.excerpt || 'No excerpt.'}\nURL: ${url}`;
  return await generateWithLLM(REPLY_SYSTEM_PROMPT, userContent, 120, url) ?? fallbackReply(post, page, url);
}

function fallbackReply(
  post: MoltbookPost,
  page: { title: string; excerpt: string | null },
  url: string,
): string {
  const keyword = `${post.title} ${post.content}`.toLowerCase();
  const template = pickReplyTemplate(keyword);
  return REPLY_TEMPLATES[template](page.title, page.excerpt || '', url);
}

// --- API client ---

export const moltbook = {
  async post(submolt: string, title: string, content: string) {
    const res = await request<{ post: { verification?: { verification_code: string; challenge_text: string } } }>(
      '/posts', { method: 'POST', body: JSON.stringify({ submolt_name: submolt, title, content }) },
    );
    const v = res.post?.verification;
    if (v) {
      const answer = await solveChallenge(v.challenge_text);
      if (answer) await request('/verify', { method: 'POST', body: JSON.stringify({ verification_code: v.verification_code, answer }) });
    }
    return res;
  },

  comment(postId: string, body: string) {
    return request(`/posts/${postId}/comments`, { method: 'POST', body: JSON.stringify({ content: body }) });
  },

  upvote(postId: string) {
    return request(`/posts/${postId}/upvote`, { method: 'POST' });
  },

  feed(sort?: string) {
    const params = sort ? `?sort=${sort}` : '';
    return request<{ posts: MoltbookPost[] }>(`/feed${params}`);
  },

  search(query: string) {
    return request<{ results: MoltbookPost[] }>(`/search?q=${encodeURIComponent(query)}`);
  },

  home() {
    return request('/home');
  },
};
