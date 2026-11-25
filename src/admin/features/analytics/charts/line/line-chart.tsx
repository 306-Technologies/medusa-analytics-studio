import { useId } from "react"
import {
  Line,
  LineChart,
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
import { GlowFilter, svgId } from "../shared/svg-defs"
import { CHART } from "../theme/tokens"
import type { ChartProps } from "../types"

type EndDotProps = { cx?: number; cy?: number; index?: number }

export const LineChartView = ({
  result,
  column,
  height,
  compact,
}: ChartProps) => {
  const reactId = useId()
  if (!result.rows.length) {
    return <ChartEmpty>No data for this period.</ChartEmpty>
  }

  const { points, series, axis, split } = toCartesian(result, column)
  const print = metricPrinter(result, column)
  const labelOf = (value: string) => formatDimension(axis, value)
  const last = points.length - 1
  const drawn = series.filter((entry) => !entry.dashed)
  const legend = split || series.length > 1

  return (
    <div className="flex flex-col gap-y-3">
      <div style={{ height: legend && compact ? height - 24 : height }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={points}
            margin={{ top: 8, right: 8, bottom: 0, left: 8 }}
          >
            <defs>
              {drawn.map((entry, index) => (
                <GlowFilter
                  key={entry.key}
                  id={svgId(reactId, `glow-${index}`)}
                  color={entry.color}
                  blur={5}
                  opacity={0.55}
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
                    series.map((entry) => [
                      entry.key,
                      entry.dashed ? CHART.fgMuted : entry.color,
                    ])
                  )}
                />
              }
              cursor={lineCursor}
            />
            {series.map((entry) => {
              const index = drawn.indexOf(entry)
              return (
                <Line
                  key={entry.key}
                  type="monotone"
                  dataKey={entry.key}
                  name={entry.name}
                  stroke={entry.dashed ? CHART.fgMuted : entry.color}
                  strokeWidth={entry.dashed ? 1.5 : 2}
                  strokeDasharray={entry.dashed ? "4 4" : undefined}
                  filter={
                    entry.dashed
                      ? undefined
                      : `url(#${svgId(reactId, `glow-${index}`)})`
                  }
                  dot={
                    entry.dashed
                      ? false
                      : ({ cx, cy, index: pointIndex }: EndDotProps) =>
                          pointIndex === last &&
                          cx !== undefined &&
                          cy !== undefined ? (
                            <circle
                              key={`${entry.key}-end`}
                              cx={cx}
                              cy={cy}
                              r={3.5}
                              fill={entry.color}
                            />
                          ) : (
                            <g key={`${entry.key}-${pointIndex}`} />
                          )
                  }
                  activeDot={{ r: 3.5, strokeWidth: 0, fill: entry.color }}
                  isAnimationActive={false}
                />
              )
            })}
          </LineChart>
        </ResponsiveContainer>
      </div>
      {legend ? (
        <ChartLegend
          items={series.map((entry) => ({
            key: entry.key,
            name: entry.name,
            color: entry.dashed ? CHART.fgMuted : entry.color,
          }))}
        />
      ) : null}
    </div>
  )
}
