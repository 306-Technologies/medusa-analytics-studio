import type { DimensionKey } from "../../../../../shared/analytics/query-language"
import { formatDimension } from "../../format"
import { metricPrinter, toMatrix, toStrength } from "../data"
import { ChartEmpty } from "../shared/chart-empty"
import { useHoverTip } from "../shared/hover-tip"
import { StrengthKey } from "../shared/strength-key"
import { CHART, GLOW_STRENGTH, glowShadow, heatColor } from "../theme/tokens"
import type { ChartProps } from "../types"

const edgeLabel = (dimension: DimensionKey, value: string): string => {
  if (dimension === "hour_of_day") {
    const hour = Number(value)
    return `${hour % 12 === 0 ? 12 : hour % 12}${hour < 12 ? "am" : "pm"}`
  }
  if (dimension === "day_of_week") {
    return formatDimension(dimension, value).slice(0, 3)
  }
  return formatDimension(dimension, value)
}

export const HeatmapChartView = ({ result, column, height }: ChartProps) => {
  const print = metricPrinter(result, column)
  const matrix = toMatrix(result, column)
  const tip = useHoverTip()

  if (!matrix.rows.length || !matrix.columns.length || matrix.max <= 0) {
    return <ChartEmpty>No data for this period.</ChartEmpty>
  }

  const strength = toStrength(
    matrix.rows.flatMap((row) =>
      matrix.columns.map((value) => matrix.valueAt(row, value))
    )
  )
  const every = Math.max(Math.ceil(matrix.columns.length / 4), 1)
  const gap = matrix.columns.length > 16 ? 4 : 6

  return (
    <div
      ref={tip.ref}
      className="relative flex flex-col gap-y-2"
      style={{ minHeight: height }}
    >
      <div
        className="grid flex-1 items-stretch"
        style={{
          gridTemplateColumns: `auto repeat(${matrix.columns.length}, minmax(0, 1fr))`,
          gridTemplateRows: `repeat(${matrix.rows.length}, minmax(0, 1fr))`,
          gap,
        }}
      >
        {matrix.rows.map((row) => (
          <div key={row} className="contents">
            <span
              className="flex items-center pr-2 text-[11px] leading-4"
              style={{ color: CHART.fgMuted }}
            >
              {edgeLabel(matrix.rowDimension, row)}
            </span>
            {matrix.columns.map((columnValue) => {
              const value = matrix.valueAt(row, columnValue)
              const level = strength(value)
              const color = heatColor(level)
              return (
                <span
                  key={columnValue}
                  className="min-h-3 rounded outline-offset-1 hover:outline hover:outline-1"
                  style={{
                    background: color,
                    outlineColor: CHART.fgTitle,
                    boxShadow:
                      level >= GLOW_STRENGTH
                        ? glowShadow(CHART.violet, 12, 55)
                        : undefined,
                  }}
                  {...tip.bind({
                    label: `${formatDimension(matrix.rowDimension, row)}, ${edgeLabel(
                      matrix.columnDimension,
                      columnValue
                    )}`,
                    rows: [{ name: column.label, value: print(value), color }],
                  })}
                />
              )
            })}
          </div>
        ))}
      </div>
      <div
        className="grid"
        style={{
          gridTemplateColumns: `auto repeat(${matrix.columns.length}, minmax(0, 1fr))`,
          columnGap: gap,
        }}
      >
        <span className="invisible pr-2 text-[11px]">Wed</span>
        {matrix.columns.map((columnValue, index) => (
          <span
            key={columnValue}
            className="overflow-visible whitespace-nowrap text-[11px] leading-4"
            style={{ color: CHART.fgMuted }}
          >
            {index % every === 0
              ? edgeLabel(matrix.columnDimension, columnValue)
              : ""}
          </span>
        ))}
      </div>
      <StrengthKey colorOf={heatColor} />
      {tip.layer}
    </div>
  )
}
