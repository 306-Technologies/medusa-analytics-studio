import { MedusaError } from "@medusajs/framework/utils"

import {
  DIMENSIONS,
  type DimensionKey,
  type MetricKey,
  type ReportQuery,
} from "../../../shared/analytics/query-language"
import { customerTypeSql } from "../../../shared/analytics/facts-format"
import type { ReportSource } from "../../../shared/analytics/types"
import { metricSql } from "./metrics"
import { type Raw, type SqlBinding, type SqlRunner } from "./sql-runner"

export type PlanWindow = {
  from: Date
  to: Date
  sinceDay: string
  untilDay: string
  currency: string
  convertTo: string | null
}

/** Bindings: base, base. */
export const fxFactorSql = (alias: string) => `case
    when ${alias}.currency_code = ? then 1::numeric
    else (
      select 1 / x.rate
      from analytics_fx_rate x
      where x.base = ? and x.quote = ${alias}.currency_code
        and x.day = ${alias}.local_day::date
    )
  end`

const ROLLUP_COLUMNS: Record<RollupTable, { kept: string[]; money: string[] }> =
  {
    analytics_sales_daily: {
      kept: [
        "local_day",
        "sales_channel",
        "country",
        "customer_type",
        "orders",
        "units",
        "new_customers",
        "returned_units",
      ],
      money: [
        "gross",
        "discounts",
        "refunded",
        "shipping",
        "tax",
        "total",
        "returns",
        "refunds",
      ],
    },
    analytics_sales_hourly: {
      kept: [
        "local_day",
        "local_hour",
        "orders",
        "units",
        "new_customers",
        "returned_units",
      ],
      money: [
        "gross",
        "discounts",
        "refunded",
        "shipping",
        "tax",
        "total",
        "returns",
        "refunds",
      ],
    },
    analytics_product_daily: {
      kept: ["local_day", "product_id", "product_title", "orders", "units"],
      money: ["gross"],
    },
    analytics_variant_daily: {
      kept: [
        "local_day",
        "product_id",
        "variant_id",
        "product_title",
        "variant_title",
        "orders",
        "units",
      ],
      money: ["gross"],
    },
  }

const rollupSource = (table: RollupTable, window: PlanWindow) => {
  const base = window.convertTo
  if (!base) {
    return { sql: table, bindings: [] }
  }
  const { kept, money } = ROLLUP_COLUMNS[table]
  return {
    sql: `(
      select ${kept.map((column) => `t.${column}`).join(", ")},
        ${money.map((column) => `t.${column} * fx.factor as ${column}`).join(", ")},
        ?::text as currency_code
      from ${table} t
      cross join lateral (select ${fxFactorSql("t")} as factor) fx
      where fx.factor is not null
        and t.local_day between ?::date and ?::date
    )`,
    bindings: [base, base, base, window.sinceDay, window.untilDay],
  }
}

export type Plan = {
  source: ReportSource
  build: (
    query: ReportQuery,
    window: PlanWindow,
    grouped: boolean
  ) => { sql: string; bindings: SqlBinding[] }
}

type RollupTable =
  | "analytics_sales_daily"
  | "analytics_sales_hourly"
  | "analytics_product_daily"
  | "analytics_variant_daily"

// Grouped by id; live products sharing a title, and deleted ones, get the end of their id so names stay unique.
const PRODUCT_LABELS = `(
  select p.id,
    case when count(*) over (partition by p.title) > 1
      then p.title || ' (' || right(p.id, 6) || ')' else p.title end as label
  from product p
  where p.deleted_at is null
)`
const VARIANT_LABELS = `(
  select v.id,
    case when count(*) over (partition by v.product_id, v.title) > 1
      then v.title || ' (' || right(v.id, 6) || ')' else v.title end as label
  from product_variant v
  where v.deleted_at is null
)`

const productLabel = (alias: string) =>
  `coalesce(max(pl.label), coalesce(max(${alias}.product_title), 'Unknown')
    || coalesce(' (' || right(max(nullif(${alias}.product_id, '')), 6) || ')', ''))`

