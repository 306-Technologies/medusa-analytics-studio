import { Migration } from "@medusajs/framework/mikro-orm/migrations"

/*
 * The refresh queue: orders whose facts need rebuilding. Order and refund
 * subscribers add a row and return; the sales-facts-drain job refreshes the
 * queued orders in batches. That way a subscriber never waits on the facts
 * lock while holding one of the connections checkout needs.
 *
 * Plain SQL like the rollups: one row per order (the order id is the key),
 * so a model's id, timestamps and soft delete would never be used.
 *
 * - include_customer_orders: also refresh the customer's other orders (set by
 *   a cancel, which can move their first order). Merged with OR on re-queue.
 * - version: goes up when an order is queued again. The drain only removes
 *   the rows it read, at the version it read, so a change that arrives while
 *   a batch is refreshing stays queued for the next batch.
 * - queued_at: when the order was first queued. Not moved on re-queue, so the
 *   oldest change is drained first and the queue's lag can be measured.
 */
export class Migration20261123090000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`create table if not exists "analytics_fact_queue" (
      "order_id" text not null,
      "include_customer_orders" boolean not null default false,
      "version" integer not null default 1,
      "queued_at" timestamptz not null default now(),
      constraint "analytics_fact_queue_pkey" primary key ("order_id")
    );`)
    this.addSql(
      `create index if not exists "IDX_analytics_fact_queue_queued_at" on "analytics_fact_queue" ("queued_at");`
    )
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "analytics_fact_queue";`)
  }
}
