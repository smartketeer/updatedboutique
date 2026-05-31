# Deployment Guide — Inventory / Stock Management Separation

## What this deployment does

- Inventory becomes a read-only catalog snapshot UI
- Stock movements are created and reviewed in the Stock Management module
- Stock movement records are stored in `stock_logs` with added columns for branch/user/reference/meta
- Admin routes for stock operations are moved under `/api/stock-management/*`

## Pre-deploy checklist

- Backup database
- Confirm queue/worker status if inventory import is used
- Confirm admin login works

## Deploy steps

1. Deploy application code
2. Run migrations
   - `php artisan migrate`
3. Clear caches (if used in your environment)
   - `php artisan config:clear`
   - `php artisan route:clear`
   - `php artisan cache:clear`
4. Build frontend assets (if applicable)
   - `npm ci`
   - `npm run build`

## Post-deploy validation

1. Admin → Inventory
   - Confirms read-only snapshot view
2. Admin → Stock Management
   - Create a Stock In entry (+1) and confirm Inventory reflects it
3. POS Sale
   - Complete a sale and confirm Stock Management → Sales shows the record

## Rollback plan

### Option A — Code rollback only (fastest)

Use if the migration must remain but you need to revert UI/API changes quickly.

1. Roll back application code to the previous release
2. Rebuild assets (if applicable)
3. Validate admin pages load

Note: With code rollback only, the database will still contain the new columns in `stock_logs`.

### Option B — Full rollback (code + migration)

Use if you must fully revert schema changes.

1. Roll back application code to the previous release
2. Roll back the latest migration batch
   - `php artisan migrate:rollback`
3. Validate:
   - Inventory functions as before
   - POS still completes sales

Important:
- If new stock movement entries were created after deployment, rolling back the migration will remove the new columns. Plan and communicate downtime for a clean rollback if needed.

