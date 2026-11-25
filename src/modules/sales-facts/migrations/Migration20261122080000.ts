import { Migration } from "@medusajs/framework/mikro-orm/migrations"

import {
  dropReportingView,
  reportingView,
} from "../../../shared/analytics/reporting-view"

/*
 * Reporting view: sales per store day, currency, sales channel and country,
 * for SQL mode. Totals only: no order, customer or city detail.
 * Hand-written (db:generate never creates views). See "Reporting views" in
 * docs/conventions/backend.md.
 */
export class Migration20261122080000 extends Migration {
  override async up(): Promise<void> {
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
        columns: {
          day: "Day in the store's timezone",
          currency: "Currency code; amounts are in this currency, never mixed",
          orders: "Orders placed (not drafts or canceled)",
          new_customer_orders: "Orders from first-time customers",
          gross_sales: "Before discounts, refunds, shipping and tax",
          total_sales: "What the customer paid",
        },
      })
    )
  }

  override async down(): Promise<void> {
    this.addSql(dropReportingView("sales_daily"))
  }
}
