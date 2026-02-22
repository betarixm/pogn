# 포근

## What it does

- **Map-based feed** — Posts are anchored to real coordinates and rendered on an interactive map with marker clustering. Scroll the map, discover the community.
- **Layers** — Structured channels that organize discussions by topic, space, or interest group. Subscribe to what matters to you.
- **Threaded posts** — Replies nest under their parent post, keeping context intact without turning into a mess.
- **Hearts** — A lightweight reaction model. No clutter, no algorithmic manipulation.
- **Attachments** — Files are stored by object key with SHA-256 integrity checks. Binary data never touches the relational database.
- **Visibility controls** — Posts can be `public` or `members`-only. Privacy is a first-class constraint, not an afterthought.

## Stack

| Layer | Technology |
| --- | --- |
| Framework | Next.js 16 (App Router) |
| UI | React 19, Tailwind CSS v4, Motion |
| Map | Leaflet + react-leaflet + MarkerCluster |
| Database | Cloudflare D1 (SQLite at the edge) |
| ORM | Drizzle ORM with branded ID types |
| Auth | Better Auth |
| Runtime | Bun |
| Deployment | Cloudflare Workers via OpenNext |

## Architecture

pogn runs entirely on Cloudflare's infrastructure. There are no origin servers to manage, no cold starts to worry about, and no per-region deployments to coordinate. A single `bun run deploy` ships the full application globally.

The database layer uses Drizzle ORM with strictly typed, branded identifiers — `UserId`, `PostId`, `LayerId`, `AttachmentId` — so type errors catch ID mix-ups at compile time, not at runtime.

```text
app/                   # Next.js App Router pages & API routes
database/
  schema.ts            # All tables defined with Drizzle sqlite-core
  types.ts             # Branded ID types + constructors
  client.ts            # D1 runtime client factory
  migrations/          # Incremental, append-only migration history
tests/
  database/            # In-memory SQLite unit tests (bun:test)
```

## Getting started

**Prerequisites:** [Bun](https://bun.sh), a [Cloudflare account](https://dash.cloudflare.com), and Wrangler CLI.

```bash
# Install dependencies
bun install

# Run local dev server
bun run dev

# Apply database migrations locally
bun run db:migrate:local

# Preview with Cloudflare Workers runtime
bun run preview
```

Open [http://localhost:3000](http://localhost:3000) to see the app.

## Deployment

```bash
# Deploy to Cloudflare Workers (global)
bun run deploy

# Apply migrations to production D1
bun run db:migrate:remote
```

One command. Every region. Done.

## Development principles

- **Strict TypeScript** — no implicit `any`, no shortcuts.
- **Test-first** — every feature and every bug fix ships with tests.
- **Incremental migrations** — schema history is never rewritten.
- **Security by default** — input validated at boundaries, storage private by default, client data exposure minimized.
- **No magic** — explicit over implicit, deterministic over clever.
