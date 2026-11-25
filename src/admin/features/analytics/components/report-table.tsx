import { Table, Text, clx } from "@medusajs/ui"

import { formatDimension, formatValue } from "../format"
import type { ReportResult } from "../types"

const MAX_ROWS = 200

type Props = {
  result: ReportResult
  metric?: string
  onMetricChange?: (metric: string) => void
  compact?: boolean
}

export const ReportTable = ({
  result,
  metric,
  onMetricChange,
  compact,
}: Props) => {
  const dimensions = result.columns.filter(
    (column) => column.kind === "dimension"
  )
  const metrics = result.columns.filter((column) => column.kind === "metric")
  const rows = result.rows.slice(0, compact ? 6 : MAX_ROWS)
  const print = (value: number, key: string) =>
    formatValue(
      value,
      metrics.find((column) => column.key === key)?.format ?? null,
      result.currency_code
    )

  const number = "text-right tabular-nums whitespace-nowrap"
  const height = compact ? "h-9" : undefined

  return (
    <div className="overflow-x-auto">
      <Table>
        <Table.Header>
          <Table.Row>
            {dimensions.map((column) => (
              <Table.HeaderCell key={column.key} className={height}>
                <Text size="xsmall" weight="plus" className="text-ui-fg-subtle">
                  {column.label}
                </Text>
              </Table.HeaderCell>
            ))}
            {dimensions.length === 0 && !compact ? (
              <Table.HeaderCell className={height} />
            ) : null}
            {metrics.map((column) => (
              <Table.HeaderCell
                key={column.key}
                className={clx(number, height)}
              >
                <button
                  type="button"
                  disabled={!onMetricChange}
                  onClick={() => onMetricChange?.(column.key)}
                  className={
                    column.key === metric
                      ? "text-ui-fg-base underline decoration-dotted underline-offset-4"
                      : "text-ui-fg-subtle"
                  }
                  title={onMetricChange ? "Draw this metric" : undefined}
                >
                  <Text size="xsmall" weight="plus">
                    {column.label}
                  </Text>
                </button>
              </Table.HeaderCell>
            ))}
          </Table.Row>
        </Table.Header>
        <Table.Body className="border-b-0">
          {compact ? null : (
            <Table.Row className="bg-ui-bg-subtle hover:bg-ui-bg-subtle">
              <Table.Cell>
                <Text size="small" weight="plus" className="text-ui-fg-base">
                  Summary
                </Text>
              </Table.Cell>
              {/* Table.Cell has no colSpan, so the other dimensions get blanks. */}
              {dimensions.slice(1).map((column) => (
                <Table.Cell key={column.key} />
              ))}
              {metrics.map((column) => (
                <Table.Cell key={column.key} className={number}>
                  <Text size="small" weight="plus">
                    {print(result.totals[column.key] ?? 0, column.key)}
                  </Text>
                  {result.compare_totals ? (
                    <Text size="xsmall" className="text-ui-fg-muted">
                      {print(
                        result.compare_totals[column.key] ?? 0,
                        column.key
                      )}
                    </Text>
                  ) : null}
                </Table.Cell>
              ))}
            </Table.Row>
          )}
          {rows.map((row) => (
            <Table.Row key={row.key} className="last:border-b-0">
              {dimensions.map((column) => (
                <Table.Cell key={column.key} className={height}>
                  <Text
                    size="small"
                    className="text-ui-fg-base whitespace-nowrap"
                  >
                    {formatDimension(column.key, row.dimensions[column.key])}
                  </Text>
                </Table.Cell>
              ))}
              {metrics.map((column) => (
                <Table.Cell key={column.key} className={clx(number, height)}>
                  <Text size="small" className="text-ui-fg-base">
                    {print(row.values[column.key] ?? 0, column.key)}
                  </Text>
                  {row.compare && !compact ? (
                    <Text size="xsmall" className="text-ui-fg-muted">
                      {print(row.compare[column.key] ?? 0, column.key)}
                    </Text>
                  ) : null}
                </Table.Cell>
              ))}
            </Table.Row>
          ))}
        </Table.Body>
      </Table>
      {compact ? null : (
        <div className="border-ui-border-base border-t px-6 py-2">
          <Text size="xsmall" className="text-ui-fg-muted">
            {result.rows.length > MAX_ROWS
              ? `Showing the first ${MAX_ROWS} of ${result.rows.length} rows. Add a LIMIT to narrow it.`
              : `${result.rows.length} ${result.rows.length === 1 ? "row" : "rows"}`}
            {result.compare_totals
              ? ". The smaller figure is the comparison period."
              : ""}
          </Text>
        </div>
      )}
    </div>
  )
}
