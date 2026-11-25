import { needsDimension } from "../data"
import type { ChartDefinition } from "../types"
import { DonutChartView } from "./donut-chart"

export const donutChart = {
  id: "donut",
  label: "Donut",
  category: "share",
  isTable: false,
  fits: needsDimension,
  component: DonutChartView,
} satisfies ChartDefinition
