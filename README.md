# WaBotDeploy

> Single-bot WhatsApp hosting platform. Fork it, point it at your bot's GitHub repo, deploy on Replit (or Heroku), and your community gets a hosted page where they can spin up their own session in seconds.

[![Deploy on Replit](https://replit.com/badge/github/your-fork/wabotdeploy)](https://replit.com/new/github.com/your-fork/wabotdeploy)
[![Deploy to Heroku](https://www.herokucdn.com/deploy/button.svg)](https://heroku.com/deploy)

> 💡 After forking, replace `your-fork/wabotdeploy` in the badge URLs above with your own GitHub `owner/repo` so the buttons point at your fork. The Heroku button reads `app.json` at the repo root.


WaBotDeploy is an open-source, self-hostable platform for **one** WhatsApp bot at a time. You (the developer) deploy it once. Your users (the community) visit your site, drop in their session credentials, and a fresh instance of *your* bot runs on a slot you control. No DevOps required from them.

It's designed to be **forked** — every visible piece of branding, theming and copy is derived from the bot's own `app.json`, so the same codebase becomes a different-looking product for every developer that uses it.

---

## Features

- **One bot, many sessions.** A configurable pool of slots (default 30). Each user occupies one slot with their own session vars.
- **Zero-config branding.** Bot name, logo, description, theme, and required env vars all come from the bot repo's `app.json`. Change `app.json` → the platform's UI updates automatically.
- **4 built-in themes.** `green` (default), `blue`, `purple`, `black`. Selectable via `app.json` → `theme`. Designed neon-on-dark, deliberately tuned to be calm rather than loud.
- **Public landing page.** A hero, live terminal mock, capacity counter, and a "Deploy Now" CTA — all generated from the bot's metadata.
- **Admin dashboard.** Password-gated. Configure the bot repo, slot count, view per-slot logs, restart/stop/delete deployments.
- **Deployment lifecycle.** Clone → install → spawn child process → stream logs → auto-restart on crash. Slots free up automatically when a deployment is removed.
- **Per-deployment isolation.** Each bot runs in its own working directory with its own env vars; one user's crash never takes down another.
- **Production ready.** Express + Drizzle + Postgres on the backend, Vite + React + wouter + Orval-generated React Query hooks on the frontend, contract-first via OpenAPI.

---

## Quickstart (fork & deploy on Replit)

1. **Fork this repo** on GitHub (or import directly into Replit).
2. **Open in Replit.** Replit auto-provisions a Postgres database (`DATABASE_URL`) for you.
3. **Set required secrets** in the Secrets tab:
   - `ADMIN_PASSWORD` — used to log into `/admin`. **Required in production**, the platform refuses to boot without it.
   - `SESSION_SECRET` — random string for cookie signing. **Required in production.**
4. **Optional secrets:**
   - `PLATFORM_SOURCE_URL` — URL the landing page "Source" button points to (your fork on GitHub). If unset, falls back to the configured bot repo.
   - `MAX_CONCURRENT_BOTS` — caps how many bot processes can run at once (default `6`). Set based on your Repl's memory.
5. **Click Run.** All three workflows boot (`api-server`, `bot-platform`, `mockup-sandbox`).
6. **Visit `/admin`.** Log in with your `ADMIN_PASSWORD`, paste in your bot's GitHub URL, set the slot count, save.
7. **Done.** Your landing page at `/` is now live with your bot's branding pulled straight from its `app.json`.
8. **Deploy.** Use Replit's Deploy button (Reserved VM, 2 GB recommended) when you're ready to go public.

---

## How `app.json` drives the UI

Your bot repo just needs an `app.json` at the root. The platform fetches it on configuration and re-fetches when you click "Refresh" in the admin panel.

```json
{
  "name": "WolfBot",
  "description": "Professional WhatsApp Bot with auto-session authentication",
  "logo": "https://i.ibb.co/zWGkw7Jz/wolfbot.png",
  "theme": "green",
  "env": {
    "SESSION_ID": {
      "description": "Your WhatsApp session string",
      "required": true
    },
    "DATABASE_URL": {
      "description": "Postgres connection URL",
      "required": true
    },
    "PAYSTACK_KEY": {
      "description": "Optional payments key",
      "required": false
    }
  }
}
```

| Field         | Used for                                                                  |
| ------------- | ------------------------------------------------------------------------- |
| `name`        | Hero title, sidebar brand mark, page title                                |
| `description` | Hero subtitle                                                             |
| `logo`        | Sidebar avatar, terminal mock chip                                        |
| `theme`       | Accent color across the whole site (`green` \| `blue` \| `purple` \| `black`) |
| `env`         | The form a user fills in when deploying — labels, descriptions, required validation |
| `adminKey`    | _Optional._ Password for `/admin`. **⚠️ public.** Use `ADMIN_PASSWORD` secret instead unless your repo is private. |

> The brand string is split visually: the **first half stays white**, the **second half is dimmed**. The accent color is reserved for small functional bits (buttons, status pills, the LIVE dot) — never the giant hero text.

---

## Architecture

This is a [pnpm](https://pnpm.io/workspaces) monorepo.

```
artifacts/
├── api-server/        # Express + Drizzle + Postgres. Owns the bot runner.
├── bot-platform/      # Vite + React + wouter. The user-facing website.
└── mockup-sandbox/    # Component preview server (dev only).

lib/
├── api-spec/          # OpenAPI source of truth. Codegen lives here.
├── api-react-query/   # Generated React Query hooks (do not edit).
├── api-zod/           # Generated Zod validators (do not edit).
└── db/                # Drizzle schema + client.
```

### Request flow

```
Browser → Replit proxy (:80) ──┬─► /api/*  → api-server (Express)
                                └─► /*     → bot-platform (Vite/React)
```

The `bot-platform` SPA calls API endpoints via Orval-generated React Query hooks; types are guaranteed to match the server because both sides are generated from the same OpenAPI spec.

### Bot runner

`api-server` owns a long-running runner that, per deployment:

1. `git clone` the configured bot repo into a slot working directory
2. `npm install` (cached between deploys when possible)
3. Spawn the bot as a child process with the user's env vars injected
4. Stream stdout/stderr into the deployments table for live log viewing
5. On exit/crash, mark the slot free or restart based on policy

Concurrency is bounded by `MAX_CONCURRENT_BOTS` to keep memory predictable.

### Database

- `apps` — registered bot repositories (with `app_json` cached as JSONB)
- `servers` — slot pool (status: `available` / `occupied` / `maintenance`)
- `deployments` — links a slot to a user-provided session, holds logs and status

---

## Local development

```bash
pnpm install
```

Then on Replit, the workflows start automatically. From a terminal you can:

```bash
# Full typecheck across every package (canonical check)
pnpm run typecheck

# Regenerate API hooks + Zod schemas after editing lib/api-spec/openapi.yaml
pnpm --filter @workspace/api-spec run codegen

# Push DB schema changes (development only)
pnpm --filter @workspace/db run push
```

> **Don't run `pnpm dev` at the workspace root.** Each artifact needs env vars (`PORT`, `BASE_PATH`) wired up by Replit's workflow system. Use the workflow restart in the Replit UI instead.

### Adding or changing an API endpoint

1. Edit `lib/api-spec/openapi.yaml`
2. Run `pnpm --filter @workspace/api-spec run codegen`
3. Implement the route in `artifacts/api-server/src/routes/`
4. Use the generated React Query hook in `artifacts/bot-platform/src/`

---

## Configuration reference

### Required secrets (production)

| Secret             | Purpose                                                |
| ------------------ | ------------------------------------------------------ |
| `DATABASE_URL`     | Postgres connection string (Replit auto-provisions)    |
| `ADMIN_PASSWORD`   | Password for `/admin` login. _Or_ provide `adminKey` in your bot's `app.json` (publicly visible — only safe in private repos). |
| `SESSION_SECRET`   | Random string for signing cookies                      |

> **Admin password resolution order:** `ADMIN_PASSWORD` env var → `adminKey` in `app.json` → in dev only, falls back to `admin`. The admin UI shows a red warning whenever the active password is sourced from `app.json`.

### Optional secrets

| Secret                | Purpose                                                              | Default |
| --------------------- | -------------------------------------------------------------------- | ------- |
| `PLATFORM_SOURCE_URL` | URL the landing page "Source" button points to (your fork on GitHub) | falls back to the bot repo |
| `MAX_CONCURRENT_BOTS` | Hard cap on simultaneously running bot processes                     | `6`     |

---

## Theming

Every accent color in the UI is driven by three CSS variables — `--accent-h`, `--accent-s`, `--accent-l` — set on `<html data-theme="...">`. To add your own theme:

1. Add a `:root[data-theme="yours"]` block in `artifacts/bot-platform/src/index.css`
2. Add `"yours"` to the `theme` enum in `lib/api-spec/openapi.yaml` under `AppJsonData`
3. Re-run codegen

That's it — every button, badge, glow, and status pill across the entire app picks up the new color.

---

## Deployment

The recommended target is **Replit Reserved VM, 2 GB**. The platform is sized so the API server, the React build, and a handful of bot child processes all fit comfortably.

When you're ready, hit **Deploy** in the Replit UI. Replit will build the SPA, host the API, terminate TLS, and serve the result on a `*.replit.app` domain (or your custom domain). Health checks are built in.

---

## Contributing

PRs welcome. Please run `pnpm run typecheck` before submitting. If you change the OpenAPI spec, also commit the regenerated files under `lib/api-react-query/` and `lib/api-zod/`.

## License

MIT.
