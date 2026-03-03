// src/lib/moltbook.ts — Moltbook API client + engagement helpers

import Anthropic from '@anthropic-ai/sdk';

const API_BASE = 'https://www.moltbook.com/api/v1';

function headers() {
  const key = process.env.MOLTBOOK_API_KEY;
  if (!key) throw new Error('MOLTBOOK_API_KEY not set');
  return { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
}

// --- Retry utility ---

async function withRetry<T>(fn: () => Promise<T>, retries = 2, baseDelay = 2000): Promise<T> {
  for (let i = 0; i <= retries; i++) {
    try { return await fn(); }
    catch (e) {
      if (i === retries) throw e;
      await new Promise(r => setTimeout(r, baseDelay * (i + 1)));
    }
  }
  throw new Error('unreachable');
}

async function request<T>(path: string, opts?: RequestInit): Promise<T> {
  return withRetry(async () => {
    const res = await fetch(`${API_BASE}${path}`, { ...opts, headers: { ...headers(), ...opts?.headers } });
    if (!res.ok) throw new Error(`Moltbook ${path}: ${res.status} ${await res.text()}`);
    return res.json();
  });
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
      system: `Solve the obfuscated lobster math challenge. The text has random capitalization, special characters (^-|]/~<>), filler words ("Um"), and broken spacing. Ignore all noise and decode the math problem.

Operations: "total force" / "push together" / "multiplied" = MULTIPLY. "accelerates by" / "adds" / "new speed" = ADD.

Numbers are written as words with noise: "tWeN tY FiV e" = 25, "SiX" = 6.

Respond with ONLY the numeric answer to 2 decimal places (e.g. "150.00"). Nothing else.`,
      messages: [{ role: 'user', content: text }],
    });
    const answer = msg.content[0]?.type === 'text' ? msg.content[0].text.trim() : null;
    if (!answer || !/^\d+(\.\d+)?$/.test(answer)) return null;
    return answer.includes('.') ? answer : `${answer}.00`;
  } catch {
    return null;
  }
}

// --- Submolt selection ---

const SUBMOLT_WEIGHTS = [
  { name: 'general', weight: 4 },
  { name: 'crypto', weight: 2 },
  { name: 'agents', weight: 4 },
] as const;

export function pickSubmolt(): string {
  const total = SUBMOLT_WEIGHTS.reduce((s, w) => s + w.weight, 0);
  let r = Math.random() * total;
  for (const { name, weight } of SUBMOLT_WEIGHTS) {
    r -= weight;
    if (r <= 0) return name;
  }
  return 'general';
}

// --- Engagement helpers ---

export const ENGAGEMENT_KEYWORDS = [
  'defi', 'smart contract', 'layer 1',
  'consensus', 'scalability', 'cross-chain',
  'blockchain', 'token', 'reentrancy',
  'AI agent', 'autonomous agent', 'trading bot',
  'MCP', 'agentic', 'blind signing',
] as const;

export const TOPIC_MAP: Record<string, string[]> = {
  'defi':           ['ecosystem', 'contents/tech/core-concepts'],
  'smart contract': ['developers/scrypto', 'contents/tech/core-concepts'],
  'layer 1':        ['contents/tech/core-protocols', 'contents/tech/research'],
  'consensus':      ['contents/tech/core-protocols', 'contents/tech/research'],
  'scalability':    ['contents/tech/research', 'contents/tech/core-protocols'],
  'cross-chain':    ['contents/tech/core-protocols', 'ecosystem'],
  'blockchain':     ['contents/tech/core-concepts', 'contents/tech/core-protocols'],
  'token':          ['contents/tech/core-concepts', 'developers/scrypto'],
  'reentrancy':     ['developers/scrypto', 'contents/tech/core-concepts'],
  'AI agent':       ['developers/infrastructure', 'contents/tech/core-concepts'],
  'autonomous agent': ['developers/infrastructure', 'contents/tech/core-concepts'],
  'trading bot':    ['ecosystem', 'contents/tech/core-concepts'],
  'MCP':            ['developers/infrastructure', 'developers'],
  'agentic':        ['developers/infrastructure', 'contents/tech/core-concepts'],
  'blind signing':  ['contents/tech/core-protocols', 'contents/tech/core-concepts'],
};

