import { Migration } from "@medusajs/framework/mikro-orm/migrations"

/*
 * The analytics rollup tables: fact rows summed per day or hour. Plain SQL
 * rather than models, because a rollup row is identified by several columns
 * together (currency, day, channel, ...), and a model would add an id,
 * timestamps and soft-delete columns that a "delete the day, sum it again"
 * table never uses. The fact tables they are built from are models (models/).
 *
 * Changing a rollup table means a new hand-written migration here, plus the
 * matching SQL in service.ts (rollupSql). No model may use these table names:
 * its generated "create table if not exists" would silently do nothing.
 *
 * local_day and local_hour are in the store's reporting timezone (see
 * analytics_fact_state.timezone). Every table can be emptied and rebuilt from
 * the fact tables, so nothing here is the source of truth.
 */
export class Migration20261122011500 extends Migration {
  override async up(): Promise<void> {
    // Per day, by the dimensions most reports split by.
    this.addSql(`create table if not exists "analytics_sales_daily" (
      "local_day" date not null,
      "currency_code" text not null,
      "sales_channel" text not null,
      "country" text not null,
      "customer_type" text not null,
      "orders" integer not null,
      "gross" numeric not null,
      "discounts" numeric not null,
      "refunded" numeric not null,
      "shipping" numeric not null,
      "tax" numeric not null,
      "total" numeric not null,
      "units" numeric not null,
      "new_customers" integer not null,
      constraint "analytics_sales_daily_pkey" primary key ("currency_code", "local_day", "sales_channel", "country", "customer_type")
    );`)
    this.addSql(
      `create index if not exists "IDX_analytics_sales_daily_local_day" on "analytics_sales_daily" ("local_day");`
    )

    // Per hour, no other split: hour of day, today, yesterday.
    this.addSql(`create table if not exists "analytics_sales_hourly" (
      "local_day" date not null,
      "local_hour" smallint not null,
      "currency_code" text not null,
      "orders" integer not null,
      "gross" numeric not null,
      "discounts" numeric not null,
      "refunded" numeric not null,
      "shipping" numeric not null,
      "tax" numeric not null,
      "total" numeric not null,
      "units" numeric not null,
      "new_customers" integer not null,
      constraint "analytics_sales_hourly_pkey" primary key ("currency_code", "local_day", "local_hour")
    );`)
    this.addSql(
      `create index if not exists "IDX_analytics_sales_hourly_local_day" on "analytics_sales_hourly" ("local_day");`
    )

    // Per day and product. "orders" counts orders containing the product.
    this.addSql(`create table if not exists "analytics_product_daily" (
      "local_day" date not null,
      "currency_code" text not null,
      "product_title" text not null,
      "orders" integer not null,
      "gross" numeric not null,
      "units" numeric not null,
      constraint "analytics_product_daily_pkey" primary key ("currency_code", "local_day", "product_title")
    );`)
    this.addSql(
      `create index if not exists "IDX_analytics_product_daily_local_day" on "analytics_product_daily" ("local_day");`
    )

    // Per day and variant. Separate from products: an order with two variants
    // of one product counts once per product, so the two can't share a table.
    this.addSql(`create table if not exists "analytics_variant_daily" (
      "local_day" date not null,
      "currency_code" text not null,
      "product_title" text not null,
      "variant_title" text not null,
      "orders" integer not null,
      "gross" numeric not null,
      "units" numeric not null,
      constraint "analytics_variant_daily_pkey" primary key ("currency_code", "local_day", "product_title", "variant_title")
    );`)
    this.addSql(
      `create index if not exists "IDX_analytics_variant_daily_local_day" on "analytics_variant_daily" ("local_day");`
    )
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "analytics_variant_daily";`)
    this.addSql(`drop table if exists "analytics_product_daily";`)
    this.addSql(`drop table if exists "analytics_sales_hourly";`)
    this.addSql(`drop table if exists "analytics_sales_daily";`)
  }
}
