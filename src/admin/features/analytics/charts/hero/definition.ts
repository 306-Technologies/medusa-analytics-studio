import { FITS } from "../data"
import type { ChartDefinition } from "../types"
import { HeroChartView } from "./hero-chart"

export const heroChart = {
  id: "hero",
  label: "Hero number",
  category: "list",
  isTable: false,
  fits: () => FITS,
  component: HeroChartView,
} satisfies ChartDefinition
