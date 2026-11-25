import type { ReactNode } from "react"

import { CHART } from "../theme/tokens"

export type TooltipRow = { name: string; value: string; color?: string }

export const TooltipCard = ({
  label,
  rows,
}: {
  label?: ReactNode
  rows: TooltipRow[]
}) => (
  <div
    className="flex min-w-36 flex-col gap-y-1 rounded-lg border px-3 py-2 shadow-lg"
    style={{ background: CHART.inset, borderColor: CHART.grid }}
  >
    {label !== undefined ? (
      <span className="text-[11px] leading-4" style={{ color: CHART.fgMuted }}>
        {label}
      </span>
    ) : null}
    {rows.map((row, index) => (
      <div key={index} className="flex items-center gap-x-2">
        {row.color ? (
          <span
            aria-hidden
            className="size-2 shrink-0 rounded-full"
            style={{ background: row.color }}
          />
        ) : null}
        <span
          className="whitespace-nowrap text-xs"
          style={{ color: CHART.fgTitle }}
        >
          {row.name}
        </span>
        <span
          className="ml-auto whitespace-nowrap pl-3 text-xs font-medium tabular-nums"
          style={{ color: CHART.fgBase }}
        >
          {row.value}
        </span>
      </div>
    ))}
  </div>
)

type TooltipEntry = {
  name?: unknown
  value?: unknown
  color?: string
  dataKey?: unknown
}

const COMPARISON_KEY = "previous"

type Props = {
  labelOf: (value: string) => string
  print: (value: number) => string
  /** Series colours by data key; gradient series arrive as "url(#...)". */
  colors?: Record<string, string>
  active?: boolean
  label?: unknown
  payload?: ReadonlyArray<TooltipEntry>
}

export const ChartTooltip = ({
  labelOf,
  print,
  colors,
  active,
  label,
  payload,
}: Props) => {
  if (!active || !payload?.length) {
    return null
  }
  // A series drawn twice (an area under its line) is listed once.
  const seen = new Set<string>()
  const rows = payload
    .flatMap((entry) => {
      const key = String(entry.dataKey ?? entry.name)
      if (typeof entry.value !== "number" || seen.has(key)) {
        return []
      }
      seen.add(key)
      const color =
        colors?.[key] ??
        (entry.color?.startsWith("url(") ? undefined : entry.color)
      return [
        { key, name: String(entry.name), value: print(entry.value), color },
      ]
    })
    .sort(
      (a, b) =>
        Number(a.key === COMPARISON_KEY) - Number(b.key === COMPARISON_KEY)
    )
  return (
    <TooltipCard
      label={
        typeof label === "string" || typeof label === "number"
          ? labelOf(String(label))
          : undefined
      }
      rows={rows}
    />
  )
}
