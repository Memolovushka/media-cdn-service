# Billing setup

## Current model

Billing is user-level. Workspace count limits and one shared account storage
quota are applied from the user plan, not from a workspace subscription.

Code-backed limits:

- Free: 1 workspace, 1 GB shared account storage.
- Pro: 5 workspaces, 25 GB shared account storage total.
- Team: 20 workspaces, 100 GB shared account storage total.

Money prices live in Polar products. The app only stores product IDs and applies
the matching plan limits after Polar webhook events.

## Production status

Production uses `wrangler.jsonc` through GitHub Actions. Billing is inactive
until the Worker has all required `POLAR_*` values.

Check current production state:

```powershell
Invoke-RestMethod -Uri "https://media-cdn-service.gabolov3.workers.dev/api/setup/status" | ConvertTo-Json -Depth 6
```

Expected billing-ready fields:

- `billing.polarAccessToken=true`
- `billing.polarProducts=true`
- `billing.polarCheckout=true`
- `billing.polarWebhook=true`
- `billing.ready=true`

## Required Polar values

- `POLAR_ACCESS_TOKEN`: Polar API access token.
- `POLAR_PRODUCT_PRO_ID`: Polar product ID for Pro.
- `POLAR_PRODUCT_TEAM_ID`: Polar product ID for Team.
- `POLAR_WEBHOOK_SECRET`: webhook signing secret from Polar.
- `POLAR_SERVER`: `production` for live billing, `sandbox` for test billing.

Webhook endpoint:

```text
https://media-cdn-service.gabolov3.workers.dev/api/auth/polar/webhooks
```

## PowerShell activation

Run from repo root:

```powershell
bunx wrangler secret put POLAR_ACCESS_TOKEN --config wrangler.jsonc
bunx wrangler secret put POLAR_PRODUCT_PRO_ID --config wrangler.jsonc
bunx wrangler secret put POLAR_PRODUCT_TEAM_ID --config wrangler.jsonc
bunx wrangler secret put POLAR_WEBHOOK_SECRET --config wrangler.jsonc
bunx wrangler secret put POLAR_SERVER --config wrangler.jsonc
```

Then redeploy:

```powershell
git push origin main
```

or manually:

```powershell
bunx wrangler deploy --config wrangler.jsonc
```

After deploy, re-check `/api/setup/status`.

## Flow

1. User opens Account settings.
2. App exposes Pro/Team checkout only when `POLAR_ACCESS_TOKEN` and product IDs
   are configured.
3. Polar sends subscription events to `/api/auth/polar/webhooks`.
4. Webhook updates `user_billing`.
5. `getBillingPlan()` applies the workspace count limit and shared account
   storage limit.

Without `POLAR_WEBHOOK_SECRET`, checkout may open, but paid plans will not sync
back into the app reliably.
