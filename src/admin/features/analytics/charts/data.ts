import {
  DIMENSIONS,
  type DimensionKey,
} from "../../../../shared/analytics/query-language"
import { OTHER_COLOR, SERIES_COLORS } from "../colors"
import { formatDimension, formatValue } from "../format"
import type { ReportColumn, ReportResult } from "../types"
import type { ChartFit } from "./types"

export const MAX_SERIES = 5
export const MAX_SLICES = 6

export const FITS: ChartFit = { ok: true }

export const metricColumn = (
  result: ReportResult,
  metric?: string
): ReportColumn | undefined => {
  const metrics = result.columns.filter((column) => column.kind === "metric")
  return metrics.find((entry) => entry.key === metric) ?? metrics[0]
}

export const metricPrinter =
  (result: ReportResult, column: ReportColumn) =>
  (value: number, short = false): string =>
    formatValue(value, column.format, result.currency_code, { compact: short })

export const needsDimension = (result: ReportResult): ChartFit =>
  result.query.dimensions.length > 0
    ? FITS
    : { ok: false, reason: "Needs a grouping" }

export const isTimeDimension = (key: DimensionKey | undefined): boolean =>
  key !== undefined && DIMENSIONS[key].kind === "time"

export const sparkValues = (
  result: ReportResult,
  column: ReportColumn
): number[] => {
  const dimensions = result.query.dimensions
  return dimensions.length === 1 && isTimeDimension(dimensions[0])
    ? result.rows.map((row) => row.values[column.key] ?? 0)
    : []
}

export type Slice = { name: string; value: number; color: string }

export const toSlices = (
  result: ReportResult,
  column: ReportColumn,
  max = MAX_SLICES
): Slice[] => {
  const dimensions = result.query.dimensions
  const sorted = [...result.rows].sort(
    (a, b) => (b.values[column.key] ?? 0) - (a.values[column.key] ?? 0)
  )
  const cut = sorted.length === max + 1 ? max + 1 : max
  const head = sorted.slice(0, cut)
  const rest = sorted.slice(cut)
  return [
    ...head.map((row, index) => ({
      name: dimensions
        .map((dimension) =>
          formatDimension(dimension, row.dimensions[dimension])
        )
        .join(" · "),
      value: row.values[column.key] ?? 0,
      color: SERIES_COLORS[index % SERIES_COLORS.length],
    })),
    ...(rest.length
      ? [
          {
            name: "Other",
            value: rest.reduce(
              (sum, row) => sum + (row.values[column.key] ?? 0),
              0
            ),
            color: OTHER_COLOR,
          },
        ]
      : []),
  ].filter((slice) => slice.value > 0)
}

export type Series = {
  key: string
  name: string
  color: string
  dashed: boolean
}

export type Cartesian = {
  points: Array<Record<string, string | number>>
  series: Series[]
  axis: DimensionKey
  split: DimensionKey | undefined
  isTime: boolean
}

export const toCartesian = (
  result: ReportResult,
  column: ReportColumn,
  { limit }: { limit?: number } = {}
): Cartesian => {
  const [axis, split] = result.query.dimensions
  const isTime = isTimeDimension(axis)

  const seriesNames = split
    ? [
        ...result.rows
          .reduce((totals, row) => {
            const name = row.dimensions[split]
            totals.set(
              name,
              (totals.get(name) ?? 0) + (row.values[column.key] ?? 0)
            )
            return totals
          }, new Map<string, number>())
          .entries(),
      ]
        .sort((a, b) => b[1] - a[1])
        .slice(0, MAX_SERIES)
        .map(([name]) => name)
    : []

  const axisValues = [
    ...new Set(result.rows.map((row) => row.dimensions[axis])),
  ]
  if (split && isTime) {
    axisValues.sort()
  }

  const points = (
    split
      ? axisValues.map((value) => {
          const point: Record<string, string | number> = { x: value }
          for (const name of seriesNames) {
            point[name] =
              result.rows.find(
                (row) =>
                  row.dimensions[axis] === value &&
                  row.dimensions[split] === name
              )?.values[column.key] ?? 0
          }
          return point
        })
      : result.rows.map((row) => ({
          x: row.dimensions[axis],
          current: row.values[column.key] ?? 0,
          ...(row.compare ? { previous: row.compare[column.key] ?? 0 } : {}),
        }))
  ).slice(0, limit)

  const series: Series[] = split
    ? seriesNames.map((name, index) => ({
        key: name,
        name: formatDimension(split, name),
        color: SERIES_COLORS[index % SERIES_COLORS.length],
        dashed: false,
      }))
    : [
        {
          key: "current",
          name: column.label,
          color: SERIES_COLORS[0],
          dashed: false,
        },
        ...(result.compare_totals
          ? [
              {
                key: "previous",
                name: "Comparison",
                color: OTHER_COLOR,
                dashed: true,
              },
            ]
          : []),
      ]

  return { points, series, axis, split, isTime }
}

