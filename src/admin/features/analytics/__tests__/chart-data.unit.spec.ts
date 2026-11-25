import type { DimensionKey } from "../../../../shared/analytics/query-language"
import {
  allOf,
  needsSteps,
  metricColumn,
  needsComparison,
  needsDimension,
  needsOneDimension,
  sparkValues,
  toCalendar,
  toCartesian,
  toMatrix,
  toRankChanges,
  toRanked,
  toSlices,
  toSteps,
  toStrength,
  MIN_STRENGTH,
} from "../charts/data"
import { OTHER_COLOR, SERIES_COLORS } from "../colors"
import type { ReportColumn, ReportResult, ReportRow } from "../types"

const sales: ReportColumn = {
  key: "total_sales",
  label: "Total sales",
  kind: "metric",
  format: "money",
}
const orders: ReportColumn = {
  key: "orders",
  label: "Orders",
  kind: "metric",
  format: "number",
}

const row = (
  dimensions: Record<string, string>,
  value: number,
  previous?: number
): ReportRow => ({
  key: Object.values(dimensions).join("|"),
  dimensions,
  values: { total_sales: value, orders: 1 },
  compare: previous === undefined ? null : { total_sales: previous, orders: 1 },
})

const report = (
  dimensions: DimensionKey[],
  rows: ReportRow[],
  { compare = false }: { compare?: boolean } = {}
): ReportResult => ({
  query: {
    dataset: "sales",
    metrics: ["total_sales", "orders"],
    dimensions,
    since: "-29d",
    until: "today",
    compare: compare ? "previous_period" : "none",
    orderBy: null,
    limit: null,
    currency: null,
  },
  columns: [
    ...dimensions.map((key) => ({
      key,
      label: key,
      kind: "dimension" as const,
      format: null,
    })),
    sales,
    orders,
  ],
  rows,
  totals: {
    total_sales: rows.reduce((sum, r) => sum + (r.values.total_sales ?? 0), 0),
  },
  compare_totals: compare ? { total_sales: 1 } : null,
  range: {
    since: "2026-10-25",
    until: "2026-11-23",
    compare_since: null,
    compare_until: null,
    timezone: "UTC",
  },
  currency_code: "eur",
  unconverted_orders: 0,
  source: "rollups",
  rebuilding: false,
  filling: false,
  pending_timezone: null,
  progress: null,
  truncated: false,
})

describe("metricColumn", () => {
  it("picks the asked-for metric, or the first one", () => {
    const result = report(["day"], [])
    expect(metricColumn(result, "orders")).toBe(orders)
    expect(metricColumn(result, "nope")).toBe(sales)
    expect(metricColumn(result)).toBe(sales)
  })
})

describe("needsDimension", () => {
  it("refuses a report grouped by nothing", () => {
    expect(needsDimension(report([], [])).ok).toBe(false)
    expect(needsDimension(report(["country"], [])).ok).toBe(true)
  })
})

describe("sparkValues", () => {
  it("returns values only for a report over time", () => {
    const rows = [row({ day: "2026-11-01" }, 5), row({ day: "2026-11-02" }, 7)]
    expect(sparkValues(report(["day"], rows), sales)).toEqual([5, 7])
    expect(
      sparkValues(report(["city"], [row({ city: "Oslo" }, 5)]), sales)
    ).toEqual([])
  })
})

describe("toSlices", () => {
  const cities = (count: number) =>
    Array.from({ length: count }, (_, index) =>
      row({ city: `City ${index}` }, 100 - index)
    )

  it("keeps the biggest six and folds the rest into Other", () => {
    const slices = toSlices(report(["city"], cities(9)), sales)
    expect(slices).toHaveLength(7)
    expect(slices[0]).toEqual({
      name: "City 0",
      value: 100,
      color: SERIES_COLORS[0],
    })
    expect(slices[6]).toEqual({
      name: "Other",
      value: 94 + 93 + 92,
      color: OTHER_COLOR,
    })
  })

  it("shows a seventh row by name rather than as a one-row Other", () => {
    const slices = toSlices(report(["city"], cities(7)), sales)
    expect(slices.map((slice) => slice.name)).not.toContain("Other")
    expect(slices).toHaveLength(7)
  })

  it("drops empty slices", () => {
    const slices = toSlices(
      report(["city"], [row({ city: "A" }, 5), row({ city: "B" }, 0)]),
      sales
    )
    expect(slices.map((slice) => slice.name)).toEqual(["A"])
  })
})

