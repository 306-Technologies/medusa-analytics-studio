# Repo Map

## Top level

| Path                                  | What                                                          |
| ------------------------------------- | ------------------------------------------------------------- |
| `src/`                                | Plugin source, built to `.medusa/server`                      |
| `sql/create-indexes-concurrently.sql` | Optional index build for large stores, shipped in the package |
| `scripts/link-admin-css.mjs`          | Post-build step for admin CSS                                 |
| `.github/workflows/publish.yml`       | Publish to npm on GitHub release                              |
| `CHANGELOG.md`                        | Keep a Changelog, one entry per change                        |
| `ai/`, `.claude/`                     | AI context, rules, settings                                   |

## src

| Path                          | What                                                                                                                    |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `modules/sales-facts`         | Fact models (`analytics_order_fact`, `analytics_line_fact`, `analytics_fact_state`), FX rates (`fx/`)                   |
| `modules/analytics-reader`    | Report engine (`engine/`: plan, run, metrics, live), read-only connection handling (`read-only.ts`)                     |
| `modules/analytics-sql`       | SQL mode: reporting role, view listing, query runner                                                                    |
| `modules/analytics-workspace` | Saved reports and dashboards                                                                                            |
| `workflows/`                  | One folder per workflow with its own `steps/`; `shared-steps/` for reused steps; `index.ts` is the `./workflows` export |
| `api/admin/analytics/`        | Routes: `query`, `live`, `reports`, `reports/[id]`, `dashboard`, `workspace`, `sql`, `sql/status`, `sql/views`          |
| `api/middlewares.ts`          | Validation per route                                                                                                    |
| `api/projections/`            | Map records to response shapes                                                                                          |
| `schemas/analytics/`          | Zod request schemas, one file per operation                                                                             |
| `jobs/`                       | Backfill, drain, reconcile, FX rate jobs                                                                                |
| `subscribers/`                | Order and refund events that queue fact refreshes                                                                       |
| `shared/analytics/`           | Query language, types, logging, timezone, cache, lock keys                                                              |
| `migration-scripts/`          | Core indexes on `order` and `cart`                                                                                      |
| `scripts/setup-sql-role.ts`   | Prints or applies the SQL-mode role setup                                                                               |
| `admin/`                      | Admin routes (`routes/analytics-studio`), store timezone widget, chart library (`features/analytics/charts`)            |
