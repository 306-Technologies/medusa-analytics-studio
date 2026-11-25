import { needsSteps } from "../data"
import type { ChartDefinition } from "../types"
import { WaterfallChartView } from "./waterfall-chart"

export const waterfallChart = {
  id: "waterfall",
  label: "Waterfall",
  category: "bars",
  isTable: false,
  fits: needsSteps,
  component: WaterfallChartView,
} satisfies ChartDefinition
