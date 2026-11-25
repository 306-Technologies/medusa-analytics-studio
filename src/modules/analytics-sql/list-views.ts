import type { Pool } from "pg"

import { REPORTING_SCHEMA } from "../../shared/analytics/reporting-view"
import type { SqlView } from "../../shared/analytics/types"

type ColumnRow = {
  view: string
  view_comment: string | null
  enabled: boolean
  column: string | null
  type: string | null
  column_comment: string | null
}

const VIEWS_SQL = `
  select c.relname as view,
         obj_description(c.oid, 'pg_class') as view_comment,
         has_table_privilege(c.oid, 'select') as enabled,
         a.attname as column,
         format_type(a.atttypid, a.atttypmod) as type,
         col_description(c.oid, a.attnum) as column_comment
  from pg_catalog.pg_class c
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  left join pg_catalog.pg_attribute a
    on a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped
    and has_table_privilege(c.oid, 'select')
  where n.nspname = $1
    and c.relkind in ('v', 'm')
  order by has_table_privilege(c.oid, 'select') desc, c.relname, a.attnum`

export const listViews = async (pool: Pool): Promise<SqlView[]> => {
  const { rows } = await pool.query<ColumnRow>(VIEWS_SQL, [REPORTING_SCHEMA])
  const views = new Map<string, SqlView>()
  for (const row of rows) {
    const view = views.get(row.view) ?? {
      name: row.view,
      comment: row.enabled ? row.view_comment : null,
      enabled: row.enabled,
      columns: [],
    }
    if (row.column !== null && row.type !== null) {
      view.columns.push({
        name: row.column,
        type: row.type,
        comment: row.column_comment,
      })
    }
    views.set(row.view, view)
  }
  return [...views.values()]
}
