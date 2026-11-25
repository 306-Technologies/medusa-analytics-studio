import { Migration } from "@medusajs/framework/mikro-orm/migrations";

/*
 * analytics_fact_state is one row: the facts' timezone, format and backfill
 * place. The service only ever inserts one fixed id, but nothing stopped a
 * second row (a generated create method, a manual insert), and readers take
 * the oldest. Extra rows are removed, keeping the one readers already use,
 * and a unique index on a constant makes a second live row impossible.
 */
export class Migration20261125090000 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`delete from "analytics_fact_state" where deleted_at is null and id <> (select id from "analytics_fact_state" where deleted_at is null order by created_at limit 1);`);
    this.addSql(`create unique index if not exists "IDX_analytics_fact_state_single_row" on "analytics_fact_state" ((true)) where deleted_at is null;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop index if exists "IDX_analytics_fact_state_single_row";`);
  }

}
