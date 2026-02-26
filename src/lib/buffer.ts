// src/lib/buffer.ts — Tweet generation helpers for Twitter automation via RSS

import Anthropic from '@anthropic-ai/sdk';

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
  if (!process.env.ANTHROPIC_API_KEY) return fallbackTweet(page, url);
  try {
    const anthropic = new Anthropic();
    const msg = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 100,
      system: TWEET_SYSTEM_PROMPT,
      messages: [{
        role: 'user',
        content: `Wiki page: "${page.title}"\nExcerpt: ${page.excerpt || 'No excerpt.'}\nTag path: ${page.tagPath}\nURL: ${url}`,
      }],
    });
    const text = msg.content[0]?.type === 'text' ? msg.content[0].text.trim() : '';
    if (!text) return fallbackTweet(page, url);
    return text.includes(url) ? text : `${text} ${url}`;
  } catch {
    return fallbackTweet(page, url);
  }
}

function fallbackTweet(
  page: { title: string; excerpt: string | null },
  url: string,
): string {
  return `${page.title}: ${page.excerpt || 'Read more on the Radix wiki.'} ${url}`;
}
