import { needsOneDimension } from "../data"
import type { ChartDefinition } from "../types"
import { RankedBarsChartView } from "./ranked-bars-chart"

export const rankedBarsChart = {
  id: "ranked-bars",
  label: "Ranked bars",
  category: "bars",
  isTable: false,
  fits: needsOneDimension,
  component: RankedBarsChartView,
} satisfies ChartDefinition
