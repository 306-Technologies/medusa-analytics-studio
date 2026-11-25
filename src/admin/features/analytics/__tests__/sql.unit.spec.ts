import {
  cellText,
  defaultChart,
  fitChart,
  fromSavedChart,
  starterSql,
  toNumber,
  toSavedChart,
} from "../sql"
import type { SqlColumn, SqlResultResponse } from "../types"

const col = (
  name: string,
  kind: SqlColumn["kind"],
  type: string = kind
): SqlColumn => ({
  name,
  kind,
  type,
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

describe("toNumber", () => {
  it("reads numbers and numeric text, nothing else", () => {
    expect(toNumber(3)).toBe(3)
    expect(toNumber("12.50")).toBe(12.5)
    expect(toNumber("9007199254740993")).toBe(9007199254740992)
    expect(toNumber("")).toBeNull()
    expect(toNumber("abc")).toBeNull()
    expect(toNumber(null)).toBeNull()
    expect(toNumber(true)).toBeNull()
  })
})

describe("defaultChart", () => {
  it("draws dates as a line with the first number column", () => {
    expect(
      defaultChart([
        col("day", "date"),
        col("reason", "text"),
        col("points", "number"),
        col("n", "number"),
      ])
    ).toEqual({ kind: "line", label: 0, values: [2] })
  })

  it("uses bars over the first text column without a date", () => {
    expect(
      defaultChart([col("reason", "text"), col("points", "number")])
    ).toEqual({
      kind: "bar",
      label: 0,
      values: [1],
    })
  })

  it("falls back to a table without number columns", () => {
    expect(defaultChart([col("name", "text")]).kind).toBe("table")
  })
})

describe("fitChart", () => {
  it("keeps settings that still fit", () => {
    const columns = [col("day", "date"), col("a", "number"), col("b", "number")]
    expect(fitChart({ kind: "bar", label: 0, values: [2] }, columns)).toEqual({
      kind: "bar",
      label: 0,
      values: [2],
    })
  })

  it("starts over when no chosen value column is left", () => {
    const columns = [col("day", "date"), col("a", "number")]
    expect(fitChart({ kind: "bar", label: 0, values: [3] }, columns)).toEqual(
      defaultChart(columns)
    )
  })
})

describe("cellText", () => {
  it("formats numbers, keeps huge exact ones, prints null and JSON", () => {
    expect(cellText(1234.5, col("n", "number"))).toBe(
      new Intl.NumberFormat().format(1234.5)
    )
    expect(cellText("9007199254740993123", col("n", "number"))).toBe(
      "9007199254740993123"
    )
    expect(cellText(null)).toBe("null")
    expect(cellText({ a: [1] })).toBe('{"a":[1]}')
    expect(cellText("2026-11-22", col("d", "date"))).toBe("2026-11-22")
  })
})

describe("starterSql", () => {
  it("selects from the view", () => {
    expect(starterSql("loyalty_points_daily")).toBe(
      "select *\nfrom reporting.loyalty_points_daily\nlimit 100"
    )
  })
})

describe("toSavedChart / fromSavedChart", () => {
  it("round-trips chart settings through a saved report", () => {
    const settings = { kind: "bar" as const, label: 1, values: [2, 3] }
    const saved = toSavedChart(settings)
    expect(saved).toEqual({
      visualization: "bar",
      chart: { label: 1, values: [2, 3] },
    })
    expect(fromSavedChart(saved.visualization, saved.chart)).toEqual(settings)
  })

  it("restores any chart, and nothing without columns", () => {
    expect(fromSavedChart("line", null)).toBeNull()
    expect(fromSavedChart("donut", { label: 0, values: [1] })).toEqual({
      kind: "donut",
      label: 0,
      values: [1],
    })
  })
})
