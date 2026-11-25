import type { AnalyticsReportRecord } from "../../modules/analytics-workspace/service"
import {
  type ReportKind,
  type SavedReport,
  type SqlChartColumns,
  VISUALIZATION_KEYS,
  type Visualization,
} from "../../shared/analytics/types"

export const toVisualization = (value: string): Visualization =>
  VISUALIZATION_KEYS.find((key) => key === value) ?? "table"

export const toReportKind = (value: unknown): ReportKind =>
  value === "sql" ? "sql" : "query"

const isColumnIndex = (value: unknown): value is number =>
  typeof value === "number" && Number.isInteger(value) && value >= 0

export const toSqlChartColumns = (value: unknown): SqlChartColumns | null => {
  if (typeof value !== "object" || value === null) {
    return null
  }
  const label = "label" in value ? value.label : null
  const values = "values" in value ? value.values : null
  if (!Array.isArray(values) || !values.every(isColumnIndex)) {
    return null
  }
  return {
    label: isColumnIndex(label) ? label : null,
    values: values.filter(isColumnIndex),
  }
}

export const toSavedReport = (record: AnalyticsReportRecord): SavedReport => {
  const kind = toReportKind(record.kind)
  return {
    id: record.id,
    name: record.name,
    description: record.description,
    kind,
    query: record.query,
    visualization: toVisualization(record.visualization),
    chart: kind === "sql" ? toSqlChartColumns(record.chart) : null,
  }
}
