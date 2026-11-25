import { needsOneDimension } from "../data"
import type { ChartDefinition } from "../types"
import { RankedListChartView } from "./ranked-list-chart"

export const rankedListChart = {
  id: "ranked-list",
  label: "Ranked list",
  category: "list",
  isTable: false,
  fits: needsOneDimension,
  component: RankedListChartView,
} satisfies ChartDefinition