describe("toCartesian", () => {
  it("draws the metric and the comparison period along one dimension", () => {
    const result = report(
      ["day"],
      [row({ day: "2026-11-01" }, 5, 4), row({ day: "2026-11-02" }, 7, 6)],
      { compare: true }
    )
    const { points, series, isTime } = toCartesian(result, sales)
    expect(isTime).toBe(true)
    expect(points).toEqual([
      { x: "2026-11-01", current: 5, previous: 4 },
      { x: "2026-11-02", current: 7, previous: 6 },
    ])
    expect(series.map((entry) => [entry.key, entry.dashed])).toEqual([
      ["current", false],
      ["previous", true],
    ])
  })

  it("turns a second dimension into series, biggest first, days in order", () => {
    const result = report(
      ["day", "sales_channel"],
      [
        row({ day: "2026-11-02", sales_channel: "Web" }, 10),
        row({ day: "2026-11-01", sales_channel: "Web" }, 10),
        row({ day: "2026-11-01", sales_channel: "POS" }, 3),
      ]
    )
    const { points, series } = toCartesian(result, sales)
    expect(series.map((entry) => entry.key)).toEqual(["Web", "POS"])
    expect(points).toEqual([
      { x: "2026-11-01", Web: 10, POS: 3 },
      { x: "2026-11-02", Web: 10, POS: 0 },
    ])
  })

  it("caps the points when asked", () => {
    const rows = ["A", "B", "C"].map((city) => row({ city }, 1))
    expect(
      toCartesian(report(["city"], rows), sales, { limit: 2 }).points
    ).toHaveLength(2)
  })
})

describe("toRanked", () => {
  it("sorts biggest first and keeps the comparison value", () => {
    const result = report(
      ["city"],
      [row({ city: "A" }, 1, 3), row({ city: "B" }, 5, 2)],
      {
        compare: true,
      }
    )
    expect(toRanked(result, sales)).toEqual([
      { key: "B", name: "B", value: 5, previous: 2 },
      { key: "A", name: "A", value: 1, previous: 3 },
    ])
  })
})

describe("allOf", () => {
  it("returns the first failing check's reason", () => {
    const fits = allOf(needsOneDimension, needsComparison)
    expect(fits(report(["city"], [], { compare: true })).ok).toBe(true)
    const fit = fits(report(["city"], []))
    expect(fit.ok).toBe(false)
    expect(fit.ok ? "" : fit.reason).toMatch(/comparison/)
  })
})

describe("toSteps", () => {
  const withTotals = (totals: Record<string, number>): ReportResult => {
    const base = report([], [])
    return {
      ...base,
      columns: Object.keys(totals).map((key) => ({
        key,
        label: key,
        kind: "metric" as const,
        format: "money" as const,
      })),
      totals,
    }
  }

  it("walks from the first metric to the last, deductions going down", () => {
    const steps = toSteps(
      withTotals({
        gross_sales: 100,
        discounts: 10,
        returns: 5,
        shipping: 8,
        total_sales: 93,
      })
    )
    expect(steps.map((step) => [step.kind, step.from, step.to])).toEqual([
      ["start", 0, 100],
      ["down", 100, 90],
      ["down", 90, 85],
      ["up", 85, 93],
      ["end", 0, 93],
    ])
    expect(steps[1].value).toBe(-10)
  })

  it("adds an Other step when the steps don't reach the end total", () => {
    const steps = toSteps(
      withTotals({ gross_sales: 100, discounts: 10, taxes: 5, total_sales: 99 })
    )
    expect(
      steps.map((step) => [step.key, step.kind, step.from, step.to])
    ).toEqual([
      ["gross_sales", "start", 0, 100],
      ["discounts", "down", 100, 90],
      ["taxes", "up", 90, 95],
      ["other", "up", 95, 99],
      ["total_sales", "end", 0, 99],
    ])
  })

  it("only fits money metrics", () => {
    expect(
      needsSteps(withTotals({ gross_sales: 1, discounts: 1, total_sales: 1 }))
        .ok
    ).toBe(true)
    const mixed = withTotals({ gross_sales: 1, discounts: 1, total_sales: 1 })
    mixed.columns[1] = { ...mixed.columns[1], format: "number" }
    expect(needsSteps(mixed).ok).toBe(false)
  })
})

