import { Text } from "@medusajs/ui"

import { change, formatPercent } from "../format"

export const Delta = ({
  current,
  previous,
}: {
  current: number
  previous: number | null | undefined
}) => {
  if (previous === null || previous === undefined) {
    return null
  }

  const difference = change(current, previous)
  if (difference === null) {
    return (
      <Text size="xsmall" className="text-ui-fg-muted">
        {current > 0 ? "Nothing earlier" : "No change"}
      </Text>
    )
  }
  if (Math.abs(difference) < 0.0005) {
    return (
      <Text size="xsmall" className="text-ui-fg-muted">
        No change
      </Text>
    )
  }

  const up = difference > 0
  return (
    <Text
      size="xsmall"
      weight="plus"
      className={up ? "text-ui-tag-green-text" : "text-ui-tag-red-text"}
    >
      {up ? "↑" : "↓"} {formatPercent(Math.abs(difference))}
    </Text>
  )
}