export type Ranked = {
  key: string
  name: string
  value: number
  previous: number | null
}

const rowName = (result: ReportResult, row: ReportResult["rows"][number]) =>
  result.query.dimensions
    .map((dimension) => formatDimension(dimension, row.dimensions[dimension]))
    .join(" · ")

export const toNamed = (
  result: ReportResult,
  column: ReportColumn,
  limit?: number
): Ranked[] =>
  result.rows.slice(0, limit).map((row) => ({
    key: row.key,
    name: rowName(result, row),
    value: row.values[column.key] ?? 0,
    previous: row.compare ? (row.compare[column.key] ?? 0) : null,
  }))

export const toRanked = (
  result: ReportResult,
  column: ReportColumn,
  limit?: number
): Ranked[] =>
  toNamed(result, column)
    .sort((a, b) => b.value - a.value)
    .slice(0, limit)

export const needsComparison = (result: ReportResult): ChartFit =>
  result.compare_totals ? FITS : { ok: false, reason: "Needs a comparison" }

export const needsOneDimension = (result: ReportResult): ChartFit =>
  result.query.dimensions.length === 1
    ? FITS
    : { ok: false, reason: "Needs one grouping" }

export const needsTime = (result: ReportResult): ChartFit =>
  isTimeDimension(result.query.dimensions[0])
    ? FITS
    : { ok: false, reason: "Needs a time grouping" }

export const allOf =
  (...checks: Array<(result: ReportResult) => ChartFit>) =>
  (result: ReportResult): ChartFit => {
    for (const check of checks) {
      const fit = check(result)
      if (!fit.ok) {
        return fit
      }
    }
    return FITS
  }

const DEDUCTIONS = new Set(["discounts", "returns"])

export type Step = {
  key: string
  label: string
  value: number
  from: number
  to: number
  kind: "start" | "up" | "down" | "end"
}

// Below this, a gap between the steps and the end total is rounding.
const STEP_TOLERANCE = 0.5

export const toSteps = (result: ReportResult): Step[] => {
  const metrics = result.columns.filter((column) => column.kind === "metric")
  const [first] = metrics
  const last = metrics[metrics.length - 1]
  if (!first || !last || metrics.length < 2) {
    return []
  }
  const startValue = result.totals[first.key] ?? 0
  const endValue = result.totals[last.key] ?? 0
  const steps: Step[] = [
    {
      key: first.key,
      label: first.label,
      value: startValue,
      from: 0,
      to: startValue,
      kind: "start",
    },
  ]
  let running = startValue
  for (const column of metrics.slice(1, -1)) {
    const amount = result.totals[column.key] ?? 0
    const down = DEDUCTIONS.has(column.key)
    const from = running
    running = down ? running - amount : running + amount
    steps.push({
      key: column.key,
      label: column.label,
      value: down ? -amount : amount,
      from,
      to: running,
      kind: down ? "down" : "up",
    })
  }
  const gap = endValue - running
  if (Math.abs(gap) > STEP_TOLERANCE) {
    steps.push({
      key: "other",
      label: "Other",
      value: gap,
      from: running,
      to: endValue,
      kind: gap < 0 ? "down" : "up",
    })
  }
  steps.push({
    key: last.key,
    label: last.label,
    value: endValue,
    from: 0,
    to: endValue,
    kind: "end",
  })
  return steps
}

export const needsSteps = (result: ReportResult): ChartFit => {
  const metrics = result.columns.filter((column) => column.kind === "metric")
  if (metrics.length < 3) {
    return { ok: false, reason: "Needs 3+ metrics" }
  }
  return metrics.every((column) => column.format === "money")
    ? FITS
    : { ok: false, reason: "Needs money metrics only" }
}

const FULL_DOMAINS: Partial<Record<DimensionKey, string[]>> = {
  day_of_week: ["1", "2", "3", "4", "5", "6", "7"],
  hour_of_day: Array.from({ length: 24 }, (_, hour) => String(hour)),
}

