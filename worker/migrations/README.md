# D1 Database Migrations

This directory contains SQL migration files for the Cloudflare D1 database.

## Running Migrations

### First-time setup (after creating the database)

```bash
# Create the D1 database (once per environment)
wrangler d1 create countdown-db

# Copy the database_id from the output and update worker/wrangler.jsonc

# Apply the initial schema
wrangler d1 execute countdown-db --file=migrations/0001_initial_schema.sql --remote
```

### For local development

```bash
# Apply to local database
wrangler d1 execute countdown-db --file=migrations/0001_initial_schema.sql --local
```

## Migration Naming Convention

Migrations follow the pattern: `XXXX_description.sql`
- `XXXX`: Four-digit sequence number (0001, 0002, etc.)
- `description`: Brief description using snake_case

## Adding New Migrations

1. Create a new file with the next sequence number
2. Include a comment header with description and date
3. Test locally first with `--local` flag
4. Apply to remote with `--remote` flag
5. Commit the migration file to version control

## Important Notes

- Migrations are **not** automatically applied by Wrangler
- You must manually run each migration using `wrangler d1 execute`
- Keep migrations idempotent using `IF NOT EXISTS` clauses where possible
- Never modify existing migration files after they've been applied to production
