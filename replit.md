# Workspace

## Overview

pnpm workspace monorepo using TypeScript. This is **WaBotDeploy** — an open-source Heroku-like platform for hosting WhatsApp bots. Users register GitHub repositories, the platform reads their `app.json` to auto-generate config forms, and bots get deployed instantly onto a shared pool of 25 server slots.

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

- GitHub repo registry: add any public GitHub repo with an `app.json`
- Auto-parses `app.json` to extract env var requirements
- 25 server slots pool (visible grid UI)
- 4-step deploy wizard: pick app → fill config form → choose slot → deploy
- Deployment management: view logs, restart, stop, delete
- Dashboard with real-time stats

## Database Schema

- `apps` — registered GitHub bot repositories (stores `app_json` as JSONB)
- `servers` — 25 server slots with status (available/occupied/maintenance)
- `deployments` — bot deployments linking apps to server slots

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
