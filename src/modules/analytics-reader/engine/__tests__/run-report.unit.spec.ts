import { MedusaError } from "@medusajs/framework/utils"

import {
  parseQuery,
  type ReportQuery,
} from "../../../../shared/analytics/query-language"
import type { SqlBinding, SqlRunner } from "../sql-runner"
import { cacheVersion } from "../plan"
import {
  type Bounds,
  MAX_GROUPED_ROWS,
  MAX_SERIES_POINTS,
  runReport,
} from "../run-report"

type Call = { sql: string; bindings: SqlBinding[] }

const query = (text: string): ReportQuery => {
  const parsed = parseQuery(text)
  if (!parsed.ok) {
    throw new Error(parsed.error)
  }
  return parsed.query
}

const bounds = (since: string, until: string, compare = false): Bounds => ({
  from_ts: new Date(`${since}T00:00:00Z`),
  to_ts: new Date(`${until}T00:00:00Z`),
  since_day: since,
  until_day: until,
  cmp_from_ts: compare ? new Date("2026-01-01T00:00:00Z") : null,
  cmp_to_ts: compare ? new Date("2026-02-01T00:00:00Z") : null,
  cmp_since_day: compare ? "2026-01-01" : null,
  cmp_until_day: compare ? "2026-01-31" : null,
})

const fakeDb = (grouped: (call: Call) => Record<string, unknown>[]) => {
  const calls: Call[] = []
  const pg: SqlRunner = {
    raw: async (sql, bindings) => {
      const call = { sql, bindings }
      calls.push(call)
      return /group by/i.test(sql)
        ? { rows: grouped(call) }
        : { rows: [{ m0: 1 }] }
    },
  }
  return { pg, calls }
}

const groupedCalls = (calls: Call[]) =>
  calls.filter((call) => /group by/i.test(call.sql))

describe("runReport", () => {
  it("sorts and limits grouped rows in SQL", async () => {
    const { pg, calls } = fakeDb(() => [
      { d0: "DE", m0: 30 },
      { d0: "FR", m0: 20 },
    ])

    const result = await runReport(
      pg,
      query(
        "FROM sales SHOW total_sales GROUP BY country SINCE -29d UNTIL today ORDER BY total_sales DESC LIMIT 2"
      ),
      "eur",
      "UTC",
      true,
      bounds("2026-02-01", "2026-03-02")
    )

    const [grouped] = groupedCalls(calls)
    expect(grouped.sql).toMatch(
      /order by g\.m0 desc, g\.d0 collate "C"\s+limit \?/
    )
    expect(grouped.bindings[grouped.bindings.length - 1]).toBe(2)
    expect(result.rows.map((row) => row.key)).toEqual(["DE", "FR"])
    expect(result.truncated).toBe(false)
  })

  it("reads the comparison window only for the rows kept", async () => {
    const { pg, calls } = fakeDb((call) =>
      call.sql.includes("join (values")
        ? [{ d0: "DE", m0: 5 }]
        : [
            { d0: "DE", m0: 30 },
            { d0: "FR", m0: 20 },
          ]
    )

    const result = await runReport(
      pg,
      query(
        "FROM sales SHOW total_sales GROUP BY country SINCE -29d UNTIL today COMPARE TO previous_period LIMIT 2"
      ),
      "eur",
      "UTC",
      true,
      bounds("2026-02-01", "2026-03-02", true)
    )

    const compare = groupedCalls(calls).find((call) =>
      call.sql.includes("join (values")
    )
    expect(compare?.sql).toMatch(
      /join \(values \(\?\), \(\?\)\) k\(k0\) on g\.d0 = k\.k0/
    )
    expect(compare?.bindings).toEqual(expect.arrayContaining(["DE", "FR"]))
    expect(
      result.rows.find((row) => row.key === "DE")?.compare?.total_sales
    ).toBe(5)
    expect(
      result.rows.find((row) => row.key === "FR")?.compare?.total_sales
    ).toBe(0)
  })

  it("orders ties the same way SQL does, by code point", async () => {
    // SQL returned these in COLLATE "C" order; ICU would put "New York" first.
    const { pg } = fakeDb(() => [
      { d0: "New York", m0: 1 },
      { d0: "Newark", m0: 1 },
      { d0: "new haven", m0: 1 },
    ])

    const result = await runReport(
      pg,
      query(
        "FROM sales SHOW orders GROUP BY city SINCE -29d UNTIL today ORDER BY orders DESC LIMIT 3"
      ),
      "eur",
      "UTC",
      true,
      bounds("2026-02-01", "2026-03-02")
    )

    expect(result.rows.map((row) => row.key)).toEqual([
      "New York",
      "Newark",
      "new haven",
    ])
  })

  it("caps a report without LIMIT and says so", async () => {
    const { pg } = fakeDb(() =>
      Array.from({ length: MAX_GROUPED_ROWS + 1 }, (_, index) => ({
        d0: `city ${String(index).padStart(5, "0")}`,
        m0: MAX_GROUPED_ROWS + 1 - index,
      }))
    )

    const result = await runReport(
      pg,
      query("FROM sales SHOW total_sales GROUP BY city SINCE -29d UNTIL today"),
      "eur",
      "UTC",
      true,
      bounds("2026-02-01", "2026-03-02")
    )

    expect(result.truncated).toBe(true)
    expect(result.rows).toHaveLength(MAX_GROUPED_ROWS)
  })

  it("reads a time series whole, without an outer LIMIT", async () => {
    const { pg, calls } = fakeDb(() => [{ d0: "2026-02-02", m0: 4 }])

    const result = await runReport(
      pg,
      query("FROM sales SHOW orders GROUP BY day SINCE -6d UNTIL today"),
      "eur",
      "UTC",
      true,
      bounds("2026-02-01", "2026-02-07")
    )

    expect(groupedCalls(calls)[0].sql).not.toMatch(/limit \?/)
    expect(result.rows).toHaveLength(7)
  })

  it("refuses a daily series longer than the cap before querying", async () => {
    const { pg, calls } = fakeDb(() => [])

    const run = runReport(
      pg,
      query("FROM sales SHOW orders GROUP BY day SINCE 2020-01-01 UNTIL today"),
      "eur",
      "UTC",
      true,
      bounds("2020-01-01", "2026-03-02")
    )

    await expect(run).rejects.toMatchObject({
      type: MedusaError.Types.INVALID_DATA,
      message: expect.stringContaining(
        `more than ${MAX_SERIES_POINTS.toLocaleString("en")} points`
      ),
    })
    expect(calls).toHaveLength(0)
  })
})

