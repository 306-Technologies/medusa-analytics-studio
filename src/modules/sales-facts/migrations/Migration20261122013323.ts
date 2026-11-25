import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261122013323 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "analytics_fact_state" add column if not exists "backfill_cursor_created_at" timestamptz null, add column if not exists "backfill_cursor_order_id" text null;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "analytics_fact_state" drop column if exists "backfill_cursor_created_at", drop column if exists "backfill_cursor_order_id";`);
  }

}