const variantLabel = (alias: string) =>
  `${productLabel(alias)} || ' / '
    || coalesce(max(vl.label), max(${alias}.variant_title), '')`

const labelJoins = (alias: string, dimensions: DimensionKey[]) =>
  [
    dimensions.includes("product") || dimensions.includes("variant")
      ? `left join ${PRODUCT_LABELS} pl on pl.id = ${alias}.product_id`
      : "",
    dimensions.includes("variant")
      ? `left join ${VARIANT_LABELS} vl on vl.id = ${alias}.variant_id`
      : "",
  ].join(" ")

const idGroup = (alias: string) => (dimension: DimensionKey) =>
  dimension === "product"
    ? `${alias}.product_id`
    : dimension === "variant"
      ? `${alias}.product_id, ${alias}.variant_id`
      : null

const ROLLUP_DIMENSIONS: Partial<Record<DimensionKey, string>> = {
  day: "to_char(r.local_day, 'YYYY-MM-DD')",
  week: "to_char(date_trunc('week', r.local_day), 'YYYY-MM-DD')",
  month: "to_char(date_trunc('month', r.local_day), 'YYYY-MM-DD')",
  day_of_week: "extract(isodow from r.local_day)::int::text",
  hour_of_day: "lpad(r.local_hour::text, 2, '0')",
  country: "r.country",
  sales_channel: "r.sales_channel",
  customer_type: "r.customer_type",
  product: productLabel("r"),
  variant: variantLabel("r"),
}

const DAY_BASED: DimensionKey[] = ["day", "week", "month", "day_of_week"]

const TABLE_DIMENSIONS: Record<RollupTable, DimensionKey[]> = {
  analytics_sales_daily: [
    ...DAY_BASED,
    "country",
    "sales_channel",
    "customer_type",
  ],
  analytics_sales_hourly: [...DAY_BASED, "hour_of_day"],
  analytics_product_daily: [...DAY_BASED, "product"],
  analytics_variant_daily: [...DAY_BASED, "product", "variant"],
}

const rollupTableFor = (dimensions: DimensionKey[]): RollupTable | null => {
  const order: RollupTable[] = dimensions.includes("variant")
    ? ["analytics_variant_daily"]
    : dimensions.includes("product")
      ? ["analytics_product_daily"]
      : ["analytics_sales_daily", "analytics_sales_hourly"]
  return (
    order.find((table) =>
      dimensions.every((dimension) =>
        TABLE_DIMENSIONS[table].includes(dimension)
      )
    ) ?? null
  )
}

/** Throws rather than sending "undefined" as SQL for a metric a product row can't answer. */
const rollupMetricSql = (metric: MetricKey, line: boolean): string => {
  const sql = line ? metricSql(metric).rollupLine : metricSql(metric).rollup
  if (!sql) {
    throw new MedusaError(
      MedusaError.Types.UNEXPECTED_STATE,
      `No rollup SQL for ${metric}${line ? " by product" : ""}`
    )
  }
  return sql
}

const rollupPlan = (table: RollupTable): Plan => {
  const perLine =
    table === "analytics_product_daily" || table === "analytics_variant_daily"
  return {
    source: "rollups",
    build: (query, window, grouped) => {
      // From the daily sales table: summing per-product order counts would count an order once per product.
      const from = rollupSource(
        perLine && !grouped ? "analytics_sales_daily" : table,
        window
      )
      const select = [
        ...(grouped
          ? query.dimensions.map(
              (dimension, index) =>
                `${ROLLUP_DIMENSIONS[dimension]} as d${index}`
            )
          : []),
        ...query.metrics.map(
          (metric, index) =>
            `${rollupMetricSql(metric, perLine && grouped)} as m${index}`
        ),
      ].join(", ")
      return {
        sql: `select ${select}
          from ${from.sql} r
          ${grouped ? labelJoins("r", query.dimensions) : ""}
          where r.currency_code = ?
            and r.local_day between ?::date and ?::date
          ${groupBy(query, grouped, idGroup("r"))}`,
        bindings: [
          ...from.bindings,
          window.currency,
          window.sinceDay,
          window.untilDay,
        ],
      }
    },
  }
}