const byNumberThenText = (a: string, b: string) => {
  const numberA = Number(a)
  const numberB = Number(b)
  return Number.isFinite(numberA) && Number.isFinite(numberB)
    ? numberA - numberB
    : a.localeCompare(b)
}

const domainOf = (result: ReportResult, dimension: DimensionKey): string[] =>
  FULL_DOMAINS[dimension] ??
  [...new Set(result.rows.map((row) => row.dimensions[dimension]))].sort(
    byNumberThenText
  )

export type Matrix = {
  rowDimension: DimensionKey
  columnDimension: DimensionKey
  rows: string[]
  columns: string[]
  valueAt: (row: string, column: string) => number
  max: number
}

/** Hours can arrive zero-padded ("09") while the grid counts "0" to "23". */
const domainKey = (
  dimension: DimensionKey,
  value: string | undefined
): string =>
  FULL_DOMAINS[dimension] && value !== undefined && /^\d+$/.test(value)
    ? String(Number(value))
    : (value ?? "")

export const toMatrix = (
  result: ReportResult,
  column: ReportColumn
): Matrix => {
  const [rowDimension, columnDimension] = result.query.dimensions
  const values = new Map<string, number>()
  for (const row of result.rows) {
    values.set(
      `${domainKey(rowDimension, row.dimensions[rowDimension])}|${domainKey(
        columnDimension,
        row.dimensions[columnDimension]
      )}`,
      row.values[column.key] ?? 0
    )
  }
  return {
    rowDimension,
    columnDimension,
    rows: domainOf(result, rowDimension),
    columns: domainOf(result, columnDimension),
    valueAt: (row, columnValue) => values.get(`${row}|${columnValue}`) ?? 0,
    max: Math.max(0, ...values.values()),
  }
}

export const needsTwoDimensions = (result: ReportResult): ChartFit =>
  result.query.dimensions.length === 2
    ? FITS
    : { ok: false, reason: "Needs two groupings" }

/** The faintest a cell with any value is drawn, so it never reads as empty. */
export const MIN_STRENGTH = 0.12

export const toStrength = (values: number[]): ((value: number) => number) => {
  const positive = values.filter((value) => value > 0)
  const low = Math.min(...positive)
  const high = Math.max(...positive)
  return (value) => {
    if (value <= 0 || !positive.length) {
      return 0
    }
    if (high === low) {
      return 1
    }
    return MIN_STRENGTH + (1 - MIN_STRENGTH) * ((value - low) / (high - low))
  }
}

const DAY_MS = 86_400_000
const toTime = (day: string) => Date.parse(`${day}T00:00:00Z`)
const toDay = (time: number) => new Date(time).toISOString().slice(0, 10)

export type CalendarDay = { day: string; value: number }

export const toCalendar = (
  result: ReportResult,
  column: ReportColumn
): { weeks: Array<Array<CalendarDay | null>>; max: number } => {
  const values = new Map(
    result.rows.map((row) => [row.dimensions.day, row.values[column.key] ?? 0])
  )
  const start = toTime(result.range.since)
  const end = toTime(result.range.until)
  // getUTCDay: Sunday is 0. Step back to the Monday on or before the start.
  const monday = start - ((new Date(start).getUTCDay() + 6) % 7) * DAY_MS

  const weeks: Array<Array<CalendarDay | null>> = []
  for (let weekStart = monday; weekStart <= end; weekStart += 7 * DAY_MS) {
    weeks.push(
      Array.from({ length: 7 }, (_, offset) => {
        const time = weekStart + offset * DAY_MS
        if (time < start || time > end) {
          return null
        }
        const day = toDay(time)
        return { day, value: values.get(day) ?? 0 }
      })
    )
  }
  return { weeks, max: Math.max(0, ...values.values()) }
}

export const needsDays = (result: ReportResult): ChartFit =>
  result.query.dimensions.length === 1 && result.query.dimensions[0] === "day"
    ? FITS
    : { ok: false, reason: "Needs grouping by day" }

export type RankChange = {
  key: string
  name: string
  now: number
  before: number
}

export const toRankChanges = (
  result: ReportResult,
  column: ReportColumn,
  limit = 5
): RankChange[] => {
  const all = toRanked(result, column)
  // The earlier rank counts every row returned, not just the top ones shown.
  const before = [...all].sort((a, b) => (b.previous ?? 0) - (a.previous ?? 0))
  return all.slice(0, limit).map((row, index) => ({
    key: row.key,
    name: row.name,
    now: index + 1,
    before: before.findIndex((entry) => entry.key === row.key) + 1,
  }))
}
