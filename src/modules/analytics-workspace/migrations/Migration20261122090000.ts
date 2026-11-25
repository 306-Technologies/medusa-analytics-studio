import { Migration } from "@medusajs/framework/mikro-orm/migrations"

/*
 * Indexes analytics needs on Medusa's own order and cart tables. Medusa does
 * not ship them because its own screens never read orders by date range.
 *
 * - order(created_at): every report filters orders by date.
 * - order(customer_id, created_at): "is this the customer's first order?"
 * - cart(updated_at) for open carts: the live view's "active carts".
 *
 * Plain CREATE INDEX, which blocks writes to the table while it builds. That
 * is a moment on a small store but can be minutes on millions of orders.
 * CONCURRENTLY is not an option here: Medusa's migration runner keeps its own
 * transactions open while migrations run, and CONCURRENTLY waits for every
 * open transaction to finish, so it waits forever.
 *
 * On a large database, build them first without blocking checkout:
 *   psql "$DATABASE_URL" -f scripts/analytics/create-indexes-concurrently.sql
 * This migration then finds them already there and does nothing.
 *
 * Our own names, so they never clash with an index Medusa adds later.
 */
type Executable = { execute: (sql: string) => Promise<unknown[]> }

// On an empty database this runs before Medusa's own tables exist; the analytics-core-indexes migration script adds the index later.
const tableExists = async (migration: Executable, table: string) => {
  const [row] = await migration.execute(
    `select to_regclass('public."${table}"') is not null as present`
  )
  return (
    typeof row === "object" &&
    row !== null &&
    "present" in row &&
    row.present === true
  )
}

export class Migration20261122090000 extends Migration {
  override async up(): Promise<void> {
    if (await tableExists(this, "order")) {
      this.addSql(
        `create index if not exists "IDX_analytics_order_created_at" on "order" ("created_at") where "deleted_at" is null;`
      )
      this.addSql(
        `create index if not exists "IDX_analytics_order_customer_created_at" on "order" ("customer_id", "created_at") where "deleted_at" is null;`
      )
    }
    if (await tableExists(this, "cart")) {
      this.addSql(
        `create index if not exists "IDX_analytics_cart_open_updated_at" on "cart" ("updated_at") where "completed_at" is null and "deleted_at" is null;`
      )
    }
  }

  override async down(): Promise<void> {
    this.addSql(`drop index if exists "IDX_analytics_cart_open_updated_at";`)
    this.addSql(
      `drop index if exists "IDX_analytics_order_customer_created_at";`
    )
    this.addSql(`drop index if exists "IDX_analytics_order_created_at";`)
  }
}
