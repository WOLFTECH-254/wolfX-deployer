# Workspace

## Overview

pnpm workspace monorepo using TypeScript. This is **WaBotDeploy** — an open-source Heroku-like platform for hosting **a single WhatsApp bot** (chosen by the deployer). The platform itself is configured by env vars (`BOT_REPO_URL`, `SLOT_COUNT`, `ADMIN_PASSWORD`) at first boot; admins can change the bot or slot count later from the `/admin` page. End users just paste their `SESSION_ID` into a free slot — the platform enforces SESSION_ID uniqueness across active deployments to prevent WhatsApp disconnects.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Frontend**: React + Vite + Tailwind CSS + shadcn/ui

## Artifacts

- **bot-platform** (`artifacts/bot-platform`) — Main web frontend at `/`
- **api-server** (`artifacts/api-server`) — Express API at `/api`

## Features

- Single configurable bot per platform deployment, set via `BOT_REPO_URL` env or `/admin` page
- Auto-fetches the bot's `app.json` to derive env var requirements
- Configurable slot pool (default 30); admin can grow/shrink at runtime
- 3-step deploy wizard: configure env → choose slot → deploy
- SESSION_ID uniqueness enforced across active deployments (transaction +
  `pg_advisory_xact_lock`) — prevents two users from running the same
  WhatsApp session simultaneously
- Admin auth: bearer password (`ADMIN_PASSWORD` env). Defaults to `"admin"`
  in dev with a UI warning; refuses to boot in production without it
- Legacy `/apps` registry routes/pages remain functional but are not linked
  from the sidebar in the single-bot model
- Deployment management: view logs, restart, stop, delete
- Dashboard with real-time stats

## Database Schema

- `apps` — registered GitHub bot repositories (stores `app_json` as JSONB)
- `servers` — 25 server slots with status (available/occupied/maintenance)
- `deployments` — bot deployments linking apps to server slots

## Optional Env Vars

- `PLATFORM_SOURCE_URL` — URL the landing page "Source" button points to
  (the platform deployer's own fork). Falls back to the configured bot repo
  if unset.

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
