# Deployment Guide

This guide covers deploying the Motorsport Countdown application to Cloudflare.

## Prerequisites

1. **Cloudflare Account**: Sign up at [cloudflare.com](https://cloudflare.com)
2. **Node.js 22**: Install via [nvm](https://github.com/nvm-sh/nvm) or download from [nodejs.org](https://nodejs.org)
3. **Wrangler CLI**: Installed via `npm install` (included in dependencies)

## One-Time Setup

### 1. Install Dependencies

```bash
# Install worker dependencies
cd worker
npm install

# Install web dependencies
cd ../web
npm install
```

### 2. Authenticate with Cloudflare

```bash
cd worker
npx wrangler login
```

This opens a browser window to authorize Wrangler with your Cloudflare account.

### 3. Create D1 Database

```bash
cd worker
npx wrangler d1 create countdown-db
```

**Important**: Copy the `database_id` from the output and update `worker/wrangler.jsonc`:

```jsonc
"d1_databases": [
  {
    "binding": "COUNTDOWN_D1",
    "database_name": "countdown-db",
    "database_id": "YOUR_DATABASE_UUID_HERE"  // Replace this
  }
]
```

### 4. Run Database Migrations

```bash
cd worker

# Apply to production database
npx wrangler d1 execute countdown-db --file=migrations/0001_initial_schema.sql --remote

# For local development
npx wrangler d1 execute countdown-db --file=migrations/0001_initial_schema.sql --local
```

### 5. Configure GitHub Secrets (for CI/CD)

Add these secrets to your GitHub repository (Settings → Secrets → Actions):

- `CLOUDFLARE_API_TOKEN`: Create at [dash.cloudflare.com/profile/api-tokens](https://dash.cloudflare.com/profile/api-tokens)
  - Template: "Edit Cloudflare Workers"
  - Permissions: Account.Cloudflare Pages (Edit), Account.Cloudflare Workers (Edit)

- `CLOUDFLARE_ACCOUNT_ID`: Find at [dash.cloudflare.com](https://dash.cloudflare.com) → Workers & Pages → Overview (right sidebar)

## Manual Deployment

### Deploy Worker (API + Durable Objects)

```bash
cd worker
npm run deploy
```

This deploys:
- Cloudflare Worker with REST API endpoints
- Durable Object (CountdownGroupDurableObject)
- D1 database binding

### Deploy Pages (React Frontend)

```bash
cd web
npm run deploy
```

This:
1. Builds the React app with Vite
2. Deploys to Cloudflare Pages

**First deployment**: You'll be prompted to create a new Pages project. Answer:
- Project name: `countdown-web`
- Production branch: `main`

## Automated Deployment (GitHub Actions)

Once GitHub secrets are configured, deployments happen automatically:

1. **Push to main branch**: Triggers full deployment of both worker and pages
2. **Manual trigger**: Go to Actions tab → Deploy to Cloudflare → Run workflow

The workflow (`.github/workflows/deploy.yml`) will:
- Install dependencies
- Build the web frontend
- Deploy the worker
- Deploy the Pages site

## Local Development

### Worker Development

```bash
cd worker
npm run dev
```

Access at: `http://localhost:8787`

### Frontend Development

```bash
cd web
npm run dev
```

Access at: `http://localhost:5173`

**Note**: Update `web/src/config.ts` (when created) to point to your local worker:
```typescript
export const API_URL = 'http://localhost:8787'
```

## Environment Configuration

### Production URLs

After deployment, your URLs will be:
- **Worker API**: `https://countdown-worker.<your-subdomain>.workers.dev`
- **Frontend**: `https://countdown-web.pages.dev`

### Custom Domains (Optional)

1. Go to Cloudflare dashboard
2. Workers & Pages → countdown-web → Custom domains
3. Add your domain (must be in your Cloudflare account)

## Deployment Checklist

Before deploying to production:

- [ ] D1 database created and ID updated in `wrangler.jsonc`
- [ ] Database migrations applied with `--remote` flag
- [ ] GitHub secrets configured (if using CI/CD)
- [ ] Environment variables set (if needed)
- [ ] Worker deployed successfully
- [ ] Pages deployed successfully
- [ ] API endpoints tested (use `curl` or Postman)
- [ ] Frontend can communicate with Worker API

## Troubleshooting

### Worker deployment fails

**Error**: "No D1 databases found with binding COUNTDOWN_D1"
- Ensure you've created the D1 database and updated `database_id` in `wrangler.jsonc`

**Error**: "Migration failed"
- Check that your Durable Object class name matches exactly in `wrangler.jsonc` and your code

### Pages deployment fails

**Error**: "Build failed"
- Run `npm run build` locally to see detailed errors
- Check that all dependencies are installed

### Database issues

**Error**: "Table doesn't exist"
- Run migrations: `npx wrangler d1 execute countdown-db --file=migrations/0001_initial_schema.sql --remote`

## Rollback

If a deployment causes issues:

### Worker Rollback
```bash
cd worker
npx wrangler rollback
```

### Pages Rollback
1. Go to Cloudflare dashboard → Workers & Pages → countdown-web
2. Click on "View builds"
3. Find the previous working deployment
4. Click "Rollback to this deployment"

## Monitoring

- **Worker logs**: `npx wrangler tail` (in worker directory)
- **Analytics**: Cloudflare dashboard → Workers & Pages → countdown-worker → Analytics
- **Error tracking**: Observability is enabled in `wrangler.jsonc`

## Next Steps

After successful deployment:
1. Test all API endpoints
2. Configure custom domains
3. Set up monitoring alerts
4. Add authentication (see project roadmap)
5. Configure CORS for your domain
