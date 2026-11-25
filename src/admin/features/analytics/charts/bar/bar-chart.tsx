import { useId } from "react"
import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import { formatDimension } from "../../format"
import { isTimeDimension, metricPrinter, toCartesian } from "../data"
import { RankedBarsChartView } from "../ranked-bars/ranked-bars-chart"
import { axisTick, barCursor, chartGrid } from "../shared/chart-axes"
import { ChartEmpty } from "../shared/chart-empty"
import { ChartHeadline } from "../shared/chart-headline"
import { ChartLegend } from "../shared/chart-legend"
import { ChartTooltip } from "../shared/chart-tooltip"
import { svgId } from "../shared/svg-defs"
import { useHighlight } from "../shared/use-highlight"
import { CHART, GLOW_TRANSITION, litFilter } from "../theme/tokens"
import type { ChartProps } from "../types"

export const BarChartView = (props: ChartProps) => {
  const { result, column, height, compact } = props
  const reactId = useId()
  const [first, second] = result.query.dimensions
  const highlight = useHighlight(result.rows.length - 1)

  if (!isTimeDimension(first) && !second) {
    return <RankedBarsChartView {...props} />
  }
  if (!result.rows.length) {
    return <ChartEmpty>No data for this period.</ChartEmpty>
  }

  const { points, series } = toCartesian(result, column)
  const drawn = series.filter((entry) => !entry.dashed)
  const print = metricPrinter(result, column)
  const labelOf = (value: string) => formatDimension(first, value)
  const total = result.totals[column.key] ?? 0
  const headline = !second && isTimeDimension(first)
  const plotHeight = compact ? height - (headline ? 40 : 24) : height
  const edges =
    points.length > 1 ? [points[0].x, points[points.length - 1].x] : undefined

  return (
    <div className="flex flex-col gap-y-3">
      {headline ? (
        <ChartHeadline
          value={print(total)}
          current={total}
          previous={result.compare_totals?.[column.key]}
        />
      ) : null}
      <div style={{ height: plotHeight }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={points}
            margin={{ top: 8, right: 4, bottom: 0, left: 4 }}
            barCategoryGap="30%"
          >
            <defs>
              {drawn.map((entry, index) => (
                <linearGradient
                  key={entry.key}
                  id={svgId(reactId, `bar-${index}`)}
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop
                    offset="0%"
                    stopColor={second ? entry.color : CHART.blue}
                    stopOpacity={second ? 0.95 : 0.75}
                  />
                  <stop
                    offset="100%"
                    stopColor={second ? entry.color : CHART.violet}
                    stopOpacity={second ? 0.55 : 0.25}
                  />
                </linearGradient>
              ))}
              <linearGradient
                id={svgId(reactId, "bar-latest")}
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop offset="0%" stopColor={CHART.blue} />
                <stop offset="100%" stopColor={CHART.violet} />
              </linearGradient>
            </defs>
            {chartGrid()}
            <XAxis
              dataKey="x"
              ticks={edges}
              interval={0}
              tickFormatter={labelOf}
              tick={axisTick(true)}
              tickLine={false}
              axisLine={false}
              tickMargin={8}
            />
            <YAxis hide domain={[0, "auto"]} />
            <Tooltip
              content={
                <ChartTooltip
                  labelOf={labelOf}
                  print={print}
                  colors={Object.fromEntries(
                    drawn.map((entry) => [
                      entry.key,
                      second ? entry.color : CHART.blue,
                    ])
                  )}
                />
              }
              cursor={barCursor}
            />
            {drawn.map((entry, index) => (
              <Bar
                key={entry.key}
                dataKey={entry.key}
                name={entry.name}
                fill={`url(#${svgId(reactId, `bar-${index}`)})`}
                stackId={second ? "stack" : undefined}
                radius={second && index < drawn.length - 1 ? 0 : [5, 5, 0, 0]}
                maxBarSize={28}
                isAnimationActive={false}
                onMouseEnter={(_, pointIndex) => highlight.enter(pointIndex)}
                onMouseLeave={highlight.leave}
              >
                {second
                  ? null
                  : points.map((point, pointIndex) => {
                      const lit = pointIndex === highlight.active
                      return (
                        <Cell
                          key={String(point.x)}
                          fill={`url(#${svgId(reactId, "bar-latest")})`}
                          style={{
                            opacity: lit ? 1 : 0.5,
                            filter: litFilter(CHART.blue, lit, 8, 70),
                            transition: `opacity ${GLOW_TRANSITION}, filter ${GLOW_TRANSITION}`,
                          }}
                        />
                      )
                    })}
              </Bar>
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
      {second ? <ChartLegend items={drawn} /> : null}
    </div>
  )
}
