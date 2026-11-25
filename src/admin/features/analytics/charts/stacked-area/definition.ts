import { allOf, FITS, needsTime, needsTwoDimensions } from "../data"
import type { ChartDefinition } from "../types"
import { StackedAreaChartView } from "./stacked-area-chart"

const fitsTimeAndSplit = allOf(needsTwoDimensions, needsTime)

export const stackedAreaChart = {
  id: "stacked-area",
  label: "Stacked area",
  category: "trend",
  isTable: false,
  fits: (result) =>
    fitsTimeAndSplit(result).ok
      ? FITS
      : { ok: false, reason: "Needs time and one more" },
  component: StackedAreaChartView,
} satisfies ChartDefinition
