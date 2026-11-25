import type { ComponentType } from "react"

import type { ReportColumn, ReportResult, Visualization } from "../types"

export const CHART_CATEGORIES = {
  trend: "Trends over time",
  bars: "Bars",
  share: "Share of a whole",
  pattern: "Patterns and distribution",
  flow: "Flow and movement",
  list: "Lists and numbers",
} as const

export type ChartCategory = keyof typeof CHART_CATEGORIES

export type ChartFit = { ok: true } | { ok: false; reason: string }

export type ChartProps = {
  result: ReportResult
  column: ReportColumn
  height: number
  compact: boolean
}

export type ChartDefinition = {
  id: Visualization
  label: string
  category: ChartCategory
  isTable: boolean
  fits: (result: ReportResult) => ChartFit
  component: ComponentType<ChartProps>
}
