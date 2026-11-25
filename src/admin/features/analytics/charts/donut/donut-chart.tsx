import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts"

import { formatPercent } from "../../format"
import { metricPrinter, toSlices } from "../data"
import { ChartEmpty } from "../shared/chart-empty"
import { useHighlight } from "../shared/use-highlight"
import { CHART, GLOW_TRANSITION, litFilter } from "../theme/tokens"
import type { ChartProps } from "../types"

export const DonutChartView = ({
  result,
  column,
  height,
  compact,
}: ChartProps) => {
  const print = metricPrinter(result, column)
  const slices = toSlices(result, column)
  const total = slices.reduce((sum, slice) => sum + slice.value, 0)
  const highlight = useHighlight(0)

  if (!slices.length || total <= 0) {
    return <ChartEmpty>No data for this period.</ChartEmpty>
  }

  const lead = slices[highlight.active] ?? slices[0]

  return (
    <div className="flex items-center gap-x-6" style={{ height }}>
      <div
        className="relative h-full flex-1"
        style={{ minWidth: 140, maxWidth: height }}
      >
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={slices}
              dataKey="value"
              nameKey="name"
              innerRadius="74%"
              outerRadius="94%"
              paddingAngle={3}
              cornerRadius={4}
              stroke="none"
              startAngle={90}
              endAngle={-270}
              isAnimationActive={false}
              onMouseEnter={(_, index) => highlight.enter(index)}
              onMouseLeave={highlight.leave}
            >
              {slices.map((slice, index) => (
                <Cell
                  key={slice.name}
                  fill={slice.color}
                  style={{
                    filter: litFilter(slice.color, index === highlight.active),
                    transition: `filter ${GLOW_TRANSITION}`,
                  }}
                />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span
            className="font-medium tabular-nums"
            style={{
              fontSize: compact ? 22 : 26,
              lineHeight: "34px",
              color: CHART.fgBase,
            }}
          >
            {formatPercent(lead.value / total)}
          </span>
          <span
            className="max-w-[70%] truncate text-[11px] leading-4"
            style={{ color: CHART.fgMuted }}
          >
            {lead.name}
          </span>
          <span
            className="max-w-[70%] truncate text-xs font-medium tabular-nums"
            style={{ color: CHART.fgTitle }}
          >
            {print(lead.value)}
          </span>
        </div>
      </div>
      <ul className="flex flex-1 flex-col gap-y-3">
        {slices.map((slice, index) => (
          <li
            key={slice.name}
            className="flex items-center gap-x-2"
            onMouseEnter={() => highlight.enter(index)}
            onMouseLeave={highlight.leave}
          >
            <span
              aria-hidden
              className="size-2 shrink-0 rounded-full"
              style={{ background: slice.color }}
            />
            <span className="truncate text-xs" style={{ color: CHART.fgTitle }}>
              {slice.name}
            </span>
            <span
              className="ml-auto pl-2 text-xs font-medium tabular-nums"
              style={{ color: CHART.fgBase }}
            >
              {print(slice.value, compact)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
