import type { AnalyticsDashboardRecord } from "../../modules/analytics-workspace/service"
import type { SavedWidget } from "../../shared/analytics/types"
import {
  toReportKind,
  toSqlChartColumns,
  toVisualization,
} from "./analytics-report"

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null

const toSpan = (value: unknown): SavedWidget["span"] =>
  value === 1 || value === 2 || value === 3 || value === 4 ? value : 2

export const toSavedWidgets = (
  record: AnalyticsDashboardRecord | null
): SavedWidget[] | null => {
  const widgets = isRecord(record?.layout) ? record.layout.widgets : null
  if (!Array.isArray(widgets)) {
    return null
  }
  return widgets.flatMap((entry) =>
    isRecord(entry) &&
    typeof entry.id === "string" &&
    typeof entry.title === "string" &&
    typeof entry.query === "string" &&
    typeof entry.visualization === "string"
      ? [
          {
            id: entry.id,
            title: entry.title,
            kind: toReportKind(entry.kind),
            query: entry.query,
            visualization: toVisualization(entry.visualization),
            chart:
              toReportKind(entry.kind) === "sql"
                ? toSqlChartColumns(entry.chart)
                : null,
            span: toSpan(entry.span),
          },
        ]
      : []
  )
}
