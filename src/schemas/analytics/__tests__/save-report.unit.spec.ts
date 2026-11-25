import { VISUALIZATION_KEYS } from "../../../shared/analytics/types"
import { SaveDashboardSchema, SaveReportSchema } from ".."

const base = { name: "Points", visualization: "line", query: "select 1" }

describe("SaveReportSchema", () => {
  it("defaults to a query-language report with no chart", () => {
    const parsed = SaveReportSchema.parse({
      ...base,
      query: "FROM sales SHOW orders",
    })
    expect(parsed.kind).toBe("query")
    expect(parsed.chart).toBeNull()
  })

  it("accepts a SQL report with its chart columns", () => {
    const parsed = SaveReportSchema.parse({
      ...base,
      kind: "sql",
      chart: { label: 0, values: [1, 2] },
    })
    expect(parsed.chart).toEqual({ label: 0, values: [1, 2] })
  })

  it("needs chart columns for a SQL report", () => {
    expect(SaveReportSchema.safeParse({ ...base, kind: "sql" }).success).toBe(
      false
    )
  })

  it("lets SQL reports use any report chart, but no unknown one", () => {
    const sql = { ...base, kind: "sql", chart: { label: 0, values: [1] } }
    expect(
      SaveReportSchema.safeParse({ ...sql, visualization: "donut" }).success
    ).toBe(true)
    expect(
      SaveReportSchema.safeParse({ ...sql, visualization: "pie" }).success
    ).toBe(false)
  })

  it("keeps query-language reports to 2,000 characters but lets SQL be longer", () => {
    const long = `select 1 ${"-".repeat(3000)}`
    expect(SaveReportSchema.safeParse({ ...base, query: long }).success).toBe(
      false
    )
    expect(
      SaveReportSchema.safeParse({
        ...base,
        kind: "sql",
        query: long,
        chart: { label: null, values: [0] },
      }).success
    ).toBe(true)
  })

  it("accepts every chart id and refuses unknown ones", () => {
    for (const visualization of VISUALIZATION_KEYS) {
      expect(
        SaveReportSchema.safeParse({ ...base, visualization }).success
      ).toBe(true)
    }
    for (const visualization of ["constructor", "pie", ""]) {
      expect(
        SaveReportSchema.safeParse({ ...base, visualization }).success
      ).toBe(false)
    }
  })

  it("refuses bad chart columns", () => {
    for (const chart of [
      { label: -1, values: [0] },
      { label: 0, values: [] },
      { label: 0, values: [1.5] },
    ]) {
      expect(
        SaveReportSchema.safeParse({ ...base, kind: "sql", chart }).success
      ).toBe(false)
    }
  })
})

describe("SaveDashboardSchema", () => {
  it("applies the same rules to each widget", () => {
    const widget = { id: "w1", title: "Points", span: 2, ...base }
    expect(
      SaveDashboardSchema.safeParse({
        widgets: [{ ...widget, kind: "sql", chart: { label: 0, values: [1] } }],
      }).success
    ).toBe(true)
    expect(
      SaveDashboardSchema.safeParse({ widgets: [{ ...widget, kind: "sql" }] })
        .success
    ).toBe(false)
  })
})
