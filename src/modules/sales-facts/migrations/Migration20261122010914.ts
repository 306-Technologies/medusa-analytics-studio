import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261122010914 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table if not exists "analytics_fact_state" ("id" text not null, "timezone" text not null, "data_version" integer not null default 0, "backfilled_at" timestamptz null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "analytics_fact_state_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_analytics_fact_state_deleted_at" ON "analytics_fact_state" ("deleted_at") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "analytics_fact_state" cascade;`);
  }

}
