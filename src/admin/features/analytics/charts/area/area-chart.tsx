import { useId } from "react"
import {
  Area,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import { formatDimension } from "../../format"
import { metricPrinter, toCartesian } from "../data"
import { axisTick, chartGrid, lineCursor } from "../shared/chart-axes"
import { ChartEmpty } from "../shared/chart-empty"
import { ChartHeadline } from "../shared/chart-headline"
import { ChartTooltip } from "../shared/chart-tooltip"
import {
  FadeGradient,
  GlowFilter,
  SideGradient,
  svgId,
} from "../shared/svg-defs"
import { CHART } from "../theme/tokens"
import type { ChartProps } from "../types"

export const AreaChartView = ({
  result,
  column,
  height,
  compact,
}: ChartProps) => {
  const reactId = useId()
  if (!result.rows.length) {
    return <ChartEmpty>No data for this period.</ChartEmpty>
  }

  const { points, axis } = toCartesian(result, column)
  const print = metricPrinter(result, column)
  const labelOf = (value: string) => formatDimension(axis, value)
  const fill = svgId(reactId, "fill")
  const stroke = svgId(reactId, "stroke")
  const glow = svgId(reactId, "glow")
  const total = result.totals[column.key] ?? 0

  return (
    <div className="flex flex-col gap-y-3">
      <ChartHeadline
        value={print(total)}
        current={total}
        previous={result.compare_totals?.[column.key]}
      />
      <div style={{ height: compact ? height - 40 : height }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={points}
            margin={{ top: 8, right: 4, bottom: 0, left: 4 }}
          >
            <defs>
              <FadeGradient
                id={fill}
                from={CHART.blue}
                to={CHART.violet}
                opacity={0.38}
              />
              <SideGradient id={stroke} from={CHART.blue} to={CHART.violet} />
              <GlowFilter id={glow} color={CHART.blue} />
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
                  colors={{ current: CHART.blue, previous: CHART.fgMuted }}
                />
              }
              cursor={lineCursor}
            />
            {result.compare_totals ? (
              <Line
                type="monotone"
                dataKey="previous"
                name="Comparison"
                stroke={CHART.fgMuted}
                strokeWidth={1.5}
                strokeDasharray="4 4"
                dot={false}
                activeDot={false}
                isAnimationActive={false}
              />
            ) : null}
            <Area
              type="monotone"
              dataKey="current"
              name={column.label}
              stroke="none"
              fill={`url(#${fill})`}
              tooltipType="none"
              activeDot={false}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="current"
              name={column.label}
              stroke={`url(#${stroke})`}
              strokeWidth={2.5}
              filter={`url(#${glow})`}
              dot={false}
              activeDot={{
                r: 4,
                fill: CHART.fgBase,
                stroke: CHART.blue,
                strokeWidth: 3,
              }}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
