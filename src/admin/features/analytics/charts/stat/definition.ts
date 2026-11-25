import { FITS } from "../data"
import type { ChartDefinition } from "../types"
import { StatChartView } from "./stat-chart"

export const statChart = {
  id: "stat",
  label: "Single number",
  category: "list",
  isTable: false,
  fits: () => FITS,
  component: StatChartView,
} satisfies ChartDefinition
