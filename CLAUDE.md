# CLAUDE.md - radix-wiki

This file provides guidance for Claude Code when working with this codebase.

## Project Overview

**radix-wiki** is a Web3-enabled decentralized wiki platform for the Radix DLT ecosystem. It features blockchain authentication (ROLA), semantic versioning with block-level diffs, and hierarchical content organization.

## Guiding Principles
- Your guiding principles are parsimony and elegance.
- Keep your code DRY, succinct and always prefer native NextJS solutions over bespoke code. 
- DO NOT implement any kind of backwards compatibility.
- DO NOT narrate your progress.
- DO NOT write a summary.
- DO NOT make ANY .md files.

## Tech Stack

- **Framework**: Next.js 15 (App Router) with React 19
- **Language**: TypeScript (strict mode)
- **Styling**: Tailwind CSS 4 with custom design system
- **Database**: PostgreSQL via Prisma ORM 7.2 (Supabase)
- **Auth**: Radix wallet authentication (ROLA - Ed25519 signatures)
- **Editor**: TipTap 2.10 with custom block extensions
- **State**: Zustand 5
- **Storage**: Vercel Blob for images

## Project Structure

```
src/
├── app/                    # Next.js App Router
│   ├── api/               # API routes (auth, wiki, comments, upload)
│   └── [[...path]]/       # Dynamic catch-all for wiki pages
├── components/            # React components
│   ├── BlockEditor.tsx    # Rich text editor (TipTap)
│   ├── BlockRenderer.tsx  # Content rendering
│   ├── ui.tsx            # Shared UI (Button, Input, Card, Badge)
│   └── ...
├── lib/                   # Utilities
│   ├── api.ts            # API helpers & requireAuth middleware
│   ├── auth.ts           # Session & JWT management
│   ├── wiki.ts           # Data fetching & path parsing
│   ├── versioning.ts     # Semantic versioning & block diffs
│   ├── tags.ts           # Tag hierarchy & access control
│   ├── prisma/client.ts  # Prisma singleton
│   └── radix/            # Radix config & balance checks
├── types/                # TypeScript types
│   ├── index.ts          # Core types (AuthSession, WikiPage, etc.)
│   └── blocks.ts         # Block types (Content, Columns, Infobox)
├── hooks/index.ts        # useAuth, usePages, useStore
└── styles/globals.css    # Tailwind 4 theme
prisma/schema.prisma      # Database schema (7 models)
```

## Key Commands

```bash
npm run dev          # Start development server
npm run build        # Build (runs prisma generate first)
npm run lint         # ESLint
npm run db:generate  # Generate Prisma client
npm run db:push      # Push schema to database
npm run db:studio    # Open Prisma Studio
```

## Path Aliases

```
@/*            → ./src/*
@/components/* → ./src/components/*
@/lib/*        → ./src/lib/*
@/hooks/*      → ./src/hooks/*
@/types/*      → ./src/types/*
```

## Architecture Patterns

### Block System
Content is stored as an array of typed blocks:
- `ContentBlock` - Rich text (HTML from TipTap)
- `ColumnsBlock` - Multi-column layouts
- `InfoboxBlock` - Wikipedia-style infoboxes with tables/maps
- `RecentPagesBlock` - Dynamic page lists
- `PageListBlock` - Static page references
- `AssetPriceBlock` - Radix asset pricing

### Authentication Flow
1. Wallet connects via Radix DApp Toolkit
2. Server generates challenge (32-byte hex, 5-min expiry)
3. User signs with wallet (Ed25519)
4. Server verifies via Radix Gateway API
5. JWT session created (7-day expiry, httpOnly cookie)

### Tag Hierarchy
Pages are organized under tag paths (e.g., `contents/tech/core-concepts`). Some paths have:
- XRD balance requirements (e.g., 50k XRD for blog)
- Author-only restrictions (community, community/rfps, blog)

### Versioning
- Semantic versioning (major/minor/patch)
- Block-level change tracking (added, removed, modified, moved)
- Full revision history stored in `Revision` model

## API Routes

| Method | Path | Purpose |
|--------|------|---------|
| POST/GET/DELETE | `/api/auth` | Login/check/logout |
| GET | `/api/wiki?page=&search=&tagPath=&sort=` | List pages |
| GET/POST/DELETE | `/api/wiki/[...path]` | CRUD single page |
| GET | `/api/wiki/[...path]/history` | Revision history |
| GET/POST | `/api/comments/[pageId]` | Comments |
| POST | `/api/upload` | Image upload |

