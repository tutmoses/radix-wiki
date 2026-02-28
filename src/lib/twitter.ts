// src/lib/twitter.ts — Tweet generation helpers for Twitter automation via RSS

import { generateWithLLM, formatPageContext } from '@/lib/moltbook';

const TWEET_SYSTEM_PROMPT = `You are @RadixWiki, a knowledgeable Twitter account for the Radix DLT ecosystem wiki. Write a tweet about the wiki page below.

Rules:
- Factual, link-heavy — drive readers to the wiki page
- Knowledgeable but approachable ("helpful librarian" tone)
- Under 240 characters (leave room for the URL to be appended)
- No emojis, no "NEW:" or "BREAKING:" openers
- Vary format: sometimes a question, sometimes a fact, sometimes a hook
- End naturally — the URL will be appended after your text`;

export async function generateTweet(
  page: { title: string; excerpt: string | null; tagPath: string },
  url: string,
): Promise<string> {
  return await generateWithLLM(TWEET_SYSTEM_PROMPT, formatPageContext(page, url), 100, url)
    ?? `${page.title}: ${page.excerpt || 'Read more on the Radix wiki.'} ${url}`;
}
