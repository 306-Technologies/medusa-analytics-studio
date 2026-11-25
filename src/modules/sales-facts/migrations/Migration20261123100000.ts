import { Migration } from "@medusajs/framework/mikro-orm/migrations"

/*
 * Failed drain attempts per queued order. A batch that fails moves to the
 * back of the queue with attempts + 1, so it can't hold up the orders behind
 * it; after a few failures its rows are dropped and the nightly reconcile
 * repairs them. See SalesFactsService.drainQueue.
 */
export class Migration20261123100000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "analytics_fact_queue" add column if not exists "attempts" integer not null default 0;`
    )
  }

  override async down(): Promise<void> {
    this.addSql(
      `alter table if exists "analytics_fact_queue" drop column if exists "attempts";`
    )
  }
}
