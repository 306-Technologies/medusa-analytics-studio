import { needsDays } from "../data"
import type { ChartDefinition } from "../types"
import { CalendarChartView } from "./calendar-chart"

export const calendarChart = {
  id: "calendar",
  label: "Calendar",
  category: "pattern",
  isTable: false,
  fits: needsDays,
  component: CalendarChartView,
} satisfies ChartDefinition
