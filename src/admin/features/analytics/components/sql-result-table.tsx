import { Table, Text, clx } from "@medusajs/ui"

import { cellText } from "../sql"
import type { SqlResultResponse } from "../types"

const MAX_ROWS = 200

type Props = {
  result: SqlResultResponse
  compact?: boolean
}

export const SqlResultTable = ({ result, compact }: Props) => {
  const rows = result.rows.slice(0, compact ? 6 : MAX_ROWS)
  const alignOf = (index: number) =>
    result.columns[index]?.kind === "number" ? "text-right" : "text-left"

  const height = compact ? "h-9" : undefined

  return (
    <div className="overflow-x-auto">
      <Table>
        <Table.Header>
          <Table.Row>
            {result.columns.map((column, index) => (
              <Table.HeaderCell
                key={index}
                className={clx(alignOf(index), height)}
              >
                <Text
                  size="xsmall"
                  weight="plus"
                  className="text-ui-fg-subtle whitespace-nowrap"
                >
                  {column.name}
                </Text>
                {compact ? null : (
                  <Text
                    size="xsmall"
                    className="text-ui-fg-muted whitespace-nowrap font-mono"
                  >
                    {column.type}
                  </Text>
                )}
              </Table.HeaderCell>
            ))}
          </Table.Row>
        </Table.Header>
        <Table.Body className="border-b-0">
          {rows.map((row, rowIndex) => (
            <Table.Row key={rowIndex} className="last:border-b-0">
              {row.map((value, index) => (
                <Table.Cell
                  key={index}
                  className={clx("tabular-nums", alignOf(index), height)}
                >
                  <Text
                    size="small"
                    className={`whitespace-nowrap ${value === null ? "text-ui-fg-muted italic" : "text-ui-fg-base"}`}
                  >
                    {cellText(value, result.columns[index])}
                  </Text>
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
              ? `Showing the first ${MAX_ROWS} of ${result.rows.length} rows.`
              : `${result.rows.length} ${result.rows.length === 1 ? "row" : "rows"}.`}
            {result.truncated
              ? ` The query returned more than ${result.row_limit.toLocaleString()} rows, so the rest were left out. Add a WHERE or LIMIT to narrow it.`
              : ""}
          </Text>
        </div>
      )}
    </div>
  )
}
