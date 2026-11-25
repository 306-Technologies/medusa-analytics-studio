import { allOf, needsOneDimension, needsTime } from "../data"
import type { ChartDefinition } from "../types"
import { AreaChartView } from "./area-chart"

export const areaChart = {
  id: "area",
  label: "Area with total",
  category: "trend",
  isTable: false,
  fits: allOf(needsTime, needsOneDimension),
  component: AreaChartView,
} satisfies ChartDefinition
