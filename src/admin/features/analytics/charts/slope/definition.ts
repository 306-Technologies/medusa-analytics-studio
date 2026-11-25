import { allOf, needsComparison, needsOneDimension } from "../data"
import type { ChartDefinition } from "../types"
import { SlopeChartView } from "./slope-chart"

export const slopeChart = {
  id: "slope",
  label: "Rank then and now",
  category: "flow",
  isTable: false,
  fits: allOf(needsOneDimension, needsComparison),
  component: SlopeChartView,
} satisfies ChartDefinition
