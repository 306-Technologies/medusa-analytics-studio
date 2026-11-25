import { change, formatPercent } from "../../format"
import { metricPrinter, toNamed } from "../data"
import { ChartEmpty } from "../shared/chart-empty"
import { useHoverTip } from "../shared/hover-tip"
import { CHART, fade, glowShadow } from "../theme/tokens"
import type { ChartProps } from "../types"

const MAX_ROWS = 12
const MAX_ROWS_COMPACT = 6

export const ChangeBarsChartView = ({
  result,
  column,
  compact,
}: ChartProps) => {
  const rows = toNamed(
    result,
    column,
    compact ? MAX_ROWS_COMPACT : MAX_ROWS
  ).map((row) => ({
    ...row,
    ratio: row.previous === null ? null : change(row.value, row.previous),
  }))
  const max = Math.max(0, ...rows.map((row) => Math.abs(row.ratio ?? 0)))
  const print = metricPrinter(result, column)
  const tip = useHoverTip()

  if (!rows.length) {
    return <ChartEmpty>No data for this period.</ChartEmpty>
  }

  return (
    <div ref={tip.ref} className="relative">
      <ul className="relative flex flex-col justify-between gap-y-3 py-1">
        {rows.map((row) => {
          const ratio = row.ratio ?? 0
          const up = ratio >= 0
          const color = up ? CHART.green : CHART.rose
          const width = max > 0 ? (Math.abs(ratio) / max) * 70 : 0
          const label =
            row.ratio === null
              ? "New"
              : `${up ? "+" : "-"}${formatPercent(Math.abs(ratio))}`
          return (
            <li
              key={row.key}
              className="flex items-center gap-x-3"
              {...tip.bind({
                label: row.name,
                rows: [
                  { name: "Now", value: print(row.value), color },
                  ...(row.previous === null
                    ? []
                    : [
                        {
                          name: "Before",
                          value: print(row.previous),
                          color: CHART.fgMuted,
                        },
                      ]),
                  { name: "Change", value: label },
                ],
              })}
            >
              <span
                className="w-24 shrink-0 truncate text-xs leading-[18px]"
                style={{ color: CHART.fgTitle }}
              >
                {row.name}
              </span>
              <span className="relative flex h-[18px] flex-1 items-center">
                <span
                  className="absolute inset-y-[-6px] left-1/2 w-px"
                  style={{ background: CHART.axis }}
                />
                <span className="flex w-1/2 items-center justify-end gap-x-1.5 pr-0.5">
                  {up ? null : (
                    <>
                      <span
                        className="text-xs font-medium tabular-nums"
                        style={{ color }}
                      >
                        {label}
                      </span>
                      <span
                        className="h-3 rounded"
                        style={{
                          width: `${width}%`,
                          background: `linear-gradient(to right, ${color}, ${fade(color, 50)})`,
                          boxShadow: glowShadow(color, 10, 35),
                        }}
                      />
                    </>
                  )}
                </span>
                <span className="flex w-1/2 items-center gap-x-1.5 pl-0.5">
                  {up ? (
                    <>
                      <span
                        className="h-3 rounded"
                        style={{
                          width: `${width}%`,
                          background: `linear-gradient(to right, ${fade(color, 50)}, ${color})`,
                          boxShadow: glowShadow(color, 10, 35),
                        }}
                      />
                      <span
                        className="text-xs font-medium tabular-nums"
                        style={{ color }}
                      >
                        {label}
                      </span>
                    </>
                  ) : null}
                </span>
              </span>
            </li>
          )
        })}
      </ul>
      {tip.layer}
    </div>
  )
}
