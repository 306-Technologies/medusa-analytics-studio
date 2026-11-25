import { useId } from "react"
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import { formatDimension } from "../../format"
import { metricPrinter, toCartesian } from "../data"
import { axisTick, chartGrid, lineCursor } from "../shared/chart-axes"
import { ChartEmpty } from "../shared/chart-empty"
import { ChartLegend } from "../shared/chart-legend"
import { ChartTooltip } from "../shared/chart-tooltip"
import { FadeGradient, svgId } from "../shared/svg-defs"
import type { ChartProps } from "../types"

export const StackedAreaChartView = ({
  result,
  column,
  height,
  compact,
}: ChartProps) => {
  const reactId = useId()
  if (!result.rows.length) {
    return <ChartEmpty>No data for this period.</ChartEmpty>
  }

  const { points, series, axis } = toCartesian(result, column)
  const print = metricPrinter(result, column)
  const labelOf = (value: string) => formatDimension(axis, value)

  return (
    <div className="flex flex-col gap-y-3">
      <div style={{ height: compact ? height - 24 : height }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={points}
            margin={{ top: 8, right: 4, bottom: 0, left: 4 }}
          >
            <defs>
              {series.map((entry, index) => (
                <FadeGradient
                  key={entry.key}
                  id={svgId(reactId, `layer-${index}`)}
                  from={entry.color}
                  opacity={0.45}
                />
              ))}
            </defs>
            {chartGrid()}
            <XAxis
              dataKey="x"
              tickFormatter={labelOf}
              tick={axisTick(true)}
              tickLine={false}
              axisLine={false}
              minTickGap={48}
              tickMargin={8}
            />
            <YAxis hide domain={[0, "auto"]} />
            <Tooltip
              content={
                <ChartTooltip
                  labelOf={labelOf}
                  print={print}
                  colors={Object.fromEntries(
                    series.map((entry) => [entry.key, entry.color])
                  )}
                />
              }
              cursor={lineCursor}
            />
            {series.map((entry, index) => (
              <Area
                key={entry.key}
                type="monotone"
                dataKey={entry.key}
                name={entry.name}
                stackId="stack"
                stroke={entry.color}
                strokeWidth={1.5}
                fill={`url(#${svgId(reactId, `layer-${index}`)})`}
                activeDot={{ r: 3, strokeWidth: 0, fill: entry.color }}
                isAnimationActive={false}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <ChartLegend items={series} />
    </div>
  )
}
