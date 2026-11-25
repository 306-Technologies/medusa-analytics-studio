import { metricPrinter, toRanked } from "../data"
import { ChartEmpty } from "../shared/chart-empty"
import { useHoverTip } from "../shared/hover-tip"
import { useHighlight } from "../shared/use-highlight"
import { CHART, GLOW_TRANSITION, litShadow } from "../theme/tokens"
import type { ChartProps } from "../types"

const MAX_ROWS = 10
const MAX_ROWS_COMPACT = 5

export const RankedBarsChartView = ({
  result,
  column,
  compact,
}: ChartProps) => {
  const rows = toRanked(result, column, compact ? MAX_ROWS_COMPACT : MAX_ROWS)
  const print = metricPrinter(result, column)
  const max = Math.max(0, ...rows.map((row) => row.value))
  const highlight = useHighlight(0)
  const tip = useHoverTip()

  if (!rows.length || max <= 0) {
    return <ChartEmpty>No data for this period.</ChartEmpty>
  }

  return (
    <div ref={tip.ref} className="relative">
      <ul className="flex flex-col justify-between gap-y-4 py-1">
        {rows.map((row, index) => (
          <li
            key={row.key}
            className="flex items-center gap-x-4"
            {...tip.bind(
              {
                label: row.name,
                rows: [
                  {
                    name: column.label,
                    value: print(row.value),
                    color: CHART.cyan,
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
              },
              { enter: () => highlight.enter(index), leave: highlight.leave }
            )}
          >
            <span
              className="w-28 shrink-0 truncate text-[13px] leading-[18px] sm:w-36"
              style={{ color: CHART.fgBase }}
            >
              {row.name}
            </span>
            <span
              className="relative h-2.5 flex-1 rounded-full"
              style={{ background: CHART.track }}
            >
              <span
                className="absolute inset-y-0 left-0 rounded-full"
                style={{
                  width: `${Math.max((row.value / max) * 100, 1)}%`,
                  background: `linear-gradient(to right, ${CHART.blue}, ${CHART.cyan})`,
                  boxShadow: litShadow(
                    CHART.cyan,
                    index === highlight.active,
                    14,
                    60
                  ),
                  transition: `box-shadow ${GLOW_TRANSITION}`,
                }}
              />
            </span>
            <span
              className="w-20 shrink-0 text-right text-[13px] font-medium leading-[18px] tabular-nums"
              style={{ color: CHART.fgBase }}
            >
              {print(row.value, compact)}
            </span>
          </li>
        ))}
      </ul>
      {tip.layer}
    </div>
  )
}
