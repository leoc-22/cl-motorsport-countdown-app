# GitHub Actions Deployment Setup

This document explains how to configure the GitHub Actions CI/CD pipeline for deploying the CL Motorsport Countdown App to Cloudflare.

## Overview

The deployment pipeline automatically:
- **On Pull Requests**: Runs linting, type checking, and builds for both worker and web
- **On Push to Main**: Deploys the worker to Cloudflare Workers and the web app to Cloudflare Pages

## Prerequisites

Before the pipeline can run successfully, you need:

1. A Cloudflare account
2. Cloudflare API token with appropriate permissions
3. D1 database created and configured

## Required GitHub Secrets

Add the following secrets to your GitHub repository:

**Settings → Secrets and variables → Actions → New repository secret**

### 1. `CLOUDFLARE_API_TOKEN`

This is a Cloudflare API token with permissions to deploy Workers and Pages.

**How to create:**
1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/profile/api-tokens)
2. Click "Create Token"
3. Use the "Edit Cloudflare Workers" template, then customize:
   - **Permissions**:
     - Account - Cloudflare Pages: Edit
     - Account - D1: Edit
     - User - User Details: Read
     - Zone - Workers Scripts: Edit
     - Account - Workers R2 Storage: Edit (if using R2)
     - Account - Account Settings: Read
   - **Account Resources**: Include your specific account
   - **Zone Resources**: Include your zones (if applicable)
4. Create the token and copy it (you won't see it again!)
5. Add it to GitHub secrets as `CLOUDFLARE_API_TOKEN`

### 2. `CLOUDFLARE_ACCOUNT_ID`

Your Cloudflare Account ID.

**How to find:**
1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Select any site or go to Workers & Pages
3. Your Account ID is visible in the right sidebar or in the URL
4. Add it to GitHub secrets as `CLOUDFLARE_ACCOUNT_ID`

## One-Time Setup: D1 Database

The GitHub Actions pipeline expects a D1 database to already exist. You must create it manually once:

```bash
# Authenticate locally
wrangler login

# Create the database
wrangler d1 create countdown-db

# Note the database_id from the output
```

Update `worker/wrangler.jsonc` with the actual database ID:

```jsonc
"d1_databases": [
  {
    "binding": "COUNTDOWN_D1",
    "database_name": "countdown-db",
    "database_id": "YOUR_ACTUAL_DATABASE_ID_HERE"
  }
]
```

Commit this change to your repository.

### Initialize Database Schema

Run this once to create the tables:

```bash
cd worker

wrangler d1 execute countdown-db --remote --command "
CREATE TABLE IF NOT EXISTS groups (
  group_id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  timezone TEXT NOT NULL,
  version INTEGER NOT NULL,
  snapshot TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS events (
  event_id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  action TEXT NOT NULL,
  payload TEXT,
  occurred_at TEXT NOT NULL
);
"
```

## One-Time Setup: Cloudflare Pages Project

Create the Pages project (only needed once):

```bash
cd web
pnpm build

# This creates the project on first deploy
wrangler pages deploy dist --project-name=motorsport-countdown
```

Or create it via the Cloudflare Dashboard:
1. Go to Workers & Pages → Create application → Pages → Upload assets
2. Name it `motorsport-countdown`

## Workflow Behavior

### On Pull Requests

```
check-worker  ✓  Lints and type-checks worker code
check-web     ✓  Lints, type-checks, and builds web code
```

No deployment occurs on PRs - only validation.

### On Push to Main

```
check-worker  ✓  Validates worker
  └─→ deploy-worker  ✓  Deploys to Cloudflare Workers
        └─→ check-web  ✓  Validates web
              └─→ deploy-web  ✓  Deploys to Cloudflare Pages
```

The pipeline ensures the worker is deployed before the web app, maintaining the correct dependency order.

## Deployment URLs

After successful deployment:

- **Worker**: `https://countdown-worker.<account-id>.workers.dev`
- **Web**: `https://motorsport-countdown.pages.dev`
- **Custom Domain**: Configure in Cloudflare Pages settings

## Environment Variables

The web build automatically receives:
- `VITE_WORKER_URL`: Set to your worker URL during build

To override or add variables:
1. Edit `.github/workflows/deploy.yml`
2. Add environment variables in the "Build" step:
   ```yaml
   - name: Build
     run: pnpm build
     env:
       VITE_WORKER_URL: https://countdown-worker.${{ secrets.CLOUDFLARE_ACCOUNT_ID }}.workers.dev
       VITE_CUSTOM_VAR: value
   ```

## Monitoring Deployments

1. **GitHub Actions**: Check the Actions tab in your repository
2. **Cloudflare Dashboard**: View deployments in Workers & Pages section
3. **Cloudflare Logs**: Use `wrangler tail` locally to see live logs

## Troubleshooting

### "Unauthorized" or 403 Errors

- Verify `CLOUDFLARE_API_TOKEN` has the correct permissions
- Check token hasn't expired
- Ensure `CLOUDFLARE_ACCOUNT_ID` is correct

### "Database not found" Errors

- Verify the D1 database exists: `wrangler d1 list`
- Confirm `database_id` in `wrangler.jsonc` matches actual database ID
- Check the database binding name is `COUNTDOWN_D1`

### "Project not found" (Pages)

- Create the Pages project manually first (see One-Time Setup above)
- Ensure project name matches: `motorsport-countdown`

### Build Failures

- Check Node.js version is 22 (specified in workflow)
- Verify `pnpm-lock.yaml` is committed and up to date
- Run builds locally first: `cd web && pnpm build`

## Manual Deployment

If you need to deploy manually:

```bash
# Worker
cd worker
npm run deploy

# Web
cd web
pnpm build
wrangler pages deploy dist --project-name=motorsport-countdown
```

## Advanced Configuration

### Custom Worker Name

Edit `worker/wrangler.jsonc`:
```jsonc
{
  "name": "your-custom-worker-name",
  ...
}
```

### Branch Previews

To enable preview deployments on branches, modify the workflow:

```yaml
on:
  push:
    branches:
      - main
      - develop  # Add preview branches
```

### Production vs Staging

Create separate environments:

1. Add a staging workflow: `.github/workflows/deploy-staging.yml`
2. Use different Cloudflare projects/workers for each environment
3. Use GitHub environments to manage secrets per environment

## Security Notes

- Never commit API tokens or secrets to the repository
- API tokens should have minimal required permissions
- Regularly rotate API tokens
- Use GitHub environment protection rules for production deployments
- Review Cloudflare audit logs regularly

## Support

- [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)
- [Cloudflare Pages Docs](https://developers.cloudflare.com/pages/)
- [Wrangler CLI Docs](https://developers.cloudflare.com/workers/wrangler/)
- [GitHub Actions Docs](https://docs.github.com/en/actions)
