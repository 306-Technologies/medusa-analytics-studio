import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261121223519 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "analytics_dashboard" drop constraint if exists "analytics_dashboard_user_unique";`);
    this.addSql(`create table if not exists "analytics_dashboard" ("id" text not null, "user_id" text not null, "layout" jsonb not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "analytics_dashboard_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_analytics_dashboard_deleted_at" ON "analytics_dashboard" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_analytics_dashboard_user_unique" ON "analytics_dashboard" ("user_id") WHERE deleted_at is null;`);

    this.addSql(`create table if not exists "analytics_report" ("id" text not null, "user_id" text not null, "name" text not null, "description" text not null default '', "query" text not null, "visualization" text not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "analytics_report_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_analytics_report_user_id" ON "analytics_report" ("user_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_analytics_report_deleted_at" ON "analytics_report" ("deleted_at") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "analytics_dashboard" cascade;`);

    this.addSql(`drop table if exists "analytics_report" cascade;`);
  }

}
