import { sqlReportResult } from "../sql-report"
import type { SqlColumn, SqlResultResponse } from "../types"

const col = (name: string, kind: SqlColumn["kind"]): SqlColumn => ({
  name,
  kind,
  type: kind,
})

const result = (
  columns: SqlColumn[],
  rows: SqlResultResponse["rows"]
): SqlResultResponse => ({
  columns,
  rows,
  row_limit: 5000,
  truncated: false,
  ms: 1,
  ran_at: "2026-11-22T00:00:00.000Z",
})

describe("sqlReportResult", () => {
  it("treats a date column as days, adds up repeats and sorts by date", () => {
    const report = sqlReportResult(
      result(
        [col("day", "date"), col("channel", "text"), col("sales", "number")],
        [
          ["2026-11-22", "web", "10"],
          ["2026-11-21", "web", 5],
          ["2026-11-22", "pos", 2.5],
        ]
      ),
      { kind: "line", label: 0, values: [2] }
    )
    expect(report.query.dimensions).toEqual(["day"])
    expect(report.rows.map((row) => [row.key, row.values.c2])).toEqual([
      ["2026-11-21", 5],
      ["2026-11-22", 12.5],
    ])
    expect(report.totals).toEqual({ c2: 17.5 })
    expect(report.range).toMatchObject({
      since: "2026-11-21",
      until: "2026-11-22",
    })
    expect(
      report.columns.find((column) => column.kind === "metric")
    ).toMatchObject({
      key: "c2",
      label: "sales",
    })
  })

  it("keeps the query's order for text labels", () => {
    const report = sqlReportResult(
      result(
        [col("reason", "text"), col("n", "number")],
        [
          ["late", 3],
          ["damaged", 1],
          ["late", 2],
        ]
      ),
      { kind: "bar", label: 0, values: [1] }
    )
    expect(report.query.dimensions).toEqual(["city"])
    expect(report.rows.map((row) => [row.key, row.values.c1])).toEqual([
      ["late", 5],
      ["damaged", 1],
    ])
  })

  it("numbers the rows when nothing is along the bottom", () => {
    const report = sqlReportResult(result([col("n", "number")], [[4], [6]]), {
      kind: "bar",
      label: null,
      values: [0],
    })
    expect(report.rows.map((row) => row.key)).toEqual(["1", "2"])
  })

  it("treats timestamps that aren't days as categories", () => {
    const report = sqlReportResult(
      result([col("at", "date"), col("n", "number")], [["11:30", 1]]),
      { kind: "line", label: 0, values: [1] }
    )
    expect(report.query.dimensions).toEqual(["city"])
  })
})
