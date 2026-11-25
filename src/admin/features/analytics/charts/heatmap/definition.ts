import { needsTwoDimensions } from "../data"
import type { ChartDefinition } from "../types"
import { HeatmapChartView } from "./heatmap-chart"

export const heatmapChart = {
  id: "heatmap",
  label: "Heatmap",
  category: "pattern",
  isTable: false,
  fits: needsTwoDimensions,
  component: HeatmapChartView,
} satisfies ChartDefinition