const needsEvents = (query: ReportQuery) =>
  query.metrics.some((metric) => metricSql(metric).events)

const FACT_COLUMNS = `t.order_id, t.local_day, t.local_hour, t.country,
  t.city, t.sales_channel, t.customer_id, t.is_new`

const factSource = (events: boolean, window: PlanWindow) => {
  const base = window.convertTo
  const money = base
    ? {
        currency: "?::text",
        factor: "fx.factor",
        join: `cross join lateral (select ${fxFactorSql("t")} as factor) fx`,
        where: "and fx.factor is not null",
        bindings: [base, base, base],
      }
    : {
        currency: "t.currency_code",
        factor: "1::numeric",
        join: "",
        where: "",
        bindings: [],
      }
  const m = (column: string) => (base ? `${column} * fx.factor` : column)
  const half = (select: string, from: string, where: string) => `
    select ${FACT_COLUMNS}, ${money.currency} as currency_code,
      ${money.factor} as factor, ${select}
    from ${from} t
    ${money.join}
    where ${where} ${money.where}`
  return {
    sql: `(${half(
      `true as is_order, ${m("t.gross")} as gross,
        ${m("t.discounts")} as discounts, ${m("t.shipping")} as shipping,
        ${m("t.tax")} as tax, ${m("t.total")} as total, t.units,
        0 as returns, 0 as returned_units, 0 as refunds`,
      "analytics_order_fact",
      "t.deleted_at is null"
    )}
    ${
      events
        ? `union all ${half(
            `false, 0, 0, 0, 0, 0, 0,
              case when t.kind = 'return' then ${m("t.amount")} else 0 end,
              case when t.kind = 'return' then t.units else 0 end,
              case when t.kind = 'refund' then ${m("t.amount")} else 0 end`,
            "analytics_event_fact",
            "true"
          )}`
        : ""
    }
    ) f`,
    bindings: events ? [...money.bindings, ...money.bindings] : money.bindings,
  }
}

const FACT_DIMENSIONS: Record<DimensionKey, string> = {
  day: "f.local_day",
  week: "to_char(date_trunc('week', f.local_day::date), 'YYYY-MM-DD')",
  month: "to_char(date_trunc('month', f.local_day::date), 'YYYY-MM-DD')",
  day_of_week: "extract(isodow from f.local_day::date)::int::text",
  hour_of_day: "lpad(f.local_hour::text, 2, '0')",
  country: "f.country",
  city: "f.city",
  sales_channel: "f.sales_channel",
  customer_type: customerTypeSql("f"),
  product: productLabel("l"),
  variant: variantLabel("l"),
}

const factsPlan: Plan = {
  source: "facts",
  build: (query, window, grouped) => {
    const perLine = query.dimensions.some(
      (dimension) => DIMENSIONS[dimension].perLine
    )
    const factMetricSql = (metric: MetricKey) =>
      (perLine ? metricSql(metric).factsLine : undefined) ??
      metricSql(metric).facts
    const select = [
      ...(grouped
        ? query.dimensions.map(
            (dimension, index) => `${FACT_DIMENSIONS[dimension]} as d${index}`
          )
        : []),
      ...query.metrics.map(
        (metric, index) => `${factMetricSql(metric)} as m${index}`
      ),
    ].join(", ")
    const source = factSource(!perLine && needsEvents(query), window)
    // "deleted_at is null" on facts and lines: the fact indexes only cover live rows.
    return {
      sql: `select ${select}
        from ${source.sql}
        ${
          perLine
            ? "join analytics_line_fact l on l.order_id = f.order_id and l.deleted_at is null"
            : ""
        }
        ${grouped && perLine ? labelJoins("l", query.dimensions) : ""}
        where f.currency_code = ?
          and f.local_day between ? and ?
        ${groupBy(query, grouped, idGroup("l"))}`,
      bindings: [
        ...source.bindings,
        window.currency,
        window.sinceDay,
        window.untilDay,
      ],
    }
  },
}

