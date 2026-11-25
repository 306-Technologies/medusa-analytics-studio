import { needsOneDimension } from "../data"
import type { ChartDefinition } from "../types"
import { TreemapChartView } from "./treemap-chart"

export const treemapChart = {
  id: "treemap",
  label: "Treemap",
  category: "share",
  isTable: false,
  fits: needsOneDimension,
  component: TreemapChartView,
} satisfies ChartDefinition
