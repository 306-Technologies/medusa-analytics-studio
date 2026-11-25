import { formatValue } from "../../format"
import { toSteps } from "../data"
import { ChartEmpty } from "../shared/chart-empty"
import { useHoverTip } from "../shared/hover-tip"
import { CHART, fade, glowShadow } from "../theme/tokens"
import type { ChartProps } from "../types"

const LABEL_SPACE = 22
/** Room above the tallest column for its 18px value label. */
const VALUE_SPACE = 30
/** Gap between columns, in percent of the row. */
const GAP = 4

export const WaterfallChartView = ({ result, height }: ChartProps) => {
  const steps = toSteps(result)
  const formats = new Map(
    result.columns.map((column) => [column.key, column.format])
  )
  const top = Math.max(0, ...steps.flatMap((step) => [step.from, step.to]))
  const tip = useHoverTip()

  if (!steps.length || top <= 0) {
    return <ChartEmpty>No data for this period.</ChartEmpty>
  }

  const plot = height - LABEL_SPACE
  const column = (100 - (steps.length - 1) * GAP) / steps.length
  const y = (value: number) =>
    plot - (Math.max(value, 0) / top) * (plot - VALUE_SPACE)

  return (
    <div ref={tip.ref} className="relative flex flex-col" style={{ height }}>
      <div className="relative flex flex-1" style={{ columnGap: `${GAP}%` }}>
        <span
          className="absolute inset-x-0 bottom-0 h-px"
          style={{ background: CHART.grid }}
        />
        {steps.slice(0, -1).map((step, index) => (
          <span
            key={`${step.key}-link`}
            className="absolute h-px border-t border-dashed"
            style={{
              top: y(step.to),
              left: `${(index + 1) * column + index * GAP}%`,
              width: `${GAP}%`,
              borderColor: CHART.cursor,
            }}
          />
        ))}
        {steps.map((step) => {
          const high = Math.max(step.from, step.to)
          const low = Math.min(step.from, step.to)
          const ends = step.kind === "start" || step.kind === "end"
          const color = ends
            ? CHART.blue
            : step.kind === "down"
              ? CHART.rose
              : CHART.green
          const exact = formatValue(
            Math.abs(step.value),
            formats.get(step.key) ?? formats.get(steps[0].key) ?? null,
            result.currency_code
          )
          const sign =
            step.value === 0
              ? ""
              : step.kind === "down"
                ? "−"
                : step.kind === "up"
                  ? "+"
                  : ""
          const amount = formatValue(
            Math.abs(step.value),
            formats.get(step.key) ?? formats.get(steps[0].key) ?? null,
            result.currency_code,
            { compact: true }
          )
          return (
            <div
              key={step.key}
              className="relative flex-1"
              {...tip.bind({
                label: step.label,
                rows: [
                  {
                    name: ends ? "Total" : "Change",
                    value: `${sign}${exact}`,
                    color,
                  },
                ],
              })}
            >
              <span
                className="absolute inset-x-0 text-center text-xs font-medium tabular-nums"
                style={{
                  top: y(high) - 18,
                  color: ends ? CHART.fgBase : color,
                }}
              >
                {sign}
                {amount}
              </span>
              <span
                className="absolute inset-x-0"
                style={{
                  top: y(high),
                  height: Math.max(y(low) - y(high), 2),
                  borderRadius: ends ? "6px 6px 0 0" : 4,
                  background: ends
                    ? `linear-gradient(to bottom, ${fade(CHART.blue, 95)}, ${fade(CHART.violet, 30)})`
                    : `linear-gradient(to bottom, ${color}, ${fade(color, 60)})`,
                  boxShadow: ends ? glowShadow(CHART.blue, 14, 35) : undefined,
                }}
              />
            </div>
          )
        })}
      </div>
      <div
        className="flex pt-1.5"
        style={{ height: LABEL_SPACE, columnGap: `${GAP}%` }}
      >
        {steps.map((step) => (
          <span
            key={step.key}
            className="flex-1 truncate text-center text-[11px] leading-4"
            style={{ color: CHART.fgMuted }}
          >
            {step.label}
          </span>
        ))}
      </div>
      {tip.layer}
    </div>
  )
}
