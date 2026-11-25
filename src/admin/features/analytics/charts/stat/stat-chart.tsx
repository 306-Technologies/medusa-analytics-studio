import { Sparkline } from "../../components/sparkline"
import { metricPrinter, sparkValues } from "../data"
import { changeText } from "../shared/chart-headline"
import { CHART, metricAccent } from "../theme/tokens"
import type { ChartProps } from "../types"

export const StatChartView = ({ result, column, compact }: ChartProps) => {
  const print = metricPrinter(result, column)
  const spark = sparkValues(result, column)
  const accent = metricAccent(column.key)
  const total = result.totals[column.key] ?? 0
  const delta = changeText(total, result.compare_totals?.[column.key])

  return (
    <div className="flex h-full flex-col justify-between gap-y-3">
      <div className="flex items-baseline justify-between gap-x-2">
        <span
          className="font-medium tabular-nums"
          style={{
            fontSize: compact ? 26 : 32,
            lineHeight: compact ? "34px" : "40px",
            color: CHART.fgBase,
          }}
        >
          {print(total)}
        </span>
        {delta ? (
          <span
            className="text-xs font-medium tabular-nums"
            style={{ color: accent }}
          >
            {delta.text}
          </span>
        ) : result.compare_totals ? (
          <span className="text-xs" style={{ color: CHART.fgMuted }}>
            No change
          </span>
        ) : null}
      </div>
      {spark.length > 1 ? (
        <Sparkline
          values={spark}
          height={compact ? 48 : 72}
          fill="fade"
          color={accent}
          glow
        />
      ) : null}
    </div>
  )
}
