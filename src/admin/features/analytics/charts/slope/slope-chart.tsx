import { type RankChange, toRankChanges } from "../data"
import { ChartEmpty } from "../shared/chart-empty"
import { useHoverTip } from "../shared/hover-tip"
import { CHART, glowColor } from "../theme/tokens"
import type { ChartProps } from "../types"

const MAX_ROWS = 8
const MAX_ROWS_COMPACT = 5

const colorOf = (now: number, before: number) =>
  now < before ? CHART.green : now > before ? CHART.rose : CHART.fgMuted

export const SlopeChartView = ({
  result,
  column,
  height,
  compact,
}: ChartProps) => {
  const ranks = toRankChanges(
    result,
    column,
    compact ? MAX_ROWS_COMPACT : MAX_ROWS
  )
  const tip = useHoverTip()
  const tipFor = (row: RankChange) =>
    tip.bind({
      label: row.name,
      rows: [
        {
          name: "Now",
          value: `#${row.now}`,
          color: colorOf(row.now, row.before),
        },
        { name: "Before", value: `#${row.before}`, color: CHART.fgMuted },
      ],
    })

  if (!ranks.length) {
    return <ChartEmpty>No data for this period.</ChartEmpty>
  }

  const count = ranks.length
  const before = [...ranks].sort((a, b) => a.before - b.before)
  // Where a slot sits, in percent of the height.
  const at = (slot: number) => ((slot - 0.5) / count) * 100
  const slotBefore = (row: RankChange) => before.indexOf(row) + 1

  const label = (text: string) => (
    <span className="text-[11px] leading-4" style={{ color: CHART.fgMuted }}>
      {text}
    </span>
  )

  return (
    <div
      ref={tip.ref}
      className="relative flex flex-col gap-y-1"
      style={{ minHeight: height }}
    >
      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)_minmax(0,1fr)] gap-x-3">
        <span className="text-right">{label("Previous")}</span>
        <span />
        {label("Now")}
      </div>
      <div className="grid flex-1 grid-cols-[minmax(0,1fr)_minmax(0,2fr)_minmax(0,1fr)] gap-x-3">
        <ol className="flex flex-col">
          {before.map((row) => (
            <li
              key={row.key}
              className="flex flex-1 items-center justify-end gap-x-2 text-[13px]"
              style={{ color: CHART.fgTitle }}
              {...tipFor(row)}
            >
              <span className="truncate">{row.name}</span>
              <span className="tabular-nums">{row.before}</span>
            </li>
          ))}
        </ol>
        <div className="relative">
          <svg
            className="absolute inset-0 size-full overflow-visible"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            aria-hidden
          >
            {ranks.map((row) => {
              const from = at(slotBefore(row))
              const to = at(row.now)
              const color = colorOf(row.now, row.before)
              return (
                <path
                  key={row.key}
                  d={`M 0 ${from} C 50 ${from}, 50 ${to}, 100 ${to}`}
                  fill="none"
                  stroke={color}
                  strokeWidth={2}
                  vectorEffect="non-scaling-stroke"
                  style={{
                    filter:
                      row.now === row.before
                        ? undefined
                        : `drop-shadow(0 0 4px ${glowColor(color, 60)})`,
                  }}
                />
              )
            })}
          </svg>
          {ranks.flatMap((row) => {
            const color = colorOf(row.now, row.before)
            return [
              <span
                key={`${row.key}-before`}
                className="absolute left-0 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full"
                style={{ top: `${at(slotBefore(row))}%`, background: color }}
              />,
              <span
                key={`${row.key}-now`}
                className="absolute right-0 size-2 -translate-y-1/2 translate-x-1/2 rounded-full"
                style={{ top: `${at(row.now)}%`, background: color }}
              />,
            ]
          })}
        </div>
        <ol className="flex flex-col">
          {ranks.map((row) => (
            <li
              key={row.key}
              className="flex flex-1 items-center gap-x-2 text-[13px] font-medium"
              style={{ color: CHART.fgBase }}
              {...tipFor(row)}
            >
              <span className="tabular-nums">{row.now}</span>
              <span className="truncate">{row.name}</span>
            </li>
          ))}
        </ol>
      </div>
      {tip.layer}
    </div>
  )
}
