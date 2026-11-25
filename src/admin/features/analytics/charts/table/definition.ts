import { FITS } from "../data"
import type { ChartDefinition } from "../types"
import { TableChartView } from "./table-chart"

export const tableChart = {
  id: "table",
  label: "Table only",
  category: "list",
  isTable: true,
  fits: () => FITS,
  component: TableChartView,
} satisfies ChartDefinition
