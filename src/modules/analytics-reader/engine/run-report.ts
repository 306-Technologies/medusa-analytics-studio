import { MedusaError } from "@medusajs/framework/utils"

import {
  DIMENSIONS,
  METRICS,
  type DimensionKey,
  type MetricKey,
  type ReportQuery,
} from "../../../shared/analytics/query-language"
import type {
  ReportColumn,
  ReportResult,
  ReportRow,
} from "../../../shared/analytics/types"
import { type Raw, type SqlBinding, type SqlRunner } from "./sql-runner"
import {
  choosePlan,
  countUnconverted,
  type FactState,
  type Plan,
  type PlanWindow,
} from "./plan"

const dateSql = (
  expression: string
): { sql: string; bindings: SqlBinding[] } => {
  if (expression === "today") {
    return { sql: "d", bindings: [] }
  }
  if (expression === "yesterday") {
    return { sql: "(d - interval '1 day')", bindings: [] }
  }
  const relative = expression.match(/^-(\d+)([dwmy])$/)
  if (relative) {
    const amount = Number(relative[1])
    const unit = { d: "days", w: "weeks", m: "months", y: "years" }[relative[2]]
    return { sql: `(d - make_interval(${unit} => ?))`, bindings: [amount] }
  }
  return { sql: "?::timestamp", bindings: [expression] }
}

export type Bounds = {
  from_ts: Date
  to_ts: Date
  since_day: string
  until_day: string
  cmp_from_ts: Date | null
  cmp_to_ts: Date | null
  cmp_since_day: string | null
  cmp_until_day: string | null
}

export const resolveBounds = async (
  pg: SqlRunner,
  query: ReportQuery,
  timezone: string
): Promise<Bounds> => {
  const since = dateSql(query.since)
  const until = dateSql(query.until)

  const shift =
    query.compare === "previous_year"
      ? { from: "s - interval '1 year'", to: "u - interval '1 year'" }
      : { from: "s - (u - s)", to: "s" }

  const result = (await pg.raw(
    `
    with t as (select date_trunc('day', now() at time zone ?) as d),
    r as (
      select ${since.sql} as s, ${until.sql} + interval '1 day' as u from t
    )
    select
      s at time zone ? as from_ts,
      u at time zone ? as to_ts,
      to_char(s, 'YYYY-MM-DD') as since_day,
      to_char(u - interval '1 day', 'YYYY-MM-DD') as until_day,
      (${shift.from}) at time zone ? as cmp_from_ts,
      (${shift.to}) at time zone ? as cmp_to_ts,
      to_char(${shift.from}, 'YYYY-MM-DD') as cmp_since_day,
      to_char((${shift.to}) - interval '1 day', 'YYYY-MM-DD') as cmp_until_day,
      (u > s) as valid
    from r
    `,
    [
      timezone,
      ...since.bindings,
      ...until.bindings,
      timezone,
      timezone,
      timezone,
      timezone,
    ]
  )) as Raw<Bounds & { valid: boolean }>

  const row = result.rows[0]
  if (!row?.valid) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "SINCE has to be on or before UNTIL."
    )
  }
  return query.compare === "none"
    ? {
        ...row,
        cmp_from_ts: null,
        cmp_to_ts: null,
        cmp_since_day: null,
        cmp_until_day: null,
      }
    : row
}

type GroupedRow = { dimensions: string[]; values: Record<string, number> }

type OrderBy = { field: string; direction: "asc" | "desc" }

type GroupedCut = {
  orderBy: OrderBy
  limit: number
  keys: Promise<string[][]> | null
}

const numbers = (
  row: Record<string, unknown>,
  metrics: MetricKey[]
): Record<string, number> =>
  Object.fromEntries(
    metrics.map((metric, index) => [metric, Number(row[`m${index}`] ?? 0)])
  )

/** Code-point order (COLLATE "C"), as compareText: the rows SQL keeps under a LIMIT and the JS re-sort must agree. */
const compareText = (left: string, right: string): number =>
  Buffer.compare(Buffer.from(left), Buffer.from(right))

const orderSql = (query: ReportQuery, orderBy: OrderBy): string => {
  const direction = orderBy.direction === "asc" ? "asc" : "desc"
  const metric = query.metrics.findIndex((key) => key === orderBy.field)
  const dimension = query.dimensions.findIndex((key) => key === orderBy.field)
  const first =
    metric >= 0
      ? `g.m${metric} ${direction}`
      : dimension >= 0
        ? `g.d${dimension} collate "C" ${direction}`
        : null
  const ties = query.dimensions.map((_, index) => `g.d${index} collate "C"`)
  return [first, ...ties].filter(Boolean).join(", ")
}