describe("toMatrix", () => {
  it("shows every weekday and hour, with 0 where nothing sold", () => {
    const result = report(
      ["day_of_week", "hour_of_day"],
      [
        row({ day_of_week: "1", hour_of_day: "9" }, 4),
        row({ day_of_week: "3", hour_of_day: "14" }, 8),
      ]
    )
    const matrix = toMatrix(result, sales)
    expect(matrix.rows).toHaveLength(7)
    expect(matrix.columns).toHaveLength(24)
    expect(matrix.valueAt("1", "9")).toBe(4)
    expect(matrix.valueAt("2", "9")).toBe(0)
    expect(matrix.max).toBe(8)
  })

  it("matches zero-padded hours to the grid", () => {
    const result = report(
      ["day_of_week", "hour_of_day"],
      [row({ day_of_week: "1", hour_of_day: "09" }, 4)]
    )
    expect(toMatrix(result, sales).valueAt("1", "9")).toBe(4)
  })
})

describe("toCalendar", () => {
  it("lays the range out in Monday-first weeks, blank outside it", () => {
    // 2026-11-18 is a Wednesday, 2026-11-23 a Monday.
    const base = report(["day"], [row({ day: "2026-11-20" }, 3)])
    const result = {
      ...base,
      range: { ...base.range, since: "2026-11-18", until: "2026-11-23" },
    }
    const { weeks, max } = toCalendar(result, sales)
    expect(weeks).toHaveLength(2)
    expect(weeks[0][0]).toBeNull()
    expect(weeks[0][2]).toEqual({ day: "2026-11-18", value: 0 })
    expect(weeks[0][4]).toEqual({ day: "2026-11-20", value: 3 })
    expect(weeks[1][0]).toEqual({ day: "2026-11-23", value: 0 })
    expect(weeks[1][1]).toBeNull()
    expect(max).toBe(3)
  })
})

describe("toRankChanges", () => {
  it("ranks the top rows now, and the same rows in the earlier period", () => {
    const result = report(
      ["product"],
      [
        row({ product: "A" }, 10, 5),
        row({ product: "B" }, 8, 9),
        row({ product: "C" }, 1, 1),
      ],
      { compare: true }
    )
    expect(toRankChanges(result, sales, 2)).toEqual([
      { key: "A", name: "A", now: 1, before: 2 },
      { key: "B", name: "B", now: 2, before: 1 },
    ])
  })

  it("ranks the earlier period across every row, not just the top ones", () => {
    const result = report(
      ["product"],
      [
        row({ product: "A" }, 10, 1),
        row({ product: "B" }, 8, 9),
        row({ product: "C" }, 1, 5),
      ],
      { compare: true }
    )
    expect(toRankChanges(result, sales, 2)).toEqual([
      { key: "A", name: "A", now: 1, before: 3 },
      { key: "B", name: "B", now: 2, before: 1 },
    ])
  })
})

describe("toStrength", () => {
  it("spreads the smallest value above zero to the largest across the scale", () => {
    const strength = toStrength([0, 70, 85, 100])
    expect(strength(0)).toBe(0)
    expect(strength(70)).toBe(MIN_STRENGTH)
    expect(strength(100)).toBe(1)
    expect(strength(85)).toBeCloseTo(MIN_STRENGTH + (1 - MIN_STRENGTH) / 2)
  })

  it("draws equal values at full strength", () => {
    expect(toStrength([5, 5])(5)).toBe(1)
    expect(toStrength([])(3)).toBe(0)
  })
})
