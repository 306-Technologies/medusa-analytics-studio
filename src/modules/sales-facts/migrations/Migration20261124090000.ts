import { Migration } from "@medusajs/framework/mikro-orm/migrations";

/*
 * A rebuild in progress beside the live tables (src/modules/sales-facts/
 * fact-set.ts): the timezone and facts format it is being built in, and when
 * it finished, so the swap can be retried on its own if it has to wait for a
 * lock. Null when no rebuild is running.
 */
export class Migration20261124090000 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "analytics_fact_state" add column if not exists "pending_timezone" text null, add column if not exists "pending_format" integer null, add column if not exists "pending_built_at" timestamptz null;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop schema if exists analytics_next cascade;`);
    this.addSql(`alter table if exists "analytics_fact_state" drop column if exists "pending_timezone", drop column if exists "pending_format", drop column if exists "pending_built_at";`);
  }

}
