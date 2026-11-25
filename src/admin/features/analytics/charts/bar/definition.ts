import { needsDimension } from "../data"
import type { ChartDefinition } from "../types"
import { BarChartView } from "./bar-chart"

export const barChart = {
  id: "bar",
  label: "Columns",
  category: "bars",
  isTable: false,
  fits: needsDimension,
  component: BarChartView,
} satisfies ChartDefinition
