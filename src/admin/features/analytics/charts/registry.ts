import type { ReportResult, Visualization } from "../types"
import { areaChart } from "./area/definition"
import { barChart } from "./bar/definition"
import { calendarChart } from "./calendar/definition"
import { changeBarsChart } from "./change-bars/definition"
import { donutChart } from "./donut/definition"
import { heatmapChart } from "./heatmap/definition"
import { heroChart } from "./hero/definition"
import { lineChart } from "./line/definition"
import { lollipopChart } from "./lollipop/definition"
import { rankedBarsChart } from "./ranked-bars/definition"
import { rankedListChart } from "./ranked-list/definition"
import { shareBarChart } from "./share-bar/definition"
import { slopeChart } from "./slope/definition"
import { stackedAreaChart } from "./stacked-area/definition"
import { statChart } from "./stat/definition"
import { tableChart } from "./table/definition"
import { treemapChart } from "./treemap/definition"
import { waffleChart } from "./waffle/definition"
import { waterfallChart } from "./waterfall/definition"
import { CHART_CATEGORIES, type ChartDefinition, type ChartFit } from "./types"

const BY_ID = {
  area: areaChart,
  line: lineChart,
  "stacked-area": stackedAreaChart,
  stat: statChart,
  bar: barChart,
  "ranked-bars": rankedBarsChart,
  "change-bars": changeBarsChart,
  waterfall: waterfallChart,
  lollipop: lollipopChart,
  donut: donutChart,
  "share-bar": shareBarChart,
  treemap: treemapChart,
  waffle: waffleChart,
  heatmap: heatmapChart,
  calendar: calendarChart,
  slope: slopeChart,
  "ranked-list": rankedListChart,
  hero: heroChart,
  table: tableChart,
} satisfies { [Id in Visualization]: ChartDefinition & { id: Id } }

export const CHARTS: ChartDefinition[] = Object.values(BY_ID)

// Own keys only: `in` would also accept "constructor" and other inherited names.
export const isChartId = (value: string): value is Visualization =>
  Object.prototype.hasOwnProperty.call(BY_ID, value)

export const chartFor = (id: string): ChartDefinition =>
  isChartId(id) ? BY_ID[id] : tableChart

export const resolveChart = (
  id: string,
  result: ReportResult
): ChartDefinition => {
  const chart = chartFor(id)
  return result.query.dimensions.length === 0 && !chart.fits(result).ok
    ? statChart
    : chart
}

export const chartsFor = (
  result: ReportResult
): Array<{ chart: ChartDefinition; fit: ChartFit }> =>
  CHARTS.map((chart) => ({ chart, fit: chart.fits(result) }))

export const CHART_GROUPS: Array<{ label: string; charts: ChartDefinition[] }> =
  Object.entries(CHART_CATEGORIES).map(([category, label]) => ({
    label,
    charts: CHARTS.filter((chart) => chart.category === category),
  }))
