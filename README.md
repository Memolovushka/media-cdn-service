# Media CDN Service

Media CDN Service is a Next.js + Cloudflare Workers app for storing private media assets and publishing selected files to stable, versioned CDN URLs.

The product is currently focused on a professional dashboard/file-manager workflow: upload, organize, preview, publish, copy CDN URLs, and inspect workspace activity.

## Features

- Email/password auth and Google OAuth through Better Auth.
- Workspace onboarding and workspace membership boundaries.
- App-mediated uploads to Cloudflare R2 with quota checks.
- Virtual folders, folder-scoped uploads, drag-and-drop uploads, drag-move, grid/list views, and OS-like selection.
- Private preview/download routes for ready assets.
- CDN publishing with versioned public keys, immutable cache headers, and copyable public URLs.
- Preview-first asset details panel with CDN lifecycle state and optional embed snippets.
- Recent workspace activity feed backed by audit events.
- File-manager polish: command palette, keyboard shortcuts, context menus, undo for file delete, upload queue/retry tray, quota meter, smart empty states, interactive breadcrumbs, and file type markers.

## Stack

- Bun + Turborepo
- Next.js App Router in `apps/web`
- Cloudflare Workers via OpenNext
- Cloudflare R2 for objects
- Cloudflare D1 + Drizzle ORM for metadata
- Better Auth for auth
- shadcn/ui, Tailwind CSS, and Ultracite/Biome

## Local Setup

```powershell
bun install
cp .env.example .env.local
bun run dev
```

The web app runs through portless at `https://web.localhost:8443`.

For plain Next.js dev without portless:

```powershell
cd apps/web
bun run dev:app
```

## Useful Commands

| Command | Description |
| --- | --- |
| `bun run check` | Run Ultracite/Biome checks |
| `bun run typecheck` | Run TypeScript checks |
| `bun run cf:build` | Build the Cloudflare Worker |
| `bun run cf:deploy` | Deploy with OpenNext/Wrangler |
| `bun run dev` | Start local development |

## Deploy

Production deploys are done through GitHub Actions on pushes to `main`.

The workflow:

1. Installs dependencies with Bun.
2. Builds the Cloudflare Worker.
3. Applies remote D1 migrations.
4. Deploys with Wrangler.

After deploy, verify production health:

```powershell
Invoke-RestMethod -Uri https://media-cdn-service.gabolov3.workers.dev/api/setup/status | ConvertTo-Json -Depth 6
```

Healthy production should report `ok=true`, `bindings.DB=true`, `bindings.MEDIA_BUCKET=true`, and `database.ready=true`.

## Project Docs

- `docs/PROJECT_PLAN.md` is the implementation/status source of truth.
- `docs/UI_UX_RECOMMENDATIONS.md` tracks the dashboard/file-manager UX plan.
- `docs/DESIGN_POLISH_PLAN.md` contains design direction and polish notes.

## Notes

- Local Windows OpenNext/Wrangler builds can be flaky around generated artifacts. Prefer GitHub Actions as the final deploy gate.
- SVG is not currently CDN-publishable until the safety policy is implemented.
- API tokens, malware scanning, cleanup jobs, and broader hardening are still tracked in `docs/PROJECT_PLAN.md`.
