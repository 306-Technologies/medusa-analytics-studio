export type {
  LiveLocation,
  LiveOrder,
  LiveResponse,
  ReportColumn,
  ReportResult,
  ReportRow,
  ReportKind,
  SqlChartColumns,
  SqlColumn,
  SqlJson,
  SqlResultResponse,
  SqlView,
} from "../../../shared/analytics/types"
export type {
  Comparison,
  DimensionKey,
  MetricKey,
  ReportQuery,
  ValueFormat,
} from "../../../shared/analytics/query-language"

import type {
  ReportKind,
  SqlChartColumns,
  Visualization,
} from "../../../shared/analytics/types"

export type {
  SavedReport,
  SavedWidget,
  Visualization,
  WorkspaceResponse,
} from "../../../shared/analytics/types"

export const REPORT_CATEGORIES = [
  "Sales",
  "Orders",
  "Customers",
  "Products",
  "Custom",
] as const

export type ReportCategory = (typeof REPORT_CATEGORIES)[number]

export const isReportCategory = (value: string): value is ReportCategory =>
  REPORT_CATEGORIES.some((entry) => entry === value)

export type ReportDefinition = {
  id: string
  name: string
  category: ReportCategory
  description: string
  kind: ReportKind
  query: string
  visualization: Visualization
  chart: SqlChartColumns | null
  createdBy: "306" | "You"
}
