# RADIX Wiki

A production-ready wiki application with exclusive Radix wallet authentication using ROLA (Radix Off-Ledger Authentication).

## Features

- **Radix Wallet Authentication**: Secure login using Radix DApp Toolkit and ROLA verification
- **Rich Text Editing**: TipTap-powered editor with support for headings, lists, tables, code blocks, images, and more
- **Wiki Management**: Create, edit, delete, and organize wiki pages with tagging and hierarchical structure
- **Revision History**: Track changes to wiki pages over time
- **Responsive Design**: Mobile-first design with minimal, extensible design system
- **Dark/Light Themes**: Automatic theme detection with manual toggle

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript 5.6
- **Database**: Supabase PostgreSQL
- **ORM**: Prisma 7.2.0 (ESM-first with driver adapters)
- **Editor**: TipTap 3.x with extensions
- **Styling**: Tailwind CSS 3.4 with custom design system
- **Authentication**: Radix DApp Toolkit 2.2.0 + ROLA 1.0.4
- **State Management**: Zustand

## Prerequisites

- Node.js 18+
- npm or yarn
- Supabase account
- Radix wallet (e.g., Radix Dashboard on Stokenet)

## Getting Started

### 1. Clone and Install

```bash
cd radix-wiki
npm install
```

### 2. Configure Environment

Copy the example environment file and fill in your values:

```bash
cp .env.example .env
```

Required environment variables:

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | Supabase PostgreSQL connection string |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key |
| `JWT_SECRET` | Secret for signing JWT sessions (min 32 chars) |
| `NEXT_PUBLIC_RADIX_NETWORK` | Radix network (`stokenet` or `mainnet`) |
| `NEXT_PUBLIC_RADIX_DAPP_DEFINITION` | Your Radix DApp definition address |
| `NEXT_PUBLIC_RADIX_GATEWAY_URL` | Radix Gateway API URL |

### 3. Setup Database

Push the schema to your database:

```bash
npm run db:push
```

Generate the Prisma client:

```bash
npm run db:generate
```

### 4. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
radix-wiki/
├── prisma/
│   └── schema.prisma         # Database schema
├── src/
│   ├── app/                  # Next.js App Router pages
│   │   ├── api/              # API routes
│   │   │   ├── auth/         # Authentication endpoints
│   │   │   ├── challenge/    # ROLA challenge generation
│   │   │   └── wiki/         # Wiki CRUD endpoints
│   │   ├── wiki/             # Wiki pages
│   │   └── page.tsx          # Home page
│   ├── components/
│   │   ├── editor/           # TipTap editor components
│   │   ├── layout/           # Header, Sidebar
│   │   └── ui/               # Reusable UI components
│   ├── hooks/                # React hooks (auth, wiki stores)
│   ├── lib/                  # Utilities and configurations
│   │   ├── prisma/           # Prisma client
│   │   ├── radix/            # ROLA, session management
│   │   └── supabase/         # Supabase client
│   ├── styles/               # Global CSS and design system
│   └── types/                # TypeScript definitions
├── .env.example              # Environment template
├── package.json
├── tailwind.config.ts
└── tsconfig.json
```

## Authentication Flow

1. User clicks "Connect Wallet" to open Radix wallet connection
2. After connecting, user signs in with selected persona
3. Backend generates a cryptographic challenge
4. User's wallet signs the challenge
5. Backend verifies signature via ROLA:
   - Fetches entity owner keys from Radix Gateway API
   - Verifies public key matches
   - Verifies signature using Web Crypto API
6. On success, creates user record and JWT session
7. Session stored in httpOnly cookie (7 day expiration)

## Design System

The design system uses CSS custom properties for easy theming:

### Colors
- `--surface-0/1/2/3`: Background layers
- `--border`: Border color
- `--text/text-muted`: Text colors
- `--accent/accent-hover`: Brand colors

### Typography
- `.heading-1/2/3`: Heading styles
- `.body-lg/body/body-sm`: Body text
- `.caption`: Small text

### Layout Utilities
- `.stack`: Vertical flex container
- `.row`: Horizontal flex container
- `.center`: Centered flex container
- `.spread`: Space-between flex container
- `.gap-xs/sm/md/lg/xl`: Gap utilities

### Component Classes
- `.surface`: Background surface
- `.btn`: Button styles
- `.input`: Input field styles
- `.card`: Card container
- `.badge`: Badge/tag styles

## API Routes

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/challenge` | Generate ROLA challenge |
| POST | `/api/auth/verify` | Verify signed challenge |
| GET | `/api/auth/session` | Get current session |
| POST | `/api/auth/logout` | End session |
| GET | `/api/wiki` | List wiki pages |
| POST | `/api/wiki` | Create wiki page |
| GET | `/api/wiki/[slug]` | Get page by slug |
| PUT | `/api/wiki/[slug]` | Update page |
| DELETE | `/api/wiki/[slug]` | Delete page |

## Security Features

- ROLA verification with Gateway API validation
- JWT sessions with httpOnly cookies
- Challenge expiration (5 minutes)
- Session expiration (7 days)
- SameSite cookie protection
- Authorization checks on all write operations
- Input validation and sanitization

## Scripts

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint
npm run db:generate  # Generate Prisma client
npm run db:push      # Push schema to database
npm run db:studio    # Open Prisma Studio
```

## Customization

### Theming

Edit CSS custom properties in `src/styles/globals.css` to customize colors, typography, and spacing.

### Editor Extensions

Add TipTap extensions in `src/components/editor/WikiEditor.tsx`. Available extensions include:
- StarterKit (bold, italic, headings, lists)
- CodeBlockLowlight (syntax highlighting)
- Table (tables with row/column operations)
- TaskList (checkboxes)
- Link, Image

## License

MIT
