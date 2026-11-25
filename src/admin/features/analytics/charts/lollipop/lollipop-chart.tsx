import { metricPrinter, toNamed } from "../data"
import { shorten } from "../shared/chart-axes"
import { ChartEmpty } from "../shared/chart-empty"
import { useHoverTip } from "../shared/hover-tip"
import { CHART, fade, glowShadow } from "../theme/tokens"
import type { ChartProps } from "../types"

const MAX_STEMS = 12
const MAX_STEMS_COMPACT = 7
const LABEL_SPACE = 22
const VALUE_SPACE = 22

export const LollipopChartView = ({
  result,
  column,
  height,
  compact,
}: ChartProps) => {
  const rows = toNamed(result, column, compact ? MAX_STEMS_COMPACT : MAX_STEMS)
  const print = metricPrinter(result, column)
  const max = Math.max(0, ...rows.map((row) => row.value))
  const tip = useHoverTip()

  if (!rows.length || max <= 0) {
    return <ChartEmpty>No data for this period.</ChartEmpty>
  }

  const plot = height - LABEL_SPACE - VALUE_SPACE

  return (
    <div ref={tip.ref} className="relative flex flex-col" style={{ height }}>
      {[0, 1, 2].map((line) => (
        <span
          key={line}
          className="absolute inset-x-0 h-px"
          style={{
            top: VALUE_SPACE + (plot * line) / 3,
            background: CHART.grid,
          }}
        />
      ))}
      <span
        className="absolute inset-x-0 h-px"
        style={{ top: VALUE_SPACE + plot, background: CHART.grid }}
      />
      <div className="relative flex flex-1">
        {rows.map((row) => {
          const stem = (row.value / max) * plot
          return (
            <div
              key={row.key}
              className="relative flex flex-1 flex-col items-center justify-end"
              {...tip.bind({
                label: row.name,
                rows: [
                  {
                    name: column.label,
                    value: print(row.value),
                    color: CHART.pink,
                  },
                  ...(row.previous === null
                    ? []
                    : [
                        {
                          name: "Before",
                          value: print(row.previous),
                          color: CHART.fgMuted,
                        },
                      ]),
                ],
              })}
            >
              <span
                className="absolute text-xs font-medium tabular-nums"
                style={{ bottom: stem + 12, color: CHART.fgBase }}
              >
                {print(row.value, true)}
              </span>
              <span
                className="size-3 shrink-0 rounded-full"
                style={{
                  background: CHART.pink,
                  boxShadow: glowShadow(CHART.pink, 10, 70),
                }}
              />
              <span
                className="w-0.5 shrink-0"
                style={{
                  height: Math.max(stem - 6, 0),
                  background: `linear-gradient(to bottom, ${CHART.pink}, ${fade(CHART.pink, 0)})`,
                }}
              />
            </div>
          )
        })}
      </div>
      <div className="flex pt-1.5" style={{ height: LABEL_SPACE }}>
        {rows.map((row) => (
          <span
            key={row.key}
            className="flex-1 truncate text-center text-[11px] leading-4"
            style={{ color: CHART.fgMuted }}
          >
            {shorten(row.name, compact ? 8 : 14)}
          </span>
        ))}
      </div>
      {tip.layer}
    </div>
  )
}
