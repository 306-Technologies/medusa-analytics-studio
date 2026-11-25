import { Migration } from "@medusajs/framework/mikro-orm/migrations"

/*
 * Daily exchange rates, so reports can show every order in the store's
 * currency. Filled by the sales-facts-fx-rates job from a rate provider
 * (Frankfurter by default, ANALYTICS_FX_URL); reports only ever read this
 * table, never the provider.
 *
 * One row per base (the store currency), quote (an order currency) and day:
 * 1 base = rate quote, so an amount in the quote currency is amount / rate in
 * the base currency. rate_day is the day the provider's rate is from (an
 * earlier day when that day had none). fixed: the day is at least two days
 * old when fetched, so the rate is final and never fetched again; until then
 * it is provisional and replaced on the next run.
 */
export class Migration20261123220000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`create table if not exists "analytics_fx_rate" (
      "base" text not null,
      "quote" text not null,
      "day" date not null,
      "rate" numeric not null check ("rate" > 0),
      "rate_day" date not null,
      "fixed" boolean not null default false,
      "provider" text not null,
      "fetched_at" timestamptz not null default now(),
      constraint "analytics_fx_rate_pkey" primary key ("base", "quote", "day")
    );`)
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "analytics_fx_rate";`)
  }
}
