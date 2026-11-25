import { needsOneDimension } from "../data"
import type { ChartDefinition } from "../types"
import { ShareBarChartView } from "./share-bar-chart"

export const shareBarChart = {
  id: "share-bar",
  label: "Share bar",
  category: "share",
  isTable: false,
  fits: needsOneDimension,
  component: ShareBarChartView,
} satisfies ChartDefinition