const groupBy = (
  query: ReportQuery,
  grouped: boolean,
  key: (dimension: DimensionKey) => string | null
) =>
  grouped && query.dimensions.length
    ? `group by ${query.dimensions
        .map((dimension, index) => key(dimension) ?? String(index + 1))
        .join(", ")}`
    : ""

type StateRow = {
  timezone: string
  backfilled_at: Date | null
  data_version: number | string
  pending_timezone: string | null
  pending_built_at: Date | null
  cursor: Date | null
  first_order: Date | null
  last_order: Date | null
}

export type FactState = {
  ready: boolean
  dataVersion: number
  timezone: string | null
  pendingTimezone: string | null
  progress: number | null
}

export const readFactState = async (pg: SqlRunner): Promise<FactState> => {
  const result = (await pg.raw(
    `select s.timezone, s.backfilled_at, s.data_version, s.pending_timezone,
            s.pending_built_at,
            s.backfill_cursor_created_at as cursor,
            case when s.backfilled_at is null or s.pending_timezone is not null then
              (select min(created_at) from "order" where deleted_at is null) end as first_order,
            case when s.backfilled_at is null or s.pending_timezone is not null then
              (select max(created_at) from "order" where deleted_at is null) end as last_order
     from analytics_fact_state s
     where s.deleted_at is null
     order by s.created_at
     limit 1`,
    []
  )) as Raw<StateRow>
  const state = result.rows[0]
  const ready = Boolean(state?.backfilled_at)
  const building = !ready || Boolean(state?.pending_timezone)
  return {
    ready,
    dataVersion: Number(state?.data_version ?? 0),
    timezone: state?.timezone ?? null,
    pendingTimezone: ready ? (state?.pending_timezone ?? null) : null,
    progress: building ? progressOf(state) : null,
  }
}

const progressOf = (state: StateRow | undefined): number => {
  if (state?.pending_built_at) {
    return 1
  }
  const first = state?.first_order
    ? new Date(state.first_order).getTime()
    : null
  const last = state?.last_order ? new Date(state.last_order).getTime() : null
  if (!state?.cursor || first === null || last === null || last <= first) {
    return 0
  }
  const at = new Date(state.cursor).getTime()
  return Math.min(1, Math.max(0, (at - first) / (last - first)))
}

const isRollupMetric = (metric: MetricKey) =>
  metricSql(metric).rollup !== undefined

export const choosePlan = (query: ReportQuery): Plan => {
  const table = query.metrics.every(isRollupMetric)
    ? rollupTableFor(query.dimensions)
    : null
  return table ? rollupPlan(table) : factsPlan
}

export type DayRange = { since: string; until: string }

export const readDaysVersion = async (
  pg: SqlRunner,
  ranges: DayRange[]
): Promise<number> => {
  if (!ranges.length) {
    return 0
  }
  const result = (await pg.raw(
    `select coalesce(max(version), 0) as version
     from analytics_day_version
     where ${ranges.map(() => "local_day between ? and ?").join(" or ")}`,
    ranges.flatMap((range) => [range.since, range.until])
  )) as Raw<{ version: number | string }>
  return Number(result.rows[0]?.version ?? 0)
}

/** Assumes version and data come from one database or replica; reads spread over lagging replicas could pair a new version with old data. */
export const cacheVersion = async (
  pg: SqlRunner,
  state: { ready: boolean; dataVersion: number },
  ranges: DayRange[]
): Promise<string> =>
  state.ready
    ? `d${await readDaysVersion(pg, ranges)}`
    : `g${state.dataVersion}`

export const countUnconverted = async (
  pg: SqlRunner,
  window: PlanWindow
): Promise<number> => {
  const base = window.convertTo
  if (!base) {
    return 0
  }
  const result = (await pg.raw(
    `select count(*) as n
     from analytics_order_fact f
     where f.deleted_at is null
       and f.local_day between ? and ?
       and f.currency_code <> ?
       and not exists (
         select 1 from analytics_fx_rate x
         where x.base = ? and x.quote = f.currency_code
           and x.day = f.local_day::date
       )`,
    [window.sinceDay, window.untilDay, base, base]
  )) as Raw<{ n: number | string }>
  return Number(result.rows[0]?.n ?? 0)
}
