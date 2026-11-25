import type { ReportQuery, ValueFormat } from "./query-language"

export type ReportColumn = {
  key: string
  label: string
  kind: "dimension" | "metric"
  format: ValueFormat | null
}

export type ReportRow = {
  key: string
  dimensions: Record<string, string>
  values: Record<string, number>
  compare: Record<string, number> | null
}

export type ReportSource = "rollups" | "facts"

export type ReportResult = {
  query: ReportQuery
  columns: ReportColumn[]
  rows: ReportRow[]
  totals: Record<string, number>
  compare_totals: Record<string, number> | null
  range: {
    since: string
    until: string
    compare_since: string | null
    compare_until: string | null
    timezone: string
  }
  currency_code: string
  unconverted_orders: number
  source: ReportSource
  rebuilding: boolean
  filling: boolean
  pending_timezone: string | null
  progress: number | null
  truncated: boolean
}

export type LiveLocation = {
  city: string
  country_code: string
  orders: number
  sales: number
}

export type LiveOrder = {
  id: string
  display_id: number | null
  created_at: string
  total: number
  city: string
  country_code: string
}

export type LiveResponse = {
  as_of: string
  currency_code: string
  timezone: string
  filling: boolean
  today: { sales: number; orders: number; units: number }
  hours: Array<{ hour: number; sales: number; orders: number }>
  carts: { active: number; checking_out: number; purchased: number }
  customers: { new: number; returning: number }
  locations: LiveLocation[]
  recent_orders: LiveOrder[]
  top_products: Array<{ title: string; units: number; sales: number }>
}

export const VISUALIZATION_KEYS = [
  "line",
  "bar",
  "donut",
  "stat",
  "table",
  "area",
  "stacked-area",
  "ranked-bars",
  "change-bars",
  "waterfall",
  "lollipop",
  "share-bar",
  "treemap",
  "waffle",
  "heatmap",
  "calendar",
  "slope",
  "ranked-list",
  "hero",
] as const

export type Visualization = (typeof VISUALIZATION_KEYS)[number]

export type ReportKind = "query" | "sql"

export type SqlChartColumns = { label: number | null; values: number[] }

export type SavedReport = {
  id: string
  name: string
  description: string
  kind: ReportKind
  query: string
  visualization: Visualization
  chart: SqlChartColumns | null
}

export type SavedWidget = {
  id: string
  title: string
  kind: ReportKind
  query: string
  visualization: Visualization
  chart: SqlChartColumns | null
  span: 1 | 2 | 3 | 4
}

export type WorkspaceResponse = {
  reports: SavedReport[]
  dashboard: SavedWidget[] | null
  read_only: boolean
}

export type SaveReportBody = Omit<SavedReport, "id"> & { id?: string }
export type SaveReportResponse = { report: SavedReport }
export type SaveDashboardBody = { widgets: SavedWidget[] }
export type SaveDashboardResponse = { dashboard: SavedWidget[] }
export type DeleteResponse = { id: string; deleted: boolean }

export type SqlStatusResponse = {
  enabled: boolean
  reason: string | null
  facts: Pick<
    ReportResult,
    "rebuilding" | "filling" | "pending_timezone" | "progress"
  > & {
    range: { timezone: string }
  }
}

export type SqlJson =
  string | number | boolean | null | SqlJson[] | { [key: string]: SqlJson }

/** bigint and numeric arrive as strings to keep precision but are still "number". */
export type SqlColumnKind =
  "number" | "text" | "date" | "boolean" | "json" | "other"

export type SqlColumn = {
  name: string
  type: string
  kind: SqlColumnKind
}

export type SqlResultResponse = {
  columns: SqlColumn[]
  /** One array per row: column names can repeat, so not objects. */
  rows: SqlJson[][]
  row_limit: number
  truncated: boolean
  ms: number
  ran_at: string
}

export type SqlViewColumn = {
  name: string
  type: string
  comment: string | null
}

export type SqlView = {
  name: string
  comment: string | null
  enabled: boolean
  columns: SqlViewColumn[]
}

export type SqlViewsResponse = { views: SqlView[] }
