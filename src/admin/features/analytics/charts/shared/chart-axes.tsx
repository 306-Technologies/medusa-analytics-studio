import { CartesianGrid } from "recharts"

import { CHART } from "../theme/tokens"

export const axisTick = (compact: boolean) => ({
  fill: CHART.fgMuted,
  fontSize: compact ? 11 : 12,
})

export const shorten = (text: string, max: number) =>
  text.length > max ? `${text.slice(0, max - 1)}…` : text

// A function, not a component: Recharts only finds its children by type.
export const chartGrid = () => (
  <CartesianGrid vertical={false} stroke={CHART.grid} />
)

export const lineCursor = { stroke: CHART.cursor, strokeWidth: 1 }

export const barCursor = { fill: CHART.band }

type CategoryTickProps = {
  x?: number | string
  y?: number | string
  payload?: { value?: unknown }
}

/** Drawn by hand on one line: Recharts wraps long names into the next bar. */
export const categoryTick =
  ({
    labelOf,
    compact,
  }: {
    labelOf: (value: string) => string
    compact: boolean
  }) =>
  ({ x, y, payload }: CategoryTickProps) => (
    <text
      x={x}
      y={y}
      textAnchor="end"
      dominantBaseline="central"
      fill={CHART.fgBase}
      fontSize={compact ? 12 : 13}
    >
      {shorten(labelOf(String(payload?.value ?? "")), compact ? 20 : 30)}
    </text>
  )