## Database Models

- **User** - Radix wallet users
- **Page** - Wiki articles (content as JSON blocks)
- **Revision** - Version history with diffs
- **Session** - JWT sessions
- **Challenge** - Auth challenges (ROLA)
- **Comment** - Threaded discussions

## Styling Conventions

All styling is centralized in `globals.css` via `@layer base` and `@layer components`. **Never use inline Tailwind utility combinations in components** — instead, define a semantic component class in `globals.css` and reference it by name.

### Rules
- **No inline Tailwind compositions**: If a pattern uses 3+ utilities together, it must be a named class in `globals.css`
- **Tailwind utilities are OK** for one-off modifiers (e.g., `className="mt-2"`, `className="text-center"`) and conditional composition via `cn()`
- **New components** → add their classes to `globals.css` under `@layer components` in the appropriate section
- **Theme tokens** live in the `@theme` block — never hardcode colors or spacing outside of it

### Theme Tokens (`@theme`)
- Dark mode default (`surface-0: #393e50`)
- Accent color: coral/pink (`#ff9da0`)
- Typography scale: `--text-h1` through `--text-small`
- Layout: `--header-height`, `--sidebar-width`, `--infobox-width`

### Component Class Catalog
Classes are organized by section in `globals.css`:

| Section | Key Classes |
|---------|-------------|
| Layout | `.stack`, `.stack-sm`, `.stack-xs`, `.row`, `.row-md`, `.spread`, `.center` |
| Surfaces | `.surface`, `.surface-interactive`, `.panel` |
| Forms | `.input`, `.input-ghost`, `.icon-btn` |
| App Shell | `.app-shell`, `.app-body`, `.app-main`, `.app-content` |
| Header | `.header`, `.header-inner`, `.header-bar`, `.logo-mark`, `.logo-text`, `.header-actions`, `.user-pill`, `.user-dot` |
| Search | `.search-panel`, `.search-results`, `.search-result`, `.search-empty` |
| Sidebar | `.sidebar`, `.sidebar-open`, `.sidebar-closed`, `.sidebar-scroll`, `.sidebar-label` |
| Nav | `.nav-item`, `.nav-item-active`, `.nav-link`, `.nav-link-active`, `.toc-btn`, `.toc-item` |
| Banner | `.banner-container`, `.banner-empty`, `.banner-overlay`, `.banner-actions`, `.banner-action-btn` |
| Page Card | `.page-card`, `.page-card-thumb`, `.page-card-body`, `.page-card-title`, `.page-card-compact` |
| Page Nav | `.page-nav`, `.page-nav-link`, `.page-nav-label`, `.page-nav-title` |
| Status | `.status-icon`, `.empty-state`, `.empty-surface` |
| Grids | `.category-grid`, `.stat-grid`, `.recent-pages-grid` |
| Stats | `.stat-card`, `.stat-value`, `.score-ring` |
| Toolbar | `.toolbar`, `.toolbar-btn`, `.toolbar-btn-active`, `.toolbar-divider` |
| Editor | `.tiptap-field`, `.edit-wrapper`, `.block-wrapper`, `.insert-btn`, `.column-editor` |
| Toggles | `.toggle-group`, `.toggle-option`, `.toggle-option-active` |
| Code Lang | `.lang-selector`, `.lang-btn`, `.lang-dropdown`, `.lang-option` |
| Metadata | `.metadata-panel`, `.metadata-grid`, `.rich-input` |
| Badges | `.badge`, `.badge-accent`, `.badge-success`, `.badge-warning`, `.badge-danger` |
| Discussion | `.comment-thread`, `.comment-action`, `.comment-delete` |
| History | `.diff-added`, `.diff-removed`, `.revision-current`, `.restore-btn` |
| Layout | `.page-with-infobox`, `.columns-layout`, `.column-view`, `.section-divider`, `.footer` |
| Loading | `.skeleton`, `.spinner`, `.loading-screen` |
| Responsive | `.hidden-mobile`, `.hidden-desktop` |

## Code Conventions

- Use `'use client'` directive for interactive components
- API error handling via `errors.*` helpers from `lib/api.ts`
- Auth middleware: `requireAuth()` wrapper
- Type-safe Prisma queries with generated types
- Memoized tag resolution for performance

## Environment Variables

