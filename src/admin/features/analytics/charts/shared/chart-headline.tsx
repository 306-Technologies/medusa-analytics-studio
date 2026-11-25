import { change, formatPercent } from "../../format"
import { CHART } from "../theme/tokens"

export const changeText = (
  current: number,
  previous: number | null | undefined
): { text: string; up: boolean } | null => {
  if (previous === null || previous === undefined) {
    return null
  }
  const difference = change(current, previous)
  if (difference === null || Math.abs(difference) < 0.0005) {
    return null
  }
  const up = difference > 0
  return { text: `${up ? "+" : "-"}${formatPercent(Math.abs(difference))}`, up }
}

export const ChangePill = ({
  current,
  previous,
}: {
  current: number
  previous: number | null | undefined
}) => {
  const delta = changeText(current, previous)
  if (!delta) {
    return null
  }
  return (
    <span
      className="rounded-md px-1.5 py-0.5 text-xs font-medium leading-4"
      style={{
        background: delta.up ? CHART.positiveBg : CHART.negativeBg,
        color: delta.up ? CHART.green : CHART.rose,
      }}
    >
      {delta.text}
    </span>
  )
}

export const ChartHeadline = ({
  value,
  current,
  previous,
}: {
  value: string
  current: number
  previous: number | null | undefined
}) => (
  <div className="flex items-center gap-x-2.5">
    <span
      className="font-medium tabular-nums"
      style={{ fontSize: 28, lineHeight: "36px", color: CHART.fgBase }}
    >
      {value}
    </span>
    <ChangePill current={current} previous={previous} />
  </div>
)