const runWindow = async (
  pg: SqlRunner,
  plan: Plan,
  query: ReportQuery,
  window: PlanWindow,
  cut: GroupedCut | null
): Promise<{ rows: GroupedRow[]; totals: Record<string, number> }> => {
  const run = (grouped: boolean, keys: string[][] | null) => {
    const statement = plan.build(query, window, grouped)
    const bindings = statement.bindings
    if (!grouped || !cut) {
      return pg.raw(statement.sql, bindings)
    }
    // A join on a VALUES list hashes; a long row-wise IN would not.
    const join = keys
      ? `join (values ${keys
          .map((key) => `(${key.map(() => "?").join(", ")})`)
          .join(", ")}) k(${query.dimensions
          .map((_, index) => `k${index}`)
          .join(", ")}) on ${query.dimensions
          .map((_, index) => `g.d${index} = k.k${index}`)
          .join(" and ")}`
      : ""
    return pg.raw(
      `select g.* from (${statement.sql}) g ${join}
       order by ${orderSql(query, cut.orderBy)}
       limit ?`,
      [
        ...bindings,
        ...(keys ? keys.flat() : []),
        keys ? Math.max(keys.length, 1) : cut.limit,
      ]
    )
  }

  const totalsPromise = run(false, null)
  // Handled now: an unhandled rejection while the keys are awaited would crash the Medusa CLI.
  totalsPromise.catch(() => undefined)
  if (!query.dimensions.length) {
    const totals = numbers((await totalsPromise).rows[0] ?? {}, query.metrics)
    return { rows: [], totals }
  }
  const keys = cut?.keys ? await cut.keys : null
  if (keys?.length === 0) {
    const totals = numbers((await totalsPromise).rows[0] ?? {}, query.metrics)
    return { rows: [], totals }
  }

  const [grouped, totals] = await Promise.all([run(true, keys), totalsPromise])
  return {
    rows: grouped.rows.map((row) => ({
      dimensions: query.dimensions.map((_, index) =>
        String(row[`d${index}`] ?? "")
      ),
      values: numbers(row, query.metrics),
    })),
    totals: numbers(totals.rows[0] ?? {}, query.metrics),
  }
}

const pad = (value: number) => String(value).padStart(2, "0")
const toDay = (date: Date) =>
  `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`
const fromDay = (day: string) => new Date(`${day}T00:00:00Z`)

export const MAX_SERIES_POINTS = 1100

export const MAX_GROUPED_ROWS = 5000

const timeKeys = (dimension: DimensionKey, since: string, until: string) => {
  const keys: string[] = []
  const cursor = fromDay(since)
  const end = fromDay(until)

  if (dimension === "week") {
    cursor.setUTCDate(cursor.getUTCDate() - ((cursor.getUTCDay() + 6) % 7))
  }
  if (dimension === "month") {
    cursor.setUTCDate(1)
  }
  while (cursor <= end) {
    if (keys.length === MAX_SERIES_POINTS) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `GROUP BY ${dimension} has more than ${MAX_SERIES_POINTS.toLocaleString("en")} points over ${since} to ${until}. Use GROUP BY week or month, or a shorter range.`
      )
    }
    keys.push(toDay(cursor))
    if (dimension === "day") {
      cursor.setUTCDate(cursor.getUTCDate() + 1)
    } else if (dimension === "week") {
      cursor.setUTCDate(cursor.getUTCDate() + 7)
    } else {
      cursor.setUTCMonth(cursor.getUTCMonth() + 1)
    }
  }
  return keys
}

const zeroes = (metrics: MetricKey[]): Record<string, number> =>
  Object.fromEntries(metrics.map((metric) => [metric, 0]))

const fillSeries = (
  query: ReportQuery,
  rows: GroupedRow[],
  since: string,
  until: string
): GroupedRow[] => {
  const byKey = new Map(rows.map((row) => [row.dimensions[0], row]))
  return timeKeys(query.dimensions[0], since, until).map(
    (key) =>
      byKey.get(key) ?? { dimensions: [key], values: zeroes(query.metrics) }
  )
}

const isSoleTimeSeries = (query: ReportQuery): boolean =>
  query.dimensions.length === 1 &&
  DIMENSIONS[query.dimensions[0]].kind === "time"

const resolveOrderBy = (query: ReportQuery): OrderBy =>
  query.orderBy ??
  (query.dimensions.length && DIMENSIONS[query.dimensions[0]].kind === "time"
    ? { field: query.dimensions[0], direction: "asc" }
    : query.dimensions.some(
          (dimension) =>
            dimension === "day_of_week" || dimension === "hour_of_day"
        )
      ? { field: query.dimensions[0], direction: "asc" }
      : { field: query.metrics[0], direction: "desc" })

