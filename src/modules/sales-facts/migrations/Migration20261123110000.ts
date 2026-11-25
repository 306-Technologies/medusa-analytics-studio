import { Migration } from "@medusajs/framework/mikro-orm/migrations"

/*
 * An index on Medusa's cart table for the analytics live view (cartsNow in
 * src/api/admin/analytics/_engine/live.ts): open carts by when they were last
 * touched. Without it the live view reads every cart ever made, abandoned
 * ones included, every 10 seconds.
 *
 * Partial on the live view's own conditions, so it only holds open carts and
 * stays small. Lives in this module because the cart module is Medusa's; the
 * IDX_analytics_ name keeps it apart from Medusa's own indexes.
 *
 * Built CONCURRENTLY so checkout can keep writing carts while it builds,
 * which Postgres only allows outside a transaction: hence isTransactional.
 *
 * If the build is interrupted (the process killed mid-migrate), Postgres
 * keeps an INVALID index that "if not exists" then skips. Repair: run
 * `drop index concurrently "IDX_analytics_cart_open_updated_at"` and migrate
 * again. Check with `select indisvalid from pg_index where indexrelid =
 * '"IDX_analytics_cart_open_updated_at"'::regclass`.
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

export class Migration20261123110000 extends Migration {
  override isTransactional(): boolean {
    return false
  }

  override async up(): Promise<void> {
    if (!(await tableExists(this, "cart"))) {
      return
    }
    this.addSql(
      `create index concurrently if not exists "IDX_analytics_cart_open_updated_at" on "cart" ("updated_at") where "deleted_at" is null and "completed_at" is null;`
    )
  }

  override async down(): Promise<void> {
    this.addSql(
      `drop index concurrently if exists "IDX_analytics_cart_open_updated_at";`
    )
  }
}