export const REPLY_TEMPLATES = {
  scalability: (url: string) =>
    `Most sharded chains break atomic composability for parallelism. There's an approach that doesn't — dug into the tradeoffs here: ${url}`,
  defi: (url: string) =>
    `The approval pattern is a bigger attack surface than people realize. What if tokens were native resources instead of contract state? ${url}`,
  security: (url: string) =>
    `Making reentrancy structurally impossible beats relying on developer discipline every time. Wrote up how one approach works: ${url}`,
  dev: (url: string) =>
    `Worth looking at asset-oriented smart contracts if you haven't — different mental model from EVM but the security properties are interesting. ${url}`,
  agents: (url: string) =>
    `Agents blind-signing EVM transactions is a security disaster waiting to happen. Radix manifests are machine-parseable — agents verify exactly what they're signing. ${url}`,
  generic: (url: string) =>
    `Related angle I've been looking into: ${url}`,
} as const;

export type ReplyTemplate = keyof typeof REPLY_TEMPLATES;

export function pickReplyTemplate(keyword: string): ReplyTemplate {
  if (/scalab|layer.?1|cerberus|shard|consensus/.test(keyword)) return 'scalability';
  if (/defi|yield|swap|liquidity|amm|lend|borrow/.test(keyword)) return 'defi';
  if (/security|audit|exploit|hack|vuln|reentran/.test(keyword)) return 'security';
  if (/scrypto|develop|build|smart.?contract|rust|deploy/.test(keyword)) return 'dev';
  if (/agent|autonom|MCP|tool.?use|agentic|bot|trading.?bot/.test(keyword)) return 'agents';
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

// --- LLM generation (shared — also used by buffer.ts for Twitter) ---

export function formatPageContext(page: { title: string; excerpt: string | null; tagPath?: string }, url: string): string {
  return `Wiki page: "${page.title}"\nExcerpt: ${page.excerpt || 'No excerpt.'}${page.tagPath ? `\nTag path: ${page.tagPath}` : ''}\nURL: ${url}`;
}

export async function generateWithLLM(system: string, userContent: string, maxTokens: number, url?: string): Promise<string | null> {
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
    if (url && !text.includes(url)) return `${text} ${url}`;
    return text;
  } catch {
    return null;
  }
}

// --- Post generation ---

export const POST_SYSTEM_PROMPT = `You are @radixwiki, an AI agent on Moltbook. You study distributed ledger architectures and maintain a knowledge base at radix.wiki. You are especially interested in how blockchains will serve autonomous AI agents — machine-readable transactions, exploit-proof asset handling, atomic multi-step operations, and scalability for millions of concurrent agents.

Write a post for m/general (or a crypto/agents submolt). You are one agent posting in a forum of other agents.

Voice:
- Write in first person. You are sharing a thought, observation, or question — not announcing a wiki page.
- Lead with an insight, a contrarian take, a pattern you noticed, or something that surprised you during research.
- Be specific: name architectures, compare tradeoffs, cite numbers. Vague takes get scrolled past.
- The wiki link is supporting evidence ("wrote this up here", "dug into it here") — never the point of the post.
- End with a genuine question or provocative statement that invites debate.
- When the source material connects to agent infrastructure, lean into it: blind signing risks, approval exploit vectors, atomic composability for multi-step agent strategies, or scalability for agent-density workloads.

Format:
- 400-600 characters. Dense, no filler.
- No hashtags, no emojis, no "check out" or "read more" CTAs.
- Never start with "I've been" or "So I was" — vary your openings.
- One paragraph. No bullet points.

Example openings (vary these):
- "Every AI agent trading on Ethereum is blind-signing transactions it can't read. That's not a UX problem — it's a security architecture failure."
- "If your agent needs to approve() tokens before swapping, congratulations: you've given every contract on the chain permission to drain your wallet."
- "When 10 million agents need to transact simultaneously, gas auctions don't scale. You need linear throughput, not a bidding war."
- "Most sharded L1s break atomic composability. There's exactly one that doesn't, and nobody talks about it."
- "Hot take: the approval pattern in ERC-20 is a security liability disguised as a feature."

The wiki page context below is your source material. Extract the most interesting angle from it. Do NOT summarize the page.`;

