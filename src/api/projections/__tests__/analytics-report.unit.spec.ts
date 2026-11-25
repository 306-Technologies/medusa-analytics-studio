import { toReportKind, toSqlChartColumns } from "../analytics-report"
import { toSavedWidgets } from "../analytics-dashboard"

describe("toReportKind", () => {
  it("reads sql, and treats anything else as the query language", () => {
    expect(toReportKind("sql")).toBe("sql")
    expect(toReportKind("query")).toBe("query")
    expect(toReportKind(undefined)).toBe("query")
    expect(toReportKind("other")).toBe("query")
  })
})

describe("toSqlChartColumns", () => {
  it("reads stored columns and drops what doesn't fit", () => {
    expect(toSqlChartColumns({ label: 0, values: [1, 2] })).toEqual({
      label: 0,
      values: [1, 2],
    })
    expect(toSqlChartColumns({ label: "x", values: [1] })).toEqual({
      label: null,
      values: [1],
    })
    expect(toSqlChartColumns({ label: 0, values: ["1"] })).toBeNull()
    expect(toSqlChartColumns(null)).toBeNull()
    expect(toSqlChartColumns("nope")).toBeNull()
  })
})

describe("toSavedWidgets", () => {
  it("reads old widgets (no kind) as query-language widgets", () => {
    const widgets = toSavedWidgets({
      id: "andash_1",
      user_id: "user_1",
      layout: {
        widgets: [
          {
            id: "a",
            title: "Old",
            query: "FROM sales SHOW orders",
            visualization: "stat",
            span: 1,
          },
          {
            id: "b",
            title: "SQL",
            kind: "sql",
            query: "select 1",
            visualization: "bar",
            chart: { label: null, values: [0] },
            span: 2,
          },
        ],
      },
      created_at: new Date(),
      updated_at: new Date(),
      deleted_at: null,
    })
    expect(widgets?.map((w) => [w.kind, w.chart])).toEqual([
      ["query", null],
      ["sql", { label: null, values: [0] }],
    ])
  })
})
