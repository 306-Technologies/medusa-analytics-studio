import { needsTime } from "../data"
import type { ChartDefinition } from "../types"
import { LineChartView } from "./line-chart"

export const lineChart = {
  id: "line",
  label: "Lines",
  category: "trend",
  isTable: false,
  fits: needsTime,
  component: LineChartView,
} satisfies ChartDefinition