Required in `.env`:
```
DATABASE_URL
BLOB_READ_WRITE_TOKEN
JWT_SECRET
NEXT_PUBLIC_RADIX_DAPP_DEFINITION_ADDRESS
NEXT_PUBLIC_RADIX_NETWORK_ID
NEXT_PUBLIC_RADIX_APPLICATION_NAME
NEXT_PUBLIC_APP_URL
```

## Creating Wiki Articles from Telegram Channels

### Workflow
1. **Connect browser** — use `tabs_context_mcp` to check Chrome connection, then navigate to `https://web.telegram.org/k/` (user must be logged in)
2. **Read channel** — navigate to the target channel, scroll through messages, take screenshots. For bulk extraction, use `javascript_tool` to scrape DOM:
   ```javascript
   // Telegram Web virtualises the DOM — only ~20-30 messages loaded at a time
   // Target the scrollable element and extract message bubbles:
   const msgs = document.querySelectorAll('.message');
   Array.from(msgs).map(m => ({
     text: m.querySelector('.text-content')?.textContent,
     name: m.querySelector('.peer-title')?.textContent,
     date: m.closest('.bubbles-group')?.querySelector('.time')?.textContent
   }));
   ```
3. **Supplement with web sources** — use `WebFetch` on linked blog posts, GitHub repos, documentation to get facts and source URLs
4. **Structure content** — plan Wikipedia-style sections (Infobox, Introduction, Background, etc.) with hyperlinked assertions
5. **Create seed script** — write `scripts/seed-<name>.mjs` following the pattern below
6. **Insert & verify** — run the script, then check the page in the browser

### Telegram Web gotchas
- DOM is virtualised: only ~20-30 messages in DOM at once, older messages are unloaded as you scroll
- Scrollable container: `document.querySelectorAll('.scrollable.scrollable-y')[1]` (index 1, not 0)
- Pinned messages: click the pinned bar at the top to read the pinned message
- Group info (members, admins): click the channel name header to open the info panel
- New/small channels may have all content accessible; large channels will need multiple scroll passes

## Seeding Wiki Pages

To create wiki pages programmatically (bypassing API auth), use a seed script in `scripts/`. See `scripts/seed-hyperscale-rs.mjs` or `scripts/seed-rac.mjs` as templates.

### Pattern
```javascript
import pg from 'pg';
import { randomUUID } from 'crypto';
import { config } from 'dotenv';
config();

const uid = () => randomUUID();
const AUTHOR_ID = 'cmk5t48vx0000005zc5se4dqz'; // Hydrate

const content = [
  { id: uid(), type: 'infobox', blocks: [{ id: uid(), type: 'content', text: '<table>...</table>' }] },
  { id: uid(), type: 'content', text: '<h2>Section</h2><p>HTML content with <a href="..." target="_blank" rel="noopener">hyperlinks</a>.</p>' },
];

const { Pool } = pg; // ESM: must destructure from default import
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
```

### Key details
- **ESM module** — use `const { Pool } = pg;` (not `pg.Pool` or `pg.default.Pool`)
- **Block IDs** — each block and nested block needs a unique UUID via `randomUUID()`
- **Block types** — `'content'` (HTML string in `text`) or `'infobox'` (contains `blocks: AtomicBlock[]`)
- **Inserts** — `pages` table (id, slug, title, content::jsonb, excerpt, tag_path, metadata, version, author_id, timestamps) + `revisions` table
- **Idempotent** — check `SELECT id FROM pages WHERE tag_path = $1 AND slug = $2` before inserting
- **Run** — `node scripts/seed-<name>.mjs`
- **Tag paths** — must match a valid path in `src/lib/tags.ts` TAG_HIERARCHY (e.g., `community`, `contents/tech/research`, `ecosystem`)
- **HTML content** — use `<a href="..." target="_blank" rel="noopener">` for external links; hyperlink assertions to their source URLs

## Batch Seeding Multiple Pages

For bulk content creation, use `scripts/seed-<category>.mjs` with a `pages` array. See `scripts/seed-core-concepts.mjs` as the canonical batch template.

