import { Skeleton, clx } from "@medusajs/ui"
import type { CSSProperties, ReactNode } from "react"

import { chartFor } from "../registry"
import { CHART } from "../theme/tokens"

const Bone = ({
  className,
  style,
}: {
  className?: string
  style?: CSSProperties
}) => (
  <Skeleton
    className={clx("rounded motion-reduce:animate-none", className)}
    style={style}
  />
)

const COLUMN_HEIGHTS = [45, 62, 38, 70, 55, 82, 64, 48, 74, 58, 88, 66]
const ROW_WIDTHS = [92, 78, 66, 54, 43, 34]

const SHAPES: Record<string, "columns" | "rows" | "ring" | "cells"> = {
  line: "columns",
  bar: "columns",
  area: "columns",
  "stacked-area": "columns",
  waterfall: "columns",
  slope: "columns",
  "ranked-bars": "rows",
  "ranked-list": "rows",
  "change-bars": "rows",
  lollipop: "rows",
  "share-bar": "rows",
  donut: "ring",
  treemap: "cells",
  waffle: "cells",
  heatmap: "cells",
  calendar: "cells",
}

const WITH_HEADLINE = new Set(["area", "bar"])

const Plot = ({ chartId, height }: { chartId: string; height: number }) => {
  const shape = SHAPES[chartId] ?? "columns"

  if (shape === "ring") {
    const size = Math.min(height - 16, 200)
    return (
      <div className="flex items-center justify-center" style={{ height }}>
        <Bone
          className="rounded-full"
          style={{
            width: size,
            height: size,
            mask: "radial-gradient(circle, transparent 57%, black 58%)",
            WebkitMask: "radial-gradient(circle, transparent 57%, black 58%)",
          }}
        />
      </div>
    )
  }

  if (shape === "cells") {
    return (
      <div className="grid grid-cols-12 gap-1" style={{ height }}>
        {Array.from({ length: 48 }, (_, index) => (
          <Bone key={index} className="rounded-sm" />
        ))}
      </div>
    )
  }

  if (shape === "rows") {
    const rows = Math.max(
      3,
      Math.min(ROW_WIDTHS.length, Math.floor(height / 36))
    )
    return (
      <div className="flex flex-col justify-around" style={{ height }}>
        {ROW_WIDTHS.slice(0, rows).map((width, index) => (
          <div key={index} className="flex items-center gap-x-3">
            <Bone className="h-2.5 w-16 shrink-0" />
            <Bone className="h-3" style={{ width: `${width}%` }} />
          </div>
        ))}
      </div>
    )
  }

  return (
    <div
      className="border-ui-border-base flex items-end gap-x-2 border-b pb-px"
      style={{ height }}
    >
      {COLUMN_HEIGHTS.map((percent, index) => (
        <Bone
          key={index}
          className="flex-1 rounded-b-none"
          style={{ height: `${percent}%` }}
        />
      ))}
    </div>
  )
}

export const TableSkeleton = ({
  rows,
  compact = false,
}: {
  rows: number
  compact?: boolean
}) => (
  <div aria-hidden className="flex flex-col">
    {Array.from({ length: rows + 1 }, (_, index) => (
      <div
        key={index}
        className={clx(
          "border-ui-border-base flex items-center gap-x-6 border-b px-6",
          compact ? "h-9" : "h-12"
        )}
      >
        <Bone className={clx("h-2.5", index === 0 ? "w-20" : "w-32")} />
        <Bone className="ml-auto h-2.5 w-16" />
        <Bone className="h-2.5 w-12" />
      </div>
    ))}
  </div>
)

type Props = {
  chartId: string
  height: number
  compact?: boolean
}

export const ChartSkeleton = ({ chartId, height, compact = false }: Props) => {
  const chart = chartFor(chartId)

  const body = chart.isTable ? (
    <TableSkeleton rows={compact ? 6 : 8} compact={compact} />
  ) : chart.id === "stat" ? (
    <div className="flex flex-col justify-between gap-y-3" style={{ height }}>
      <Bone style={{ height: compact ? 34 : 40, width: "55%" }} />
      <Bone style={{ height: compact ? 48 : 72 }} />
    </div>
  ) : chart.id === "hero" ? (
    <div
      className="flex flex-col justify-center gap-y-3"
      style={{ minHeight: height }}
    >
      <Bone style={{ height: 40, width: "40%" }} />
      <Bone style={{ height: Math.round(height * 0.55) }} />
    </div>
  ) : WITH_HEADLINE.has(chart.id) ? (
    // ChartHeadline (36px) and its gap; compact charts shrink the plot to fit.
    <div className="flex flex-col gap-y-3">
      <Bone style={{ height: 36, width: "35%" }} />
      <Plot chartId={chart.id} height={compact ? height - 40 : height} />
    </div>
  ) : (
    <Plot chartId={chart.id} height={height} />
  )

  return (
    <div role="status" aria-busy="true" aria-label="Loading chart">
      {body}
    </div>
  )
}

export const ChartPlaceholder = ({
  height,
  children,
}: {
  height: number
  children: ReactNode
}) => (
  <div
    className="flex items-center justify-center px-6 text-center text-xs"
    style={{ minHeight: height, color: CHART.fgMuted }}
  >
    {children}
  </div>
)
