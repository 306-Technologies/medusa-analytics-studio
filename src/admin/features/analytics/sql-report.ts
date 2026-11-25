import type { DimensionKey } from "../../../shared/analytics/query-language"
import { cellText, seriesKey, toNumber, type SqlChartSettings } from "./sql"
import type {
  ReportColumn,
  ReportResult,
  ReportRow,
  SqlResultResponse,
} from "./types"

const TIME: DimensionKey = "day"
const CATEGORY: DimensionKey = "city"

const DAY = /^\d{4}-\d{2}-\d{2}/

const today = () => {
  const now = new Date()
  const pad = (value: number) => String(value).padStart(2, "0")
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

export const sqlReportResult = (
  result: SqlResultResponse,
  settings: SqlChartSettings
): ReportResult => {
  const labelColumn =
    settings.label === null ? undefined : result.columns[settings.label]
  const isTime =
    labelColumn?.kind === "date" &&
    result.rows.every((row) => {
      const value = settings.label === null ? null : row[settings.label]
      return value === null || value === undefined || DAY.test(String(value))
    })
  const dimension = isTime ? TIME : CATEGORY

  const columns: ReportColumn[] = [
    {
      key: dimension,
      label: labelColumn?.name ?? "Row",
      kind: "dimension",
      format: null,
    },
    ...settings.values.flatMap((index): ReportColumn[] => {
      const column = result.columns[index]
      return column
        ? [
            {
              key: seriesKey(index),
              label: column.name,
              kind: "metric",
              format: "number",
            },
          ]
        : []
    }),
  ]
  const metricKeys = columns
    .filter((column) => column.kind === "metric")
    .map((column) => ({ key: column.key, index: Number(column.key.slice(1)) }))

  const grouped = new Map<string, ReportRow>()
  result.rows.forEach((row, rowIndex) => {
    const raw = settings.label === null ? null : (row[settings.label] ?? null)
    const value =
      settings.label === null
        ? String(rowIndex + 1)
        : isTime && raw !== null
          ? String(raw).slice(0, 10)
          : raw === null
            ? ""
            : cellText(raw)
    const entry = grouped.get(value) ?? {
      key: value,
      dimensions: { [dimension]: value },
      values: Object.fromEntries(metricKeys.map(({ key }) => [key, 0])),
      compare: null,
    }
    for (const { key, index } of metricKeys) {
      entry.values[key] =
        (entry.values[key] ?? 0) + (toNumber(row[index] ?? null) ?? 0)
    }
    grouped.set(value, entry)
  })

  const rows = [...grouped.values()]
  if (isTime) {
    rows.sort((a, b) => a.key.localeCompare(b.key))
  }
  const days = isTime
    ? rows.map((row) => row.key).filter((key) => key !== "")
    : []
  const since = days[0] ?? today()
  const until = days[days.length - 1] ?? since

  return {
    query: {
      dataset: "sales",
      metrics: [],
      dimensions: [dimension],
      since,
      until,
      compare: "none",
      orderBy: null,
      limit: null,
      currency: null,
    },
    columns,
    rows,
    totals: Object.fromEntries(
      metricKeys.map(({ key }) => [
        key,
        rows.reduce((sum, row) => sum + (row.values[key] ?? 0), 0),
      ])
    ),
    compare_totals: null,
    range: {
      since,
      until,
      compare_since: null,
      compare_until: null,
      timezone: "UTC",
    },
    currency_code: "",
    unconverted_orders: 0,
    source: "rollups",
    rebuilding: false,
    filling: false,
    pending_timezone: null,
    progress: null,
    truncated: result.truncated,
  }
}
