import { Sparkline } from "../../components/sparkline"
import { change, formatPercent, formatRange } from "../../format"
import { metricPrinter, sparkValues } from "../data"
import { CHART, glowColor } from "../theme/tokens"
import type { ChartProps } from "../types"

const changeSentence = (
  current: number,
  previous: number | undefined
): string | null => {
  if (previous === undefined) {
    return null
  }
  const difference = change(current, previous)
  if (difference === null) {
    return "Nothing to compare with in the earlier period."
  }
  if (Math.abs(difference) < 0.0005) {
    return "The same as the earlier period."
  }
  return `${difference > 0 ? "Up" : "Down"} ${formatPercent(Math.abs(difference))} on the earlier period.`
}

export const HeroChartView = ({
  result,
  column,
  height,
  compact,
}: ChartProps) => {
  const print = metricPrinter(result, column)
  const total = result.totals[column.key] ?? 0
  const spark = sparkValues(result, column)
  const sentence = changeSentence(total, result.compare_totals?.[column.key])

  return (
    <div
      className="relative flex flex-col justify-center gap-y-3"
      style={{ minHeight: height }}
    >
      <span
        className="relative z-[1] w-fit font-normal tabular-nums"
        style={{
          fontSize: compact ? 56 : 72,
          lineHeight: 1.05,
          letterSpacing: "-0.02em",
          background: `linear-gradient(to right, ${CHART.blue}, ${CHART.violet})`,
          WebkitBackgroundClip: "text",
          backgroundClip: "text",
          color: "transparent",
          filter: `drop-shadow(0 0 22px ${glowColor(CHART.blue, 45)})`,
        }}
      >
        {print(total)}
      </span>
      <span className="relative z-[1] flex flex-col gap-y-1">
        {sentence ? (
          <span
            className="text-[15px] leading-6"
            style={{ color: CHART.fgBase }}
          >
            {sentence}
          </span>
        ) : null}
        <span
          className="text-[13px] leading-5"
          style={{ color: CHART.fgTitle }}
        >
          {column.label}, {formatRange(result.range.since, result.range.until)}
        </span>
      </span>
      {spark.length > 1 ? (
        <div className="pointer-events-none absolute bottom-0 right-0 w-1/2 opacity-90">
          <Sparkline
            values={spark}
            height={Math.round(height * 0.55)}
            fill="fade"
            color={CHART.violet}
            glow
          />
        </div>
      ) : null}
    </div>
  )
}
