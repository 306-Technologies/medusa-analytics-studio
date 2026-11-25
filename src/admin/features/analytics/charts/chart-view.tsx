import type { ReportResult } from "../types"
import { metricColumn } from "./data"
import { resolveChart } from "./registry"
import { ChartEmpty } from "./shared/chart-empty"

type Props = {
  result: ReportResult
  chartId: string
  metric?: string
  height?: number
  compact?: boolean
}

export const ChartView = ({
  result,
  chartId,
  metric,
  height = 280,
  compact = false,
}: Props) => {
  const chart = resolveChart(chartId, result)
  const column = metricColumn(result, metric)

  if (!column) {
    return <ChartEmpty>Nothing to draw.</ChartEmpty>
  }

  const fit = chart.fits(result)
  if (!fit.ok) {
    return <ChartEmpty>{fit.reason}</ChartEmpty>
  }

  const Chart = chart.component
  return (
    <Chart result={result} column={column} height={height} compact={compact} />
  )
}
