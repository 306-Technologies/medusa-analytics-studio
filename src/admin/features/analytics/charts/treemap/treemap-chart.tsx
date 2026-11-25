import { type ReactNode, useId } from "react"
import { ResponsiveContainer, Tooltip, Treemap } from "recharts"

import { formatDimension, formatPercent } from "../../format"
import { metricPrinter, toSlices } from "../data"
import { shorten } from "../shared/chart-axes"
import { ChartEmpty } from "../shared/chart-empty"
import { ChartTooltip } from "../shared/chart-tooltip"
import { svgId } from "../shared/svg-defs"
import { useHighlight } from "../shared/use-highlight"
import { CHART, GLOW_TRANSITION, litFilter } from "../theme/tokens"
import type { ChartProps } from "../types"

const STRENGTH = [1, 0.78, 0.56, 0.5, 0.38, 0.3, 0.2]
const GAP = 2

type TileProps = {
  idOf: (index: number) => string
  defs: ReactNode
  total: number
  active: number
  onEnter: (index: number) => void
  onLeave: () => void
  x?: number
  y?: number
  width?: number
  height?: number
  index?: number
  name?: string
  value?: number
  depth?: number
}

// Module-level so Recharts doesn't remount the tiles on every hover.
const Tile = ({
  idOf,
  defs,
  total,
  active,
  onEnter,
  onLeave,
  x = 0,
  y = 0,
  width = 0,
  height = 0,
  index = 0,
  name = "",
  value = 0,
  depth,
}: TileProps) => {
  // Gradients go on the root (depth 0): the treemap doesn't render its own children.
  if (depth === 0) {
    return <g>{defs}</g>
  }
  const roomy = width > 64 && height > 44
  return (
    <g onMouseEnter={() => onEnter(index)} onMouseLeave={onLeave}>
      <rect
        x={x + GAP}
        y={y + GAP}
        width={Math.max(width - GAP * 2, 0)}
        height={Math.max(height - GAP * 2, 0)}
        rx={8}
        fill={`url(#${idOf(index)})`}
        style={{
          filter: litFilter(CHART.blue, index === active, 10, 35),
          transition: `filter ${GLOW_TRANSITION}`,
        }}
      />
      {roomy ? (
        <>
          <text
            x={x + 14}
            y={y + 24}
            fill={CHART.fgBase}
            fontSize={13}
            fontWeight={500}
          >
            {shorten(name, Math.max(Math.floor(width / 8), 4))}
          </text>
          <text x={x + 14} y={y + 42} fill={CHART.fgOnTile} fontSize={12}>
            {formatPercent(value / total)}
          </text>
        </>
      ) : null}
    </g>
  )
}

export const TreemapChartView = ({ result, column, height }: ChartProps) => {
  const reactId = useId()
  const print = metricPrinter(result, column)
  const slices = toSlices(result, column)
  const total = slices.reduce((sum, slice) => sum + slice.value, 0)
  const labelOf = (value: string) =>
    formatDimension(result.query.dimensions[0], value)
  const highlight = useHighlight(0)

  if (!slices.length || total <= 0) {
    return <ChartEmpty>No data for this period.</ChartEmpty>
  }

  const idOf = (index: number) => svgId(reactId, `tile-${index}`)
  const defs = (
    <defs>
      {slices.map((slice, index) => {
        const strength = STRENGTH[index] ?? STRENGTH[STRENGTH.length - 1]
        return (
          <linearGradient
            key={slice.name}
            id={idOf(index)}
            x1="0"
            y1="0"
            x2="0"
            y2="1"
          >
            <stop offset="0%" stopColor={CHART.blue} stopOpacity={strength} />
            <stop
              offset="100%"
              stopColor={CHART.violet}
              stopOpacity={strength * 0.7}
            />
          </linearGradient>
        )
      })}
    </defs>
  )

  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <Treemap
          data={slices.map((slice) => ({
            name: slice.name,
            value: slice.value,
          }))}
          dataKey="value"
          nameKey="name"
          aspectRatio={4 / 3}
          isAnimationActive={false}
          content={
            <Tile
              idOf={idOf}
              defs={defs}
              total={total}
              active={highlight.active}
              onEnter={highlight.enter}
              onLeave={highlight.leave}
            />
          }
        >
          <Tooltip content={<ChartTooltip labelOf={labelOf} print={print} />} />
        </Treemap>
      </ResponsiveContainer>
    </div>
  )
}
