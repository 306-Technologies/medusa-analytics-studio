import { formatPercent } from "../../format"
import { metricPrinter, toSlices } from "../data"
import { ChartEmpty } from "../shared/chart-empty"
import { useHoverTip } from "../shared/hover-tip"
import { useHighlight } from "../shared/use-highlight"
import { CHART, fade, GLOW_TRANSITION, litShadow } from "../theme/tokens"
import type { ChartProps } from "../types"

const MAX_PARTS = 5
// Below this share a part is too narrow for its percentage.
const LABEL_MIN_SHARE = 0.08

export const ShareBarChartView = ({ result, column, compact }: ChartProps) => {
  const print = metricPrinter(result, column)
  const parts = toSlices(result, column, MAX_PARTS)
  const total = parts.reduce((sum, part) => sum + part.value, 0)
  const highlight = useHighlight(0)
  const tip = useHoverTip()

  if (!parts.length || total <= 0) {
    return <ChartEmpty>No data for this period.</ChartEmpty>
  }

  return (
    <div ref={tip.ref} className="relative flex flex-col gap-y-8 pt-4">
      <div className="flex h-10 gap-x-1">
        {parts.map((part, index) => {
          const share = part.value / total
          const first = index === 0
          const last = index === parts.length - 1
          return (
            <div
              key={part.name}
              className="flex items-center overflow-hidden px-3"
              {...tip.bind(
                {
                  label: part.name,
                  rows: [
                    {
                      name: column.label,
                      value: print(part.value),
                      color: part.color,
                    },
                    { name: "Share", value: formatPercent(share) },
                  ],
                },
                { enter: () => highlight.enter(index), leave: highlight.leave }
              )}
              style={{
                flexGrow: share,
                flexBasis: 0,
                minWidth: 4,
                borderRadius: `${first ? 10 : 3}px ${last ? 10 : 3}px ${last ? 10 : 3}px ${first ? 10 : 3}px`,
                background: `linear-gradient(to bottom, ${part.color}, ${fade(part.color, 60)})`,
                boxShadow: litShadow(
                  part.color,
                  index === highlight.active,
                  18,
                  50
                ),
                transition: `box-shadow ${GLOW_TRANSITION}`,
              }}
            >
              {share >= LABEL_MIN_SHARE ? (
                <span
                  className="text-sm font-medium"
                  style={{ color: CHART.fgOnFill }}
                >
                  {formatPercent(share)}
                </span>
              ) : null}
            </div>
          )
        })}
      </div>
      <ul className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {parts.slice(0, compact ? 4 : MAX_PARTS + 1).map((part, index) => (
          <li
            key={part.name}
            className="flex min-w-0 flex-col gap-y-1"
            onMouseEnter={() => highlight.enter(index)}
            onMouseLeave={highlight.leave}
          >
            <span className="flex items-center gap-x-2">
              <span
                aria-hidden
                className="size-2 shrink-0 rounded-full"
                style={{ background: part.color }}
              />
              <span
                className="truncate text-xs"
                style={{ color: CHART.fgTitle }}
              >
                {part.name}
              </span>
            </span>
            <span
              className="pl-4 text-xl font-medium tabular-nums"
              style={{ color: CHART.fgBase }}
            >
              {print(part.value, true)}
            </span>
          </li>
        ))}
      </ul>
      {tip.layer}
    </div>
  )
}
