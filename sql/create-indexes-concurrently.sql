-- Analytics indexes, built without blocking writes.
--
-- For large databases (hundreds of thousands of orders or more), run this
-- BEFORE deploying migration Migration20261122090000 (analytics-workspace
-- module), from a plain psql session, outside any transaction:
--
--   psql "$DATABASE_URL" -f node_modules/@306technologies/medusa-analytics-studio/sql/create-indexes-concurrently.sql
--
-- The migration then finds the indexes already there and does nothing.
-- Each build can take minutes; orders and carts keep being written meanwhile.
--
-- Names and definitions must match the migration exactly.
--
-- If a build is interrupted, Postgres leaves an INVALID index that IF NOT
-- EXISTS would skip. Find them with:
--   select indexrelid::regclass from pg_index where not indisvalid;
-- then DROP INDEX CONCURRENTLY that index and run this file again.

\set ON_ERROR_STOP on

create index concurrently if not exists "IDX_analytics_order_created_at"
  on "order" ("created_at") where "deleted_at" is null;

create index concurrently if not exists "IDX_analytics_order_customer_created_at"
  on "order" ("customer_id", "created_at") where "deleted_at" is null;

create index concurrently if not exists "IDX_analytics_cart_open_updated_at"
  on "cart" ("updated_at") where "completed_at" is null and "deleted_at" is null;

select c.relname as index_name, i.indisvalid as valid
from pg_index i
join pg_class c on c.oid = i.indexrelid
where c.relname in (
  'IDX_analytics_order_created_at',
  'IDX_analytics_order_customer_created_at',
  'IDX_analytics_cart_open_updated_at'
);
