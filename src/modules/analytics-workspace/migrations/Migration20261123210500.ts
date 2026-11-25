import { Migration } from "@medusajs/framework/mikro-orm/migrations"

/*
 * The `returns` metric used to mean money refunded. It now means goods sent
 * back, and money refunded is `refunds`. Saved query-language reports and
 * dashboard widgets that asked for `returns` are switched to `refunds`, so
 * they keep showing what they showed before. SQL reports are left alone:
 * they name reporting view columns, which kept their meaning.
 */
const WORD = "\\mreturns\\M"

export class Migration20261123210500 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`update "analytics_report"
      set "query" = regexp_replace("query", '${WORD}', 'refunds', 'g'),
          "updated_at" = now()
      where "kind" = 'query' and "query" ~ '${WORD}';`)
    this.addSql(`update "analytics_dashboard" d
      set "layout" = jsonb_set(d."layout", '{widgets}', (
            select coalesce(jsonb_agg(
              case when coalesce(x.w->>'kind', 'query') = 'query'
                then jsonb_set(x.w, '{query}', to_jsonb(
                  regexp_replace(x.w->>'query', '${WORD}', 'refunds', 'g')))
                else x.w end
              order by x.n), '[]'::jsonb)
            from jsonb_array_elements(d."layout"->'widgets')
              with ordinality as x(w, n))),
          "updated_at" = now()
      where jsonb_typeof(d."layout"->'widgets') = 'array'
        and d."layout"::text ~ '${WORD}';`)
  }

  override async down(): Promise<void> {
    // Nothing to undo: `refunds` is what these reports always showed.
  }
}
