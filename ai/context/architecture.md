# Architecture

## Shape

```text
 Medusa events (order.*, payment.refunded)
        │ subscribers
        ▼
 queue-sales-facts-refresh ──> queue ──> sales-facts-drain job (every minute)
                                             │ refresh-sales-facts workflow
                                             ▼
                              salesFacts module: order and line facts, daily rollups
                                             │
 Admin (/app/analytics) ─> /admin/analytics/* ─> analyticsReader (own read-only pool) ─> reports, live view
                                             └─> analyticsSql (restricted role, optional) ─> SQL mode
                           analyticsWorkspace: saved reports and dashboards per admin user
```

- One plugin, four modules, each registered separately by the host app so it gets its own options (see README "Install").
- `salesFacts` (`src/modules/sales-facts`): fact tables plus their state, FX rates (`fx/`, Frankfurter by default). Jobs: `sales-facts-backfill` (every 5 min until done), `sales-facts-drain` (every minute), `sales-facts-reconcile` (daily), `sales-facts-fx-rates` (hourly). `jobsEnabled: false` turns them off on an instance.
- `analyticsReader` (`src/modules/analytics-reader`): parses the query language (`src/shared/analytics/query-language.ts`), plans and runs reports (`engine/`), and the live view. Runs on its own connection, optionally a read replica.
- `analyticsSql` (`src/modules/analytics-sql`): SQL mode, off by default. Uses a `reporting_reader` Postgres role limited to listed views.
- `analyticsWorkspace` (`src/modules/analytics-workspace`): `analytics_report` and `analytics_dashboard`. `readOnly` makes the admin keep them in the browser instead.

## Data flow rules

- Writes (saved reports, dashboards, facts): route or job -> workflow -> steps (with compensation) -> module service.
- Reports read facts (`analytics_order_fact`, `analytics_line_fact`, `analytics_sales_daily`, `analytics_product_daily`), never `order` tables at request time. The one exception is the live view's cart counts, which read `cart` through a partial index.
- Every report query is read-only, parameterised and time-limited. See README "Safety"; those layers are the product's main promise.
- Side effects run from subscribers or jobs, never inline in an admin request.
- Jobs that must run on one instance at a time take the Postgres advisory locks in `src/shared/analytics/lock-keys.ts`.
