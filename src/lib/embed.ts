// src/lib/embed.ts — the hosts a page may frame.
//
// One list, read by the sanitiser and the editor's embed nodes, so a frame that
// survives cleaning is also drawn on the canvas, and a save from the canvas
// keeps it. `frame-src` in next.config.ts is `https:` broad, so this list is
// the only thing deciding which hosts a page can frame.

export const EMBED_HOSTS = [
  'www.youtube.com', 'www.youtube-nocookie.com', 'platform.twitter.com',
  'www.google.com', 'maps.google.com', 'embed.apple.com', 'docs.google.com',
  'radixrolodex.com', 'quack.space',
  // Only in older revisions, kept so a restore still renders.
  'embed.notion.co', 'replit.com', 'tutmoses.github.io', 'widgets.sociablekit.com',
];
