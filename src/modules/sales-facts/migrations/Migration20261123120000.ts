import { Migration } from "@medusajs/framework/mikro-orm/migrations"

/*
 * Per-day data versions for the report cache. Every fact refresh stamps the
 * days it rebuilt with the new global data_version (analytics_fact_state), so
 * a report's cache key only changes when a day inside its window changed:
 * today's orders no longer throw away every cached report about last month.
 *
 * Plain SQL like the rollups (one row per store-local day, YYYY-MM-DD like
 * the facts' local_day). Emptied with the facts when a rebuild starts.
 */
export class Migration20261123120000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`create table if not exists "analytics_day_version" (
      "local_day" text not null,
      "version" bigint not null,
      constraint "analytics_day_version_pkey" primary key ("local_day")
    );`)
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "analytics_day_version";`)
  }
}
