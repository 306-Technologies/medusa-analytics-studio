import { needsOneDimension } from "../data"
import type { ChartDefinition } from "../types"
import { WaffleChartView } from "./waffle-chart"

export const waffleChart = {
  id: "waffle",
  label: "Waffle",
  category: "share",
  isTable: false,
  fits: needsOneDimension,
  component: WaffleChartView,
} satisfies ChartDefinition
