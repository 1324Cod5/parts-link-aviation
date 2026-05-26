# Parts Link Aviation

A professional multi-vendor aircraft parts marketplace connecting verified MROs, airlines, and brokers with qualified buyers worldwide.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm --filter @workspace/aeroparts run dev` — run the frontend (port 20655)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string, `SESSION_SECRET` — express-session secret

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React 19 + Vite + Wouter + TanStack Query + shadcn/ui
- API: Express 5 + express-session + bcrypt
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/aeroparts/` — React+Vite frontend (previewPath: `/`)
- `artifacts/api-server/` — Express API (port 8080, all routes under `/api`)
- `lib/api-spec/` — OpenAPI spec (`openapi.yaml`) — source of truth for API contract
- `lib/api-client-react/` — Generated React Query hooks + Zod schemas (do not edit manually)
- `lib/db/src/schema/index.ts` — Drizzle ORM schema — source of truth for DB
- `artifacts/aeroparts/src/App.tsx` — Router with all page routes
- `artifacts/aeroparts/src/context/AuthContext.tsx` — Auth state (user, logout)
- `artifacts/aeroparts/src/components/ui/listing-card.tsx` — Reusable listing card
- `artifacts/aeroparts/src/components/ui/badge-indicator.tsx` — Verification badge display

## Architecture decisions

- **Contract-first API**: OpenAPI spec in `lib/api-spec` is the source of truth; hooks are auto-generated via Orval. Never write API client code manually.
- **Session-based auth**: express-session with bcrypt password hashing. Sessions stored in memory (upgrade to DB-backed for production).
- **Three-tier verification badge system**: `pending_verification` → `documentation_reviewed` → `verified`. Admin-controlled via the admin portal.
- **Dark-mode-first theme**: CSS custom properties in `index.css` using dark navy (`216 60% 10%`) / silver (`0 0% 75%`) palette applied globally.
- **Shared proxy routing**: Frontend on `/`, API on `/api`. Vite uses relative URLs; no proxy config needed.

## Product

- **Buyers**: Browse/search 10+ certified aircraft parts, filter by condition/sale type/badge, contact sellers directly via inquiry form
- **Sellers**: Register, log in, manage listings (create/edit/delete), track inquiry stats via dashboard
- **Admin**: Review all listings, promote badge status (pending → docs reviewed → verified), remove fraudulent listings

## Demo Credentials

- Admin: `admin@aeroparts.com` / `password`
- Seller: `avtech@example.com` / `password`
- Other sellers: `globalair@example.com`, `euroaero@example.com`, `pacificparts@example.com` (all: `password`)

## User preferences

- Dark navy/silver/white B2B aviation aesthetic — no bright colors except badge indicators
- Professional, technical tone throughout the UI
- Monospace font for part numbers and prices

## Gotchas

- After schema changes, run `pnpm --filter @workspace/db run push` then `pnpm --filter @workspace/api-spec run codegen`
- Sessions are in-memory; server restart logs everyone out (acceptable for dev)
- The `useSearch()` hook from wouter returns the raw query string (no leading `?` in some versions — use `new URLSearchParams(searchStr)`)

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
