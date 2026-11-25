import { Migration } from "@medusajs/framework/mikro-orm/migrations";

/*
 * How the stored facts were computed (FACTS_FORMAT in
 * src/shared/analytics/facts-format.ts). Existing rows get 1, so the first
 * backfill run after this release rebuilds every fact with Medusa's own
 * totals (format 2) while reports read Medusa's order tables.
 */
export class Migration20261123184118 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "analytics_fact_state" add column if not exists "facts_format" integer not null default 1;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "analytics_fact_state" drop column if exists "facts_format";`);
  }

}