export const runReport = async (
  pg: SqlRunner,
  query: ReportQuery,
  currency: string,
  timezone: string,
  ready: boolean,
  bounds: Bounds,
  rebuild: Pick<FactState, "pendingTimezone" | "progress"> = {
    pendingTimezone: null,
    progress: null,
  }
): Promise<ReportResult> => {
  const plan = choosePlan(query)
  const series = isSoleTimeSeries(query)
  const orderBy = resolveOrderBy(query)

  // LIMIT rows, or MAX_GROUPED_ROWS + 1 to tell that the cap cut it; a time series is read whole.
  const limit = query.limit ?? MAX_GROUPED_ROWS + 1
  if (series) {
    timeKeys(query.dimensions[0], bounds.since_day, bounds.until_day)
  }

  const money = query.currency
    ? { currency: query.currency, convertTo: null }
    : { currency, convertTo: currency }
  const currentWindow: PlanWindow = {
    from: bounds.from_ts,
    to: bounds.to_ts,
    sinceDay: bounds.since_day,
    untilDay: bounds.until_day,
    ...money,
  }
  const compareWindow =
    bounds.cmp_from_ts &&
    bounds.cmp_to_ts &&
    bounds.cmp_since_day &&
    bounds.cmp_until_day
      ? {
          from: bounds.cmp_from_ts,
          to: bounds.cmp_to_ts,
          sinceDay: bounds.cmp_since_day,
          untilDay: bounds.cmp_until_day,
          ...money,
        }
      : null

  const unconvertedPromise = ready
    ? countUnconverted(pg, currentWindow)
    : Promise.resolve(0)
  unconvertedPromise.catch(() => undefined)

  const windowOf = (window: PlanWindow, cut: GroupedCut | null) =>
    ready
      ? runWindow(pg, plan, query, window, cut)
      : Promise.resolve({ rows: [], totals: zeroes(query.metrics) })

  let current: Awaited<ReturnType<typeof runWindow>>
  let previous: Awaited<ReturnType<typeof runWindow>> | null
  if (series) {
    ;[current, previous] = await Promise.all([
      windowOf(currentWindow, null),
      compareWindow ? windowOf(compareWindow, null) : null,
    ])
  } else {
    const currentPromise = windowOf(currentWindow, {
      orderBy,
      limit,
      keys: null,
    })
    ;[current, previous] = await Promise.all([
      currentPromise,
      compareWindow
        ? windowOf(compareWindow, {
            orderBy,
            limit,
            keys: currentPromise.then((result) =>
              result.rows.map((row) => row.dimensions)
            ),
          })
        : null,
    ])
  }

  const truncated =
    !series && query.limit === null && current.rows.length > MAX_GROUPED_ROWS
  if (truncated) {
    current.rows = current.rows.slice(0, MAX_GROUPED_ROWS)
  }

  const currentRows = series
    ? fillSeries(query, current.rows, bounds.since_day, bounds.until_day)
    : current.rows
  const previousRows =
    previous && series && bounds.cmp_since_day && bounds.cmp_until_day
      ? fillSeries(
          query,
          previous.rows,
          bounds.cmp_since_day,
          bounds.cmp_until_day
        )
      : (previous?.rows ?? [])

  const previousByKey = new Map(
    previousRows.map((row) => [row.dimensions.join(" · "), row])
  )

  let rows: ReportRow[] = currentRows.map((row, index) => {
    const key = row.dimensions.join(" · ")
    const match = series ? previousRows[index] : previousByKey.get(key)
    return {
      key,
      dimensions: Object.fromEntries(
        query.dimensions.map((dimension, position) => [
          dimension,
          row.dimensions[position],
        ])
      ),
      values: row.values,
      compare: previous ? (match?.values ?? zeroes(query.metrics)) : null,
    }
  })

  const sign = orderBy.direction === "asc" ? 1 : -1

  rows = [...rows].sort((a, b) => {
    const left = a.values[orderBy.field] ?? a.dimensions[orderBy.field] ?? ""
    const right = b.values[orderBy.field] ?? b.dimensions[orderBy.field] ?? ""
    const order =
      typeof left === "number" && typeof right === "number"
        ? (left - right) * sign
        : compareText(String(left), String(right)) * sign
    if (order) {
      return order
    }
    // Ties by dimension in order, as orderSql, so the rows SQL kept under a LIMIT are the ones shown.
    for (const dimension of query.dimensions) {
      const tie = compareText(a.dimensions[dimension], b.dimensions[dimension])
      if (tie) {
        return tie
      }
    }
    return 0
  })
  if (query.limit !== null) {
    rows = rows.slice(0, query.limit)
  }

  const columns: ReportColumn[] = [
    ...query.dimensions.map((dimension) => ({
      key: dimension,
      label: DIMENSIONS[dimension].label,
      kind: "dimension" as const,
      format: null,
    })),
    ...query.metrics.map((metric) => ({
      key: metric,
      label: METRICS[metric].label,
      kind: "metric" as const,
      format: METRICS[metric].format,
    })),
  ]

  return {
    query,
    columns,
    rows,
    totals: current.totals,
    compare_totals: previous?.totals ?? null,
    range: {
      since: bounds.since_day,
      until: bounds.until_day,
      compare_since: bounds.cmp_since_day,
      compare_until: bounds.cmp_until_day,
      timezone,
    },
    currency_code: money.currency,
    unconverted_orders: await unconvertedPromise,
    source: plan.source,
    rebuilding: !ready || rebuild.pendingTimezone !== null,
    filling: !ready,
    pending_timezone: rebuild.pendingTimezone,
    progress: rebuild.progress,
    truncated,
  }
}
