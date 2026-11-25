import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261122012257 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "analytics_order_fact" drop constraint if exists "analytics_order_fact_order_id_unique";`);
    this.addSql(`alter table if exists "analytics_line_fact" drop constraint if exists "analytics_line_fact_order_id_item_id_unique";`);
    this.addSql(`create table if not exists "analytics_line_fact" ("id" text not null, "order_id" text not null, "item_id" text not null, "currency_code" text not null, "order_created_at" timestamptz not null, "local_day" text not null, "local_hour" integer not null, "product_id" text null, "variant_id" text null, "product_title" text null, "variant_title" text null, "quantity" integer not null, "gross" numeric not null, "raw_gross" jsonb not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "analytics_line_fact_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_analytics_line_fact_deleted_at" ON "analytics_line_fact" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_analytics_line_fact_order_id_item_id_unique" ON "analytics_line_fact" ("order_id", "item_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_analytics_line_fact_currency_code_order_created_at" ON "analytics_line_fact" ("currency_code", "order_created_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_analytics_line_fact_local_day" ON "analytics_line_fact" ("local_day") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "analytics_order_fact" ("id" text not null, "order_id" text not null, "order_version" integer not null, "currency_code" text not null, "order_created_at" timestamptz not null, "local_day" text not null, "local_hour" integer not null, "customer_id" text null, "sales_channel_id" text null, "sales_channel" text not null, "country" text not null, "city" text not null, "is_new" boolean not null, "gross" numeric not null, "discounts" numeric not null, "refunded" numeric not null, "shipping" numeric not null, "tax" numeric not null, "total" numeric not null, "units" integer not null, "raw_gross" jsonb not null, "raw_discounts" jsonb not null, "raw_refunded" jsonb not null, "raw_shipping" jsonb not null, "raw_tax" jsonb not null, "raw_total" jsonb not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "analytics_order_fact_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_analytics_order_fact_deleted_at" ON "analytics_order_fact" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_analytics_order_fact_order_id_unique" ON "analytics_order_fact" ("order_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_analytics_order_fact_currency_code_order_created_at" ON "analytics_order_fact" ("currency_code", "order_created_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_analytics_order_fact_currency_code_local_day" ON "analytics_order_fact" ("currency_code", "local_day") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_analytics_order_fact_local_day" ON "analytics_order_fact" ("local_day") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_analytics_order_fact_customer_id_order_created_at" ON "analytics_order_fact" ("customer_id", "order_created_at") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "analytics_line_fact" cascade;`);

    this.addSql(`drop table if exists "analytics_order_fact" cascade;`);
  }

}