describe("cacheVersion", () => {
  const versionDb = (version: number) => {
    const calls: Call[] = []
    const pg: SqlRunner = {
      raw: async (sql, bindings) => {
        calls.push({ sql, bindings })
        return { rows: [{ version }] }
      },
    }
    return { pg, calls }
  }

  it("uses the newest version over every range once the facts are ready", async () => {
    const { pg, calls } = versionDb(42)

    const version = await cacheVersion(pg, { ready: true, dataVersion: 99 }, [
      { since: "2026-02-01", until: "2026-03-02" },
      { since: "2026-01-01", until: "2026-01-31" },
    ])

    expect(version).toBe("d42")
    expect(calls[0].sql).toMatch(
      /local_day between \? and \? or local_day between \? and \?/
    )
    expect(calls[0].bindings).toEqual([
      "2026-02-01",
      "2026-03-02",
      "2026-01-01",
      "2026-01-31",
    ])
  })

  it("uses the global version while rebuilding, without a query", async () => {
    const { pg, calls } = versionDb(42)

    const version = await cacheVersion(pg, { ready: false, dataVersion: 99 }, [
      { since: "2026-02-01", until: "2026-03-02" },
    ])

    expect(version).toBe("g99")
    expect(calls).toHaveLength(0)
  })
})

describe("runReport failures", () => {
  it("rejects once, with no unhandled rejection, when both windows fail", async () => {
    const unhandled = jest.fn()
    process.on("unhandledRejection", unhandled)
    let totalsCalls = 0
    const pg: SqlRunner = {
      raw: async (sql) => {
        if (/count\(\*\) as n/.test(sql)) {
          return { rows: [{ n: 0 }] }
        }
        if (/group by/i.test(sql)) {
          throw new Error("current grouped timed out")
        }
        totalsCalls += 1
        if (totalsCalls === 2) {
          await new Promise((resolve) => setTimeout(resolve, 20))
          throw new Error("compare totals timed out")
        }
        return { rows: [{ m0: 1 }] }
      },
    }

    try {
      await expect(
        runReport(
          pg,
          query(
            "FROM sales SHOW total_sales GROUP BY country SINCE -29d UNTIL today COMPARE TO previous_period LIMIT 5"
          ),
          "eur",
          "UTC",
          true,
          bounds("2026-02-01", "2026-03-02", true)
        )
      ).rejects.toThrow("current grouped timed out")
      await new Promise((resolve) => setTimeout(resolve, 50))
      expect(totalsCalls).toBe(2)
      expect(unhandled).not.toHaveBeenCalled()
    } finally {
      process.off("unhandledRejection", unhandled)
    }
  })
})
