import { needsOneDimension } from "../data"
import type { ChartDefinition } from "../types"
import { LollipopChartView } from "./lollipop-chart"

export const lollipopChart = {
  id: "lollipop",
  label: "Lollipop",
  category: "bars",
  isTable: false,
  fits: needsOneDimension,
  component: LollipopChartView,
} satisfies ChartDefinition
