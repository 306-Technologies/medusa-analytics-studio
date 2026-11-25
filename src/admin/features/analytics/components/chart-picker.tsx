import { Select } from "@medusajs/ui"

import { CHART_GROUPS, CHARTS, isChartId } from "../charts/registry"
import type { ReportResult, Visualization } from "../types"

type Props = {
  value: Visualization
  onChange: (value: Visualization) => void
  result: ReportResult | undefined
}

export const ChartPicker = ({ value, onChange, result }: Props) => {
  const unavailable = result
    ? CHARTS.flatMap((chart) => {
        const fit = chart.fits(result)
        return fit.ok || chart.id === value ? [] : [{ chart, need: fit.reason }]
      })
    : []
  const hidden = new Set(unavailable.map((entry) => entry.chart.id))
  const groups = CHART_GROUPS.map((group) => ({
    ...group,
    charts: group.charts.filter((chart) => !hidden.has(chart.id)),
  })).filter((group) => group.charts.length > 0)

  return (
    <Select
      size="small"
      value={value}
      onValueChange={(next) => {
        if (isChartId(next)) {
          onChange(next)
        }
      }}
    >
      <Select.Trigger aria-label="Visualization">
        <Select.Value />
      </Select.Trigger>
      <Select.Content className="max-h-[420px]">
        {groups.map((group) => (
          <Select.Group key={group.label}>
            <Select.Label>{group.label}</Select.Label>
            {group.charts.map((chart) => (
              <Select.Item key={chart.id} value={chart.id}>
                {chart.label}
              </Select.Item>
            ))}
          </Select.Group>
        ))}
        {unavailable.length ? (
          <>
            <Select.Separator />
            <Select.Group>
              <Select.Label>Needs a different query</Select.Label>
              {unavailable.map(({ chart, need }) => (
                <Select.Item
                  key={chart.id}
                  value={chart.id}
                  disabled
                  className="data-[disabled]:text-ui-fg-disabled data-[disabled]:cursor-default"
                >
                  <span className="flex items-baseline justify-between gap-x-4">
                    <span className="truncate">{chart.label}</span>
                    <span className="txt-compact-xsmall text-ui-fg-muted shrink-0">
                      {need}
                    </span>
                  </span>
                </Select.Item>
              ))}
            </Select.Group>
          </>
        ) : null}
      </Select.Content>
    </Select>
  )
}
