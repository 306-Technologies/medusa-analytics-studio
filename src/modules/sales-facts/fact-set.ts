import type { SqlEntityManager } from "@medusajs/framework/mikro-orm/postgresql"
import { MedusaError } from "@medusajs/framework/utils"

export const NEXT_SCHEMA = "analytics_next"
export const OLD_SCHEMA = "analytics_old"

export const FACT_TABLES = [
  "analytics_order_fact",
  "analytics_line_fact",
  "analytics_event_fact",
  "analytics_sales_daily",
  "analytics_sales_hourly",
  "analytics_product_daily",
  "analytics_variant_daily",
] as const

const SWAP_LOCK_TIMEOUT = "5s"

type Row = Record<string, unknown>
type ConstraintRow = { name: string; definition: string }
type IndexRow = { definition: string }
type ViewRow = { view: string; definition: string }

const text = (value: unknown): string => String(value)

const liveSchema = async (manager: SqlEntityManager): Promise<string> => {
  const [row] = await manager.execute<Row[]>("select current_schema() as name")
  return text(row?.name)
}

const quoted = (name: string) => `"${name.replaceAll('"', '""')}"`

export const createNextSet = async (
  manager: SqlEntityManager
): Promise<void> => {
  const live = await liveSchema(manager)
  await manager.execute(`drop schema if exists ${NEXT_SCHEMA} cascade`)
  await manager.execute(`create schema ${NEXT_SCHEMA}`)
  for (const table of FACT_TABLES) {
    const source = `${quoted(live)}.${quoted(table)}`
    const target = `${NEXT_SCHEMA}.${quoted(table)}`
    await manager.execute(
      `create table ${target} (like ${source}
         including defaults including constraints including comments
         including generated including identity)`
    )
    const constraints = await manager.execute<ConstraintRow[]>(
      `select conname as name, pg_get_constraintdef(oid) as definition
       from pg_constraint
       where conrelid = ?::regclass and contype in ('p', 'u')`,
      [source]
    )
    for (const constraint of constraints) {
      await manager.execute(
        `alter table ${target} add constraint ${quoted(constraint.name)} ${constraint.definition}`
      )
    }
    // The index definition names the table as schema.table, swapped for the copy's.
    const indexes = await manager.execute<IndexRow[]>(
      `select pg_get_indexdef(i.indexrelid) as definition
       from pg_index i
       where i.indrelid = ?::regclass
         and not exists (select 1 from pg_constraint c where c.conindid = i.indexrelid)`,
      [source]
    )
    for (const index of indexes) {
      const onLive = ` ON ${live}.${table} `
      const onLiveQuoted = ` ON ${quoted(live)}.${quoted(table)} `
      const definition = index.definition.includes(onLive)
        ? index.definition.replace(onLive, ` ON ${target} `)
        : index.definition.replace(onLiveQuoted, ` ON ${target} `)
      if (definition === index.definition) {
        throw new MedusaError(
          MedusaError.Types.UNEXPECTED_STATE,
          `Could not copy an index of ${table}: ${index.definition}`
        )
      }
      await manager.execute(definition)
    }
  }
}

export const nextSetExists = async (
  manager: SqlEntityManager
): Promise<boolean> => {
  const [row] = await manager.execute<Row[]>(
    `select to_regclass('${NEXT_SCHEMA}.analytics_order_fact') is not null as present`
  )
  return row?.present === true
}

export const dropNextSet = async (manager: SqlEntityManager): Promise<void> => {
  await manager.execute(`drop schema if exists ${NEXT_SCHEMA} cascade`)
}

export const useNextSet = async <T>(
  manager: SqlEntityManager,
  work: () => Promise<T>
): Promise<T> => {
  // A missing schema is silently skipped on a search path, which would send these writes to the live tables.
  const [check] = await manager.execute<Row[]>(
    `select to_regclass('${NEXT_SCHEMA}.analytics_order_fact') is not null as present,
            current_setting('search_path') as path`
  )
  if (!check?.present) {
    throw new MedusaError(
      MedusaError.Types.UNEXPECTED_STATE,
      `A rebuild is recorded but schema ${NEXT_SCHEMA} is missing; the next backfill step starts it again`
    )
  }
  const previous = text(check.path)
  await manager.execute("select set_config('search_path', ?, true)", [
    `${NEXT_SCHEMA}, ${previous}`,
  ])
  // Put back only on success: after a failure the transaction is aborted and its rollback resets the setting.
  const result = await work()
  await manager.execute("select set_config('search_path', ?, true)", [previous])
  return result
}

