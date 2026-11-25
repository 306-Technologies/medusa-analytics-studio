import { Migration } from "@medusajs/framework/mikro-orm/migrations"

/*
 * Product and variant rollups keyed by id instead of title, so two products
 * with the same title stay apart and a renamed product stays one row. The
 * titles stay as the names Medusa had at order time; reports show the
 * product's current title (_engine/plan.ts, product_label).
 *
 * The tables are recreated empty: this release raises FACTS_FORMAT, so the
 * backfill rebuilds every rollup anyway. product_id and variant_id are ''
 * for lines without one (custom items), so they can be part of the key.
 */
export class Migration20261123200000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`drop table if exists "analytics_product_daily";`)
    this.addSql(`create table "analytics_product_daily" (
      "local_day" date not null,
      "currency_code" text not null,
      "product_id" text not null,
      "product_title" text not null,
      "orders" integer not null,
      "gross" numeric not null,
      "units" numeric not null,
      constraint "analytics_product_daily_pkey" primary key ("currency_code", "local_day", "product_id")
    );`)
    this.addSql(
      `create index if not exists "IDX_analytics_product_daily_local_day" on "analytics_product_daily" ("local_day");`
    )

    this.addSql(`drop table if exists "analytics_variant_daily";`)
    this.addSql(`create table "analytics_variant_daily" (
      "local_day" date not null,
      "currency_code" text not null,
      "product_id" text not null,
      "variant_id" text not null,
      "product_title" text not null,
      "variant_title" text not null,
      "orders" integer not null,
      "gross" numeric not null,
      "units" numeric not null,
      constraint "analytics_variant_daily_pkey" primary key ("currency_code", "local_day", "product_id", "variant_id")
    );`)
    this.addSql(
      `create index if not exists "IDX_analytics_variant_daily_local_day" on "analytics_variant_daily" ("local_day");`
    )
  }

  override async down(): Promise<void> {
    // Back to the title-keyed tables of Migration20261122011500, empty; the
    // facts rebuild refills them.
    this.addSql(`drop table if exists "analytics_variant_daily";`)
    this.addSql(`drop table if exists "analytics_product_daily";`)
    this.addSql(`create table "analytics_product_daily" (
      "local_day" date not null,
      "currency_code" text not null,
      "product_title" text not null,
      "orders" integer not null,
      "gross" numeric not null,
      "units" numeric not null,
      constraint "analytics_product_daily_pkey" primary key ("currency_code", "local_day", "product_title")
    );`)
    this.addSql(`create table "analytics_variant_daily" (
      "local_day" date not null,
      "currency_code" text not null,
      "product_title" text not null,
      "variant_title" text not null,
      "orders" integer not null,
      "gross" numeric not null,
      "units" numeric not null,
      constraint "analytics_variant_daily_pkey" primary key ("currency_code", "local_day", "product_title", "variant_title")
    );`)
  }
}
