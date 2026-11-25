import { formatDay } from "../../format"
import { metricPrinter, toCalendar, toStrength } from "../data"
import { ChartEmpty } from "../shared/chart-empty"
import { useHoverTip } from "../shared/hover-tip"
import { StrengthKey } from "../shared/strength-key"
import { CHART, glowShadow, tealColor } from "../theme/tokens"
import type { ChartProps } from "../types"

const WEEKDAY_LABELS = ["Mon", "", "Wed", "", "Fri", "", ""]
const MAX_SQUARE = 26

const monthOf = (day: string) =>
  new Date(`${day}T00:00:00Z`).toLocaleDateString(undefined, {
    month: "short",
    timeZone: "UTC",
  })

export const CalendarChartView = ({ result, column }: ChartProps) => {
  const print = metricPrinter(result, column)
  const { weeks } = toCalendar(result, column)
  const tip = useHoverTip()

  if (!weeks.length) {
    return <ChartEmpty>No data for this period.</ChartEmpty>
  }

  const lastDay = result.range.until
  const strength = toStrength(weeks.flat().map((entry) => entry?.value ?? 0))
  const columns = `auto repeat(${weeks.length}, minmax(0, ${MAX_SQUARE}px))`
  const monthLabels = weeks.map((week, index) => {
    const first = week.find((entry) => entry !== null)
    const previous = weeks[index - 1]?.find((entry) => entry !== null)
    return first && (!previous || monthOf(first.day) !== monthOf(previous.day))
      ? monthOf(first.day)
      : ""
  })

  return (
    <div ref={tip.ref} className="relative flex flex-col gap-y-2">
      <div className="flex flex-col gap-y-1.5 overflow-x-auto">
        <div className="grid gap-x-1" style={{ gridTemplateColumns: columns }}>
          <span className="invisible pr-2 text-[11px]">Wed</span>
          {monthLabels.map((label, index) => (
            <span
              key={index}
              className="overflow-visible whitespace-nowrap text-[11px] leading-4"
              style={{ color: CHART.fgMuted }}
            >
              {label}
            </span>
          ))}
        </div>
        <div
          className="grid grid-flow-col gap-1"
          style={{
            gridTemplateColumns: columns,
            gridTemplateRows: "repeat(7, auto)",
          }}
        >
          {WEEKDAY_LABELS.map((label, index) => (
            <span
              key={`label-${index}`}
              className="flex items-center pr-2 text-[11px] leading-4"
              style={{
                color: CHART.fgMuted,
                gridColumn: 1,
                gridRow: index + 1,
              }}
            >
              {label}
            </span>
          ))}
          {weeks.flatMap((week, weekIndex) =>
            week.map((entry, dayIndex) => (
              <span
                key={`${weekIndex}-${dayIndex}`}
                className="aspect-square rounded"
                style={{
                  gridColumn: weekIndex + 2,
                  gridRow: dayIndex + 1,
                  background: entry
                    ? tealColor(strength(entry.value))
                    : "transparent",
                  boxShadow:
                    entry?.day === lastDay
                      ? glowShadow(CHART.teal, 14, 70)
                      : undefined,
                }}
                {...(entry
                  ? tip.bind({
                      label: formatDay(entry.day, true),
                      rows: [
                        {
                          name: column.label,
                          value: print(entry.value),
                          color: tealColor(strength(entry.value)),
                        },
                      ],
                    })
                  : {})}
              />
            ))
          )}
        </div>
      </div>
      <StrengthKey colorOf={tealColor} />
      {tip.layer}
    </div>
  )
}
