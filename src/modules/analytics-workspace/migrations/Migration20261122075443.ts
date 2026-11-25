import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261122075443 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "analytics_report" add column if not exists "kind" text check ("kind" in ('query', 'sql')) not null default 'query', add column if not exists "chart" jsonb null;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "analytics_report" drop column if exists "kind", drop column if exists "chart";`);
  }

}
