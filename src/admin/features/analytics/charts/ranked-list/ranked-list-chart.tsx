import { formatValue } from "../../format"
import { metricPrinter, toRanked } from "../data"
import { ChartEmpty } from "../shared/chart-empty"
import { useHoverTip } from "../shared/hover-tip"
import { useHighlight } from "../shared/use-highlight"
import { CHART, GLOW_TRANSITION, litShadow } from "../theme/tokens"
import type { ChartProps } from "../types"

const MAX_ROWS = 8
const MAX_ROWS_COMPACT = 4

const PAIRS: Array<[string, string]> = [
  [CHART.blue, CHART.violet],
  [CHART.violet, CHART.pink],
  [CHART.pink, CHART.orange],
  [CHART.cyan, CHART.blue],
]

const initials = (name: string) =>
  name
    .split(/[\s·-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("") || "?"

export const RankedListChartView = ({
  result,
  column,
  compact,
}: ChartProps) => {
  const rows = toRanked(result, column, compact ? MAX_ROWS_COMPACT : MAX_ROWS)
  const print = metricPrinter(result, column)
  const detail = result.columns.find(
    (entry) => entry.kind === "metric" && entry.key !== column.key
  )
  const detailOf = (key: string) => {
    const row = result.rows.find((entry) => entry.key === key)
    return detail && row
      ? formatValue(
          row.values[detail.key] ?? 0,
          detail.format,
          result.currency_code
        )
      : null
  }
  const max = Math.max(0, ...rows.map((row) => row.value))
  const highlight = useHighlight(0)
  const tip = useHoverTip()

  if (!rows.length || max <= 0) {
    return <ChartEmpty>No data for this period.</ChartEmpty>
  }

  return (
    <div ref={tip.ref} className="relative">
      <ol className="flex flex-col justify-between gap-y-4">
        {rows.map((row, index) => {
          const [from, to] = PAIRS[index % PAIRS.length]
          const second = detailOf(row.key)
          const caption =
            detail && second ? `${second} ${detail.label.toLowerCase()}` : null
          return (
            <li
              key={row.key}
              className="flex items-center gap-x-4"
              {...tip.bind(
                {
                  label: row.name,
                  rows: [
                    { name: column.label, value: print(row.value), color: to },
                    ...(detail && second
                      ? [{ name: detail.label, value: second }]
                      : []),
                  ],
                },
                { enter: () => highlight.enter(index), leave: highlight.leave }
              )}
            >
              <span
                className="w-4 shrink-0 text-right text-[13px] tabular-nums"
                style={{ color: CHART.fgMuted }}
              >
                {index + 1}
              </span>
              <span
                aria-hidden
                className="flex size-8 shrink-0 items-center justify-center rounded-full text-[11px] font-medium"
                style={{
                  background: `linear-gradient(135deg, ${from}, ${to})`,
                  color: CHART.fgOnFill,
                }}
              >
                {initials(row.name)}
              </span>
              <span className="flex w-32 min-w-0 shrink-0 flex-col sm:w-44">
                <span
                  className="truncate text-[13px] leading-[18px]"
                  style={{ color: CHART.fgBase }}
                >
                  {row.name}
                </span>
                {caption ? (
                  <span
                    className="truncate text-[11px] leading-4"
                    style={{ color: CHART.fgMuted }}
                  >
                    {caption}
                  </span>
                ) : null}
              </span>
              <span
                className="relative h-1.5 flex-1 rounded-full"
                style={{ background: CHART.track }}
              >
                <span
                  className="absolute inset-y-0 left-0 rounded-full"
                  style={{
                    width: `${Math.max((row.value / max) * 100, 2)}%`,
                    background: `linear-gradient(to right, ${from}, ${to})`,
                    boxShadow: litShadow(
                      to,
                      index === highlight.active,
                      12,
                      60
                    ),
                    transition: `box-shadow ${GLOW_TRANSITION}`,
                  }}
                />
              </span>
              <span
                className="w-20 shrink-0 text-right text-[13px] font-medium tabular-nums"
                style={{ color: CHART.fgBase }}
              >
                {print(row.value, compact)}
              </span>
            </li>
          )
        })}
      </ol>
      {tip.layer}
    </div>
  )
}
