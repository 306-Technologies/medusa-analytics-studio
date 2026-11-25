import { formatPercent } from "../../format"
import { metricPrinter, toRanked } from "../data"
import { ChartEmpty } from "../shared/chart-empty"
import { useHoverTip } from "../shared/hover-tip"
import { CHART, glowColor } from "../theme/tokens"
import type { ChartProps } from "../types"

const SQUARES = 100

export const WaffleChartView = ({
  result,
  column,
  height,
  compact,
}: ChartProps) => {
  const print = metricPrinter(result, column)
  const [lead, ...rest] = toRanked(result, column)
  const others = rest.reduce((sum, row) => sum + row.value, 0)
  const total = (lead?.value ?? 0) + others
  const tip = useHoverTip()

  if (!lead || total <= 0) {
    return <ChartEmpty>No data for this period.</ChartEmpty>
  }

  const share = lead.value / total
  const filled = Math.round(share * SQUARES)
  const square = Math.max(Math.min(Math.floor((height - 9 * 4) / 10), 18), 8)

  return (
    <div
      ref={tip.ref}
      className="relative flex items-center gap-x-8"
      style={{ minHeight: height }}
    >
      <div
        className="grid shrink-0 grid-cols-10 gap-1"
        role="img"
        aria-label={`${formatPercent(share)} ${lead.name}`}
      >
        {Array.from({ length: SQUARES }, (_, index) => (
          <span
            key={index}
            {...tip.bind(
              index < filled
                ? {
                    label: lead.name,
                    rows: [
                      {
                        name: column.label,
                        value: print(lead.value),
                        color: CHART.pink,
                      },
                      { name: "Share", value: formatPercent(share) },
                    ],
                  }
                : {
                    label: rest.length === 1 ? rest[0].name : "Everything else",
                    rows: [
                      { name: column.label, value: print(others) },
                      { name: "Share", value: formatPercent(1 - share) },
                    ],
                  }
            )}
            className="rounded-[3px]"
            style={{
              width: square,
              height: square,
              background:
                index < filled
                  ? `linear-gradient(to bottom, ${CHART.pink}, ${CHART.violet})`
                  : CHART.empty,
            }}
          />
        ))}
      </div>
      <div className="flex min-w-0 flex-col gap-y-2">
        <span
          className="font-normal tabular-nums"
          style={{
            fontSize: compact ? 48 : 60,
            lineHeight: 1,
            background: `linear-gradient(to right, ${CHART.pink}, ${CHART.violet})`,
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            color: "transparent",
            filter: `drop-shadow(0 0 18px ${glowColor(CHART.pink, 45)})`,
          }}
        >
          {formatPercent(share)}
        </span>
        <span className="text-[15px] leading-6" style={{ color: CHART.fgBase }}>
          {lead.name}
        </span>
        <span
          className="text-[13px] leading-5"
          style={{ color: CHART.fgTitle }}
        >
          {print(lead.value)} of {print(total)} {column.label.toLowerCase()}
        </span>
      </div>
      {tip.layer}
    </div>
  )
}
