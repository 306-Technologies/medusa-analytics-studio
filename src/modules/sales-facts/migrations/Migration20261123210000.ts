import { Migration } from "@medusajs/framework/mikro-orm/migrations"

import {
  dropReportingView,
  reportingView,
} from "../../../shared/analytics/reporting-view"

/*
 * Returns and refunds as their own events, counted on the day they happen
 * rather than on the original order's day (closed periods stay closed).
 *
 * - analytics_event_fact: one row per received return and per refund, with
 *   the order's dimensions copied on. Plain SQL like the rollups: rebuilt
 *   from Medusa's tables by the fact refresh, never written by hand.
 *   kind 'return': amount = value of the units received back (before tax,
 *   after their share of the discount), units = those units.
 *   kind 'refund': amount = money paid back, units = 0.
 * - returns, returned_units, refunds on the sales rollups.
 * - reporting.sales_daily gets the same event dating (dropped first: new
 *   columns in the middle can't be added by "create or replace").
 *
 * The refresh queue loses include_customer_orders: a refresh now decides the
 * customers' first orders again itself, so a cancel never queues the
 * customer's other orders.
 *
 * Saved reports asking for `returns` are renamed to `refunds` by the
 * analytics-workspace migration of this release.
 *
 * Empty to start: this release raises FACTS_FORMAT, so the backfill rebuilds
 * every fact and rollup.
 */
export class Migration20261123210000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`create table if not exists "analytics_event_fact" (
      "id" text not null,
      "kind" text not null check ("kind" in ('return', 'refund')),
      "order_id" text not null,
      "currency_code" text not null,
      "occurred_at" timestamptz not null,
      "local_day" text not null,
      "local_hour" smallint not null,
      "customer_id" text null,
      "sales_channel" text not null,
      "country" text not null,
      "city" text not null,
      "is_new" boolean not null,
      "amount" numeric not null,
      "units" numeric not null,
      constraint "analytics_event_fact_pkey" primary key ("id")
    );`)
    this.addSql(
      `create index if not exists "IDX_analytics_event_fact_order_id" on "analytics_event_fact" ("order_id");`
    )
    this.addSql(
      `create index if not exists "IDX_analytics_event_fact_currency_day" on "analytics_event_fact" ("currency_code", "local_day");`
    )
    this.addSql(
      `create index if not exists "IDX_analytics_event_fact_local_day" on "analytics_event_fact" ("local_day");`
    )

    this.addSql(
      `alter table "analytics_fact_queue" drop column if exists "include_customer_orders";`
    )

    for (const table of ["analytics_sales_daily", "analytics_sales_hourly"]) {
      this.addSql(`alter table "${table}"
        add column if not exists "returns" numeric not null default 0,
        add column if not exists "returned_units" numeric not null default 0,
        add column if not exists "refunds" numeric not null default 0;`)
    }

    this.addSql(dropReportingView("sales_daily"))
    this.addSql(
      reportingView({
        name: "sales_daily",
        comment: "Sales per store day, currency, sales channel and country",
        sql: `
          select local_day::date as day,
                 currency_code as currency,
                 sales_channel,
                 country,
                 count(*) filter (where is_order) as orders,
                 count(*) filter (where is_order and is_new) as new_customer_orders,
                 sum(units) as units,
                 sum(returned_units) as returned_units,
                 sum(gross) as gross_sales,
                 sum(discounts) as discounts,
                 sum(returns) as returns,
                 sum(refunds) as refunds,
                 sum(shipping) as shipping,
                 sum(tax) as tax,
                 sum(total) as total_sales
          from (
            select local_day, currency_code, sales_channel, country, is_new,
                   true as is_order, units, 0 as returned_units, gross,
                   discounts, 0 as returns, 0 as refunds, shipping, tax, total
            from analytics_order_fact
            where deleted_at is null
            union all
            select local_day, currency_code, sales_channel, country, is_new,
                   false, 0,
                   case when kind = 'return' then units else 0 end, 0, 0,
                   case when kind = 'return' then amount else 0 end,
                   case when kind = 'refund' then amount else 0 end, 0, 0, 0
            from analytics_event_fact
          ) facts
          group by 1, 2, 3, 4`,
        columns: {
          day: "Day in the store's timezone (returns and refunds: the day they happened)",
          currency: "Currency code; amounts are in this currency, never mixed",
          sales_channel: "Sales channel name",
          country: "Shipping country code",
          orders: "Orders placed (not drafts or canceled)",
          new_customer_orders: "Orders from first-time customers",
          units: "Units ordered",
          returned_units: "Units received back",
          gross_sales: "Before discounts, returns, shipping and tax",
          discounts: "Discounts, before tax",
          returns: "Value of goods received back, before tax, after discounts",
          refunds: "Money paid back to customers",
          shipping: "Shipping charged, before tax",
          tax: "Tax on items and shipping",
          total_sales: "What the customer paid, before refunds",
        },
      })
    )
  }

  override async down(): Promise<void> {
    this.addSql(dropReportingView("sales_daily"))
    this.addSql(
      reportingView({
        name: "sales_daily",
        comment: "Sales per store day, currency, sales channel and country",
        sql: `
          select local_day::date as day,
                 currency_code as currency,
                 sales_channel,
                 country,
                 count(*) as orders,
                 count(*) filter (where is_new) as new_customer_orders,
                 sum(units) as units,
                 sum(gross) as gross_sales,
                 sum(discounts) as discounts,
                 sum(refunded) as refunds,
                 sum(shipping) as shipping,
                 sum(tax) as tax,
                 sum(total) as total_sales
          from analytics_order_fact
          where deleted_at is null
          group by 1, 2, 3, 4`,
      })
    )
    for (const table of ["analytics_sales_hourly", "analytics_sales_daily"]) {
      this.addSql(`alter table "${table}"
        drop column if exists "refunds",
        drop column if exists "returned_units",
        drop column if exists "returns";`)
    }
    this.addSql(`drop table if exists "analytics_event_fact";`)
    this.addSql(
      `alter table "analytics_fact_queue" add column if not exists "include_customer_orders" boolean not null default false;`
    )
    // Saved reports keep `refunds`: it is the old meaning of `returns`.
  }
}