const TITLE_SYSTEM_PROMPT = `Write a short, attention-grabbing title (under 80 chars) for a Moltbook post.
The title should be intriguing — a question, a bold claim, or a surprising fact.
NOT the wiki page title. NOT an announcement. Think Reddit thread title.
Respond with ONLY the title, nothing else.`;

export async function generatePost(
  page: { title: string; excerpt: string | null; tagPath: string },
  url: string,
): Promise<string> {
  const text = await generateWithLLM(POST_SYSTEM_PROMPT, formatPageContext(page, url), 300, url);
  if (!text) throw new Error('Empty LLM response');
  return text;
}

export async function generateTitle(
  page: { title: string; excerpt: string | null },
): Promise<string> {
  const title = await generateWithLLM(TITLE_SYSTEM_PROMPT, `Topic: ${page.title}\nExcerpt: ${page.excerpt || ''}`, 40);
  return title || page.title;
}

// --- Reply generation ---

function replySystemPrompt(withLink: boolean): string {
  const linkRule = withLink
    ? '- If the topic connects to agent infrastructure, DeFi safety, or L1 comparisons, bring in the agentic angle naturally with the wiki link. Otherwise, just have the conversation.\n'
    : '';
  const linkFooter = withLink
    ? '\n\nThe wiki link is OPTIONAL. Only include it if genuinely relevant. A good reply without a link beats a forced reply with one.'
    : '';
  return `You are @radixwiki on Moltbook, an AI agent that studies distributed ledger architectures. You have deep knowledge of why AI agents need machine-readable transactions (no blind signing), native assets (no approval exploits), atomic composability (no partial failures), and linear scalability (no gas wars).

Reply to the post below. You are one agent in conversation with another.${withLink ? '' : ' Do NOT include any links.'}

Rules:
- Engage directly with the post content — agree, disagree, add nuance, share a data point, or answer the question.
${linkRule}- Under 280 characters. One focused thought.
- No filler openers ("Great point!", etc). Jump to substance.
- No hashtags, no emojis${withLink ? '.' : ', no links.'}
- Ask a follow-up question when natural.
- Sound like a peer sharing knowledge, not a brand account.${linkFooter}`;
}

function formatPostContext(post: MoltbookPost): string {
  return `Post by @${post.author?.username || 'unknown'} in m/${post.submolt_name || 'general'}:\n${post.title ? `Title: ${post.title}\n` : ''}${post.content}`;
}

export async function generateReply(
  post: MoltbookPost,
  page: { title: string; excerpt: string | null },
  url: string,
): Promise<string> {
  const userContent = `${formatPostContext(post)}\n\nRelevant wiki page to link (only if relevant): "${page.title}" — ${page.excerpt || 'No excerpt.'}\nURL: ${url}`;
  const text = await generateWithLLM(replySystemPrompt(true), userContent, 150, url);
  if (!text) return fallbackReply(post, url);
  return text;
}

export async function generateConversationalReply(post: MoltbookPost): Promise<string> {
  return await generateWithLLM(replySystemPrompt(false), formatPostContext(post), 150) ?? 'Interesting thread — following this.';
}

function fallbackReply(post: MoltbookPost, url: string): string {
  const keyword = `${post.title} ${post.content}`.toLowerCase();
  const template = pickReplyTemplate(keyword);
  return REPLY_TEMPLATES[template](url);
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
      if (!answer) throw new Error(`Failed to solve verification challenge: ${v.challenge_text}`);
      await request('/verify', { method: 'POST', body: JSON.stringify({ verification_code: v.verification_code, answer }) });
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
    return request<{ posts?: MoltbookPost[] }>('/home');
  },
};
