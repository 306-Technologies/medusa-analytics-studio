import type {
  SqlChartColumns,
  SqlColumn,
  SqlJson,
  Visualization,
} from "./types"

export type SqlChartSettings = {
  kind: Visualization
  label: number | null
  /** The column drawn first. Older saved reports may list a few. */
  values: number[]
}

/** bigint and numeric arrive as text so no precision is lost. */
export const toNumber = (value: SqlJson): number | null => {
  if (typeof value === "number") {
    return value
  }
  if (typeof value === "string" && value.trim() !== "") {
    const number = Number(value)
    return Number.isFinite(number) ? number : null
  }
  return null
}

export const defaultChart = (columns: SqlColumn[]): SqlChartSettings => {
  const indexOf = (kind: SqlColumn["kind"]) =>
    columns.findIndex((column) => column.kind === kind)
  const date = indexOf("date")
  const text = indexOf("text")
  const label = date >= 0 ? date : text >= 0 ? text : null
  const values = columns
    .map((column, index) => ({ column, index }))
    .filter(({ column, index }) => column.kind === "number" && index !== label)
    .map(({ index }) => index)
    .slice(0, 1)
  return {
    kind: values.length === 0 ? "table" : date >= 0 ? "line" : "bar",
    label,
    values,
  }
}

export const fitChart = (
  settings: SqlChartSettings,
  columns: SqlColumn[]
): SqlChartSettings => {
  const inRange = (index: number) => index >= 0 && index < columns.length
  const values = settings.values.filter(
    (index) => inRange(index) && columns[index]?.kind === "number"
  )
  const label =
    settings.label !== null && inRange(settings.label) ? settings.label : null
  if (values.length === 0) {
    return defaultChart(columns)
  }
  return { ...settings, label, values }
}

export const seriesKey = (index: number) => `c${index}`

const numberFormat = new Intl.NumberFormat(undefined, {
  maximumFractionDigits: 6,
})

export const cellText = (value: SqlJson, column?: SqlColumn): string => {
  if (value === null) {
    return "null"
  }
  if (typeof value === "object") {
    return JSON.stringify(value)
  }
  if (column?.kind === "number") {
    const number = toNumber(value)
    return number !== null && Number.isSafeInteger(Math.trunc(number))
      ? numberFormat.format(number)
      : String(value)
  }
  return String(value)
}

export const isColumnIndex = (value: unknown): value is number =>
  typeof value === "number" && Number.isInteger(value) && value >= 0

export const toSavedChart = (
  settings: SqlChartSettings
): { visualization: Visualization; chart: SqlChartColumns } => ({
  visualization: settings.kind,
  chart: { label: settings.label, values: settings.values },
})

export const fromSavedChart = (
  visualization: Visualization,
  chart: SqlChartColumns | null
): SqlChartSettings | null =>
  chart
    ? { kind: visualization, label: chart.label, values: chart.values }
    : null

export const starterSql = (view: string) =>
  `select *\nfrom reporting.${view}\nlimit 100`