const TABLE_PLACEHOLDERS = FACT_TABLES.map(() => "?").join(", ")

const shapeOf = async (
  manager: SqlEntityManager,
  schema: string
): Promise<string> => {
  const rows = await manager.execute<Row[]>(
    `select c.relname || '.' || a.attname || ':' || format_type(a.atttypid, a.atttypmod)
              || case when a.attnotnull then '!' else '' end as item
     from pg_attribute a
     join pg_class c on c.oid = a.attrelid
     join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = ? and c.relkind = 'r' and a.attnum > 0 and not a.attisdropped
       and c.relname in (${TABLE_PLACEHOLDERS})
     union all
     select 'index ' || i.relname
     from pg_index x
     join pg_class i on i.oid = x.indexrelid
     join pg_class c on c.oid = x.indrelid
     join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = ? and c.relname in (${TABLE_PLACEHOLDERS})
     order by 1`,
    [schema, ...FACT_TABLES, schema, ...FACT_TABLES]
  )
  return rows.map((row) => text(row.item)).join("\n")
}

export const nextSetMatches = async (
  manager: SqlEntityManager
): Promise<boolean> =>
  (await shapeOf(manager, await liveSchema(manager))) ===
  (await shapeOf(manager, NEXT_SCHEMA))

/** Must run inside the caller's transaction, which also records the new timezone. */
export const swapSets = async (manager: SqlEntityManager): Promise<void> => {
  const live = await liveSchema(manager)
  const tables = FACT_TABLES.map((table) => `${quoted(live)}.${quoted(table)}`)

  // Every lock in one statement: one table at a time would hold the first while reports queue behind the swap.
  await manager.execute(`set local lock_timeout = '${SWAP_LOCK_TIMEOUT}'`)
  await manager.execute(`set local statement_timeout = '${SWAP_LOCK_TIMEOUT}'`)
  try {
    await manager.execute(
      `lock table ${[
        ...tables,
        ...FACT_TABLES.map((table) => `${NEXT_SCHEMA}.${quoted(table)}`),
      ].join(", ")} in access exclusive mode`
    )
  } catch (error) {
    throw isLockWait(error) ? new SwapLockWaitError(error) : error
  }
  await manager.execute("set local lock_timeout = default")
  await manager.execute("set local statement_timeout = default")

  // Views point at the table, not its name, so they are recreated on the new tables.
  const views = await manager.execute<ViewRow[]>(
    `select distinct v.oid::regclass::text as view, pg_get_viewdef(v.oid) as definition
     from pg_depend d
     join pg_rewrite r on r.oid = d.objid
     join pg_class v on v.oid = r.ev_class
     where d.classid = 'pg_rewrite'::regclass
       and d.refobjid in (${tables.map(() => "?::regclass").join(", ")})
       and v.oid <> d.refobjid
       and v.relkind = 'v'`,
    tables
  )

  await manager.execute(`drop schema if exists ${OLD_SCHEMA} cascade`)
  await manager.execute(`create schema ${OLD_SCHEMA}`)
  for (const table of FACT_TABLES) {
    await manager.execute(
      `alter table ${quoted(live)}.${quoted(table)} set schema ${OLD_SCHEMA}`
    )
    await manager.execute(
      `alter table ${NEXT_SCHEMA}.${quoted(table)} set schema ${quoted(live)}`
    )
  }
  for (const view of views) {
    await manager.execute(
      `create or replace view ${view.view} as ${view.definition}`
    )
  }
  // Plain drops: anything still depending on an old table fails the whole swap rather than being dropped.
  for (const table of FACT_TABLES) {
    await manager.execute(`drop table ${OLD_SCHEMA}.${quoted(table)}`)
  }
  await manager.execute(`drop schema ${OLD_SCHEMA}`)
  await manager.execute(`drop schema ${NEXT_SCHEMA}`)
}

/** Lock or statement timeout (55P03, 57014); only used around the swap's own lock statement. */
const isLockWait = (error: unknown): boolean => {
  const codes = new Set(["55P03", "57014"])
  const codeOf = (value: unknown): string | undefined =>
    typeof value === "object" && value !== null && "code" in value
      ? String(value.code)
      : undefined
  const previous =
    typeof error === "object" && error !== null && "previous" in error
      ? error.previous
      : undefined
  return [codeOf(error), codeOf(previous)].some(
    (code) => code !== undefined && codes.has(code)
  )
}

export class SwapLockWaitError extends MedusaError {
  constructor(readonly cause: unknown) {
    super(
      MedusaError.Types.CONFLICT,
      "Running reports held the analytics tables too long to swap the rebuild in"
    )
  }
}