### Batch pattern
```javascript
const pages = [
  {
    tagPath: 'contents/tech/core-concepts',
    slug: 'page-slug',
    title: 'Page Title',
    excerpt: 'One-sentence excerpt (≤160 chars).',
    content: [
      { id: uid(), type: 'infobox', blocks: [{ id: uid(), type: 'content', text: '<table>...</table>' }] },
      { id: uid(), type: 'content', text: '<h2>Introduction</h2><p>...</p>' },
      { id: uid(), type: 'content', text: '<h2>Section</h2><p>...</p>' },
      { id: uid(), type: 'content', text: '<h2>External Links</h2><ul><li>...</li></ul>' },
    ],
  },
  // ... more pages
];

// Loop: check existence → INSERT page + revision in transaction
for (const page of pages) {
  const existing = await client.query('SELECT id FROM pages WHERE tag_path = $1 AND slug = $2', [page.tagPath, page.slug]);
  if (existing.rows.length > 0) { skipped++; continue; }
  await client.query('BEGIN');
  // INSERT INTO pages ... + INSERT INTO revisions ...
  await client.query('COMMIT');
}
```

### Content quality standards
- **Infobox first** — every page starts with an infobox block containing a `<table>` with key-value metadata
- **Section structure** — Introduction → 2-3 body sections → External Links (all `<h2>`)
- **Hyperlinked assertions** — every factual claim links to its source (`<a href="..." target="_blank" rel="noopener">`)
- **Internal cross-links** — link to other wiki pages via relative paths (e.g., `<a href="/contents/tech/core-protocols/radix-engine" rel="noopener">`)
- **Block boundaries** — each conceptual section gets its own content block (200-800 words each)
- **No inline styles** — semantic HTML only (`<h2>`, `<h3>`, `<ul>`, `<ol>`, `<table>`, `<code>`, `<strong>`, `<em>`)
- **Excerpt** — ≤160 chars, one sentence, no markdown

## Content Overhaul Plan

### Current State (as of 2026-02-18)
Total pages: 261 across 17 tag paths.

| Tag Path | Count | Status |
|---|---|---|
| `ecosystem` | 122 | Many stubs from Notion import — need enrichment |
| `contents/tech/core-concepts` | 24 | ✅ Good (14 original + 10 new from Phase 2) |
| `contents/history` | 20 | Events seeded from Notion markdown |
| `community` | 19 | User profiles (auto-created on login) |
| `contents/tech/core-protocols` | 13 | ✅ Good (11 original + 2 new from Phase 2) |
| `blog` | 9 | Original posts |
| `contents/resources` | 7 | Guides & resources |
| `contents/tech/releases` | 6 | Network releases |
| `contents/tech/research` | 8 | ✅ Good (5 original + 3 new from Phase 2c) |
| `developers` | 4 | Quickstart tutorials |
| `developers/build` | 4 | ✅ Good (4 new from Phase 3a) |
| `developers/learn` | 3 | Learning guides |
| `contents/resources/legal` | 3 | Legal docs |
| `contents/resources/python-scripts` | 2 | Scripts |
| `forum` | 2 | RFCs |
| `meta` | 1 | About page |
| `(homepage)` | 1 | Homepage |

### Remaining Phases
Each phase = one conversation, producing a batch seed script.

| Phase | Category | Work | Est. Pages |
|---|---|---|---|
| ✅ Phase 2a | `core-concepts` + `core-protocols` | New pages | 12 done |
| ✅ Phase 2b | `contents/tech/comparisons` | Radix vs ETH/SOL/DOT/ATOM | 5 done |
| ✅ Phase 2c | `contents/tech/research` | Cerberus whitepaper, economic model, consensus evolution | 3 done |
| ✅ Phase 3a | `developers/build` | Dev environment, build/test, deploy, frontend | 4 done |
| ✅ Phase 3b | `developers/patterns` | Badge auth, vault, oracle, multi-component | 4 done |
| ✅ Phase 3c | `developers/reference` | Scrypto stdlib, SBOR, manifest ref | 3 done |
| Phase 4 | `contents/history` | Radix founding, key milestones | ~8 new |
| Phase 5 | `community` / governance | Foundation, RDX Works, programs | ~5 new/updated |
| Phase 1a-d | `ecosystem` audit | Update stubs → full articles | ~40 updated |

### Research Sources
- **Radix Docs**: https://docs.radixdlt.com/
- **Radix Blog**: https://www.radixdlt.com/blog
- **Radix Knowledge Base**: https://learn.radixdlt.com/
- **Cerberus Whitepaper**: https://arxiv.org/pdf/2008.04450
- **GitHub**: https://github.com/radixdlt
- **Telegram groups**: Radix Developer Discussion (@RadixDevelopers), Radix DLT Official, hyperscale-rs for Radix, Radix Accountability Council

## Important Notes

- No test framework currently configured
- Images stored on Vercel Blob (remote patterns configured in next.config)
- Prisma connection pooling set to max: 1 for serverless
- Security headers configured in next.config.ts