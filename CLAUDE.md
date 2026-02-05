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
- Author-only restrictions (community, community/rfps, contents/blog)

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

Design system defined in `globals.css`:
- Dark mode default (`surface-0: #393e50`)
- Accent color: coral/pink (`#ff9da0`)
- Utility classes: `.center`, `.row`, `.stack-sm`, `.surface-interactive`

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

## Important Notes

- No test framework currently configured
- Images stored on Vercel Blob (remote patterns configured in next.config)
- Prisma connection pooling set to max: 1 for serverless
- Security headers configured in next.config.ts