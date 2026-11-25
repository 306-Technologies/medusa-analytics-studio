import { allOf, needsComparison, needsOneDimension } from "../data"
import type { ChartDefinition } from "../types"
import { ChangeBarsChartView } from "./change-bars-chart"

export const changeBarsChart = {
  id: "change-bars",
  label: "Change vs before",
  category: "bars",
  isTable: false,
  fits: allOf(needsOneDimension, needsComparison),
  component: ChangeBarsChartView,
} satisfies ChartDefinition
